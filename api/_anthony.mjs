// Ant-Thony in Universe (Nov 1): Rebel #001 roams the villages and answers players. His brain and voice live in the
// Rebel Economy (rebel-economy-core: POST /api/anthony/reply, /api/anthony/voice, /api/anthony/knowledge, with this
// app's Authorized App key, the same REBEL_ECONOMY_SERVICE_KEY the points use). These helpers keep the routes small:
// who is asking (the ra_econ session: the economy account id the points use), per-player and per-site limits (his
// replies cost the economy; it also caps Universe at 4,000 a day), the once-a-day greeting, and a signature on every
// line he says, so his voice only ever speaks lines his brain gave (never text a page made up).
import crypto from 'node:crypto';
import { econSessionOf, redis } from './_econ.mjs';
import { clientIp } from './_guard.mjs';

const env = (k) => String(process.env[k] || '').trim();
export const SITE = env('VERCEL_ENV') === 'production' ? 'prod' : 'dev';
export const VILLAGE_NAMES = {
  hub: 'Hub Village', ronin: 'Ronin', samurai: 'Samurai', shogun: 'Shogun', bushi: 'Bushi', buke: 'Buke', ashigaru: 'Ashigaru',
  kenshi: 'Kenshi', yamabushi: 'Yamabushi', sohei: 'Sohei', wokou: 'Wokou', warrior: 'Warrior', 'cute-creepy': 'Cute & Creepy',
  chumpz: 'Chumpz Cove', 'saints-la': 'Saints of LA'
};
export const ECON_USER = /^[a-z0-9]{10,40}$/i;   // (the economy's member.userId rule)
const day = () => new Date().toISOString().slice(0, 10);
const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 24);

// who is talking: a signed-in player (their economy account and name) or a guest (by the page's guest key, else IP)
export function asker(req, guestKey) {
  const s = econSessionOf(req);
  if (s?.u && ECON_USER.test(String(s.u))) return { id: 'u:' + s.u, userId: String(s.u), name: String(s.n || s.un || 'a rebel').slice(0, 40), signedIn: true,
    discordId: /^\d{5,25}$/.test(String(s.d || '')) ? String(s.d) : null };   // (a Discord player: he remembers them across his apps)
  const gk = /^[A-Za-z0-9_-]{16,64}$/.test(String(guestKey || '')) ? String(guestKey) : '';
  return { id: 'g:' + hash(gk || clientIp(req)), ip: hash(clientIp(req)), userId: null, name: 'a guest', signedIn: false };
}

// fixed windows: every [key, limit, seconds] must be under its limit (each counted). Fails open: the economy caps too.
export async function underLimits(list) {
  try {
    const now = Math.floor(Date.now() / 1000), keys = list.map(([k, , s]) => `anthony:rl:v1:${SITE}:${k}:${Math.floor(now / s)}`);
    const r = await redis(list.flatMap(([, , s], i) => [['INCR', keys[i]], ['EXPIRE', keys[i], s + 60]]));
    return list.every(([, lim], i) => Number(r[i * 2]?.result || 0) <= lim);
  } catch (e) { return true; }
}

// the once-a-day greeting: true the first time today for this player (and for their IP as a guest)
export async function firstGreetToday(who) {
  try {
    const keys = [`anthony:greet:v1:${SITE}:${day()}:${who.id}`]; if (who.ip) keys.push(`anthony:greet:v1:${SITE}:${day()}:ip:${who.ip}`);
    const r = await redis(keys.map((k) => ['SET', k, '1', 'NX', 'EX', 90000]));
    return r.every((x) => x?.result === 'OK');
  } catch (e) { return false; }
}

// his voice speaks only lines his brain gave: each reply carries a token (10 minutes)
const secret = () => env('VILLAGE_SESSION_SECRET');
const mac = (exp, text) => crypto.createHmac('sha256', secret()).update(`anthony-voice:v1:${SITE}:${exp}:${text}`).digest('base64url');
export function voiceToken(text) { if (!secret()) return null; const exp = Math.floor(Date.now() / 1000) + 600; return `${exp}.${mac(exp, text)}`; }
export function voiceTokenOk(text, token) {
  if (!secret()) return false;
  const m = /^(\d{10})\.([A-Za-z0-9_-]{43})$/.exec(String(token || '')); if (!m || Number(m[1]) < Date.now() / 1000) return false;
  const a = Buffer.from(m[2]), b = Buffer.from(mac(m[1], text));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// the economy's voice answers a WAV (or JSON on an error)
export async function econVoice(text, ms = 85000) {
  const base = env('REBEL_ECONOMY_URL').replace(/\/+$/, ''), key = env('REBEL_ECONOMY_SERVICE_KEY');
  if (!base || !key) return { ok: false, status: 503, error: 'The Rebel Economy link is not set up yet' };
  let r;
  try { r = await fetch(`${base}/api/anthony/voice`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(ms) }); }
  catch (e) { return { ok: false, status: 504, error: 'His voice did not answer' }; }
  if (!r.ok || !/audio\//.test(r.headers.get('content-type') || '')) { const d = await r.json().catch(() => ({})); return { ok: false, status: r.status === 401 ? 503 : 502, error: d.error || `voice ${r.status}` }; }
  return { ok: true, wav: Buffer.from(await r.arrayBuffer()), ms: r.headers.get('x-voice-ms') || '' };
}

// clean text from a page: one line, no control characters
export const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
