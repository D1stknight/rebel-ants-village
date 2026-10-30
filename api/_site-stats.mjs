// Counters for the Admin Hub's dashboard: what happened on this site each UTC day.
//   bump({ field: n }, { name: member })  adds to the day's counts (stats:v1:<prod|dev>:d:<day>) and to the day's distinct
//                                         players (HyperLogLog stats:v1:<prod|dev>:u:<name>:<day>; members are hashed)
//   daily(days)                           -> per day: the counts and the distinct counts, newest last, + the last 7 days'
// The fields used: tickets, village:<id> (room tickets: every Universe page that joins the rooms), signin:discord,
// signin:name, new:name, pts:<kind> / awards:<kind> / held:<kind> (Rebel Points the village paid or held), forges,
// forge:pts, forges:admin, saves (story saves), badges (sent to the Badge Wall); distinct: players, signed, guests, savers.
// Production and the previews count apart. bump() never throws and never makes a request wait more than 600 ms.
import crypto from 'node:crypto';

export const ENV = process.env.VERCEL_ENV === 'production' ? 'prod' : 'dev';
const P = `stats:v1:${ENV}:`;
const KEEP_S = 40 * 86400;
export const UNIQUES = ['players', 'signed', 'guests', 'savers'];
const dayOf = (t = Date.now()) => Math.floor(t / 86400000);

async function redis(commands, ms) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
  if (!url || !token) throw new Error('Redis is not configured');
  const ac = ms ? new AbortController() : null, t = ms ? setTimeout(() => ac.abort(), ms) : 0;
  try {
    const r = await fetch(`${url}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(commands), ...(ac ? { signal: ac.signal } : {}) });
    const data = await r.json().catch(() => null);
    if (!r.ok || !Array.isArray(data)) throw new Error(data?.error || `Redis request failed with status ${r.status}`);
    return data.map(x => (x && 'result' in x ? x.result : null));
  } finally { if (t) clearTimeout(t); }
}

export async function bump(counts = {}, uniques = {}, now = Date.now()) {
  try {
    const day = dayOf(now), D = P + 'd:' + day, cmds = [];
    for (const [k, v] of Object.entries(counts)) { const n = Math.round(+v); if (n && /^[a-z0-9:_-]{1,40}$/.test(k)) cmds.push(['HINCRBY', D, k, n]); }
    if (cmds.length) cmds.push(['EXPIRE', D, KEEP_S]);
    for (const [name, member] of Object.entries(uniques)) {
      if (!UNIQUES.includes(name) || !member) continue;
      const U = `${P}u:${name}:${day}`;
      cmds.push(['PFADD', U, crypto.createHash('sha256').update('rebel-universe:stats:' + member).digest('base64url').slice(0, 16)], ['EXPIRE', U, KEEP_S]);
    }
    if (cmds.length) await redis(cmds, 600);
  } catch (e) { /* (a count lost is no reason to fail the request) */ }
}

// the last `days` days (1-30), oldest first: { day: 'YYYY-MM-DD', counts: { field: n }, players, signed, guests, savers }
// + week: the distinct players of the last 7 days
export async function daily(days = 14, now = Date.now()) {
  days = Math.max(1, Math.min(30, Math.round(+days || 14)));
  const d1 = dayOf(now), list = [], cmds = [];
  for (let d = d1 - days + 1; d <= d1; d++) { list.push(d); cmds.push(['HGETALL', P + 'd:' + d]); for (const n of UNIQUES) cmds.push(['PFCOUNT', `${P}u:${n}:${d}`]); }
  const week = [], weekSigned = [];
  for (let d = d1 - 6; d <= d1; d++) { week.push(`${P}u:players:${d}`); weekSigned.push(`${P}u:signed:${d}`); }
  cmds.push(['PFCOUNT', ...week], ['PFCOUNT', ...weekSigned]);
  const r = await redis(cmds);
  const per = 1 + UNIQUES.length;
  const out = list.map((d, i) => {
    const raw = r[i * per], counts = {};
    if (Array.isArray(raw)) for (let j = 0; j + 1 < raw.length; j += 2) counts[raw[j]] = +raw[j + 1] || 0;
    const o = { day: new Date(d * 86400000).toISOString().slice(0, 10), counts };
    UNIQUES.forEach((n, j) => { o[n] = +r[i * per + 1 + j] || 0; });
    return o;
  });
  return { env: ENV, days: out, week: { players: +r[r.length - 2] || 0, signed: +r[r.length - 1] || 0 } };
}
