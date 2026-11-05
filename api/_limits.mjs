// The limits the Admin Hub's Limits page changes (admin.html #limits, api/admin-limits.mjs).
//   net: per internet connection. The players on one network (a meetup's wifi, an office, a school) share these, so a
//        crowd on one wifi can need them raised before an event. They stop a script on one connection from hammering the
//        sign-ins and the rooms.
//   ant: Ant-Thony's budget for the whole site, a UTC day (every line costs the Rebel Economy's model and voice). 0 = off.
// Kept in Redis site:limits:v1:<prod|dev> (each site its own: the live admin sets the live site's, the dev admin the dev
// preview's), read at most every 30 s per warm function; a value not set, or out of its range, is its default. Redis down
// or not set up: the defaults (nothing breaks). The room copies per village are the rooms' own setting (the control
// desk's cfg, realtime/src/control.js copies: admin.html sets it through /api/mp-admin cfg-set).
export const LIMITS = {
  mpJoinsIp: { def: 90, min: 10, max: 5000, group: 'net', label: 'Multiplayer joins', per: 'per wifi, every 10 minutes',
    help: 'A player takes one each time a page connects to the rooms: entering a village, a reconnect, joining an event or a group. 90 is enough for about 20-40 people on one wifi.' },
  mpJoinsAcct: { def: 240, min: 30, max: 5000, group: 'net', label: 'Multiplayer joins per player', per: 'per player, every hour',
    help: 'The same, for one signed-in player.' },
  discordIp: { def: 60, min: 10, max: 5000, group: 'net', label: 'Discord sign-ins', per: 'per wifi, every hour',
    help: 'Starting a Discord sign-in, and coming back from Discord, each count once.' },
  nameTriesIp: { def: 40, min: 10, max: 2000, group: 'net', label: 'Name and PIN sign-in tries', per: 'per wifi, every 10 minutes',
    help: 'Every try counts, right or wrong (it stops someone guessing PINs).' },
  nameNewIp: { def: 10, min: 1, max: 500, group: 'net', label: 'New name accounts', per: 'per wifi, every hour',
    help: 'Making a new name and PIN account. The Rebel Economy also allows 10 an hour per wifi on its own side.' },
  antGreetDay: { def: 1500, min: 0, max: 100000, group: 'ant', label: "Ant-Thony's hellos", per: 'a day, the whole site',
    help: 'He greets each player once a day when they walk up to him.' },
  antAskDay: { def: 3000, min: 0, max: 100000, group: 'ant', label: 'Questions he answers', per: 'a day, the whole site',
    help: 'Players typing to him in his talk box.' },
  antWakeDay: { def: 1500, min: 0, max: 100000, group: 'ant', label: 'Times he can be woken', per: 'a day, the whole site',
    help: 'Waking him in his house between 2 and 7 a.m. New York time.' },
  antVoiceDay: { def: 2500, min: 0, max: 100000, group: 'ant', label: 'Lines he says out loud', per: 'a day, the whole site',
    help: 'His spoken lines in Universe. The Rebel Economy also has its own cap: 600 spoken lines a day for every app together.' }
};
const ENV = process.env.VERCEL_ENV === 'production' ? 'prod' : 'dev';
export const LIMITS_SITE = ENV, LIMITS_KEY = `site:limits:v1:${ENV}`;
const KEEP_MS = 30000;

async function redis(commands) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
  if (!url || !token) throw Object.assign(new Error('Redis is not configured'), { code: 'no_redis' });
  const r = await fetch(`${url}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(commands), signal: AbortSignal.timeout(2500) });
  const data = await r.json().catch(() => null);
  if (!r.ok || !Array.isArray(data)) throw new Error(data?.error || `Redis request failed with status ${r.status}`);
  return data;
}

// one value: a whole number in its range, else null (= the default)
function okValue(name, v) {
  const d = LIMITS[name]; if (!d || v == null || v === '') return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= d.min && n <= d.max ? n : null;
}
export const defaults = () => Object.fromEntries(Object.entries(LIMITS).map(([k, d]) => [k, d.def]));
// the saved values only (what an admin set), cleaned
export function cleanSaved(o) {
  const out = {};
  for (const k of Object.keys(LIMITS)) { const v = okValue(k, o?.[k]); if (v != null) out[k] = v; }
  return out;
}

let memo = null, memoAt = 0, memoP = null;
// { values (every limit, the saved or the default), saved (what an admin set), updatedAt, by }
export async function readLimits({ fresh = false } = {}) {
  if (!fresh && memo && Date.now() - memoAt < KEEP_MS) return memo;
  if (!fresh && memoP) return memoP;
  const p = (async () => {
    let d = null;
    try { const [r] = await redis([['GET', LIMITS_KEY]]); d = r?.result ? JSON.parse(r.result) : null; } catch (e) { d = memo ? { saved: memo.saved, updatedAt: memo.updatedAt, by: memo.by } : null; }
    const saved = cleanSaved(d?.saved);
    memo = { values: { ...defaults(), ...saved }, saved, updatedAt: d?.updatedAt || null, by: d?.by || null }; memoAt = Date.now();
    return memo;
  })();
  if (!fresh) { memoP = p; p.finally(() => { memoP = null; }); }
  return p;
}
// one limit's value now (never throws: the default when anything is wrong)
export async function limitOf(name) {
  try { return (await readLimits()).values[name] ?? LIMITS[name].def; } catch (e) { return LIMITS[name]?.def; }
}
// save the admin's values (set: { name: number | null (= back to the default) }, or reset: everything back)
export async function saveLimits({ set, reset, by } = {}) {
  const cur = await readLimits({ fresh: true }), saved = reset ? {} : { ...cur.saved }, bad = [];
  for (const [k, v] of Object.entries(set && typeof set === 'object' ? set : {})) {
    if (!LIMITS[k]) continue;
    if (v == null || v === '') { delete saved[k]; continue; }
    const n = okValue(k, v); if (n == null) { bad.push(k); continue; }
    if (n === LIMITS[k].def) delete saved[k]; else saved[k] = n;
  }
  if (bad.length) return { ok: false, bad, error: bad.map(k => `${LIMITS[k].label}: ${LIMITS[k].min}-${LIMITS[k].max}`).join('; ') };
  const doc = { saved, updatedAt: new Date().toISOString(), by: by || null };
  await redis([Object.keys(saved).length ? ['SET', LIMITS_KEY, JSON.stringify(doc)] : ['DEL', LIMITS_KEY]]);
  memo = { values: { ...defaults(), ...saved }, saved, updatedAt: doc.updatedAt, by: doc.by }; memoAt = Date.now();
  return { ok: true, ...memo };
}
