// The Colony Stage (multiplayer step 6): an event's hall, one Durable Object per event ('<site>:event:<id>'). It holds
// everyone at that event, whichever copy of the village or room they stand in: the hosts' voices (and the players they
// bring up to speak) heard by all, the event chat, raised hands, and the pre-made show started at the same moment on every
// page. The events themselves (title, place, times, hosts, the show) live on the control desk (control.js), where the
// Admin Hub makes them; the hall asks the desk for its event when the first page knocks, and the desk tells it when the
// event changes or ends (an alarm ends it at its end time too).
//   page -> hall  {t:'sc', x}                 an event chat line (signed-in players; hosts are never slowed down)
//                 {t:'hand', on}               raise / lower my hand (signed-in, not a host or speaker)
//                 {t:'up', u} {t:'down', u}    a host brings a raised hand up to speak / sends a speaker down
//                 {t:'show', go}               a host starts (go 1: from the top, 3 s from now) / stops (go 0) the show
//                 {t:'rp', i, why}             report a chat line
//                 vp vs va vx                  voice (voice.js): hosts and speakers talk, everyone here hears them
//   hall -> page  {t:'shi', ev, you, host, speakers, hands, hand, show, now, n, cfg, hist, mute}   the hello
//                 {t:'sc', m}  {t:'scx', why}  {t:'scd', i}  {t:'scc'}   chat line, refused, deleted, cleared
//                 {t:'shands', hands} (hosts)  {t:'shand', on} (mine)  {t:'sspk', speakers}  {t:'sn', n} (how many here)
//                 {t:'sshow', show, now}  {t:'sev', ev}  {t:'scfg', chat, slow, voice}  {t:'scm', until}  vo / vp / vs
//                 {t:'send'} the event is over (then the socket closes, 4004)
// ev = {id, title, place: {village, room|null, label}, starts, ends, hosts: [{u, n}], show: {title, len, audio|null, cues}|null}
// show while it runs = ev.show + startAt (server time, ms)
import { MAX_CHARS, cleanText, charCount, filterText } from './chat.js';
import { DEFAULT_CFG, normCfg, withTimeout } from './control.js';
import { Voice } from './voice.js';
import { EVENT_ID, isLive, pubEvent, showOf } from './events.js';

const PROTOCOL = 'rebel-universe.v1', HISTORY = 60, KEEP = 400, STAGE_SLOW = 5, MAX_SPEAKERS = 6, MAX_HANDS = 60, EARLY = 60 * 60000, LEAD = 3000;
const VOICE_T = new Set(['vp', 'vs', 'va', 'vx']), BIG = /^\{"t":"v[pa]"/, UID = /^[A-Za-z0-9_-]{16}$/;
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export class StageHall {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env; this.site = env.SITE || 'dev'; this.sql = ctx.storage.sql; this.cfg = null; this.nAt = 0;
    this.schema();
    this.socks = new Map(); // ws -> live state (u, sub, n, k, host, mute, rate limits)
    for (const ws of ctx.getWebSockets()) { const a = ws.deserializeAttachment(); if (a && a.u) this.socks.set(ws, this.live(a)); }
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
    this.voice = new Voice(env, {
      sql: this.sql, send: (ws, o) => { try { ws.send(JSON.stringify(o)); } catch (e) {} }, all: (o, except) => this.all(o, except),
      may: (p, what) => {
        const cfg = this.cfg || normCfg(DEFAULT_CFG);
        if (cfg.voice === false) return 'off';
        if (what === 'hear') return null; // (everyone at the event hears the stage, guests too)
        if (p.k === 'guest') return 'guest';
        if (p.mute > Date.now()) return 'muted';
        return p.host || this.isSpeaker(p.u) ? null : 'stage';
      },
      canHear: (p, k) => k !== p.u && this.online(k) && (this.isHostU(k) || this.isSpeaker(k)),
      keyOf: p => p.u, keyOut: k => k
    });
  }
  schema() {
    for (const q of [
      'CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)',
      'CREATE TABLE IF NOT EXISTS chat (i INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, u TEXT, sub TEXT, n TEXT, k TEXT, h INTEGER, x TEXT, del INTEGER DEFAULT 0)',
      'CREATE TABLE IF NOT EXISTS hands (u TEXT PRIMARY KEY, sub TEXT, n TEXT, at INTEGER)',
      'CREATE TABLE IF NOT EXISTS speakers (u TEXT PRIMARY KEY, sub TEXT, n TEXT, at INTEGER)'
    ]) this.sql.exec(q);
    this.voice?.schema();
  }
  kv(k) { const r = this.sql.exec('SELECT v FROM kv WHERE k = ?', k).toArray()[0]; return r ? r.v : null; }
  kvSet(k, v) { if (v == null) this.sql.exec('DELETE FROM kv WHERE k = ?', k); else this.sql.exec('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, String(v)); }
  ev() { try { return JSON.parse(this.kv('ev') || 'null'); } catch (e) { return null; } }
  show() { return showOf(this.ev()); }
  room() { const id = this.kv('id'); return id ? `${this.site}:event:${id}` : null; }
  live(a) { return { mute: 0, host: false, ...a, win: 0, cnt: 0, said: 0, lastX: '', hand: 0, rep: 0, reps: 0 }; }
  slim(p) { return { u: p.u, sub: p.sub, n: p.n, k: p.k, host: !!p.host, mute: p.mute || 0 }; }
  online(u) { for (const p of this.socks.values()) if (p.u === u) return true; return false; }
  isHostSub(sub) { return (this.ev()?.hosts || []).some(h => h.sub === sub); }
  isHostU(u) { return (this.ev()?.hosts || []).some(h => h.u === u); }
  isSpeaker(u) { return !!this.sql.exec('SELECT 1 FROM speakers WHERE u = ?', u).toArray()[0]; }
  speakers() { return this.sql.exec('SELECT u, n FROM speakers ORDER BY at').toArray(); }
  hands() { return this.sql.exec('SELECT u, n, at FROM hands ORDER BY at').toArray(); }
  all(o, except) { const s = JSON.stringify(o); for (const w of this.socks.keys()) if (w !== except) try { w.send(s); } catch (e) {} }
  hosts(o) { const s = JSON.stringify(o); for (const [w, p] of this.socks) if (p.host) try { w.send(s); } catch (e) {} }
  control() { return this.env.CONTROL.get(this.env.CONTROL.idFromName(this.site + ':control')); }
  toControl(path, body) { const p = this.control().fetch('https://control' + path, { method: 'POST', body: JSON.stringify(body) }).catch(() => {}); try { this.ctx.waitUntil(p); } catch (e) {} }
  async ask(path, body) { const r = await withTimeout(this.control().fetch('https://control' + path, { method: 'POST', body: JSON.stringify(body) }), 2500); return r.json(); }
  history() { return this.sql.exec('SELECT i, at, u, n, k, h, x FROM chat WHERE del = 0 ORDER BY i DESC LIMIT ?', HISTORY).toArray().reverse(); }
  count(force) { const now = Date.now(); if (!force && now - this.nAt < 3000) return; this.nAt = now; this.all({ t: 'sn', n: this.socks.size }); }
  // the event as the desk has it (asked once, then kept; the desk pushes changes), and an alarm at its end
  async load(id) {
    if (this.kv('id') === id && this.ev()) return this.ev();
    let d = null; try { d = await this.ask('/event', { id }); } catch (e) { return null; }
    if (!d?.ev) return null;
    this.kvSet('id', id); this.setEv(d.ev);
    return d.ev;
  }
  setEv(ev) {
    this.kvSet('ev', JSON.stringify(ev));
    if (ev.ends > Date.now()) this.ctx.storage.setAlarm(ev.ends).catch?.(() => {});
    for (const [w, p] of this.socks) { const h = this.isHostSub(p.sub); if (h !== p.host) { p.host = h; try { w.serializeAttachment(this.slim(p)); } catch (e) {} } }
  }

  async fetch(req) {
    const url = new URL(req.url), now = Date.now();
    if (url.pathname === '/ctl') return this.ctl(await req.json().catch(() => ({})));
    const ident = JSON.parse(req.headers.get('x-ru-ident') || 'null'), id = url.searchParams.get('id') || '';
    if (!ident || req.headers.get('upgrade') !== 'websocket' || !UID.test(ident.u || '') || !EVENT_ID.test(id)) return json({ ok: false }, 400);
    const ev = await this.load(id);
    if (!ev) return json({ ok: false, error: 'no such event' }, 404);
    if (ev.ended || now >= ev.ends) return json({ ok: false, error: 'over' }, 410);
    const host = this.isHostSub(ident.sub);
    if (!isLive(ev, now) && !(host && ev.starts - now < EARLY)) return json({ ok: false, error: 'not yet', starts: ev.starts }, 403);
    let chk = { ban: 0, mute: 0 };
    try { const d = await this.ask('/check', { room: this.room(), sub: ident.sub }); if (d.cfg) this.cfg = normCfg(d.cfg); chk = { ban: +d.ban || 0, mute: +d.mute || 0 }; } catch (e) {}
    if (chk.ban > now) return json({ ok: false, error: 'banned' }, 403);
    // the same account again (another tab, a new page): the older socket goes
    for (const [w, p] of [...this.socks]) if (p.u === ident.u) { try { w.serializeAttachment({ gone: true }); w.send('{"t":"sdup"}'); w.close(4001, 'opened elsewhere'); } catch (e) {} this.socks.delete(w); }
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    const p = this.live({ u: ident.u, sub: ident.sub, n: ident.n, k: ident.k, host, mute: chk.mute > now ? chk.mute : 0 });
    server.serializeAttachment(this.slim(p)); this.socks.set(server, p);
    const cfg = this.cfg || normCfg(DEFAULT_CFG);
    server.send(JSON.stringify({ t: 'shi', ev: pubEvent(ev, now), you: p.u, host, speakers: this.speakers(), hands: host ? this.hands() : undefined, hand: !!this.sql.exec('SELECT 1 FROM hands WHERE u = ?', p.u).toArray()[0],
      show: this.show(), now, n: this.socks.size, hist: this.history(), mute: p.mute, cfg: { chat: cfg.chat, slow: Math.max(STAGE_SLOW, cfg.slow), voice: cfg.voice !== false && this.voice.on } }));
    this.count();
    return new Response(null, { status: 101, webSocket: client, headers: { 'sec-websocket-protocol': PROTOCOL } });
  }
  async webSocketMessage(ws, data) {
    const p = this.socks.get(ws); if (!p) return;
    if (typeof data !== 'string' || (data.length > 1024 && !(data.length <= 13000 && BIG.test(data)))) return;
    const now = Date.now();
    if (now - p.win > 2000) { p.win = now; p.cnt = 0; }
    if (++p.cnt > 24) { if (p.cnt > 96) try { ws.close(4008, 'too many messages'); } catch (e) {} return; }
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    if (VOICE_T.has(m.t)) return this.voice.message(ws, p, m);
    if (m.t === 'sc') return this.chat(ws, p, m, now);
    if (m.t === 'hand') return this.hand(ws, p, !!m.on, now);
    if (m.t === 'up' || m.t === 'down') return p.host && this.speaker(typeof m.u === 'string' ? m.u : '', m.t === 'up');
    if (m.t === 'show') return p.host && this.runShow(!!m.go);
    if (m.t === 'rp') return this.report(ws, p, m, now);
  }
  chat(ws, p, m, now) {
    const no = o => { try { ws.send(JSON.stringify({ t: 'scx', ...o })); } catch (e) {} };
    const cfg = this.cfg || normCfg(DEFAULT_CFG);
    if (p.k === 'guest') return no({ why: 'guest' });
    if (!cfg.chat) return no({ why: 'off' });
    if (p.mute > now) return no({ why: 'muted', until: p.mute });
    const gap = p.host ? 0 : Math.max(STAGE_SLOW, cfg.slow) * 1000;
    if (now - p.said < gap) return no({ why: 'slow', wait: gap - (now - p.said) });
    const raw = cleanText(m.x);
    if (!raw) return no({ why: 'empty' });
    if (charCount(raw) > MAX_CHARS) return no({ why: 'long', max: MAX_CHARS });
    if (raw.toLowerCase() === p.lastX && now - p.said < 30000) return no({ why: 'same' });
    const { text } = filterText(raw, cfg);
    p.said = now; p.lastX = raw.toLowerCase();
    const row = this.sql.exec('INSERT INTO chat (at, u, sub, n, k, h, x) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING i', now, p.u, p.sub, p.n, p.k, p.host ? 1 : 0, text).one();
    if (row.i % 20 === 0) this.sql.exec('DELETE FROM chat WHERE i <= ?', row.i - KEEP);
    const msg = { i: row.i, u: p.u, n: p.n, k: p.k, x: text, at: now, ...(p.host ? { h: 1 } : {}) };
    this.all({ t: 'sc', m: msg });
    this.toControl('/log', { room: this.room(), m: { ...msg, ch: 'e' }, sub: p.sub, raw: raw !== text ? raw : null });
  }
  hand(ws, p, on, now) {
    if (p.k === 'guest' || p.host || this.isSpeaker(p.u) || now - p.hand < 1500) return;
    p.hand = now;
    if (on) { if (this.sql.exec('SELECT COUNT(*) AS n FROM hands').one().n >= MAX_HANDS) return; this.sql.exec('INSERT INTO hands (u, sub, n, at) VALUES (?, ?, ?, ?) ON CONFLICT(u) DO NOTHING', p.u, p.sub, p.n, now); }
    else this.sql.exec('DELETE FROM hands WHERE u = ?', p.u);
    try { ws.send(JSON.stringify({ t: 'shand', on })); } catch (e) {}
    this.hosts({ t: 'shands', hands: this.hands() });
  }
  // a host brings a raised hand up to speak (or sends a speaker down: their voice stops)
  speaker(u, up) {
    if (!UID.test(u)) return;
    if (up) {
      const h = this.sql.exec('SELECT * FROM hands WHERE u = ?', u).toArray()[0];
      if (!h || this.sql.exec('SELECT COUNT(*) AS n FROM speakers').one().n >= MAX_SPEAKERS) return;
      this.sql.exec('INSERT INTO speakers (u, sub, n, at) VALUES (?, ?, ?, ?) ON CONFLICT(u) DO NOTHING', h.u, h.sub, h.n, Date.now());
      this.sql.exec('DELETE FROM hands WHERE u = ?', u);
    } else {
      this.sql.exec('DELETE FROM speakers WHERE u = ?', u); this.sql.exec('DELETE FROM hands WHERE u = ?', u);
      this.voice.mute(u);
    }
    this.all({ t: 'sspk', speakers: this.speakers() });
    this.hosts({ t: 'shands', hands: this.hands() });
  }
  // the show from the top, LEAD ms from now on every page (or stopped); the desk keeps when it started, for halls and pages later
  runShow(go, at, fromDesk) {
    const ev = this.ev(); if (!ev || !ev.show) return;
    ev.showAt = go ? (+at > 0 ? +at : Date.now() + LEAD) : 0;
    this.kvSet('ev', JSON.stringify(ev));
    if (!fromDesk) this.toControl('/showat', { id: ev.id, at: ev.showAt });
    this.all({ t: 'sshow', show: showOf(ev), now: Date.now() });
  }
  report(ws, p, m, now) {
    const no = why => { try { ws.send(JSON.stringify({ t: 'scx', why })); } catch (e) {} };
    if (now - p.rep < 15000 || p.reps >= 20) return no('report-slow');
    const r = Number.isInteger(m.i) ? this.sql.exec('SELECT * FROM chat WHERE i = ?', m.i).toArray()[0] : null;
    if (!r || r.sub === p.sub) return no('report-none');
    p.rep = now; p.reps++;
    const why = ['spam', 'abuse', 'scam', 'other'].includes(m.why) ? m.why : 'other';
    const context = this.sql.exec('SELECT i, at, n, sub, x FROM chat WHERE at > ? ORDER BY i DESC LIMIT 12', now - 3600000).toArray().reverse().map(c => ({ ...c, ch: 'e' }));
    this.toControl('/report', { room: this.room(), why, note: cleanText(m.note).slice(0, 200), by: { sub: p.sub, n: p.n, k: p.k }, target: { sub: r.sub, n: r.n, k: r.k, u: r.u }, msg: { i: r.i, ch: 'e', x: r.x, at: r.at }, context, where: null });
    try { ws.send('{"t":"rpok"}'); } catch (e) {}
  }
  // from the control desk: the event changed or ended, the show, and the admins' commands (settings, mute, kick, del, clear)
  async ctl(op) {
    let hit = 0;
    if (op.op === 'ev' && op.ev && op.ev.id === this.kv('id')) {
      this.setEv(op.ev);
      if (op.ev.ended || Date.now() >= op.ev.ends) { await this.end(); return json({ ok: true, hit: 1 }); }
      this.all({ t: 'sev', ev: pubEvent(op.ev) });
      for (const [w, p] of this.socks) try { w.send(JSON.stringify({ t: 'shost', host: p.host, hands: p.host ? this.hands() : undefined })); } catch (e) {}
      hit = this.socks.size;
    }
    if (op.op === 'end') { hit = this.socks.size; await this.end(); }
    if (op.op === 'show') { this.runShow(!!op.go, op.at, true); hit = this.socks.size; }
    if (op.op === 'cfg') { this.cfg = normCfg(op.cfg); if (this.cfg.voice === false) this.voice.muteAll(); this.all({ t: 'scfg', chat: this.cfg.chat, slow: Math.max(STAGE_SLOW, this.cfg.slow), voice: this.cfg.voice !== false && this.voice.on }); hit = this.socks.size; }
    if (op.op === 'mute') for (const [w, p] of this.socks) if (p.sub === op.sub) { p.mute = +op.until || 0; hit++; if (p.mute > Date.now()) this.voice.mute(p.u); try { w.serializeAttachment(this.slim(p)); w.send(JSON.stringify({ t: 'scm', until: p.mute })); } catch (e) {} }
    if (op.op === 'kick') for (const [w, p] of [...this.socks]) if (p.sub === op.sub) {
      hit++; this.socks.delete(w);
      try { w.serializeAttachment({ gone: true }); w.send(JSON.stringify({ t: 'kick', why: op.why === 'banned' ? 'banned' : 'kick', until: +op.until || 0 })); w.close(4003, 'kicked'); } catch (e) {}
      if (!this.online(p.u)) this.voice.drop(p.u);
    }
    if (op.op === 'del' && +op.i > 0) { this.sql.exec('UPDATE chat SET del = 1 WHERE i = ?', +op.i); this.all({ t: 'scd', i: +op.i }); hit = 1; }
    if (op.op === 'clear') { this.sql.exec('UPDATE chat SET del = 1'); this.all({ t: 'scc' }); hit = 1; }
    return json({ ok: true, room: this.room(), hit });
  }
  // the event is over: everyone told, the sockets closed, nothing kept (a late knock asks the desk again: 410)
  async end() {
    const room = this.room();
    for (const w of this.socks.keys()) try { w.send('{"t":"send"}'); w.serializeAttachment({ gone: true }); w.close(4004, 'ended'); } catch (e) {}
    this.socks.clear();
    if (room) this.toControl('/forget', { room });
    try { await this.ctx.storage.deleteAlarm(); } catch (e) {}
    try { await this.ctx.storage.deleteAll(); } catch (e) {}
    this.schema();
  }
  async alarm() { const ev = this.ev(); if (!ev) return; if (Date.now() >= ev.ends - 1000) await this.end(); else await this.ctx.storage.setAlarm(ev.ends); }
  drop(ws) {
    const p = this.socks.get(ws); if (!p) return; this.socks.delete(ws);
    if (!this.online(p.u)) {
      if (this.sql.exec('DELETE FROM hands WHERE u = ? RETURNING u', p.u).toArray().length) this.hosts({ t: 'shands', hands: this.hands() });
      const v = this.voice.drop(p.u); try { this.ctx.waitUntil(v); } catch (e) {}
    }
    this.count();
  }
  webSocketClose(ws, code) { this.drop(ws); try { ws.close(code === 1005 ? 1000 : code, 'bye'); } catch (e) {} }
  webSocketError(ws) { this.drop(ws); }
}
