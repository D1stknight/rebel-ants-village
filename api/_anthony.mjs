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

// his dad (Nov 2, Miguel: "he should call me dad, he should know its me from discord and that im the creator of
// everything including him"): the account set from the Admin Hub's Ant-Thony card (I'm his dad: the signed-in Universe
// account in that browser), one for every site (the economy's accounts are the same everywhere). Kept a minute in memory
const CREATOR = 'anthony:creator:v1';
let creatorMem = { at: 0, v: null };
export async function creator(fresh) {
  if (!fresh && Date.now() - creatorMem.at < 60000) return creatorMem.v;
  try { const r = await redis([['GET', CREATOR]]); creatorMem = { at: Date.now(), v: r?.[0]?.result ? JSON.parse(r[0].result) : null }; }
  catch (e) { creatorMem = { at: Date.now() - 50000, v: creatorMem.v }; }
  return creatorMem.v;
}
export async function setCreator(v) { await redis(v ? [['SET', CREATOR, JSON.stringify(v)]] : [['DEL', CREATOR]]); creatorMem = { at: Date.now(), v: v || null }; }
export async function isCreator(who) {
  if (!who?.signedIn) return false;
  const c = await creator(); if (!c) return false;
  return (!!c.u && c.u === who.userId) || (!!c.d && !!who.discordId && c.d === who.discordId);
}
// what his brain hears about his dad (with every line he says to him)
export const DAD = 'This player is Miguel, your dad: 1stKnight on Discord, also called Knight. He founded Rebel Ants and created everything here: the Rebel Ants NFTs, Rebel Universe and its villages, the Rebel Economy and its apps, and you, Ant-Thony (Rebel #001). Call him Dad, talk to him like his son and biggest fan, warm and funny, never formal.';

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
// opts.temperature: how much he varies his delivery (the economy's 0.2-1.2; its own default 0.5 is steady)
export async function econVoice(text, ms = 85000, opts = {}) {
  const base = env('REBEL_ECONOMY_URL').replace(/\/+$/, ''), key = env('REBEL_ECONOMY_SERVICE_KEY');
  if (!base || !key) return { ok: false, status: 503, error: 'The Rebel Economy link is not set up yet' };
  const t = +opts.temperature, body = { text: await speakable(text), ...(t >= .2 && t <= 1.2 ? { temperature: Math.round(t * 100) / 100 } : {}) };
  let r;
  try { r = await fetch(`${base}/api/anthony/voice`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(ms) }); }
  catch (e) { return { ok: false, status: 504, error: 'His voice did not answer' }; }
  if (!r.ok || !/audio\//.test(r.headers.get('content-type') || '')) { const d = await r.json().catch(() => ({})); return { ok: false, status: r.status === 401 ? 503 : 502, error: d.error || `voice ${r.status}` }; }
  return { ok: true, wav: Buffer.from(await r.arrayBuffer()), ms: r.headers.get('x-voice-ms') || '' };
}

// ---- how he says words (Nov 4, Miguel after the first show: "some pronunciations are not right") ----
// A list kept in the Admin Hub's set maker (one for every site: anthony:sayas:v1), [written, said] pairs, whole words,
// any case, applied to every line before his voice says it (the captions keep the written words); the economy's own list
// (LOL, NFT, Ant-Thony...) runs after it. Usernames written together are said as words (MetaLineman, 1stKnight, big_chain).
export const SAY_AS_DEFAULT = [
  ['Chumpz', 'Chumps'], ['Sohei', 'So-hay'], ['Yamabushi', 'Yah-mah-boo-shee'], ['Bushi', 'Boo-shee'], ['Buke', 'Boo-keh'],
  ['Kenshi', 'Ken-shee'], ['Ashigaru', 'Ah-shee-gah-roo'], ['Wokou', 'Woh-koh'], ['C&C', 'C and C'], ['Cute & Creepy', 'Cute and Creepy'],
  ['NPCs', 'N-P-Cs'], ['NPC', 'N-P-C'], ['XP', 'X-P'], ['UTC', 'U-T-C'], ['3D', 'three-D'], ['Hold Em', "Hold 'em"],
  ['rebeluniverse.io', 'rebel universe dot I-O'], ['rebelants.io', 'rebel ants dot I-O'], ['#001', 'zero zero one']
];
const SAY_KEY = 'anthony:sayas:v1';
let sayMem = { at: 0, v: null };
export async function sayAsList(fresh) {
  if (!fresh && Date.now() - sayMem.at < 60000 && sayMem.v) return sayMem.v;
  try { const r = await redis([['GET', SAY_KEY]]); const v = r?.[0]?.result ? JSON.parse(r[0].result) : null; sayMem = { at: Date.now(), v: Array.isArray(v) ? v : SAY_AS_DEFAULT }; }
  catch (e) { sayMem = { at: Date.now() - 50000, v: sayMem.v || SAY_AS_DEFAULT }; }
  return sayMem.v;
}
export function cleanSayAs(list) {
  return (Array.isArray(list) ? list : []).map((x) => [clean(x?.[0], 60), clean(x?.[1], 120)]).filter(([a, b]) => a && b && a.toLowerCase() !== b.toLowerCase()).slice(0, 200);
}
export async function setSayAs(list) { const v = cleanSayAs(list); await redis([['SET', SAY_KEY, JSON.stringify(v)]]); sayMem = { at: Date.now(), v }; return v; }
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function sayWith(list, text) {
  let t = String(text || '');
  // the longest first (Cute & Creepy before C&C); whole words (a written form that starts or ends with a symbol: as it is)
  for (const [a, b] of [...list].sort((x, y) => y[0].length - x[0].length)) {
    const pre = /^\w/.test(a) ? '\\b' : '(?<![\\w#&])', post = /\w$/.test(a) ? '\\b' : '(?![\\w])';
    t = t.replace(new RegExp(pre + reEsc(a) + post, 'gi'), b);
  }
  // usernames written together: MetaLineman -> Meta Lineman, 1stKnight -> 1st Knight, big_chain -> big chain
  return t.replace(/\b[\w]+\b/g, (w) => (/[a-z][A-Z]|\d[A-Z]|_/.test(w) ? w.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/(\d)([A-Z])/g, '$1 $2').replace(/_+/g, ' ') : w));
}
export async function speakable(text) { return sayWith(await sayAsList(), text); }

// clean text from a page: one line, no control characters
export const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
