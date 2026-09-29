// Phase 2: wallet ownership.
// - Sign-in with Ethereum: the player signs a free message (no transaction). The server checks the signature (plain
//   wallets and smart wallets, EIP-1271 / 6492) and sets an HttpOnly session cookie with the address.
// - Ownership: ownerOf(tokenId) read live from the collection's contract (Alchemy RPC).
// - Forge allowance: each Rebel gets FORGE_TOKEN_LIMIT forges (default 3). Starting a forge opens a 24 h forge
//   window for that Rebel and that wallet; the paid Forge steps (images, 3D, rig) only run inside an open window.
import crypto from 'crypto';
import { createPublicClient, http, getAddress, recoverMessageAddress } from 'viem';
import { mainnet } from 'viem/chains';
import { readCookie, isAdminRequest } from './_admin-auth.mjs';
import { getCollection, ALCHEMY_NETWORK } from './_collections.mjs';

export const WALLET_COOKIE = 'ra_wallet';
const SESSION_TTL = 60 * 60 * 24 * 7;              // 7 days
export const FORGE_LIMIT = Math.max(1, parseInt(process.env.FORGE_TOKEN_LIMIT || '3', 10));           // per Rebel, per owner
// a sale gives the new owner fresh forges; these caps stop wallet-to-wallet transfers from farming them
export const TOKEN_LIFETIME = Math.max(FORGE_LIMIT, parseInt(process.env.FORGE_TOKEN_LIFETIME || '12', 10));  // per Rebel, all owners
export const WALLET_DAILY = Math.max(1, parseInt(process.env.FORGE_WALLET_DAILY || '6', 10));              // forge starts per wallet per day
export const WINDOW_TTL = 60 * 60 * 24;            // an open forge lasts a day
// per open forge: how many of each paid step may run (a forge = 1 concept + repaints, 3 sculpts, rig + fallbacks)
export const STEP_MAX = { concept: 8, production: 8, back: 8, side: 16, upload: 60, build: 5, meshy: 5, store: 12, rig: 6 };

function secret() {
  const s = process.env.WALLET_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error('Missing WALLET_SESSION_SECRET');
  return s;
}
const sign = (b64) => crypto.createHmac('sha256', 'wallet:' + secret()).update(b64).digest('base64url');
function safeEqual(a, b) { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length === y.length && crypto.timingSafeEqual(x, y); }

export function isAddr(v) { return /^0x[0-9a-fA-F]{40}$/.test(String(v || '')); }

export function walletSessionCookie(address) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = Buffer.from(JSON.stringify({ a: String(address).toLowerCase(), iat: now, exp: now + SESSION_TTL })).toString('base64url');
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${WALLET_COOKIE}=${encodeURIComponent(b64 + '.' + sign(b64))}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL}${secure}`;
}
export function clearWalletCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${WALLET_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
// the signed-in wallet (lowercase) or null
export function walletOf(req) {
  const raw = readCookie(req, WALLET_COOKIE);
  if (!raw) return null;
  const [b64, sig] = raw.split('.');
  if (!b64 || !sig || !safeEqual(sig, sign(b64))) return null;
  try {
    const p = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    return isAddr(p.a) && p.exp > Math.floor(Date.now() / 1000) ? p.a : null;
  } catch (e) { return null; }
}

// ---- redis ----
function redisCfg() {
  return { url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '', token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '' };
}
export async function redis(commands) {
  const { url, token } = redisCfg();
  if (!url || !token) throw new Error('Redis is not configured');
  const r = await fetch(`${url}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(commands) });
  const d = await r.json();
  if (!r.ok) throw new Error(d?.error || `Redis ${r.status}`);
  return Array.isArray(d) ? d : [];
}

// ---- chain ----
const alchemyUrl = (chain) => `https://${ALCHEMY_NETWORK[chain] || 'eth-mainnet'}.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`;
let mainClient = null;
function client() { return mainClient || (mainClient = createPublicClient({ chain: mainnet, transport: http(alchemyUrl('ethereum')) })); }

// EIP-4361 message check + signature check (EOA, EIP-1271 and EIP-6492 smart wallets)
export async function verifySignIn({ message, signature, host }) {
  const m = String(message || '');
  const addr = (m.match(/^0x[0-9a-fA-F]{40}$/m) || [])[0];
  const domain = m.split(' wants you to sign in')[0];
  const nonce = (m.match(/^Nonce: ([A-Za-z0-9]{8,64})$/m) || [])[1];
  const issued = (m.match(/^Issued At: (.+)$/m) || [])[1];
  if (!addr || !nonce || !issued) throw Object.assign(new Error('Not a sign-in message'), { status: 400 });
  if (host && domain !== host) throw Object.assign(new Error('Sign-in message is for another site'), { status: 400 });
  const age = Date.now() - Date.parse(issued);
  if (!(age > -120000 && age < 10 * 60000)) throw Object.assign(new Error('Sign-in message expired, try again'), { status: 400 });
  const [del] = await redis([['DEL', `wallet:nonce:v1:${nonce}`]]);
  if (Number(del?.result || 0) !== 1) throw Object.assign(new Error('Sign-in expired, try again'), { status: 400 });
  // a plain wallet: recover the signer locally; otherwise ask the chain (smart wallets: EIP-1271 / EIP-6492)
  let ok = false;
  try { ok = (await recoverMessageAddress({ message: m, signature })).toLowerCase() === addr.toLowerCase(); } catch (e) {}
  if (!ok) ok = await client().verifyMessage({ address: getAddress(addr), message: m, signature }).catch(() => false);
  if (!ok) throw Object.assign(new Error('Signature does not match this wallet'), { status: 401 });
  return addr.toLowerCase();
}
export async function newNonce() {
  const n = crypto.randomBytes(12).toString('hex');
  await redis([['SET', `wallet:nonce:v1:${n}`, '1', 'EX', 600]]);
  return n;
}

// owner, cached 2 minutes (the paid steps re-check it, so a Rebel sold mid-forge stops forging for the seller)
export async function ownerOfCached(collectionKey, tokenId) {
  const k = `forge:owner:v1:${collectionKey}:${tokenId}`;
  try { const [c] = await redis([['GET', k]]); if (c?.result) return c.result; } catch (e) {}
  const o = await ownerOf(collectionKey, tokenId);
  if (o) { try { await redis([['SET', k, o, 'EX', 120]]); } catch (e) {} }
  return o;
}
// live owner of an ERC-721 token (lowercase) or null
export async function ownerOf(collectionKey, tokenId) {
  const col = await getCollection(collectionKey || 'battle_for_colony');
  if (!col || !/^\d{1,78}$/.test(String(tokenId || ''))) return null;
  const data = '0x6352211e' + BigInt(tokenId).toString(16).padStart(64, '0');
  const r = await fetch(alchemyUrl(col.chain), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: col.contract, data }, 'latest'] }) });
  const j = await r.json().catch(() => ({}));
  const out = String(j?.result || '');
  if (!/^0x[0-9a-fA-F]{64}$/.test(out)) return null;
  return ('0x' + out.slice(26)).toLowerCase();
}

// ---- forge allowance ----
// used = forges this owner started on this Rebel (a new owner starts at 0); life = all owners together
const qKey = (c, t, w) => `forge:quota:v2:${c}:${t}:${w}`;
const lKey = (c, t) => `forge:quota-life:v1:${c}:${t}`;
const dKey = (w) => `forge:wallet-day:v1:${w}:${new Date().toISOString().slice(0, 10)}`;
const oKey = (c, t) => `forge:open:v1:${c}:${t}`;
const uKey = (c, t) => `forge:open-uses:v1:${c}:${t}`;
export async function forgeStatus(collectionKey, tokenId, owner) {
  const [q, l, o] = await redis([['GET', owner ? qKey(collectionKey, tokenId, owner) : 'forge:none'], ['GET', lKey(collectionKey, tokenId)], ['GET', oKey(collectionKey, tokenId)]]);
  const used = Number(q?.result || 0), life = Number(l?.result || 0);
  let open = null; try { open = o?.result ? JSON.parse(o.result) : null; } catch (e) {}
  const left = Math.max(0, Math.min(FORGE_LIMIT - used, TOKEN_LIFETIME - life));
  return { used, limit: FORGE_LIMIT, left, lifetimeUsed: life, lifetimeLimit: TOKEN_LIFETIME, open };
}
export async function openForge(collectionKey, tokenId, wallet) {
  const st = await forgeStatus(collectionKey, tokenId, wallet);
  if (st.left <= 0) return { ok: false, reason: st.used >= FORGE_LIMIT ? 'owner' : 'lifetime', ...st };
  const [d] = await redis([['INCR', dKey(wallet)], ['EXPIRE', dKey(wallet), 172800]]);
  if (Number(d?.result || 0) > WALLET_DAILY) return { ok: false, reason: 'daily', ...st };
  const open = { wallet, startedAt: new Date().toISOString(), n: st.used + 1 };
  const [inc] = await redis([['INCR', qKey(collectionKey, tokenId, wallet)], ['INCR', lKey(collectionKey, tokenId)], ['SET', oKey(collectionKey, tokenId), JSON.stringify(open), 'EX', WINDOW_TTL], ['DEL', uKey(collectionKey, tokenId)]]);
  const used = Number(inc?.result || st.used + 1);
  return { ok: true, used, limit: FORGE_LIMIT, left: Math.max(0, Math.min(FORGE_LIMIT - used, TOKEN_LIFETIME - st.lifetimeUsed - 1)), open };
}
// admin: the current owner gets all forges back (the Rebel's lifetime count too)
export async function resetForges(collectionKey, tokenId, owner) {
  await redis([...(owner ? [['DEL', qKey(collectionKey, tokenId, owner)]] : []), ['DEL', lKey(collectionKey, tokenId)], ['DEL', oKey(collectionKey, tokenId)], ['DEL', uKey(collectionKey, tokenId)]]);
}

// Gate for a paid Forge step. Admins pass. Everyone else needs: signed-in wallet + an open forge for this Rebel started by
// that wallet + the step still under its per-forge maximum. Sends the error and returns false when blocked.
export async function requireForgeStep(req, res, { collectionKey, tokenId, step }) {
  if (isAdminRequest(req)) return true;
  const c = String(collectionKey || 'battle_for_colony'), t = String(tokenId || '');
  const deny = (status, error, code) => { res.status(status).json({ ok: false, error, code }); return false; };
  const wallet = walletOf(req);
  if (!wallet) return deny(401, 'Sign in with your wallet to forge', 'wallet_required');
  if (!/^\d{1,78}$/.test(t)) return deny(400, 'Missing Rebel token', 'bad_token');
  try {
    const [o] = await redis([['GET', oKey(c, t)]]);
    let open = null; try { open = o?.result ? JSON.parse(o.result) : null; } catch (e) {}
    if (!open) return deny(403, 'Start a forge for this Rebel first', 'no_open_forge');
    if (open.wallet !== wallet) return deny(403, 'This forge was started by another wallet', 'not_your_forge');
    const owner = await ownerOfCached(c, t);
    if (owner && owner !== wallet) return deny(403, 'This Rebel is now held by another wallet', 'not_owner');
    const [n] = await redis([['HINCRBY', uKey(c, t), step, 1], ['EXPIRE', uKey(c, t), WINDOW_TTL]]);
    if (Number(n?.result || 0) > (STEP_MAX[step] || 5)) return deny(429, 'This forge has used all of its tries for this step', 'step_limit');
    return true;
  } catch (e) {
    return deny(503, 'The forge could not check your wallet, try again', 'check_failed');
  }
}
