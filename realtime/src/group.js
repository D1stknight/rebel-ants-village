// Groups (multiplayer step 4): up to GROUP_MAX signed-in players who see where the others are, in any village, and talk
// in a group chat. One Durable Object per group ('<site>:group:<id>'); each member's page holds a second socket to it:
//   wss://<worker>/v1/group?id=<id>|new   (subprotocols 'rebel-universe.v1' and 't.<ticket>', the same tickets as the rooms)
// 'new' makes a group with the opener as its leader (GROUPS_A_DAY a day per account, the control desk counts). A group lets
// in its members and anyone a member invited in the last INVITE_MS; the rest are turned away (403). Members who change
// village drop and come back (a page each village): they stay members; anyone away for AWAY_MS is taken off, and the group
// ends with its last member (an alarm every AWAY_MS while it has members: no timers, so a quiet group hibernates).
//   client -> group {t:'gp', v:village, c:copy, i:interior|null, p:[x,z]}    where I am (when it changes, at most once a second)
//                   {t:'gc', x}                                        a message to the group (the room chat's rules and filter)
//                   {t:'gi', u, n}                                     invite that player (their short code, their name)
//                   {t:'gk', u}                                        the leader takes a member off
//                   {t:'gl'}                                           leave the group
//                   {t:'rp', i, why, note}                             report a group message
//   group -> client {t:'ghi', g:id, you:u, lead:u, max, members:[member], hist:[msg], cfg:{chat, slow}, mute}
//                   {t:'gj', m:member}   joined      {t:'gx', u, why:'left'|'kick'|'away'}   off the group
//                   {t:'gon', u, on}   connected or not      {t:'gp', u, v, c, i, p}   where a member is
//                   {t:'glead', u}   the new leader      {t:'gc', m:msg}   a message      {t:'gcx', why, ...}   not sent
//                   {t:'gi', ok, u, why}   an invite noted (or why not: slow, who, member, full)      {t:'rpok'}   a report taken
//                   {t:'gcd', i} / {t:'gcc'}   a message deleted / the chat cleared (admin)      {t:'gcm', until}   you are muted
//                   {t:'gcfg', chat, slow}   the chat settings      {t:'kick', why, until}   then the socket closes (4003)
//                   {t:'gdup'}   the same account opened the group again elsewhere (this one closes: 4001)
//   member = {u, n, k, look:{t, col, tok}, v, c (the village copy), i, p, on, lead}      msg = {i, u, n, k, x, at}
// The sockets close with 4004 when a member is off the group (left, taken off, away) or the group ends.
// Messages and reports go to the control desk like the rooms' (its room name '<site>:group:<id>'), so the admins see them
// and reach the group: their mutes, kicks, bans, deletes and settings count here too.
import { MAX_CHARS, cleanText, charCount, filterText } from './chat.js';
import { DEFAULT_CFG, normCfg, withTimeout } from './control.js';
import { VILLAGES } from './villages.js';

export const GROUP_MAX = 8, INVITE_MS = 10 * 60 * 1000, AWAY_MS = 30 * 60 * 1000;
const PROTOCOL = 'rebel-universe.v1', HISTORY = 50, KEEP = 200;
const INTERIOR = /^[A-Za-z0-9_-]{1,64}$/, UID = /^[A-Za-z0-9_-]{16}$/;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export class PartyGroup {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env; this.site = env.SITE || 'dev'; this.sql = ctx.storage.sql;
    this.away = Math.max(1000, +env.GROUP_AWAY_MS || AWAY_MS); // (shorter in tests)
    this.schema();
    this.socks = new Map(); // ws -> live member state (u, sub, n, k, mute, rate limits)
    for (const ws of ctx.getWebSockets()) { const a = ws.deserializeAttachment(); if (a && a.u) this.socks.set(ws, this.live(a)); }
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
  }
  schema() {
    for (const q of [
      'CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)',
      'CREATE TABLE IF NOT EXISTS members (u TEXT PRIMARY KEY, sub TEXT, n TEXT, k TEXT, look TEXT, v TEXT, c INTEGER, i TEXT, px REAL, pz REAL, seen INTEGER, joined INTEGER)',
      'CREATE TABLE IF NOT EXISTS invites (u TEXT PRIMARY KEY, by TEXT, at INTEGER)',
      'CREATE TABLE IF NOT EXISTS chat (i INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, u TEXT, sub TEXT, n TEXT, k TEXT, x TEXT, del INTEGER DEFAULT 0)'
    ]) this.sql.exec(q);
  }
  kv(k) { const r = this.sql.exec('SELECT v FROM kv WHERE k = ?', k).toArray()[0]; return r ? r.v : null; }
  kvSet(k, v) { this.sql.exec('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, String(v)); }
  room() { const id = this.kv('id'); return id ? `${this.site}:group:${id}` : null; } // (the control desk's name for it)
  live(a) { return { mute: 0, ...a, win: 0, cnt: 0, said: 0, lastX: '', gp: 0, inv: 0, rep: 0, reps: 0 }; }
  slim(p) { return { u: p.u, sub: p.sub, n: p.n, k: p.k, mute: p.mute || 0 }; }
  members() { return this.sql.exec('SELECT * FROM members ORDER BY joined').toArray(); }
  online(u) { for (const p of this.socks.values()) if (p.u === u) return true; return false; }
  pub(r) {
    let look = null; try { look = JSON.parse(r.look || 'null'); } catch (e) {}
    return { u: r.u, n: r.n, k: r.k, look, v: r.v || null, c: r.c || null, i: r.i || null, p: r.v ? [r.px, r.pz] : null, on: this.online(r.u), lead: this.kv('lead') === r.u };
  }
  all(o, except) { const s = JSON.stringify(o); for (const w of this.socks.keys()) if (w !== except) try { w.send(s); } catch (e) {} }
  control() { return this.env.CONTROL.get(this.env.CONTROL.idFromName(this.site + ':control')); }
  toControl(path, body) { const p = this.control().fetch('https://control' + path, { method: 'POST', body: JSON.stringify(body) }).catch(() => {}); try { this.ctx.waitUntil(p); } catch (e) {} }
  // the control desk: banned, muted, the settings (and it learns this group is open). Not answering in time = let in
  async check(sub, room, made) {
    try {
      const r = await withTimeout(this.control().fetch('https://control/check', { method: 'POST', body: JSON.stringify({ room, sub, made: made ? 1 : 0 }) }), 2500);
      const d = await r.json(); if (d.cfg) this.cfg = normCfg(d.cfg);
      return { ban: +d.ban || 0, mute: +d.mute || 0, tooMany: !!d.tooMany };
    } catch (e) { return { ban: 0, mute: 0, tooMany: false }; }
  }
  history() { return this.sql.exec('SELECT i, at, u, n, k, x FROM chat WHERE del = 0 ORDER BY i DESC LIMIT ?', HISTORY).toArray().reverse(); }
  async alarmSoon() { if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + this.away); }

  async fetch(req) {
    const url = new URL(req.url), now = Date.now();
    if (url.pathname === '/ctl') return this.ctl(await req.json().catch(() => ({})));
    const ident = JSON.parse(req.headers.get('x-ru-ident') || 'null');
    if (!ident || req.headers.get('upgrade') !== 'websocket' || !UID.test(ident.u || '')) return json({ ok: false }, 400);
    const id = url.searchParams.get('id') || '', fresh = url.searchParams.get('new') === '1';
    if (fresh ? this.kv('id') : this.kv('id') !== id) return json({ ok: false, error: fresh ? 'taken' : 'no such group' }, fresh ? 409 : 404);
    if (!fresh && !this.sql.exec('SELECT u FROM members WHERE u = ?', ident.u).toArray()[0]) {
      const invite = this.sql.exec('SELECT at FROM invites WHERE u = ?', ident.u).toArray()[0];
      if (!invite || now - invite.at > INVITE_MS) return json({ ok: false, error: 'not invited' }, 403);
      if (this.members().length >= GROUP_MAX) return json({ ok: false, error: 'full' }, 409);
    }
    const chk = await this.check(ident.sub, `${this.site}:group:${id}`, fresh);
    if (chk.ban > now) return json({ ok: false, error: 'banned' }, 403);
    if (fresh && chk.tooMany) return json({ ok: false, error: 'too many groups today' }, 429);
    // (the desk was asked: things may have moved meanwhile)
    if (fresh) { if (this.kv('id')) return json({ ok: false, error: 'taken' }, 409); this.kvSet('id', id); this.kvSet('lead', ident.u); this.kvSet('made', now); }
    else if (this.kv('id') !== id) return json({ ok: false, error: 'no such group' }, 404);
    const look = ident.look && typeof ident.look === 'object' ? { t: String(ident.look.t || ''), col: ident.look.col || null, tok: ident.look.tok || null } : null;
    const again = !!this.sql.exec('SELECT u FROM members WHERE u = ?', ident.u).toArray()[0];
    if (again) this.sql.exec('UPDATE members SET sub = ?, n = ?, k = ?, look = ?, seen = ? WHERE u = ?', ident.sub, ident.n, ident.k, JSON.stringify(look), now, ident.u);
    else {
      if (!fresh) {
        const invite = this.sql.exec('SELECT at FROM invites WHERE u = ?', ident.u).toArray()[0];
        if (!invite || now - invite.at > INVITE_MS) return json({ ok: false, error: 'not invited' }, 403);
        if (this.members().length >= GROUP_MAX) return json({ ok: false, error: 'full' }, 409);
      }
      this.sql.exec('INSERT INTO members (u, sub, n, k, look, seen, joined) VALUES (?, ?, ?, ?, ?, ?, ?)', ident.u, ident.sub, ident.n, ident.k, JSON.stringify(look), now, now);
      this.sql.exec('DELETE FROM invites WHERE u = ?', ident.u);
    }
    // the same account opened the group again (another tab, or this page again after a drop): the older socket goes
    for (const [w, p] of [...this.socks]) if (p.u === ident.u) { try { w.serializeAttachment({ gone: true }); w.send('{"t":"gdup"}'); w.close(4001, 'opened elsewhere'); } catch (e) {} this.socks.delete(w); }
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    const p = this.live({ u: ident.u, sub: ident.sub, n: ident.n, k: ident.k, mute: chk.mute > now ? chk.mute : 0 });
    server.serializeAttachment(this.slim(p)); this.socks.set(server, p);
    const cfg = this.cfg || normCfg(DEFAULT_CFG);
    server.send(JSON.stringify({ t: 'ghi', g: id, you: ident.u, lead: this.kv('lead'), max: GROUP_MAX, members: this.members().map(r => this.pub(r)), hist: this.history(), cfg: { chat: cfg.chat, slow: cfg.slow }, mute: p.mute }));
    const r = this.sql.exec('SELECT * FROM members WHERE u = ?', ident.u).toArray()[0];
    if (!again) this.all({ t: 'gj', m: this.pub(r) }, server); else this.all({ t: 'gon', u: ident.u, on: true }, server);
    await this.alarmSoon();
    return new Response(null, { status: 101, webSocket: client, headers: { 'sec-websocket-protocol': PROTOCOL } });
  }
  async webSocketMessage(ws, data) {
    const p = this.socks.get(ws); if (!p) return;
    if (typeof data !== 'string' || data.length > 1024) return;
    const now = Date.now();
    if (now - p.win > 2000) { p.win = now; p.cnt = 0; }
    if (++p.cnt > 24) { if (p.cnt > 96) try { ws.close(4008, 'too many messages'); } catch (e) {} return; }
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'gp') return this.where(ws, p, m, now);
    if (m.t === 'gc') return this.chat(ws, p, m, now);
    if (m.t === 'gi') return this.invite(ws, p, m, now);
    if (m.t === 'gk') return this.kick(ws, p, m);
    if (m.t === 'gl') return this.leave(p.u, 'left');
    if (m.t === 'rp') return this.report(ws, p, m, now);
  }
  where(ws, p, m, now) {
    if (now - p.gp < 900) return;
    const v = VILLAGES.has(m.v) ? m.v : null, i = typeof m.i === 'string' && INTERIOR.test(m.i) ? m.i : null, c = Number.isInteger(m.c) && m.c >= 1 && m.c <= 99 ? m.c : null;
    const q = Array.isArray(m.p) && m.p.length === 2 && m.p.every(x => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) < 5000) ? m.p.map(x => Math.round(x * 10) / 10) : null;
    if (!v || !q || (m.i != null && !i)) return;
    p.gp = now;
    this.sql.exec('UPDATE members SET v = ?, c = ?, i = ?, px = ?, pz = ?, seen = ? WHERE u = ?', v, c, i, q[0], q[1], now, p.u);
    this.all({ t: 'gp', u: p.u, v, c, i, p: q }, ws);
  }
  async chat(ws, p, m, now) {
    const no = o => { try { ws.send(JSON.stringify({ t: 'gcx', ...o })); } catch (e) {} };
    if (!this.cfg) await this.check(null, this.room());
    const cfg = this.cfg || normCfg(DEFAULT_CFG);
    if (!this.socks.has(ws)) return;
    if (!cfg.chat) return no({ why: 'off' });
    if (p.mute > now) return no({ why: 'muted', until: p.mute });
    const gap = cfg.slow * 1000;
    if (now - p.said < gap) return no({ why: 'slow', wait: gap - (now - p.said) });
    const raw = cleanText(m.x);
    if (!raw) return no({ why: 'empty' });
    if (charCount(raw) > MAX_CHARS) return no({ why: 'long', max: MAX_CHARS });
    if (raw.toLowerCase() === p.lastX && now - p.said < 30000) return no({ why: 'same' });
    const { text } = filterText(raw, cfg);
    p.said = now; p.lastX = raw.toLowerCase();
    const row = this.sql.exec('INSERT INTO chat (at, u, sub, n, k, x) VALUES (?, ?, ?, ?, ?, ?) RETURNING i', now, p.u, p.sub, p.n, p.k, text).one();
    if (row.i % 20 === 0) this.sql.exec('DELETE FROM chat WHERE i <= ?', row.i - KEEP);
    const msg = { i: row.i, u: p.u, n: p.n, k: p.k, x: text, at: now };
    this.all({ t: 'gc', m: msg });
    this.toControl('/log', { room: this.room(), m: { ...msg, ch: 'g' }, sub: p.sub, raw: raw !== text ? raw : null });
  }
  invite(ws, p, m, now) {
    const no = why => { try { ws.send(JSON.stringify({ t: 'gi', ok: false, u: typeof m.u === 'string' ? m.u.slice(0, 16) : null, why })); } catch (e) {} };
    if (now - p.inv < 2000) return no('slow'); p.inv = now;
    const u = typeof m.u === 'string' && UID.test(m.u) ? m.u : null; if (!u || u === p.u) return no('who');
    if (this.sql.exec('SELECT u FROM members WHERE u = ?', u).toArray()[0]) return no('member');
    if (this.members().length >= GROUP_MAX) return no('full');
    this.sql.exec('INSERT INTO invites (u, by, at) VALUES (?, ?, ?) ON CONFLICT(u) DO UPDATE SET by = excluded.by, at = excluded.at', u, p.u, now);
    this.sql.exec('DELETE FROM invites WHERE at < ?', now - INVITE_MS);
    try { ws.send(JSON.stringify({ t: 'gi', ok: true, u })); } catch (e) {}
  }
  kick(ws, p, m) {
    if (this.kv('lead') !== p.u) return;
    const u = typeof m.u === 'string' && UID.test(m.u) ? m.u : null; if (!u || u === p.u) return;
    return this.leave(u, 'kick');
  }
  // off the group: told, their sockets closed; a new leader if it was the leader; the group ends with its last member
  async leave(u, why) {
    if (!this.sql.exec('SELECT u FROM members WHERE u = ?', u).toArray()[0]) return;
    this.sql.exec('DELETE FROM members WHERE u = ?', u);
    this.sql.exec('DELETE FROM invites WHERE u = ?', u);
    this.all({ t: 'gx', u, why });
    for (const [w, p] of [...this.socks]) if (p.u === u) { try { w.serializeAttachment({ gone: true }); w.close(4004, why); } catch (e) {} this.socks.delete(w); }
    const rest = this.members();
    if (!rest.length) return this.end();
    if (this.kv('lead') === u) { const next = rest.find(r => this.online(r.u)) || rest[0]; this.kvSet('lead', next.u); this.all({ t: 'glead', u: next.u }); }
  }
  // nothing kept: the sockets closed, the alarm and the storage gone (the tables made again, empty: a late knock is a
  // 404), and the control desk forgets the group
  async end() {
    const room = this.room();
    for (const w of this.socks.keys()) try { w.serializeAttachment({ gone: true }); w.close(4004, 'ended'); } catch (e) {}
    this.socks.clear();
    if (room) this.toControl('/forget', { room });
    try { await this.ctx.storage.deleteAlarm(); } catch (e) {}
    try { await this.ctx.storage.deleteAll(); } catch (e) {}
    this.schema();
  }
  report(ws, p, m, now) {
    const no = why => { try { ws.send(JSON.stringify({ t: 'gcx', why })); } catch (e) {} };
    if (now - p.rep < 15000 || p.reps >= 20) return no('report-slow');
    const r = Number.isInteger(m.i) ? this.sql.exec('SELECT * FROM chat WHERE i = ?', m.i).toArray()[0] : null;
    if (!r || r.sub === p.sub) return no('report-none');
    p.rep = now; p.reps++;
    const why = ['spam', 'abuse', 'scam', 'other'].includes(m.why) ? m.why : 'other';
    const context = this.sql.exec('SELECT i, at, n, sub, x FROM chat WHERE at > ? ORDER BY i DESC LIMIT 12', now - 3600000).toArray().reverse().map(c => ({ ...c, ch: 'g' }));
    this.toControl('/report', { room: this.room(), why, note: cleanText(m.note).slice(0, 200), by: { sub: p.sub, n: p.n, k: p.k }, target: { sub: r.sub, n: r.n, k: r.k, u: r.u }, msg: { i: r.i, ch: 'g', x: r.x, at: r.at }, context, where: null });
    try { ws.send('{"t":"rpok"}'); } catch (e) {}
  }
  // from the control desk (an admin's command): the settings, a mute, a kick or ban, a message deleted, the chat cleared
  ctl(op) {
    let hit = 0;
    if (op.op === 'cfg') { this.cfg = normCfg(op.cfg); this.all({ t: 'gcfg', chat: this.cfg.chat, slow: this.cfg.slow }); hit = this.socks.size; }
    if (op.op === 'mute') for (const [w, p] of this.socks) if (p.sub === op.sub) { p.mute = +op.until || 0; hit++; try { w.serializeAttachment(this.slim(p)); w.send(JSON.stringify({ t: 'gcm', until: p.mute })); } catch (e) {} }
    if (op.op === 'kick') for (const [w, p] of [...this.socks]) if (p.sub === op.sub) {
      hit++; this.socks.delete(w);
      try { w.serializeAttachment({ gone: true }); w.send(JSON.stringify({ t: 'kick', why: op.why === 'banned' ? 'banned' : 'kick', until: +op.until || 0 })); w.close(4003, 'kicked'); } catch (e) {}
      if (!this.online(p.u)) this.all({ t: 'gon', u: p.u, on: false });
    }
    if (op.op === 'del' && +op.i > 0) { this.sql.exec('UPDATE chat SET del = 1 WHERE i = ?', +op.i); this.all({ t: 'gcd', i: +op.i }); hit = 1; }
    if (op.op === 'clear') { this.sql.exec('UPDATE chat SET del = 1'); this.all({ t: 'gcc' }); hit = 1; }
    return json({ ok: true, room: this.room(), hit });
  }
  // every AWAY_MS while anyone is a member: members not seen for AWAY_MS go (the last one out ends the group)
  async alarm() {
    const now = Date.now();
    for (const r of this.members()) if (!this.online(r.u) && now - (r.seen || 0) > this.away) await this.leave(r.u, 'away');
    if (this.kv('id') && this.members().length) await this.ctx.storage.setAlarm(now + this.away);
  }
  drop(ws) {
    const p = this.socks.get(ws); if (!p) return; this.socks.delete(ws);
    if (!this.kv('id')) return;
    this.sql.exec('UPDATE members SET seen = ? WHERE u = ?', Date.now(), p.u);
    if (!this.online(p.u)) this.all({ t: 'gon', u: p.u, on: false });
  }
  webSocketClose(ws, code) { this.drop(ws); try { ws.close(code === 1005 ? 1000 : code, 'bye'); } catch (e) {} }
  webSocketError(ws) { this.drop(ws); }
}
