// GET /api/mp-ticket?village=<id>&col=<collection>&tok=<token>&gk=<guest key>  -> { ok, ticket, url, site, exp, you: { name, kind } }
// GET /api/mp-ticket?key=1                                     -> { ok, site, key, admin }
// A ticket into the multiplayer rooms (realtime/: a Cloudflare Worker). The ticket = base64url(JSON) + '.' + base64url(an
// Ed25519 signature); the key is worked out from VILLAGE_SESSION_SECRET and the site (prod / dev), so there is nothing new
// to set up and a dev ticket never opens a production room. The room server holds only the public key (?key=1: key; admin
// = the public key of the admin key api/mp-admin.mjs signs the Admin Hub's commands with, worked out apart from it).
// Who: a signed-in player (ra_econ: Discord or name + PIN) by their Rebel Economy account, else a guest: an id worked out
// from the tab's guest key (gk: random, kept in the tab by assets/village-multiplayer.js), so the page's next ticket (a
// reconnect, a reload) is the same player and the room lets go of the old socket (one socket per account) instead of
// showing it as another Rebel; a page that sends none gets a new id each time.
// What they look like: the Forge character of the Rebel they play (col + tok), as the server finds it: the wallet's own
// forged character when the signed-in wallet holds that NFT, else its public character (the showcase / Free to play),
// else the starter ant. Never a URL from the browser: nobody can show up as a character they don't have.
import crypto from 'node:crypto';
import { enforceRateLimit, clientIp } from './_guard.mjs';
import { econSessionOf, isNameSession } from './_econ.mjs';
import { walletOf, holderOf, redis } from './_wallet.mjs';

const TTL = 120;
const ROOM_SERVERS = { prod: 'wss://rebel-universe-rooms.miguel-a-concepcion.workers.dev', dev: 'wss://rebel-universe-rooms-dev.miguel-a-concepcion.workers.dev' }; // the deployed realtime/ workers (MP_ROOMS_URL wins)
const VILLAGES = new Set(['hub', 'ronin', 'samurai', 'shogun', 'bushi', 'buke', 'ashigaru', 'kenshi', 'yamabushi', 'sohei', 'wokou', 'warrior', 'cute-creepy', 'chumpz', 'saints-la']);
const FRIEND_KITS = { chumpz: 'chz_ape_racer' }; // an unforged friend NFT plays this kit character (village.html FRIEND_KIT_STANDIN)
const STORE = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/[A-Za-z0-9._~%\/-]{1,400}\.glb$/;
const GUEST_KEY = /^[A-Za-z0-9_-]{22,43}$/;
const guestSub = gk => 'g:' + (GUEST_KEY.test(gk) ? crypto.createHash('sha256').update('rebel-universe:guest:v1:' + gk).digest('base64url').slice(0, 16) : crypto.randomBytes(12).toString('base64url'));

export const siteOf = () => (process.env.VERCEL_ENV === 'production' ? 'prod' : 'dev');
// the room server's address for this site: wss for the players, https for api/mp-admin.mjs (MP_ROOMS_URL wins: tests)
export function roomsUrl(site = siteOf()) {
  const url = String(process.env.MP_ROOMS_URL || ROOM_SERVERS[site] || '');
  return /^wss:\/\/[a-z0-9.-]+(:\d+)?$/.test(url) || (site === 'dev' && /^ws:\/\/127\.0\.0\.1:\d+$/.test(url)) ? url : '';
}
const keyCache = new Map();
function edKey(purpose, site) {
  const secret = String(process.env.VILLAGE_SESSION_SECRET || '');
  if (secret.length < 16) throw Object.assign(new Error('Multiplayer is not set up yet'), { status: 503 });
  const c = keyCache.get(purpose + ':' + site);
  if (c && c.secret === secret) return c;
  const seed = crypto.createHmac('sha256', `rebel-universe:${purpose}:v1:${site}`).update(secret).digest();
  const priv = crypto.createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]), format: 'der', type: 'pkcs8' });
  const pub = crypto.createPublicKey(priv).export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64url');
  const k = { site, secret, priv, pub }; keyCache.set(purpose + ':' + site, k); return k;
}
export const ticketKey = (site = siteOf()) => edKey('mp-ticket', site);
export const adminKey = (site = siteOf()) => edKey('mp-admin', site);
export function signTicket(payload, site = siteOf()) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${crypto.sign(null, Buffer.from(body), ticketKey(site).priv).toString('base64url')}`;
}
const parse = raw => { try { return raw ? JSON.parse(raw) : null; } catch (e) { return null; } };
const rigOf = r => { const u = r && (r.forgeRigGlbUrl || r.characterBundle?.forgeRigGlbUrl); return typeof u === 'string' && STORE.test(u) ? u : null; };
const matches = (r, col, tok) => r && r.collectionKey === col && String(r.tokenId) === tok && !r.appearanceSource;
// what the player looks like to the others (see the top)
export async function lookOf(req, col, tok) {
  if (!col || !tok) return { t: 'starter' };
  const wallet = walletOf(req), keys = [`forge:active-character:v1:local_testing_wallet:${col}:${tok}`];
  if (wallet) keys.push(`forge:active-character:v1:${wallet}:${col}:${tok}`);
  let rows = [];
  try { const out = await redis([['MGET', ...keys]]); rows = Array.isArray(out?.[0]?.result) ? out[0].result : []; } catch (e) { rows = []; }
  const pub = parse(rows[0]), own = parse(rows[1]);
  if (own && matches(own, col, tok) && own.walletAddress === wallet && rigOf(own)) {
    try { if ((await holderOf(col, tok, wallet)).holder) return { t: 'rig', url: rigOf(own), col, tok }; } catch (e) {}
  }
  if (pub && matches(pub, col, tok) && !pub.walletAddress && rigOf(pub)) return { t: 'rig', url: rigOf(pub), col, tok };
  return FRIEND_KITS[col] ? { t: 'kit', type: FRIEND_KITS[col], col, tok } : { t: 'starter', col, tok };
}
function avatarOf(s) {
  if (isNameSession(s) || !/^\d{5,24}$/.test(String(s.d))) return '';
  if (s.a && /^(a_)?[0-9a-f]{32}$/.test(s.a)) return `https://cdn.discordapp.com/avatars/${s.d}/${s.a}.png?size=64`;
  return `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(s.d) >> 22n) % 6n)}.png`;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'Method not allowed' }); }
  const q = req.query || {}, site = siteOf();
  try {
    if (q.key) return res.status(200).json({ ok: true, site, key: ticketKey(site).pub, admin: adminKey(site).pub });
    const url = roomsUrl(site);
    if (!url) return res.status(503).json({ ok: false, error: 'The rooms are not switched on yet' });
    const village = String(q.village || ''), col = String(q.col || ''), tok = String(q.tok || '');
    if (!VILLAGES.has(village) || (col && !/^[a-z0-9_]{1,64}$/.test(col)) || (tok && !/^(0|[1-9][0-9]{0,77})$/.test(tok))) return res.status(400).json({ ok: false, error: 'Bad request' });
    const s = econSessionOf(req);
    if (!(await enforceRateLimit(req, res, `mp-ticket-ip:${clientIp(req)}`, 90, 600, 'room tickets'))) return;
    if (s && !(await enforceRateLimit(req, res, `mp-ticket:${s.u}`, 240, 3600, 'room tickets'))) return;
    const now = Math.floor(Date.now() / 1000), look = await lookOf(req, col, tok);
    const who = s ? { sub: 'u:' + s.u, n: String(s.n || s.un || 'Rebel').slice(0, 40), k: isNameSession(s) ? 'name' : 'discord', av: avatarOf(s) }
      : { sub: guestSub(String(q.gk || '')), n: 'Guest', k: 'guest', av: '' };
    const payload = { v: 1, site, ...who, look, village, iat: now, exp: now + TTL };
    return res.status(200).json({ ok: true, ticket: signTicket(payload, site), url, site, exp: payload.exp, you: { name: who.n, kind: who.k } });
  } catch (e) {
    return res.status(e.status || 500).json({ ok: false, error: e.status ? e.message : 'Could not make a room ticket' });
  }
}
