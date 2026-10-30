// What goes wrong on players' screens (the Admin Hub's dashboard): script errors, startup problems and how long pages
// take to be ready, sent by assets/site-report.js to /api/telemetry and read back by /api/admin-stats.
//   record(events, ip)   -> adds them up in Redis (tele:v1:<prod|dev>:*); numbers, page names and error messages only
//   summary({ hours })   -> the series, the most common errors, the startup problems, the latest reports
// Production and the previews keep apart (like the game boards and the ticker), so a test on a preview never shows on the
// live site's dashboard.
import crypto from 'node:crypto';

export const ENV = process.env.VERCEL_ENV === 'production' ? 'prod' : 'dev';
const P = `tele:v1:${ENV}:`;
const KEEP_S = 16 * 86400; // (hours and days kept 16 days: the dashboard looks back 14)
const RECENT = 300, SIGS_MAX = 5000, PER_IP = 120, IP_WINDOW_S = 600;
export const KINDS = ['err', 'prob', 'ready', 'load'];
export const PAGES = ['village', 'lobby', 'forge', 'admin'];
const OSES = ['ios', 'android', 'mac', 'win', 'linux', 'cros', 'other'], BROWSERS = ['safari', 'chrome', 'firefox', 'edge', 'opera', 'other'];
const READY_BANDS = [5000, 10000, 20000, 40000]; // (ready in under 5 s, 10, 20, 40, or more)

async function redis(commands) {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
  if (!url || !token) throw new Error('Redis is not configured');
  const r = await fetch(`${url}/pipeline`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(commands) });
  const data = await r.json().catch(() => null);
  if (!r.ok || !Array.isArray(data)) throw new Error(data?.error || `Redis request failed with status ${r.status}`);
  return data.map(x => (x && 'result' in x ? x.result : null));
}

const one = (v, set, d) => (set.includes(v) ? v : d);
const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : null);
// an error message or source as it may be kept: no query strings, wallet addresses, e-mail addresses or long ids
export function scrub(s, max = 300) {
  return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/(https?:\/\/[^\s?#)'"]*)[?#][^\s)'"]*/g, '$1')
    .replace(/\b0x[a-fA-F0-9]{40}\b/g, '[wallet]').replace(/[^\s@'"()<>]+@[^\s@'"()<>]+\.[a-z]{2,}/gi, '[email]')
    .replace(/[A-Za-z0-9_-]{32,}/g, '[id]').replace(/\s+/g, ' ').trim().slice(0, max);
}
// a script address with its line and column kept at the end (scrub would take them with a query string)
export function src(s, max = 160) {
  const m = String(s == null ? '' : s).match(/^(.*?)(:\d+(?::\d+)?)$/);
  return m ? scrub(m[1], max - m[2].length) + m[2] : scrub(s, max);
}
// a source as file:line (no column, no folders: the same mistake from two builds groups together)
const where = s => src(s).replace(/^.*\//, '').replace(/:(\d+):\d+$/, ':$1');
export const sigOf = (p, m, s) => crypto.createHash('sha256').update(`${p}|${scrub(m).replace(/\d+/g, '#')}|${where(s)}`).digest('base64url').slice(0, 12);

// one event as it is kept, or null (not one of ours)
export function clean(e) {
  if (!e || typeof e !== 'object') return null;
  const k = one(e.k, KINDS, null), p = one(e.p, PAGES, null);
  if (!k || !p) return null;
  const out = { k, p, v: /^[a-z-]{1,20}$/.test(String(e.v)) ? e.v : '', d: e.d === 'p' ? 'p' : 'd', o: one(e.o, OSES, 'other'), b: one(e.b, BROWSERS, 'other'), l: num(e.l, 0, 2) || 0 };
  if (k === 'err') {
    out.m = scrub(e.m); if (!out.m) return null;
    out.s = src(e.s); out.st = (Array.isArray(e.st) ? e.st : []).slice(0, 5).map(x => src(x, 120)).filter(Boolean);
    out.n = num(e.n, 1, 1000) || 1;
  } else if (k === 'prob') {
    if (!/^[a-z0-9-]{2,24}$/.test(String(e.c))) return null;
    out.c = e.c; out.m = scrub(e.m, 200);
  } else if (k === 'ready') {
    out.ms = num(e.ms, 0, 900000); if (out.ms == null) return null;
  }
  return out;
}

// add a page's reports up (at most 12 a call); a caller past PER_IP in 10 minutes is dropped
export async function record(events, ip, now = Date.now()) {
  const list = (Array.isArray(events) ? events : []).slice(0, 12).map(clean).filter(Boolean);
  if (!list.length) return { ok: true, kept: 0 };
  const rl = `rl:tele:${String(ip || 'unknown').slice(0, 64)}:${Math.floor(now / 1000 / IP_WINDOW_S)}`;
  const [count, sigs] = await redis([['INCRBY', rl, list.length], ['HLEN', P + 'sigs'], ['EXPIRE', rl, IP_WINDOW_S + 60]]);
  if (+count > PER_IP) return { ok: false, limited: true, kept: 0 };
  const hour = Math.floor(now / 3600000), day = Math.floor(now / 86400000), H = P + 'h:' + hour, D = P + 'sig:' + day, cmds = [];
  let recent = 0;
  for (const e of list) {
    if (e.k === 'err') {
      const sig = sigOf(e.p, e.m, e.s);
      cmds.push(['HINCRBY', H, 'err', e.n], ['HINCRBY', H, 'err:' + e.p, e.n], ['HINCRBY', D, sig, e.n], ['HSET', P + 'sigl', sig, now]);
      if (+sigs < SIGS_MAX) cmds.push(['HSETNX', P + 'sigs', sig, JSON.stringify({ p: e.p, m: e.m, s: e.s, st: e.st, first: now, d: e.d, o: e.o, b: e.b })]);
      cmds.push(['LPUSH', P + 'recent', JSON.stringify({ at: now, k: 'err', p: e.p, v: e.v, d: e.d, o: e.o, b: e.b, m: e.m, s: where(e.s), n: e.n, sig })]); recent++;
    } else if (e.k === 'prob') {
      cmds.push(['HINCRBY', H, 'prob:' + e.c, 1], ['HINCRBY', H, 'prob:' + e.c + ':' + e.d, 1]);
      cmds.push(['LPUSH', P + 'recent', JSON.stringify({ at: now, k: 'prob', p: e.p, v: e.v, d: e.d, o: e.o, b: e.b, c: e.c, m: e.m, l: e.l })]); recent++;
    } else if (e.k === 'ready') {
      const band = READY_BANDS.findIndex(x => e.ms < x);
      cmds.push(['HINCRBY', H, `ready:n:${e.p}:${e.v}:${e.d}`, 1], ['HINCRBY', H, `ready:ms:${e.p}:${e.v}:${e.d}`, e.ms], ['HINCRBY', H, `ready:b${band < 0 ? 4 : band}:${e.p}:${e.d}`, 1]);
    } else cmds.push(['HINCRBY', H, `load:${e.p}:${e.d}`, 1]);
  }
  cmds.push(['EXPIRE', H, KEEP_S], ['EXPIRE', D, KEEP_S]);
  if (recent) cmds.push(['LTRIM', P + 'recent', 0, RECENT - 1]);
  await redis(cmds);
  return { ok: true, kept: list.length };
}

// the dashboard's view of the last `hours` (1 h to 14 days): a series (an hour a step up to 2 days, else 6 hours), the
// pages' ready times by village and device, the startup problems, the most common errors and the latest reports
export async function summary({ hours = 24, now = Date.now() } = {}) {
  hours = Math.max(1, Math.min(336, Math.round(+hours || 24)));
  const h1 = Math.floor(now / 3600000), h0 = h1 - hours + 1, step = hours <= 48 ? 1 : 6;
  const d1 = Math.floor(now / 86400000), d0 = Math.floor((h0 * 3600000) / 86400000);
  const cmds = [];
  for (let h = h0; h <= h1; h++) cmds.push(['HGETALL', P + 'h:' + h]);
  for (let d = d0; d <= d1; d++) cmds.push(['HGETALL', P + 'sig:' + d]);
  cmds.push(['LRANGE', P + 'recent', 0, 59]);
  const res = await redis(cmds);
  const pairs = a => { const o = {}; if (Array.isArray(a)) for (let i = 0; i + 1 < a.length; i += 2) o[a[i]] = +a[i + 1] || 0; else if (a && typeof a === 'object') for (const [k, v] of Object.entries(a)) o[k] = +v || 0; return o; };
  const series = [], ready = {}, problems = {}, totals = { err: 0, loads: 0, ready: 0, errByPage: {}, loadsByPage: {} }, bands = { d: [0, 0, 0, 0, 0], p: [0, 0, 0, 0, 0] };
  let cur = null;
  for (let i = 0; i <= h1 - h0; i++) {
    const h = h0 + i, f = pairs(res[i]), t = Math.floor(h / step) * step * 3600000;
    if (!cur || cur.t !== t) { cur = { t, err: 0, prob: 0, loads: 0, readyN: 0, readyMs: 0 }; series.push(cur); }
    for (const [k, v] of Object.entries(f)) {
      const a = k.split(':');
      if (k === 'err') { cur.err += v; totals.err += v; }
      else if (a[0] === 'err' && a.length === 2) totals.errByPage[a[1]] = (totals.errByPage[a[1]] || 0) + v;
      else if (a[0] === 'prob' && a.length === 2) { cur.prob += v; problems[a[1]] = problems[a[1]] || { n: 0, d: 0, p: 0 }; problems[a[1]].n += v; }
      else if (a[0] === 'prob' && a.length === 3) { problems[a[1]] = problems[a[1]] || { n: 0, d: 0, p: 0 }; problems[a[1]][a[2] === 'p' ? 'p' : 'd'] += v; }
      else if (a[0] === 'load') { cur.loads += v; totals.loads += v; totals.loadsByPage[a[1]] = (totals.loadsByPage[a[1]] || 0) + v; }
      else if (a[0] === 'ready' && (a[1] === 'n' || a[1] === 'ms')) {
        const key = `${a[2]}:${a[3]}:${a[4]}`, r = ready[key] = ready[key] || { p: a[2], v: a[3], d: a[4], n: 0, ms: 0 };
        r[a[1]] += v; if (a[1] === 'n') { cur.readyN += v; totals.ready += v; } else cur.readyMs += v;
      } else if (a[0] === 'ready' && /^b\d$/.test(a[1])) { const b = +a[1].slice(1), d = a[3] === 'p' ? 'p' : 'd'; if (a[2] === 'village' && b < 5) bands[d][b] += v; }
    }
  }
  const sigCount = {};
  for (let i = 0; i <= d1 - d0; i++) for (const [k, v] of Object.entries(pairs(res[h1 - h0 + 1 + i]))) sigCount[k] = (sigCount[k] || 0) + v;
  const top = Object.entries(sigCount).sort((a, b) => b[1] - a[1]).slice(0, 25);
  let errors = [];
  if (top.length) {
    const [samples, lasts] = await redis([['HMGET', P + 'sigs', ...top.map(t => t[0])], ['HMGET', P + 'sigl', ...top.map(t => t[0])]]);
    errors = top.map(([sig, n], i) => { let s = null; try { s = JSON.parse(samples[i]); } catch (e) {} return { sig, n, last: +lasts[i] || null, ...(s || {}) }; });
  }
  const recent = (res[res.length - 1] || []).map(x => { try { return JSON.parse(x); } catch (e) { return null; } }).filter(Boolean);
  const readyList = Object.values(ready).map(r => ({ ...r, avgMs: r.n ? Math.round(r.ms / r.n) : null })).sort((a, b) => b.n - a.n);
  return { ok: true, env: ENV, at: now, hours, step, series: series.map(s => ({ t: s.t, err: s.err, prob: s.prob, loads: s.loads, readyMs: s.readyN ? Math.round(s.readyMs / s.readyN) : null, readyN: s.readyN })),
    totals, ready: readyList, readyBands: bands, problems, errors, recent };
}
