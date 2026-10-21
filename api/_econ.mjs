// The Rebel Economy link (rebel-economy-core, economy.rebelants.io).
// - The village's server talks to the economy with its app's service key (REBEL_ECONOMY_SERVICE_KEY, Bearer on
//   /api/internal/*): resolve a Discord identity to the economy's userId (and balance), credit points. The key never
//   leaves the server.
// - Players sign in with the village's own Discord app (DISCORD_CLIENT_ID / _SECRET; redirect
//   <origin>/api/econ-discord-callback). The session is the ra_econ cookie (HttpOnly, signed with
//   VILLAGE_SESSION_SECRET): { u: economy userId, d: Discord id, un: Discord username, n: display name, a: avatar }.
// - Players without Discord sign in with a name + PIN instead (api/econ-name-login -> the economy's
//   /api/internal/name-auth: the casino's colony name accounts). Same cookie, d = "name:<slug>", un = the slug, no a.
// - Production signs in on https://rebeluniverse.io, previews on their branch URL (the dev preview's is the second
//   redirect registered with Discord), local runs on their own host.
import crypto from 'crypto';
import { readCookie } from './_admin-auth.mjs';

export const ECON_COOKIE = 'ra_econ';
export const STATE_COOKIE = 'ra_econ_st';
const SESSION_TTL = 60 * 60 * 24 * 30;                 // 30 days
const STATE_TTL = 600;                                 // a sign-in has 10 minutes to come back from Discord
export const ECON_SOURCE = 'rebel-ants-village';

const env = (k) => String(process.env[k] || '').trim();
// which settings this deploy has (names only, never values)
export function econEnv() {
  return {
    REBEL_ECONOMY_URL: !!env('REBEL_ECONOMY_URL'),
    REBEL_ECONOMY_SERVICE_KEY: !!env('REBEL_ECONOMY_SERVICE_KEY'),
    DISCORD_CLIENT_ID: !!env('DISCORD_CLIENT_ID'),
    DISCORD_CLIENT_SECRET: !!env('DISCORD_CLIENT_SECRET'),
    VILLAGE_SESSION_SECRET: env('VILLAGE_SESSION_SECRET').length >= 16
  };
}
export const econReady = () => Object.values(econEnv()).every(Boolean);
export function economyHost() { try { return new URL(env('REBEL_ECONOMY_URL')).host; } catch (e) { return null; } }
// the Rebel Economy's points shop (the Forge's "Get Rebel Points" until the packs open in the village)
export function econShopUrl() { const b = env('REBEL_ECONOMY_URL').replace(/\/+$/, ''); return /^https?:\/\//.test(b) ? `${b}/shop` : null; }

function secret() {
  const s = env('VILLAGE_SESSION_SECRET');
  if (s.length < 16) throw Object.assign(new Error('Sign-in is not set up yet'), { status: 503 });
  return s;
}
const sign = (purpose, b64) => crypto.createHmac('sha256', `${purpose}:${secret()}`).update(b64).digest('base64url');
function safeEqual(a, b) { const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || '')); return x.length === y.length && crypto.timingSafeEqual(x, y); }
const secure = () => (process.env.NODE_ENV === 'production' ? '; Secure' : '');

function packSigned(purpose, obj) {
  const b64 = Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${b64}.${sign(purpose, b64)}`;
}
function unpackSigned(purpose, raw) {
  if (!raw) return null;
  const [b64, sig] = String(raw).split('.');
  try {
    if (!b64 || !sig || !safeEqual(sig, sign(purpose, b64))) return null;
    const p = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    return p && p.exp > Math.floor(Date.now() / 1000) ? p : null;
  } catch (e) { return null; }
}

// ---- the player's session ----
export function econSessionCookie(s) {
  const now = Math.floor(Date.now() / 1000);
  const v = packSigned('econ', { u: String(s.u), d: String(s.d), un: String(s.un || '').slice(0, 64), n: String(s.n || '').slice(0, 64), a: s.a ? String(s.a).slice(0, 80) : null, iat: now, exp: now + SESSION_TTL });
  return `${ECON_COOKIE}=${encodeURIComponent(v)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL}${secure()}`;
}
export const clearEconCookie = () => `${ECON_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure()}`;
// the signed-in player { u, d, un, n, a } or null
export function econSessionOf(req) {
  try {
    const p = unpackSigned('econ', readCookie(req, ECON_COOKIE));
    return p && /^[A-Za-z0-9_-]{6,64}$/.test(p.u) && (/^\d{5,24}$/.test(p.d) || NAME_ID.test(p.d)) ? p : null;
  } catch (e) { return null; }
}
// a name + PIN account's id in the economy ("name:<slug>", the slug as the casino makes it)
export const NAME_ID = /^name:[a-z0-9-]{1,32}$/;
export const isNameSession = (s) => NAME_ID.test(String(s?.d || ''));

// ---- the round trip to Discord: a one-time state, where to go back to, popup or not ----
export function newStateCookie({ ret, popup }) {
  const now = Math.floor(Date.now() / 1000), s = crypto.randomBytes(16).toString('hex');
  const v = packSigned('econ-state', { s, r: ret, p: popup ? 1 : 0, exp: now + STATE_TTL });
  return { state: s, cookie: `${STATE_COOKIE}=${encodeURIComponent(v)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${STATE_TTL}${secure()}` };
}
export const clearStateCookie = () => `${STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure()}`;
export function readStateCookie(req, state) {
  const p = unpackSigned('econ-state', readCookie(req, STATE_COOKIE));
  return p && state && safeEqual(p.s, state) ? { ret: safeReturn(p.r), popup: !!p.p } : null;
}
// only a path on this site (never another host), in plain URL characters
export function safeReturn(r) {
  const v = String(r || '');
  return /^\/(?![\/\\])[A-Za-z0-9\-._~%&=+,:@\/?#]{0,500}$/.test(v) ? v : '/village.html';
}

export function hostOf(req) { return String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim(); }
// the one origin each deploy signs in on (Discord only accepts the redirects registered for the app)
export function publicOrigin(req) {
  const fixed = env('VILLAGE_PUBLIC_ORIGIN').replace(/\/+$/, '');
  if (fixed) return fixed;
  if (process.env.VERCEL_ENV === 'production') return 'https://rebeluniverse.io';
  if (process.env.VERCEL_ENV === 'preview' && env('VERCEL_BRANCH_URL')) return `https://${env('VERCEL_BRANCH_URL')}`;
  const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  return `${proto}://${hostOf(req)}`;
}
export const callbackUrl = (req) => `${publicOrigin(req)}/api/econ-discord-callback`;

// ---- Discord ----
const DISCORD = env('ECON_DISCORD_BASE') || 'https://discord.com';      // tests point this at a fake
export function discordAuthorizeUrl(req, state) {
  const q = new URLSearchParams({ response_type: 'code', client_id: env('DISCORD_CLIENT_ID'), scope: 'identify', state, redirect_uri: callbackUrl(req) });
  return `${DISCORD}/oauth2/authorize?${q}`;
}
async function timed(url, opts = {}, ms = 9000) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ac.signal }); } finally { clearTimeout(t); }
}
// the code from the callback -> the Discord user { id, username, global_name, avatar }
export async function discordUserFromCode(req, code) {
  const tr = await timed(`${DISCORD}/api/oauth2/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code: String(code), redirect_uri: callbackUrl(req), client_id: env('DISCORD_CLIENT_ID'), client_secret: env('DISCORD_CLIENT_SECRET') })
  });
  const tok = await tr.json().catch(() => ({}));
  if (!tr.ok || !tok.access_token) throw Object.assign(new Error('Discord did not accept the sign-in'), { status: 502, detail: tok.error || tr.status });
  const ur = await timed(`${DISCORD}/api/users/@me`, { headers: { Authorization: `Bearer ${tok.access_token}` } });
  const u = await ur.json().catch(() => ({}));
  if (!ur.ok || !/^\d{5,24}$/.test(String(u.id || ''))) throw Object.assign(new Error('Discord did not send your account'), { status: 502 });
  return { id: String(u.id), username: String(u.username || '').slice(0, 64) || 'rebel', global_name: u.global_name ? String(u.global_name).slice(0, 64) : null, avatar: u.avatar ? String(u.avatar).slice(0, 80) : null };
}

// ---- redis (the same store as the leaderboards; its own copy so these functions don't load the wallet code) ----
export async function redis(commands) {
  const url = env('UPSTASH_REDIS_REST_URL') || env('KV_REST_API_URL'), token = env('UPSTASH_REDIS_REST_TOKEN') || env('KV_REST_API_TOKEN');
  if (!url || !token) throw Object.assign(new Error('Redis is not configured'), { status: 503 });
  const r = await timed(`${url}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(commands) });
  const d = await r.json().catch(() => null);
  if (!r.ok || !Array.isArray(d)) throw Object.assign(new Error(d?.error || `Redis ${r.status}`), { status: 503 });
  return d;
}

// ---- the economy ----
export async function econCall(path, body, method = 'POST') {
  const base = env('REBEL_ECONOMY_URL').replace(/\/+$/, ''), key = env('REBEL_ECONOMY_SERVICE_KEY');
  if (!base || !key) throw Object.assign(new Error('The Rebel Economy link is not set up yet'), { status: 503 });
  let r;
  try {
    r = await timed(`${base}${path}`, { method, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify(body || {}) });
  } catch (e) { throw Object.assign(new Error('The Rebel Economy did not answer'), { status: 504 }); }
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}
// a Discord identity -> { userId, displayName, balance } (the account is made or linked on first use)
export async function econResolve({ discordId, username, displayName }) {
  const { ok, status, data } = await econCall('/api/internal/resolve', { discordId, username, displayName: displayName || null });
  if (!ok || !data.userId) throw Object.assign(new Error(data.message || 'The Rebel Economy did not find your account'), { status: status === 401 ? 503 : 502, code: data.error });
  return { userId: String(data.userId), displayName: data.displayName || displayName || username, balance: Number(data.balance) || 0 };
}
// name + PIN: register or sign in -> the economy's answer as is ({ ok, status, data }: data.ok false = taken, wrong PIN...)
export function econNameAuth({ action, name, pin, player }) {
  return econCall('/api/internal/name-auth', { action, name, pin, player });
}
// a name account's balance (Discord players read theirs through econResolve)
export async function econNameBalance(userId) {
  const { ok, status, data } = await econCall('/api/internal/name-auth', { action: 'balance', userId });
  if (!ok || !data.ok) throw Object.assign(new Error(data.message || 'The Rebel Economy did not find your account'), { status: status === 404 ? 502 : status, code: data.code || data.error });
  return Number(data.balance) || 0;
}
// credit points (idempotencyKey: the same key never pays twice) -> { newBalance, transactionId, userId, amount }
// (a key the economy has seen answers with that first transaction: its id, user and amount)
export async function econCredit({ userId, amount, reason, metadata, idempotencyKey, type = 'game_reward' }) {
  const { ok, status, data } = await econCall('/api/internal/credit', { userId, amount: Math.round(amount), type, source: ECON_SOURCE, reason: String(reason || '').slice(0, 500), metadata, idempotencyKey });
  if (!ok) throw Object.assign(new Error(data.message || 'The Rebel Economy did not take the points'), { status: status >= 500 ? 502 : status, code: data.error, economyStatus: status });
  return { newBalance: Number(data.newBalance) || 0, transactionId: data.transactionId || null,
    userId: data.userId != null ? String(data.userId) : null, amount: data.amount != null ? String(data.amount) : null };
}

// take points (a forge) -> { newBalance, transactionId, userId, amount }. The economy answers any key it has seen with that
// first transaction, whatever it was (a credit, another user), so the answer must be this very debit, else it is refused
// (code key_conflict): callers give every debit its own key.
export async function econDebit({ userId, amount, reason, metadata, idempotencyKey }) {
  const { ok, status, data } = await econCall('/api/internal/debit', { userId, amount: Math.round(amount), type: 'spend', source: ECON_SOURCE, reason: String(reason || '').slice(0, 500), metadata, idempotencyKey });
  if (!ok) throw Object.assign(new Error(data.message || 'The Rebel Economy did not take the points'), { status: status >= 500 ? 502 : status, code: data.error, economyStatus: status });
  if (data.direction !== 'debit' || String(data.userId) !== String(userId) || String(data.amount) !== String(Math.round(amount)))
    throw Object.assign(new Error('The Rebel Economy answered with another transaction'), { status: 502, code: 'key_conflict' });
  return { newBalance: Number(data.newBalance) || 0, transactionId: data.transactionId || null, userId: String(data.userId), amount: String(data.amount) };
}

// ---- the page Discord sends the player back to ----
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function finishPage({ ok, message, ret, popup }) {
  const back = esc(ret || '/village.html');
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rebel Ants</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0a0c11;color:#ece4cf;font:15px/1.5 system-ui,sans-serif}
.c{max-width:360px;padding:28px 24px;text-align:center;border:1px solid rgba(214,175,92,.35);border-radius:10px;background:rgba(255,255,255,.03)}
b{display:block;color:${ok ? '#d6af5c' : '#e06b5b'};letter-spacing:2px;text-transform:uppercase;font-size:12px;margin-bottom:8px}a{color:#5ecfca}</style></head>
<body><div class="c"><b>${ok ? 'Signed in' : 'Not signed in'}</b><p>${esc(message)}</p><p><a href="${back}">Back to the village</a></p></div>
<script>
try { new BroadcastChannel('ra-econ').postMessage({ signedIn: ${ok ? 'true' : 'false'} }); } catch (e) {}
try { localStorage.setItem('raEconPing', String(Date.now())); } catch (e) {}
${popup ? `setTimeout(function () { try { window.close(); } catch (e) {} }, ${ok ? 700 : 2600});` : ''}
</script></body></html>`;
}
