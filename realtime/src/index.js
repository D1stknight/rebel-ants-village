// Rebel Universe rooms: the multiplayer room server (Cloudflare Worker + one Durable Object per village copy).
//
// A player's page opens   wss://<this worker>/v1/room?village=<id>[&copy=<n>]   with two WebSocket subprotocols:
// 'rebel-universe.v1' and 't.<ticket>'. The ticket comes from Universe (api/mp-ticket.mjs): base64url(JSON) + '.' +
// base64url(Ed25519 signature), signed with a key derived from the site's session secret; this worker only holds the
// public keys (TICKET_KEYS, plain vars), so it can check a ticket but never make one. The ticket says who the player is
// (sub, name, kind) and what they look like (look); its site must be this worker's SITE.
//
// Rooms: each village is split into copies of ROOM_MAX players (the Durable Object '<site>:<village>:<copy>'); a player
// joins the first copy with room (or the copy asked for, to be with a friend). Each copy relays what its players send
// to the others, on the moment it comes in (no timers, so an idle room hibernates and costs nothing):
//   client -> room  {t:'s', p:[x,y,z], r:yaw, a:'walk', i:interiorId|null, f:1 (a final state: stopped)}   state
//                   {t:'e', e:'cheer'}                                                                        emote
//                   {t:'c', ch:'n'|'v'|'w', x:text, to:id (a whisper)}   chat: nearby (CHAT_NEAR m, the same place),
//                                                                         the village copy, or one player
//                   {t:'rp', i:message id | id:player id, why:'spam'|'abuse'|'scam'|'other', note}            a report
//                   {t:'gi', to:player id, g:groupId}   hand a player of this copy an invite to my group (signed-in players)
//                   {t:'pf', f, ft, sl, fr, s, rtt, rc, d, o, b, l, m, n, g}   how the page ran over the last minute (fps,
//                                                 its slow frames, ping...): kept here and sent to the control desk once a
//                                                 minute with who is here and how sockets closed (the Admin Hub's dashboard)
//                   {"t":"ping"}  answered with {"t":"pong"} without waking the room (auto response)
//   room -> client  {t:'hi', you:id, u, room:{village, copy, max}, peers:[peer], hist:[msg], cfg:{chat, slow}, mute}
//                   {t:'j', ...peer}   someone came in      {t:'l', id}   someone left
//                   {t:'u', id, s:[x,y,z,yaw,anim,interior]}   a state     {t:'e', id, e}   an emote
//                   {t:'c', m:msg}   a chat message (the sender gets it back as it was shown)
//                   {t:'cx', why, until|wait}   a message not sent: guest, off, muted, slow, same, empty, long, nopos, gone
//                   {t:'cd', i}   a message deleted (admin)      {t:'cc'}   the chat cleared (admin)
//                   {t:'cfg', chat, slow}   the chat switched on / off, slow mode      {t:'cm', until}   you are muted
//                   {t:'rpok'} / {t:'cx', why:'report-…'}   a report taken / not
//                   {t:'kick', why:'kick'|'banned', until}   then the socket closes (4003)
//                   {t:'dup'}   the same account opened the room somewhere else (this one closes)
//                   {t:'gi', g:groupId, from:{id, u, n, k}}   a group invite from that player (see below)
//   peer = {id, n: name, k: 'discord'|'name'|'guest', u: the account's own short code (blocks), av: avatar url, look,
//           s: state|null}
//   msg  = {i, ch, id, n, k, u, x: the text as shown, at, to + tn (a whisper: to whom)}
// Near players (same interior, < NEAR m) get every state; further ones one every 0.5 s (< MID m) or 2 s; a final
// state always goes through. Limits: 1 KB a message, 24 messages / 2 s a player, emotes 1 / 1.2 s. A socket that sends
// nothing for STALE_S seconds (150; not even its ping every 25 s: a phone put away, a connection gone half-open, which
// the room never hears close) is closed (4002) and its player leaves.
// Chat (signed-in players only; guests read): MAX_CHARS characters, one message every 2 s (or the slow mode's gap), the
// word filter and links (chat.js), the last 200 kept per copy (the village ones replayed to newcomers). Every message
// and report also goes to the control desk (control.js: settings, mutes and bans, the log, the reports), which the
// Admin Hub reaches through Universe with signed commands (POST /v1/admin: ADMIN_KEYS, not TICKET_KEYS).
// Groups (group.js, one Durable Object per group, signed-in players only): /v1/group?id=<id>|new with the same tickets. A
// member notes an invite with the group ({t:'gi', u}), then hands it over through the room ({t:'gi', to, g}); the invited
// player's page opens the group, which lets in only its members and the players invited lately.
// Events (stage.js, events.js: the Colony Stage): the Admin Hub makes them on the control desk; GET /v1/events lists the
// ones on now and next (public), /v1/stage?id=<event> opens an event's hall with the same tickets (guests too).
import { MAX_CHARS, cleanText, charCount, filterText } from './chat.js';
import { RoomControl, DEFAULT_CFG, normCfg, withTimeout } from './control.js';
import { PartyGroup } from './group.js';
import { VILLAGES } from './villages.js';
import { Voice, VOICE_R } from './voice.js';
import { StageHall } from './stage.js';
import { EVENT_ID } from './events.js';
export { RoomControl, PartyGroup, StageHall };

const PROTOCOL = 'rebel-universe.v1';
const EMOTES = new Set(['cheer', 'wave', 'bow', 'dance_wave', 'dance_tut', 'dance_house', 'dance_gangnam', 'jump', 'kick']);
const ANIM = /^[a-z0-9_]{1,20}$/, INTERIOR = /^[A-Za-z0-9_-]{1,64}$/, GROUP_ID = /^[A-Za-z0-9_-]{12}$/;
const VOICE_T = new Set(['vp', 'vs', 'va', 'vx']), BIG = /^\{"t":"v[pa]"/; // (voice offers and answers carry an SDP: up to 13 KB)
const NEAR = 40, MID = 120, COPIES = 24, CHAT_NEAR = 30, HISTORY = 50, KEEP = 200;

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });
const b64u = s => { const t = String(s).replace(/-/g, '+').replace(/_/g, '/'); const bin = atob(t + '==='.slice((t.length + 3) % 4)); return Uint8Array.from(bin, c => c.charCodeAt(0)); };
const keyCache = new Map();
async function publicKeys(env, site, field = 'TICKET_KEYS') {
  let list = []; try { const k = JSON.parse(env[field] || '{}')[site]; list = Array.isArray(k) ? k : k ? [k] : []; } catch (e) { list = []; }
  const out = [];
  for (const k of list) {
    if (!keyCache.has(k)) keyCache.set(k, crypto.subtle.importKey('raw', b64u(k), { name: 'Ed25519' }, false, ['verify']));
    out.push(await keyCache.get(k));
  }
  return out;
}
async function signedBy(keys, body, sig) { const data = new TextEncoder().encode(body), s = b64u(sig); for (const k of keys) if (await crypto.subtle.verify({ name: 'Ed25519' }, k, s, data)) return true; return false; }
// a ticket this worker can trust: signed by one of its site's keys, for its site, not expired, not too long-lived
export async function verifyTicket(raw, env, now = Date.now()) {
  const [body, sig] = String(raw || '').split('.');
  if (!body || !sig || body.length > 2400 || sig.length > 100) throw Object.assign(new Error('bad ticket'), { code: 'ticket' });
  const site = env.SITE || 'dev';
  if (!(await signedBy(await publicKeys(env, site), body, sig))) throw Object.assign(new Error('ticket not signed by this site'), { code: 'ticket' });
  const t = JSON.parse(new TextDecoder().decode(b64u(body))), sec = now / 1000;
  if (t.v !== 1 || t.site !== site || !(t.exp > sec) || t.exp - sec > 600 || typeof t.sub !== 'string' || !/^[ug]:[A-Za-z0-9_-]{4,64}$/.test(t.sub)) throw Object.assign(new Error('ticket expired or not for this site'), { code: 'ticket' });
  return t;
}
// an Admin Hub command, signed by Universe with its admin key (another key than the tickets': a ticket is never a command)
export async function verifyAdmin(raw, env, now = Date.now()) {
  const [body, sig] = String(raw || '').trim().split('.');
  if (!body || !sig || body.length > 24000 || sig.length > 100) throw new Error('bad command');
  const site = env.SITE || 'dev';
  if (!(await signedBy(await publicKeys(env, site, 'ADMIN_KEYS'), body, sig))) throw new Error('not signed by this site');
  const a = JSON.parse(new TextDecoder().decode(b64u(body))), sec = now / 1000;
  if (a.v !== 1 || a.typ !== 'mp-admin' || a.site !== site || !(a.exp > sec) || a.exp - sec > 120 || typeof a.cmd !== 'string' || !/^[a-z-]{2,20}$/.test(a.cmd) || typeof a.nonce !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(a.nonce)) throw new Error('expired or not for this site');
  return a;
}
const controlOf = env => env.CONTROL.get(env.CONTROL.idFromName((env.SITE || 'dev') + ':control'));
// the account's own short code, the same in every room: what a player's Block remembers (never the account id itself)
async function uidOf(sub) { const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('rebel-universe:uid:v1:' + sub))); return btoa(String.fromCharCode(...d)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, 16); }

// who a ticket says the player is, as the rooms and groups keep it
const identOf = async t => ({ sub: t.sub, u: await uidOf(t.sub), n: String(t.n || 'Rebel').slice(0, 40), k: ['discord', 'name', 'guest'].includes(t.k) ? t.k : 'guest', av: typeof t.av === 'string' && /^https:\/\/cdn\.discordapp\.com\//.test(t.av) ? t.av.slice(0, 160) : '', look: t.look && typeof t.look === 'object' ? t.look : { t: 'starter' } });
const protocolsOf = req => String(req.headers.get('sec-websocket-protocol') || '').split(',').map(s => s.trim());
// a group's socket: signed-in players only; 'new' makes one (its id here: 9 random bytes)
async function openGroup(req, env, url) {
  if (req.headers.get('upgrade')?.toLowerCase() !== 'websocket') return json({ ok: false, error: 'websocket only' }, 426);
  if (!originAllowed(env, req.headers.get('origin'))) return json({ ok: false, error: 'origin' }, 403);
  const id = url.searchParams.get('id') || '';
  if (id !== 'new' && !GROUP_ID.test(id)) return json({ ok: false, error: 'group' }, 400);
  const protos = protocolsOf(req);
  if (!protos.includes(PROTOCOL)) return json({ ok: false, error: 'protocol' }, 400);
  let t;
  try { t = await verifyTicket((protos.find(p => p.startsWith('t.')) || '').slice(2), env); } catch (e) { return json({ ok: false, error: e.code || 'ticket' }, 401); }
  if (t.k === 'guest' || !t.sub.startsWith('u:')) return json({ ok: false, error: 'sign in to be in a group' }, 403);
  if (!env.GROUPS) return json({ ok: false, error: 'groups are not on here' }, 503);
  const gid = id === 'new' ? btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(9)))).replace(/\+/g, '-').replace(/\//g, '_') : id;
  const stub = env.GROUPS.get(env.GROUPS.idFromName(`${env.SITE || 'dev'}:group:${gid}`));
  return stub.fetch(new Request(`https://group/join?id=${gid}${id === 'new' ? '&new=1' : ''}`, { headers: { upgrade: 'websocket', 'x-ru-ident': JSON.stringify(await identOf(t)) } }));
}

// an event's hall (stage.js): anyone with a ticket (guests watch, listen and read); the hall checks the event is on
async function openStage(req, env, url) {
  if (req.headers.get('upgrade')?.toLowerCase() !== 'websocket') return json({ ok: false, error: 'websocket only' }, 426);
  if (!originAllowed(env, req.headers.get('origin'))) return json({ ok: false, error: 'origin' }, 403);
  const id = url.searchParams.get('id') || '';
  if (!EVENT_ID.test(id)) return json({ ok: false, error: 'event' }, 400);
  const protos = protocolsOf(req);
  if (!protos.includes(PROTOCOL)) return json({ ok: false, error: 'protocol' }, 400);
  let t;
  try { t = await verifyTicket((protos.find(p => p.startsWith('t.')) || '').slice(2), env); } catch (e) { return json({ ok: false, error: e.code || 'ticket' }, 401); }
  if (!env.STAGES) return json({ ok: false, error: 'events are not on here' }, 503);
  const stub = env.STAGES.get(env.STAGES.idFromName(`${env.SITE || 'dev'}:event:${id}`));
  return stub.fetch(new Request(`https://stage/join?id=${id}`, { headers: { upgrade: 'websocket', 'x-ru-ident': JSON.stringify(await identOf(t)) } }));
}

function originAllowed(env, origin) {
  if (!origin) return env.ALLOW_NO_ORIGIN === '1'; // tests / tools only
  const exact = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (exact.includes(origin)) return true;
  const suffix = String(env.ALLOWED_ORIGIN_SUFFIX || '').trim();
  if (suffix) { try { const u = new URL(origin); if (u.protocol === 'https:' && u.host.endsWith(suffix)) return true; } catch (e) {} }
  return env.ALLOW_LOCAL === '1' && /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/v1/health') return json({ ok: true, site: env.SITE || 'dev', protocol: PROTOCOL });
    if (url.pathname === '/v1/admin') {
      if (req.method !== 'POST') return json({ ok: false, error: 'POST only' }, 405);
      const raw = await req.text();
      let a; try { a = await verifyAdmin(raw, env); } catch (e) { return json({ ok: false, error: 'not allowed' }, 401); }
      return controlOf(env).fetch('https://control/admin', { method: 'POST', body: JSON.stringify({ cmd: a.cmd, args: a.args || {}, nonce: a.nonce }) });
    }
    if (url.pathname === '/v1/group') return openGroup(req, env, url);
    if (url.pathname === '/v1/stage') return openStage(req, env, url);
    if (url.pathname === '/v1/events') { // the events on now and next (public: the lobby's LIVE NOW, the pages' banner)
      const r = await controlOf(env).fetch('https://control/events');
      const origin = req.headers.get('origin');
      return new Response(await r.text(), { status: r.status, headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=15', ...(origin && originAllowed(env, origin) ? { 'access-control-allow-origin': origin, vary: 'origin' } : {}) } });
    }
    if (url.pathname !== '/v1/room') return json({ ok: false, error: 'not found' }, 404);
    if (req.headers.get('upgrade')?.toLowerCase() !== 'websocket') return json({ ok: false, error: 'websocket only' }, 426);
    if (!originAllowed(env, req.headers.get('origin'))) return json({ ok: false, error: 'origin' }, 403);
    const village = url.searchParams.get('village') || '', want = Math.floor(+url.searchParams.get('copy') || 0);
    if (!VILLAGES.has(village) || want < 0 || want > COPIES) return json({ ok: false, error: 'village' }, 400);
    const protos = protocolsOf(req);
    if (!protos.includes(PROTOCOL)) return json({ ok: false, error: 'protocol' }, 400);
    let t;
    try { t = await verifyTicket((protos.find(p => p.startsWith('t.')) || '').slice(2), env); } catch (e) { return json({ ok: false, error: e.code || 'ticket' }, 401); }
    if (t.village && t.village !== village) return json({ ok: false, error: 'ticket is for another village' }, 401);
    const ident = await identOf(t);
    const site = env.SITE || 'dev';
    for (let copy = want || 1; copy <= (want || COPIES); copy++) {
      const stub = env.ROOMS.get(env.ROOMS.idFromName(`${site}:${village}:${copy}`));
      const fwd = new Request(`https://room/join?village=${village}&copy=${copy}`, { headers: { upgrade: 'websocket', 'x-ru-ident': JSON.stringify(ident) } });
      const res = await stub.fetch(fwd);
      if (res.status !== 409) return res;
    }
    return json({ ok: false, error: 'full' }, 409);
  }
};

export class RoomCopy {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env; this.max = Math.max(2, Math.min(200, +env.ROOM_MAX || 50)); this.site = env.SITE || 'dev';
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS chat (i INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, ch TEXT, pid INTEGER, sub TEXT, n TEXT, k TEXT, u TEXT, x TEXT, tid INTEGER, tn TEXT, tsub TEXT, del INTEGER DEFAULT 0)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)');
    this.name = this.kv('name'); this.cfg = null;
    try { const c = this.kv('cfg'); if (c) this.cfg = normCfg(JSON.parse(c)); } catch (e) {}
    this.peers = new Map(); this.nextId = Math.max(1, +this.kv('next') || 1); // (ids never come back in a copy: old chat lines keep theirs)
    this.stale = Math.max(5, Math.min(3600, +env.STALE_S || 150)) * 1000; this.swept = 0;
    // how the pages run (the dashboard): their minute reports, the joins and the closes by code since the last send to the
    // control desk (kept in memory only: a room sent to sleep loses at most a minute of them)
    this.pfBuf = []; this.pfSent = 0; this.joins = 0; this.closes = {};
    this.pfEvery = Math.max(1, +env.PERF_FLUSH_S || 60) * 1000; this.pfMin = Math.max(0, env.PERF_MIN_S != null ? +env.PERF_MIN_S : 30) * 1000;
    // waking from hibernation: who is here comes back from the sockets' attachments
    for (const ws of ctx.getWebSockets()) { const a = ws.deserializeAttachment(); if (a && a.id) { this.peers.set(ws, this.live(a)); this.nextId = Math.max(this.nextId, a.id + 1); } }
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
    // voice (voice.js): nearby voices, the same place and within VOICE_R; signed-in players only
    this.vchk = 0;
    this.voice = new Voice(env, {
      sql: this.sql, send: (ws, o) => { try { ws.send(JSON.stringify(o)); } catch (e) {} },
      all: (o, except) => { const s = JSON.stringify(o); for (const w of this.peers.keys()) if (w !== except) try { w.send(s); } catch (e) {} },
      may: (p, what) => p.k === 'guest' ? 'guest' : (this.cfg || normCfg(DEFAULT_CFG)).voice === false ? 'off' : what === 'talk' && p.mute > Date.now() ? 'muted' : null,
      canHear: (p, k) => { const s = this.byId(+k); return !!(s && s !== p && s.s && p.s && s.s[5] === p.s[5] && !(s.mute > Date.now()) && Math.hypot(s.s[0] - p.s[0], s.s[2] - p.s[2]) <= VOICE_R); },
      keyOf: p => String(p.id), keyOut: k => +k
    });
  }
  kv(k) { const r = this.sql.exec('SELECT v FROM kv WHERE k = ?', k).toArray()[0]; return r ? r.v : null; }
  kvSet(k, v) { this.sql.exec('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, String(v)); }
  byId(id) { for (const p of this.peers.values()) if (p.id === id) return p; return null; }
  sockOf(k) { for (const [ws, p] of this.peers) if (p.id === +k) return { ws, p }; return null; }
  live(a) { return { mute: 0, ...a, last: new Map(), win: 0, cnt: 0, em: 0, said: 0, lastX: '', rep: 0, reps: 0, gi: 0 }; }
  slim(p) { return { id: p.id, sub: p.sub, u: p.u, n: p.n, k: p.k, av: p.av, look: p.look, s: p.s, village: p.village, copy: p.copy, mute: p.mute || 0, j: p.j, seen: p.seen || 0 }; }
  pub(p) { return { id: p.id, n: p.n, k: p.k, u: p.u, av: p.av, look: p.look, s: p.s, ...(this.voice?.isOn(p.id) ? { vo: 1 } : {}) }; }
  voiceOn(cfg) { return !!((cfg || this.cfg || normCfg(DEFAULT_CFG)).voice !== false && this.voice.on); }
  control() { return controlOf(this.env); }
  toControl(path, body) { // (not waited on: the message is out already)
    const p = this.control().fetch('https://control' + path, { method: 'POST', body: JSON.stringify(body) }).catch(() => {});
    try { this.ctx.waitUntil(p); } catch (e) {}
  }
  setCfg(c) { const n = normCfg(c), was = JSON.stringify(this.cfg); this.cfg = n; if (JSON.stringify(n) !== was) this.kvSet('cfg', JSON.stringify(n)); return n; }
  // the control desk: is this account banned or muted, and the settings (it also learns this copy is open). If the desk
  // does not answer in time the player comes in all the same
  async check(sub) {
    try {
      const r = await withTimeout(this.control().fetch('https://control/check', { method: 'POST', body: JSON.stringify({ room: this.name, sub }) }), 2500);
      const d = await r.json();
      if (d.cfg) this.setCfg(d.cfg);
      return { ban: +d.ban || 0, mute: +d.mute || 0 };
    } catch (e) { return { ban: 0, mute: 0 }; }
  }
  async config() { if (!this.cfg) await this.check(null); return this.cfg || normCfg(DEFAULT_CFG); }
  history() {
    return this.sql.exec("SELECT i, at, pid, n, k, u, x FROM chat WHERE ch = 'v' AND del = 0 ORDER BY i DESC LIMIT ?", HISTORY).toArray().reverse()
      .map(r => ({ i: r.i, ch: 'v', id: r.pid, n: r.n, k: r.k, u: r.u, x: r.x, at: r.at }));
  }
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/ctl') return this.ctl(await req.json().catch(() => ({})));
    const ident = JSON.parse(req.headers.get('x-ru-ident') || 'null');
    if (!ident || req.headers.get('upgrade') !== 'websocket') return json({ ok: false }, 400);
    this.sweep(Date.now(), true); // (a newcomer never gets a player whose socket went quiet)
    // one socket per account: an older one is told and closed (a guest is the same account while its tab keeps its guest
    // key: api/mp-ticket.mjs), so a page coming back on a new ticket replaces its old socket instead of meeting it
    for (const [w, p] of [...this.peers]) if (p.sub === ident.sub) { this.part(w, '{"t":"dup"}', 4001, 'opened elsewhere'); }
    if (this.peers.size >= this.max) return json({ ok: false, full: true }, 409);
    const village = url.searchParams.get('village'), copy = +url.searchParams.get('copy'), name = `${this.site}:${village}:${copy}`;
    if (this.name !== name) { this.name = name; this.kvSet('name', name); }
    const chk = await this.check(ident.sub), now = Date.now();
    if (this.peers.size >= this.max) return json({ ok: false, full: true }, 409); // (others came in meanwhile)
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    if (chk.ban > now) { // banned: told why, then closed (the page stops knocking)
      server.send(JSON.stringify({ t: 'kick', why: 'banned', until: chk.ban })); server.close(4003, 'banned');
      return new Response(null, { status: 101, webSocket: client, headers: { 'sec-websocket-protocol': PROTOCOL } });
    }
    const p = this.live({ id: this.nextId++, ...ident, s: null, village, copy, mute: chk.mute > now ? chk.mute : 0, j: now });
    this.kvSet('next', this.nextId);
    server.serializeAttachment(this.slim(p)); this.peers.set(server, p); this.joins++;
    const cfg = this.cfg || normCfg(DEFAULT_CFG);
    server.send(JSON.stringify({ t: 'hi', you: p.id, u: p.u, room: { village, copy, max: this.max }, peers: [...this.peers.values()].filter(q => q !== p).map(q => this.pub(q)),
      hist: this.history(), cfg: { chat: cfg.chat, slow: cfg.slow, voice: this.voiceOn(cfg) }, mute: p.mute }));
    const join = JSON.stringify({ t: 'j', ...this.pub(p) });
    for (const w of this.peers.keys()) if (w !== server) try { w.send(join); } catch (e) {}
    return new Response(null, { status: 101, webSocket: client, headers: { 'sec-websocket-protocol': PROTOCOL } });
  }
  async webSocketMessage(ws, data) {
    const p = this.peers.get(ws); if (!p) return;
    if (typeof data !== 'string' || (data.length > 1024 && !(data.length <= 13000 && BIG.test(data)))) return;
    const now = Date.now();
    p.seen = now; this.sweep(now);
    if (now - p.win > 2000) { p.win = now; p.cnt = 0; }
    if (++p.cnt > 24) { if (p.cnt > 96) try { ws.close(4008, 'too many messages'); } catch (e) {} return; }
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    if (m && VOICE_T.has(m.t)) return this.voice.message(ws, p, m);
    if (m && m.t === 's') this.state(ws, p, m, now);
    else if (m && m.t === 'e') this.emote(ws, p, m, now);
    else if (m && m.t === 'c') await this.chat(ws, p, m, now);
    else if (m && m.t === 'rp') this.report(ws, p, m, now);
    else if (m && m.t === 'gi') this.groupInvite(p, m, now);
    else if (m && m.t === 'pf') this.perf(p, m, now);
  }
  // a page's minute report (village-multiplayer.js): numbers only, clamped; one every pfMin a player. Sent on to the
  // control desk with the others once a minute (on the next report after that: no timers, the room still sleeps)
  perf(p, m, now) {
    if (now - (p.pf || 0) < this.pfMin) return; p.pf = now;
    const n = (v, lo, hi, d = null) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
    const one = (v, set, d) => (set.includes(v) ? v : d);
    const f = n(m.f, 0, 240), s = n(m.s, 0, 600, 0);
    if (f == null || s < 5) return; // (a page that was hardly on screen)
    this.pfBuf.push({ v: p.village, i: p.s && p.s[5] ? 1 : 0, k: p.k === 'guest' ? 'g' : 's', d: one(m.d, ['p', 'd'], 'd'),
      o: one(m.o, ['ios', 'android', 'mac', 'win', 'linux', 'cros', 'other'], 'other'), b: one(m.b, ['safari', 'chrome', 'firefox', 'edge', 'opera', 'other'], 'other'),
      l: Math.round(n(m.l, 0, 2, 0)), f: Math.round(f * 10) / 10, ft: Math.round(n(m.ft, 0, 5000, 0)), sl: Math.round(n(m.sl, 0, 100000, 0)), fr: Math.round(n(m.fr, 0, 1000, 0)), s: Math.round(s),
      rtt: m.rtt == null ? null : Math.round(n(m.rtt, 0, 60000, 0)), rc: Math.round(n(m.rc, 0, 1000, 0)), m: m.m == null ? null : Math.round(n(m.m, 0, 100000, 0)), n: Math.round(n(m.n, 0, 500, 0)), g: m.g ? 1 : 0 });
    if (this.pfBuf.length >= 200 || now - this.pfSent >= this.pfEvery) this.flushPerf(now);
  }
  flushPerf(now) {
    const body = { room: this.name, at: now, peers: this.peers.size, joins: this.joins, closes: this.closes, reports: this.pfBuf };
    this.pfBuf = []; this.joins = 0; this.closes = {}; this.pfSent = now;
    this.toControl('/perf', body);
  }
  closed(code) { const c = String(+code || 0); this.closes[c] = (this.closes[c] || 0) + 1; }
  // a group invite handed to one signed-in player of this copy (one every 2 s); the group itself decides who comes in
  groupInvite(p, m, now) {
    if (p.k === 'guest' || now - p.gi < 2000 || !Number.isInteger(m.to) || typeof m.g !== 'string' || !GROUP_ID.test(m.g)) return;
    for (const [w, o] of this.peers) if (o.id === m.to) {
      if (o === p || o.k === 'guest') return;
      p.gi = now;
      try { w.send(JSON.stringify({ t: 'gi', g: m.g, from: { id: p.id, u: p.u, n: p.n, k: p.k } })); } catch (e) {}
      return;
    }
  }
  state(ws, p, m, now) {
    const num = v => typeof v === 'number' && Number.isFinite(v), q = Array.isArray(m.p) ? m.p : []; // numbers only (JSON turns NaN into null)
    if (q.length !== 3 || !q.every(v => num(v) && Math.abs(v) < 5000) || !num(m.r)) return;
    const a = typeof m.a === 'string' && ANIM.test(m.a) ? m.a : 'idle', i = typeof m.i === 'string' && INTERIOR.test(m.i) ? m.i : null;
    const s = [Math.round(q[0] * 100) / 100, Math.round(q[1] * 100) / 100, Math.round(q[2] * 100) / 100, Math.round(m.r * 1000) / 1000, a, i];
    p.s = s; try { ws.serializeAttachment(this.slim(p)); } catch (e) {}
    const msg = JSON.stringify({ t: 'u', id: p.id, s }), final = m.f === 1;
    for (const [w, o] of this.peers) {
      if (w === ws) continue;
      let gap = 0;
      if (o.s) { const d = o.s[5] !== s[5] ? Infinity : Math.hypot(o.s[0] - s[0], o.s[2] - s[2]); gap = d < NEAR ? 0 : d < MID ? 500 : 2000; }
      const last = o.last.get(p.id) || 0;
      if (!final && now - last < gap) continue;
      o.last.set(p.id, now);
      try { w.send(msg); } catch (e) {}
    }
    if (now - this.vchk > 2000) { this.vchk = now; this.voice.recheck(k => this.sockOf(k)); } // (who hears whom after the moves)
  }
  emote(ws, p, m, now) {
    if (!EMOTES.has(m.e) || now - p.em < 1200) return; p.em = now;
    const msg = JSON.stringify({ t: 'e', id: p.id, e: m.e });
    for (const [w, o] of this.peers) if (w !== ws && (!o.s || !p.s || o.s[5] === p.s[5])) try { w.send(msg); } catch (e) {}
  }
  // a chat message: checked, filtered, kept, sent to whoever it is for (the sender too, as it was shown), and logged
  async chat(ws, p, m, now) {
    const no = o => { try { ws.send(JSON.stringify({ t: 'cx', ...o })); } catch (e) {} };
    if (p.k === 'guest') return no({ why: 'guest' });
    const cfg = await this.config();
    if (!this.peers.has(ws)) return;
    if (!cfg.chat) return no({ why: 'off' });
    if (p.mute > now) return no({ why: 'muted', until: p.mute });
    const gap = cfg.slow * 1000;
    if (now - p.said < gap) return no({ why: 'slow', wait: gap - (now - p.said) });
    const raw = cleanText(m.x);
    if (!raw) return no({ why: 'empty' });
    if (charCount(raw) > MAX_CHARS) return no({ why: 'long', max: MAX_CHARS });
    if (raw.toLowerCase() === p.lastX && now - p.said < 30000) return no({ why: 'same' });
    const ch = m.ch === 'v' ? 'v' : m.ch === 'w' ? 'w' : 'n';
    let to = null;
    if (ch === 'w') { for (const o of this.peers.values()) if (o.id === m.to) to = o; if (!to || to === p) return no({ why: 'gone' }); }
    if (ch === 'n' && !p.s) return no({ why: 'nopos' });
    const { text } = filterText(raw, cfg);
    p.said = now; p.lastX = raw.toLowerCase();
    const row = this.sql.exec('INSERT INTO chat (at, ch, pid, sub, n, k, u, x, tid, tn, tsub) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING i',
      now, ch, p.id, p.sub, p.n, p.k, p.u, text, to ? to.id : null, to ? to.n : null, to ? to.sub : null).one();
    if (row.i % 20 === 0) this.sql.exec('DELETE FROM chat WHERE i <= ?', row.i - KEEP);
    const msg = { i: row.i, ch, id: p.id, n: p.n, k: p.k, u: p.u, x: text, at: now, ...(to ? { to: to.id, tn: to.n } : {}) };
    const out = JSON.stringify({ t: 'c', m: msg });
    const near = o => o === p || (o.s && p.s && o.s[5] === p.s[5] && Math.hypot(o.s[0] - p.s[0], o.s[2] - p.s[2]) <= CHAT_NEAR);
    for (const [w, o] of this.peers) if (ch === 'v' || (ch === 'w' ? o === p || o === to : near(o))) try { w.send(out); } catch (e) {}
    this.toControl('/log', { room: this.name, m: msg, sub: p.sub, raw: raw !== text ? raw : null, tsub: to ? to.sub : null });
  }
  // a player's report: the message (kept here; a whisper only by someone it was between) or the player, with the
  // chat around it, to the control desk
  report(ws, p, m, now) {
    const no = why => { try { ws.send(JSON.stringify({ t: 'cx', why })); } catch (e) {} };
    if (now - p.rep < 15000 || p.reps >= 20) return no('report-slow');
    let msg = null, target = null;
    if (Number.isInteger(m.i)) {
      const r = this.sql.exec('SELECT * FROM chat WHERE i = ?', m.i).toArray()[0];
      if (r && (r.ch !== 'w' || r.sub === p.sub || r.tsub === p.sub)) { msg = { i: r.i, ch: r.ch, x: r.x, at: r.at, tn: r.tn }; target = { sub: r.sub, n: r.n, k: r.k, u: r.u }; }
    } else if (Number.isInteger(m.id)) {
      for (const o of this.peers.values()) if (o.id === m.id) target = { sub: o.sub, n: o.n, k: o.k, u: o.u };
    }
    if (!target || target.sub === p.sub) return no('report-none');
    p.rep = now; p.reps++;
    const why = ['spam', 'abuse', 'scam', 'other'].includes(m.why) ? m.why : 'other';
    const context = this.sql.exec("SELECT i, at, ch, n, sub, x FROM chat WHERE ch != 'w' AND at > ? ORDER BY i DESC LIMIT 12", now - 3600000).toArray().reverse();
    this.toControl('/report', { room: this.name, why, note: cleanText(m.note).slice(0, 200), by: { sub: p.sub, n: p.n, k: p.k }, target, msg, context, where: p.s });
    try { ws.send('{"t":"rpok"}'); } catch (e) {}
  }
  // from the control desk (an admin's command; nothing else can reach a room's own address)
  ctl(op) {
    const all = o => { const s = JSON.stringify(o); for (const w of this.peers.keys()) try { w.send(s); } catch (e) {} };
    let hit = 0;
    if (op.op === 'who') {
      const players = [...this.peers.values()].map(p => ({ id: p.id, sub: p.sub, u: p.u, n: p.n, k: p.k, look: p.look ? { t: p.look.t, col: p.look.col, tok: p.look.tok } : null, s: p.s, mute: p.mute > Date.now() ? p.mute : 0, j: p.j }));
      return json({ ok: true, room: this.name, players, hit: players.length });
    }
    if (op.op === 'cfg') { const c = this.setCfg(op.cfg); if (c.voice === false) this.voice.muteAll(); all({ t: 'cfg', chat: c.chat, slow: c.slow, voice: this.voiceOn(c) }); hit = this.peers.size; }
    if (op.op === 'mute') for (const [w, p] of this.peers) if (p.sub === op.sub) { p.mute = +op.until || 0; hit++; if (p.mute > Date.now()) this.voice.mute(p.id); try { w.serializeAttachment(this.slim(p)); w.send(JSON.stringify({ t: 'cm', until: p.mute })); } catch (e) {} }
    if (op.op === 'kick') for (const [w, p] of [...this.peers]) if (p.sub === op.sub) { hit++; this.part(w, JSON.stringify({ t: 'kick', why: op.why === 'banned' ? 'banned' : 'kick', until: +op.until || 0 }), 4003, 'kicked'); }
    if (op.op === 'del' && +op.i > 0) { this.sql.exec('UPDATE chat SET del = 1 WHERE i = ?', +op.i); all({ t: 'cd', i: +op.i }); hit = 1; }
    if (op.op === 'clear') { this.sql.exec('UPDATE chat SET del = 1'); all({ t: 'cc' }); hit = 1; }
    return json({ ok: true, room: this.name, hit });
  }
  // a player sent away (another tab, a kick or a ban): told why, its socket marked gone (a room waking from hibernation
  // must not take it back while the close is still under way) and closed
  part(ws, msg, code, reason) {
    try { ws.send(msg); } catch (e) {}
    this.shut(ws, code, reason);
  }
  shut(ws, code, reason) {
    if (this.peers.has(ws)) this.closed(code);
    try { ws.serializeAttachment({ gone: true }); } catch (e) {}
    try { ws.close(code, reason); } catch (e) {}
    this.drop(ws);
  }
  // players whose socket has sent nothing for this.stale, not even a ping (the auto response keeps its time), leave
  // (looked at on a join and at most every 10 s on a message)
  sweep(now, force) {
    if (!force && now - this.swept < 10000) return;
    this.swept = now;
    for (const [w, p] of [...this.peers]) {
      let last = Math.max(p.seen || 0, p.j || 0);
      try { const t = this.ctx.getWebSocketAutoResponseTimestamp(w); if (t && +t > last) last = +t; } catch (e) {}
      if (now - last > this.stale) this.shut(w, 4002, 'gone quiet');
    }
  }
  drop(ws) {
    const p = this.peers.get(ws); if (!p) return; this.peers.delete(ws);
    const msg = JSON.stringify({ t: 'l', id: p.id });
    for (const w of this.peers.keys()) try { w.send(msg); } catch (e) {}
    const v = this.voice.drop(p.id); try { this.ctx.waitUntil(v); } catch (e) {} // (its tracks closed at the SFU)
    if (!this.peers.size && (this.pfBuf.length || this.joins || Object.keys(this.closes).length)) this.flushPerf(Date.now()); // (the last one out: the desk sees it empty)
  }
  webSocketClose(ws, code) { if (this.peers.has(ws)) this.closed(code); this.drop(ws); try { ws.close(code === 1005 ? 1000 : code, 'bye'); } catch (e) {} }
  webSocketError(ws) { if (this.peers.has(ws)) this.closed(1006); this.drop(ws); }
}
