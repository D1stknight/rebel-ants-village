// The rooms' control desk: one Durable Object per site ('<site>:control'). It keeps
//   the chat settings (chat on / off everywhere, slow mode, links, the word filter and the admins' own words),
//   who is muted or banned (by account), the chat log (every message, the words as typed beside what was shown),
//   the players' reports, and which room copies have been open lately (to reach them).
// The rooms (and groups: '<site>:group:<id>') ask it when a player joins (banned? muted? the settings; a new group: too
// many made today?) and send it every message and report. The Admin Hub
// reaches it through Universe: api/mp-admin.mjs signs each command, the worker checks the signature (index.js /v1/admin),
// this desk runs it once (each command's nonce is kept 10 minutes) and passes it on to the rooms that need it.
import { EVENT_ID, EVENT_ROOM, isLive, briefEvent, normEvent, newEventId } from './events.js';
export const DEFAULT_CFG = { chat: true, slow: 2, links: false, filter: true, words: [], voice: true };
export function normCfg(c) {
  c = c && typeof c === 'object' ? c : {};
  const words = (Array.isArray(c.words) ? c.words : []).map(w => String(w).replace(/\s+/g, ' ').trim().slice(0, 40)).filter(w => w.length >= 2);
  return { chat: c.chat !== false, slow: Math.min(120, Math.max(2, Math.round(+c.slow || 2))), links: c.links === true, filter: c.filter !== false, words: [...new Set(words)].slice(0, 200), voice: c.voice !== false };
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
export const withTimeout = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('timeout')), ms))]);
const SUB = /^[ug]:[A-Za-z0-9_-]{4,64}$/, ROOM = /^[a-z]+:[a-z-]+:\d{1,2}$/, GROUP = /^[a-z]+:group:[A-Za-z0-9_-]{12}$/, UID = /^[A-Za-z0-9_-]{16}$/;
const isRoom = s => typeof s === 'string' && (ROOM.test(s) || GROUP.test(s) || EVENT_ROOM.test(s)); // (a room copy, a group or an event's hall)
export const GROUPS_A_DAY = 30; // new groups an account may make in a UTC day
const FOREVER = 4102444800000; // a ban with no end (2100)
const clamp = (v, lo, hi, d) => { v = Math.round(+v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
const label = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 200);

export class RoomControl {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env; this.sql = ctx.storage.sql; this.site = env.SITE || 'dev';
    for (const q of [
      'CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)',
      'CREATE TABLE IF NOT EXISTS mods (sub TEXT PRIMARY KEY, n TEXT, mute INTEGER DEFAULT 0, ban INTEGER DEFAULT 0, why TEXT, at INTEGER)',
      'CREATE TABLE IF NOT EXISTS log (id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT, i INTEGER, at INTEGER, ch TEXT, sub TEXT, n TEXT, k TEXT, x TEXT, raw TEXT, tsub TEXT, tn TEXT, del INTEGER DEFAULT 0)',
      'CREATE INDEX IF NOT EXISTS log_room ON log (room, i)',
      'CREATE INDEX IF NOT EXISTS log_sub ON log (sub)',
      "CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, room TEXT, why TEXT, state TEXT DEFAULT 'open', data TEXT)",
      'CREATE TABLE IF NOT EXISTS rooms (name TEXT PRIMARY KEY, at INTEGER)',
      'CREATE TABLE IF NOT EXISTS nonces (n TEXT PRIMARY KEY, at INTEGER)',
      'CREATE TABLE IF NOT EXISTS made (sub TEXT, day INTEGER, n INTEGER, PRIMARY KEY (sub, day))',
      'CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, data TEXT, starts INTEGER, ends INTEGER, at INTEGER)',
      // how Universe runs (the dashboard), from the rooms' minute sends (perf()): per minute, village and device (phone /
      // desktop) the pages' reports added up; fps in five bands, ping in four. Kept PERF_DAYS days
      'CREATE TABLE IF NOT EXISTS perf (m INTEGER, v TEXT, d TEXT, n INTEGER DEFAULT 0, fsum REAL DEFAULT 0, f0 INTEGER DEFAULT 0, f1 INTEGER DEFAULT 0, f2 INTEGER DEFAULT 0, f3 INTEGER DEFAULT 0, f4 INTEGER DEFAULT 0, ftsum REAL DEFAULT 0, sl INTEGER DEFAULT 0, fr INTEGER DEFAULT 0, rsum REAL DEFAULT 0, rn INTEGER DEFAULT 0, r0 INTEGER DEFAULT 0, r1 INTEGER DEFAULT 0, r2 INTEGER DEFAULT 0, r3 INTEGER DEFAULT 0, rc INTEGER DEFAULT 0, ins INTEGER DEFAULT 0, gm INTEGER DEFAULT 0, gs INTEGER DEFAULT 0, msum REAL DEFAULT 0, mn INTEGER DEFAULT 0, PRIMARY KEY (m, v, d))',
      'CREATE TABLE IF NOT EXISTS online (m INTEGER, room TEXT, v TEXT, peers INTEGER, last INTEGER, joins INTEGER, PRIMARY KEY (m, room))', // (peers: the most in the minute, last: the newest count)
      'CREATE TABLE IF NOT EXISTS closes (m INTEGER, code INTEGER, n INTEGER, PRIMARY KEY (m, code))',
      'CREATE TABLE IF NOT EXISTS devs (h INTEGER, d TEXT, o TEXT, b TEXT, n INTEGER DEFAULT 0, fsum REAL DEFAULT 0, slow INTEGER DEFAULT 0, rsum REAL DEFAULT 0, rn INTEGER DEFAULT 0, PRIMARY KEY (h, d, o, b))'
    ]) this.sql.exec(q);
    this.cfgCache = null;
  }
  getEvent(id) { if (!EVENT_ID.test(String(id || ''))) return null; const r = this.sql.exec('SELECT data FROM events WHERE id = ?', id).toArray()[0]; try { return r ? JSON.parse(r.data) : null; } catch (e) { return null; } }
  putEvent(ev) { this.sql.exec('INSERT INTO events (id, data, starts, ends, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, starts = excluded.starts, ends = excluded.ends, at = excluded.at', ev.id, JSON.stringify(ev), ev.starts, ev.ends, Date.now()); }
  // a change to an event's hall, if it has been opened (nobody there: the next page to knock loads the event as it is)
  async toHall(id, op) {
    const name = `${this.site}:event:${id}`;
    if (!this.sql.exec('SELECT 1 FROM rooms WHERE name = ?', name).toArray()[0]) return 0;
    return (await this.each(op, name)).reduce((a, [, r]) => a + (+r?.hit || 0), 0);
  }
  cfg() {
    if (!this.cfgCache) { const r = this.sql.exec("SELECT v FROM kv WHERE k = 'cfg'").toArray()[0]; let c = null; try { c = r && JSON.parse(r.v); } catch (e) {} this.cfgCache = normCfg(c || DEFAULT_CFG); }
    return this.cfgCache;
  }
  async fetch(req) {
    const url = new URL(req.url), now = Date.now();
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    // a player joining a room (or a room that needs the settings: sub null)
    if (url.pathname === '/check') {
      if (isRoom(body.room)) this.sql.exec('INSERT INTO rooms (name, at) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET at = excluded.at', body.room, now);
      const m = typeof body.sub === 'string' ? this.sql.exec('SELECT mute, ban FROM mods WHERE sub = ?', body.sub).toArray()[0] : null;
      const out = { cfg: this.cfg(), ban: m && m.ban > now ? m.ban : 0, mute: m && m.mute > now ? m.mute : 0 };
      if (body.made && typeof body.sub === 'string' && SUB.test(body.sub)) { // a new group: counted per account and day
        const day = Math.floor(now / 86400000), n = this.sql.exec('INSERT INTO made (sub, day, n) VALUES (?, ?, 1) ON CONFLICT(sub, day) DO UPDATE SET n = n + 1 RETURNING n', body.sub, day).one().n;
        if (n === 1) this.sql.exec('DELETE FROM made WHERE day < ?', day - 1);
        if (n > Math.max(1, +this.env.GROUPS_A_DAY || GROUPS_A_DAY)) out.tooMany = true;
      }
      return json(out);
    }
    if (url.pathname === '/forget') { // a group or an event's hall that ended
      if (typeof body.room === 'string' && (GROUP.test(body.room) || EVENT_ROOM.test(body.room))) this.sql.exec('DELETE FROM rooms WHERE name = ?', body.room);
      return json({ ok: true });
    }
    // the events: the public list (the worker's GET /v1/events: the lobby and the pages), one event for its hall, the
    // show started or stopped by a host in the hall
    if (url.pathname === '/events') {
      const rows = this.sql.exec('SELECT data FROM events WHERE ends > ? AND starts < ? ORDER BY starts', now, now + 30 * 86400000).toArray().map(r => JSON.parse(r.data)).filter(ev => !ev.ended);
      return json({ ok: true, now, live: rows.filter(ev => isLive(ev, now)).map(ev => briefEvent(ev, now)), next: rows.filter(ev => ev.starts > now).slice(0, 5).map(ev => briefEvent(ev, now)) });
    }
    if (url.pathname === '/event') return json({ ok: true, ev: this.getEvent(body.id) });
    if (url.pathname === '/showat') { const ev = this.getEvent(body.id); if (ev && ev.show) { ev.showAt = Math.max(0, Math.round(+body.at || 0)); this.putEvent(ev); } return json({ ok: true }); }
    if (url.pathname === '/log') {
      const m = body.m || {};
      const r = this.sql.exec('INSERT INTO log (room, i, at, ch, sub, n, k, x, raw, tsub, tn) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id',
        String(body.room || ''), +m.i || 0, +m.at || now, String(m.ch || ''), String(body.sub || ''), String(m.n || ''), String(m.k || ''), String(m.x || ''), body.raw ? String(body.raw) : null, body.tsub ? String(body.tsub) : null, m.tn ? String(m.tn) : null).one();
      if (r.id % 100 === 0) this.sql.exec('DELETE FROM log WHERE id <= ?', r.id - 5000); // the last 5,000
      return json({ ok: true });
    }
    if (url.pathname === '/report') {
      const r = this.sql.exec('INSERT INTO reports (at, room, why, data) VALUES (?, ?, ?, ?) RETURNING id', now, String(body.room || ''), String(body.why || 'other'), JSON.stringify(body)).one();
      if (r.id % 50 === 0) this.sql.exec('DELETE FROM reports WHERE id <= ?', r.id - 1000);
      return json({ ok: true, id: r.id });
    }
    if (url.pathname === '/perf') { this.perf(body, now); return json({ ok: true }); }
    if (url.pathname === '/admin') return json(await this.admin(body, now));
    return json({ ok: false }, 404);
  }
  // a room's minute send (index.js flushPerf): who is in it, how its sockets closed, its pages' reports
  perf(body, now) {
    const at = Math.min(now, +body.at || now), m = Math.floor(at / 60000), h = Math.floor(at / 3600000);
    const room = typeof body.room === 'string' && ROOM.test(body.room) ? body.room : null;
    const peers = clamp(body.peers, 0, 500, 0);
    if (room) this.sql.exec('INSERT INTO online (m, room, v, peers, last, joins) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(m, room) DO UPDATE SET peers = MAX(peers, excluded.peers), last = excluded.last, joins = joins + excluded.joins',
      m, room, room.split(':')[1], peers, peers, clamp(body.joins, 0, 100000, 0));
    for (const [code, n] of Object.entries(body.closes && typeof body.closes === 'object' ? body.closes : {}).slice(0, 20)) {
      const c = clamp(code, 0, 9999, 0), k = clamp(n, 0, 100000, 0);
      if (k) this.sql.exec('INSERT INTO closes (m, code, n) VALUES (?, ?, ?) ON CONFLICT(m, code) DO UPDATE SET n = n + excluded.n', m, c, k);
    }
    const by = new Map(), dev = new Map(), num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    for (const r of Array.isArray(body.reports) ? body.reports.slice(0, 400) : []) {
      if (!r || typeof r !== 'object' || !/^[a-z-]{2,20}$/.test(String(r.v)) || !(num(r.f) > 0)) continue;
      const d = r.d === 'p' ? 'p' : 'd', f = num(r.f), rtt = r.rtt == null ? null : num(r.rtt);
      const a = by.get(r.v + '|' + d) || by.set(r.v + '|' + d, { v: r.v, d, n: 0, fsum: 0, f: [0, 0, 0, 0, 0], ftsum: 0, sl: 0, fr: 0, rsum: 0, rn: 0, r: [0, 0, 0, 0], rc: 0, ins: 0, gm: 0, gs: 0, msum: 0, mn: 0 }).get(r.v + '|' + d);
      a.n++; a.fsum += f; a.f[f < 20 ? 0 : f < 30 ? 1 : f < 45 ? 2 : f < 55 ? 3 : 4]++; a.ftsum += num(r.ft); a.sl += num(r.sl); a.fr += num(r.fr); a.rc += num(r.rc);
      if (rtt != null) { a.rsum += rtt; a.rn++; a.r[rtt < 100 ? 0 : rtt < 200 ? 1 : rtt < 400 ? 2 : 3]++; }
      if (r.i) a.ins++; if (r.g) a.gm++; if (r.k === 'g') a.gs++; if (r.m != null && num(r.m) > 0) { a.msum += num(r.m); a.mn++; }
      const o = ['ios', 'android', 'mac', 'win', 'linux', 'cros'].includes(r.o) ? r.o : 'other', b = ['safari', 'chrome', 'firefox', 'edge', 'opera'].includes(r.b) ? r.b : 'other';
      const e = dev.get(d + '|' + o + '|' + b) || dev.set(d + '|' + o + '|' + b, { d, o, b, n: 0, fsum: 0, slow: 0, rsum: 0, rn: 0 }).get(d + '|' + o + '|' + b);
      e.n++; e.fsum += f; if (f < 30) e.slow++; if (rtt != null) { e.rsum += rtt; e.rn++; }
    }
    for (const a of by.values()) this.sql.exec(`INSERT INTO perf (m, v, d, n, fsum, f0, f1, f2, f3, f4, ftsum, sl, fr, rsum, rn, r0, r1, r2, r3, rc, ins, gm, gs, msum, mn) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(m, v, d) DO UPDATE SET n = n + excluded.n, fsum = fsum + excluded.fsum, f0 = f0 + excluded.f0, f1 = f1 + excluded.f1, f2 = f2 + excluded.f2, f3 = f3 + excluded.f3, f4 = f4 + excluded.f4, ftsum = ftsum + excluded.ftsum,
      sl = sl + excluded.sl, fr = fr + excluded.fr, rsum = rsum + excluded.rsum, rn = rn + excluded.rn, r0 = r0 + excluded.r0, r1 = r1 + excluded.r1, r2 = r2 + excluded.r2, r3 = r3 + excluded.r3, rc = rc + excluded.rc,
      ins = ins + excluded.ins, gm = gm + excluded.gm, gs = gs + excluded.gs, msum = msum + excluded.msum, mn = mn + excluded.mn`,
      m, a.v, a.d, a.n, a.fsum, ...a.f, a.ftsum, a.sl, a.fr, a.rsum, a.rn, ...a.r, a.rc, a.ins, a.gm, a.gs, a.msum, a.mn);
    for (const e of dev.values()) this.sql.exec('INSERT INTO devs (h, d, o, b, n, fsum, slow, rsum, rn) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(h, d, o, b) DO UPDATE SET n = n + excluded.n, fsum = fsum + excluded.fsum, slow = slow + excluded.slow, rsum = rsum + excluded.rsum, rn = rn + excluded.rn',
      h, e.d, e.o, e.b, e.n, e.fsum, e.slow, e.rsum, e.rn);
    // older than PERF_DAYS days: gone (looked at once every 30 minutes)
    const pruned = +((this.sql.exec("SELECT v FROM kv WHERE k = 'perfPruned'").toArray()[0] || {}).v || 0);
    if (m - pruned >= 30) {
      const cut = m - Math.max(1, +this.env.PERF_DAYS || 14) * 1440;
      for (const t of ['perf', 'online', 'closes']) this.sql.exec(`DELETE FROM ${t} WHERE m < ?`, cut);
      this.sql.exec('DELETE FROM devs WHERE h < ?', Math.floor(cut / 60));
      this.sql.exec("INSERT INTO kv (k, v) VALUES ('perfPruned', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", String(m));
    }
  }
  // the dashboard's numbers over the last `hours` (1 h to 14 days): a series in steps (players online: the most in a step;
  // fps by device, the share under 30 fps, ping, the share at 200 ms or more, dropped connections), each village and
  // device family over the whole span, and the last five minutes
  stats(args, now) {
    const hours = clamp(args.hours, 1, 336, 24), from = Math.floor((now - hours * 3600000) / 60000);
    const step = clamp(args.step, 1, 1440, hours <= 6 ? 5 : hours <= 48 ? 15 : hours <= 168 ? 60 : 180), at = mm => Math.floor(mm / step) * step;
    const series = new Map(), S = mm => { const k = at(mm); return series.get(k) || series.set(k, { t: k * 60000, online: 0, joins: 0, nD: 0, fD: 0, nP: 0, fP: 0, slow: 0, n: 0, rsum: 0, rn: 0, lag: 0, drops: 0, freezes: 0, reconnects: 0 }).get(k); };
    // players online in a step: each copy's most in it, added up (copies send in different minutes)
    for (const r of this.sql.exec('SELECT k, SUM(mp) AS p, SUM(j) AS j FROM (SELECT (m / ?) * ? AS k, room, MAX(peers) AS mp, SUM(joins) AS j FROM online WHERE m >= ? GROUP BY k, room) GROUP BY k', step, step, from).toArray()) { const s = S(r.k); s.online = r.p; s.joins = r.j; }
    for (const r of this.sql.exec('SELECT m, d, SUM(n) AS n, SUM(fsum) AS fsum, SUM(f0 + f1) AS slow, SUM(rsum) AS rsum, SUM(rn) AS rn, SUM(r2 + r3) AS lag, SUM(fr) AS fr, SUM(rc) AS rc FROM perf WHERE m >= ? GROUP BY m, d', from).toArray()) {
      const s = S(r.m); if (r.d === 'p') { s.nP += r.n; s.fP += r.fsum; } else { s.nD += r.n; s.fD += r.fsum; }
      s.n += r.n; s.slow += r.slow; s.rsum += r.rsum; s.rn += r.rn; s.lag += r.lag; s.freezes += r.fr; s.reconnects += r.rc;
    }
    const DROP = [1006, 1011, 4002, 4008];
    const closes = {};
    for (const r of this.sql.exec('SELECT m, code, SUM(n) AS n FROM closes WHERE m >= ? GROUP BY m, code', from).toArray()) { closes[r.code] = (closes[r.code] || 0) + r.n; if (DROP.includes(r.code)) S(r.m).drops += r.n; }
    const r1 = v => Math.round(v * 10) / 10, pct = (a, b) => (b ? Math.round(a / b * 1000) / 10 : null);
    const out = [...series.values()].sort((a, b) => a.t - b.t).map(s => ({ t: s.t, online: s.online, joins: s.joins, fpsD: s.nD ? r1(s.fD / s.nD) : null, fpsP: s.nP ? r1(s.fP / s.nP) : null,
      reports: s.n, slowPct: pct(s.slow, s.n), rtt: s.rn ? Math.round(s.rsum / s.rn) : null, lagPct: pct(s.lag, s.rn), drops: s.drops, freezes: s.freezes, reconnects: s.reconnects }));
    const peaks = new Map(this.sql.exec('SELECT v, MAX(t) AS peak FROM (SELECT k, v, SUM(mp) AS t FROM (SELECT m / 5 AS k, room, v, MAX(peers) AS mp FROM online WHERE m >= ? GROUP BY k, room) GROUP BY k, v) GROUP BY v', from).toArray().map(r => [r.v, r.peak]));
    const villages = this.sql.exec(`SELECT v, SUM(n) AS n, SUM(fsum) AS fsum, SUM(f0) AS f0, SUM(f1) AS f1, SUM(f2) AS f2, SUM(f3) AS f3, SUM(f4) AS f4, SUM(ftsum) AS ftsum, SUM(rsum) AS rsum, SUM(rn) AS rn, SUM(r2 + r3) AS lag,
      SUM(fr) AS fr, SUM(sl) AS sl, SUM(ins) AS ins, SUM(gm) AS gm, SUM(CASE WHEN d = 'p' THEN n ELSE 0 END) AS np, SUM(CASE WHEN d = 'p' THEN fsum ELSE 0 END) AS fp FROM perf WHERE m >= ? GROUP BY v ORDER BY n DESC`, from).toArray()
      .map(r => ({ v: r.v, reports: r.n, fps: r1(r.fsum / r.n), fpsP: r.np ? r1(r.fp / r.np) : null, fpsD: r.n - r.np ? r1((r.fsum - r.fp) / (r.n - r.np)) : null, bands: [r.f0, r.f1, r.f2, r.f3, r.f4], slowPct: pct(r.f0 + r.f1, r.n),
        frameMs: Math.round(r.ftsum / r.n), rtt: r.rn ? Math.round(r.rsum / r.rn) : null, lagPct: pct(r.lag, r.rn), freezes: r.fr, slowFrames: r.sl, inRooms: pct(r.ins, r.n), inGames: pct(r.gm, r.n), peak: peaks.get(r.v) || 0 }));
    for (const [v, peak] of peaks) if (!villages.some(x => x.v === v)) villages.push({ v, reports: 0, fps: null, slowPct: null, rtt: null, peak });
    const devices = this.sql.exec('SELECT d, o, b, SUM(n) AS n, SUM(fsum) AS fsum, SUM(slow) AS slow, SUM(rsum) AS rsum, SUM(rn) AS rn FROM devs WHERE h >= ? GROUP BY d, o, b ORDER BY n DESC LIMIT 30', Math.floor(from / 60)).toArray()
      .map(r => ({ d: r.d, o: r.o, b: r.b, reports: r.n, fps: r1(r.fsum / r.n), slowPct: pct(r.slow, r.n), rtt: r.rn ? Math.round(r.rsum / r.rn) : null }));
    // the last five minutes (players online: each copy's newest send in them)
    const m5 = Math.floor(now / 60000) - 5;
    const latest = new Map(); for (const r of this.sql.exec('SELECT room, last FROM online WHERE m >= ? ORDER BY m DESC', m5).toArray()) if (!latest.has(r.room)) latest.set(r.room, r.last);
    const recent = this.sql.exec("SELECT SUM(n) AS n, SUM(fsum) AS fsum, SUM(CASE WHEN d = 'p' THEN n ELSE 0 END) AS np, SUM(CASE WHEN d = 'p' THEN fsum ELSE 0 END) AS fp, SUM(f0 + f1) AS slow, SUM(rsum) AS rsum, SUM(rn) AS rn, SUM(r2 + r3) AS lag, SUM(msum) AS msum, SUM(mn) AS mn FROM perf WHERE m >= ?", m5).one();
    const n = recent.n || 0, nd = n - (recent.np || 0);
    const nowStats = { reports: n, online: [...latest.values()].reduce((a, b) => a + b, 0), rooms: [...latest.values()].filter(Boolean).length, fpsD: nd ? r1((recent.fsum - recent.fp) / nd) : null, fpsP: recent.np ? r1(recent.fp / recent.np) : null, slowPct: pct(recent.slow || 0, n),
      rtt: recent.rn ? Math.round(recent.rsum / recent.rn) : null, lagPct: pct(recent.lag || 0, recent.rn || 0), memMB: recent.mn ? Math.round(recent.msum / recent.mn) : null };
    return { at: now, hours, step, series: out, villages, devices, closes, now: nowStats };
  }
  // a command to the rooms: every room copy and group open in the last three days, or only the one named (who is online:
  // the room copies only, group members are in rooms too)
  async each(op, only) {
    const names = (only ? [only] : this.sql.exec('SELECT name FROM rooms WHERE at > ?', Date.now() - 3 * 86400000).toArray().map(r => r.name)).filter(n => op.op !== 'who' || ROOM.test(n));
    const out = await Promise.allSettled(names.map(async name => {
      const ns = GROUP.test(name) ? this.env.GROUPS : EVENT_ROOM.test(name) ? this.env.STAGES : this.env.ROOMS; if (!ns) return [name, null];
      const r = await withTimeout(ns.get(ns.idFromName(name)).fetch('https://room/ctl', { method: 'POST', body: JSON.stringify(op) }), 4000);
      return [name, await r.json()];
    }));
    return out.map((r, k) => (r.status === 'fulfilled' ? r.value : [names[k], null]));
  }
  async admin({ cmd, args, nonce }, now) {
    args = args && typeof args === 'object' ? args : {};
    this.sql.exec('DELETE FROM nonces WHERE at < ?', now - 600000);
    if (this.sql.exec('SELECT 1 FROM nonces WHERE n = ?', String(nonce)).toArray().length) return { ok: false, error: 'This command was already used' };
    this.sql.exec('INSERT INTO nonces (n, at) VALUES (?, ?)', String(nonce), now);
    const sub = typeof args.sub === 'string' && SUB.test(args.sub) ? args.sub : null, name = label(args.n).slice(0, 40);
    const reached = rows => rows.reduce((a, [, r]) => a + (+r?.hit || 0), 0);
    const mod = (field, until) => {
      this.sql.exec(`INSERT INTO mods (sub, n, ${field}, why, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(sub) DO UPDATE SET ${field} = excluded.${field}, n = COALESCE(NULLIF(excluded.n, ''), mods.n), why = excluded.why, at = excluded.at`, sub, name, until, label(args.why), now);
    };
    switch (cmd) {
      case 'online': {
        const rows = await this.each({ op: 'who' }), rooms = [];
        for (const [room, r] of rows) {
          if (!r) continue;
          if (!r.players?.length) { this.sql.exec('DELETE FROM rooms WHERE name = ? AND at < ?', room, now - 60000); continue; }
          const [, village, copy] = room.split(':'); rooms.push({ room, village, copy: +copy, players: r.players });
        }
        rooms.sort((a, b) => b.players.length - a.players.length);
        return { ok: true, at: now, rooms, total: rooms.reduce((a, r) => a + r.players.length, 0) };
      }
      case 'log': {
        const where = [], b = [], q = label(args.q).replace(/[%_]/g, '').slice(0, 60);
        if (isRoom(args.room)) { where.push('room = ?'); b.push(args.room); }
        else if (typeof args.village === 'string' && /^[a-z-]{2,20}$/.test(args.village)) { where.push('room LIKE ?'); b.push(`${this.site}:${args.village}:%`); }
        if (sub) { where.push('(sub = ? OR tsub = ?)'); b.push(sub, sub); }
        if (q) { where.push('(x LIKE ? OR raw LIKE ? OR n LIKE ?)'); b.push(`%${q}%`, `%${q}%`, `%${q}%`); }
        if (+args.before > 0) { where.push('id < ?'); b.push(+args.before); }
        const rows = this.sql.exec(`SELECT * FROM log ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY id DESC LIMIT ${clamp(args.limit, 1, 300, 100)}`, ...b).toArray();
        return { ok: true, rows };
      }
      case 'reports': {
        const rows = this.sql.exec(`SELECT * FROM reports ${args.all ? '' : "WHERE state = 'open'"} ORDER BY id DESC LIMIT ${clamp(args.limit, 1, 200, 50)}`).toArray()
          .map(r => { let d = {}; try { d = JSON.parse(r.data); } catch (e) {} return { id: r.id, at: r.at, room: r.room, why: r.why, state: r.state, ...d }; });
        const open = this.sql.exec("SELECT COUNT(*) AS n FROM reports WHERE state = 'open'").one().n;
        return { ok: true, rows, open };
      }
      case 'report-state': {
        const state = ['open', 'done', 'dismissed'].includes(args.state) ? args.state : 'done';
        this.sql.exec('UPDATE reports SET state = ? WHERE id = ?', state, clamp(args.id, 1, 1e12, 0));
        return { ok: true };
      }
      case 'mods': {
        const rows = this.sql.exec('SELECT * FROM mods WHERE mute > ? OR ban > ? ORDER BY at DESC LIMIT 500', now, now).toArray();
        return { ok: true, rows };
      }
      case 'mute': case 'unmute': {
        if (!sub) return { ok: false, error: 'Which account?' };
        const until = cmd === 'mute' ? now + clamp(args.minutes, 1, 43200, 60) * 60000 : 0;
        mod('mute', until);
        return { ok: true, until, reached: reached(await this.each({ op: 'mute', sub, until })) };
      }
      case 'ban': case 'unban': {
        if (!sub) return { ok: false, error: 'Which account?' };
        const h = clamp(args.hours, 0, 8760, 24), until = cmd === 'ban' ? (h ? now + h * 3600000 : FOREVER) : 0;
        mod('ban', until);
        return { ok: true, until, reached: cmd === 'ban' ? reached(await this.each({ op: 'kick', sub, why: 'banned', until })) : 0 };
      }
      case 'kick': {
        if (!sub) return { ok: false, error: 'Which account?' };
        return { ok: true, reached: reached(await this.each({ op: 'kick', sub, why: 'kick' })) };
      }
      case 'del': {
        if (!isRoom(args.room) || !(+args.i > 0)) return { ok: false, error: 'Which message?' };
        this.sql.exec('UPDATE log SET del = 1 WHERE room = ? AND i = ?', args.room, +args.i);
        return { ok: true, reached: reached(await this.each({ op: 'del', i: +args.i }, args.room)) };
      }
      case 'clear': {
        const only = isRoom(args.room) ? args.room : null;
        return { ok: true, reached: reached(await this.each({ op: 'clear' }, only)) };
      }
      case 'cfg-get': return { ok: true, cfg: this.cfg() };
      case 'stats': return { ok: true, ...this.stats(args, now) };
      // the Colony Stage's events (events.js): the list (admins see everything), made or changed, live now, ended, the show,
      // a host added from Online now or taken off, deleted
      case 'events': {
        const events = this.sql.exec('SELECT data FROM events WHERE ends > ? ORDER BY starts DESC LIMIT 100', now - 14 * 86400000).toArray().map(r => JSON.parse(r.data)).map(ev => ({ ...ev, live: isLive(ev, now) }));
        return { ok: true, now, events };
      }
      case 'event-save': {
        const old = args.id ? this.getEvent(args.id) : null;
        if (args.id && !old) return { ok: false, error: 'No such event' };
        const r = normEvent(args, old, now); if (r.error) return { ok: false, error: r.error };
        const ev = { ...r.ev, id: old ? old.id : newEventId() };
        this.putEvent(ev);
        return { ok: true, ev, reached: old ? await this.toHall(ev.id, { op: 'ev', ev }) : 0 };
      }
      case 'event-live': case 'event-end': {
        const ev = this.getEvent(args.id); if (!ev) return { ok: false, error: 'No such event' };
        if (cmd === 'event-live') { ev.starts = now; ev.ends = Math.max(ev.ends, now + 3600000); ev.ended = 0; }
        else { ev.ended = now; ev.showAt = 0; }
        this.putEvent(ev);
        return { ok: true, ev, reached: await this.toHall(ev.id, cmd === 'event-end' ? { op: 'end' } : { op: 'ev', ev }) };
      }
      case 'event-show': {
        const ev = this.getEvent(args.id); if (!ev) return { ok: false, error: 'No such event' };
        if (!ev.show) return { ok: false, error: 'This event has no show yet.' };
        if (args.go && !isLive(ev, now)) return { ok: false, error: 'The event is not live.' };
        ev.showAt = args.go ? now + 3000 : 0; this.putEvent(ev);
        return { ok: true, ev, reached: await this.toHall(ev.id, { op: 'show', go: !!args.go, at: ev.showAt }) };
      }
      case 'event-host': {
        const ev = this.getEvent(args.id); if (!ev) return { ok: false, error: 'No such event' };
        if (!sub || /^g:/.test(sub)) return { ok: false, error: 'Hosts are signed-in players' };
        ev.hosts = (ev.hosts || []).filter(h => h.sub !== sub);
        if (args.on !== false) { if (!UID.test(String(args.u || ''))) return { ok: false, error: 'Which player?' }; if (ev.hosts.length >= 6) return { ok: false, error: 'Six hosts at most' }; ev.hosts.push({ sub, u: args.u, n: name || 'Host' }); }
        this.putEvent(ev);
        return { ok: true, ev, reached: await this.toHall(ev.id, { op: 'ev', ev }) };
      }
      case 'event-delete': {
        const ev = this.getEvent(args.id); if (!ev) return { ok: false, error: 'No such event' };
        const reachedN = await this.toHall(ev.id, { op: 'end' });
        this.sql.exec('DELETE FROM events WHERE id = ?', ev.id);
        return { ok: true, reached: reachedN };
      }
      case 'cfg-set': {
        const cfg = normCfg({ ...this.cfg(), ...args });
        this.sql.exec("INSERT INTO kv (k, v) VALUES ('cfg', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", JSON.stringify(cfg)); this.cfgCache = cfg;
        return { ok: true, cfg, reached: reached(await this.each({ op: 'cfg', cfg })) };
      }
    }
    return { ok: false, error: 'Unknown command' };
  }
}
