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
//                   {"t":"ping"}  answered with {"t":"pong"} without waking the room (auto response)
//   room -> client  {t:'hi', you:id, room:{village, copy, max}, peers:[peer]}   on joining
//                   {t:'j', ...peer}   someone came in      {t:'l', id}   someone left
//                   {t:'u', id, s:[x,y,z,yaw,anim,interior]}   a state     {t:'e', id, e}   an emote
//                   {t:'dup'}   the same account opened the room somewhere else (this one closes)
//   peer = {id, n: name, k: 'discord'|'name'|'guest', av: avatar url, look, s: state|null}
// Near players (same interior, < NEAR m) get every state; further ones one every 0.5 s (< MID m) or 2 s; a final
// state always goes through. Limits: 1 KB a message, 24 messages / 2 s a player, emotes 1 / 1.2 s.

const PROTOCOL = 'rebel-universe.v1';
const VILLAGES = new Set(['hub', 'ronin', 'samurai', 'shogun', 'bushi', 'buke', 'ashigaru', 'kenshi', 'yamabushi', 'sohei', 'wokou', 'warrior', 'cute-creepy', 'chumpz', 'saints-la']);
const EMOTES = new Set(['cheer', 'wave', 'bow', 'dance_wave', 'dance_tut', 'dance_house', 'dance_gangnam', 'jump', 'kick']);
const ANIM = /^[a-z0-9_]{1,20}$/, INTERIOR = /^[A-Za-z0-9_-]{1,64}$/;
const NEAR = 40, MID = 120, COPIES = 24;

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });
const b64u = s => { const t = String(s).replace(/-/g, '+').replace(/_/g, '/'); const bin = atob(t + '==='.slice((t.length + 3) % 4)); return Uint8Array.from(bin, c => c.charCodeAt(0)); };
const keyCache = new Map();
async function publicKeys(env, site) {
  let list = []; try { const k = JSON.parse(env.TICKET_KEYS || '{}')[site]; list = Array.isArray(k) ? k : k ? [k] : []; } catch (e) { list = []; }
  const out = [];
  for (const k of list) {
    if (!keyCache.has(k)) keyCache.set(k, crypto.subtle.importKey('raw', b64u(k), { name: 'Ed25519' }, false, ['verify']));
    out.push(await keyCache.get(k));
  }
  return out;
}
// a ticket this worker can trust: signed by one of its site's keys, for its site, not expired, not too long-lived
export async function verifyTicket(raw, env, now = Date.now()) {
  const [body, sig] = String(raw || '').split('.');
  if (!body || !sig || body.length > 2400 || sig.length > 100) throw Object.assign(new Error('bad ticket'), { code: 'ticket' });
  const site = env.SITE || 'dev', keys = await publicKeys(env, site), data = new TextEncoder().encode(body), s = b64u(sig);
  let ok = false; for (const k of keys) if (await crypto.subtle.verify({ name: 'Ed25519' }, k, s, data)) { ok = true; break; }
  if (!ok) throw Object.assign(new Error('ticket not signed by this site'), { code: 'ticket' });
  const t = JSON.parse(new TextDecoder().decode(b64u(body))), sec = now / 1000;
  if (t.v !== 1 || t.site !== site || !(t.exp > sec) || t.exp - sec > 600 || typeof t.sub !== 'string' || !/^[ug]:[A-Za-z0-9_-]{4,64}$/.test(t.sub)) throw Object.assign(new Error('ticket expired or not for this site'), { code: 'ticket' });
  return t;
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
    if (url.pathname !== '/v1/room') return json({ ok: false, error: 'not found' }, 404);
    if (req.headers.get('upgrade')?.toLowerCase() !== 'websocket') return json({ ok: false, error: 'websocket only' }, 426);
    if (!originAllowed(env, req.headers.get('origin'))) return json({ ok: false, error: 'origin' }, 403);
    const village = url.searchParams.get('village') || '', want = Math.floor(+url.searchParams.get('copy') || 0);
    if (!VILLAGES.has(village) || want < 0 || want > COPIES) return json({ ok: false, error: 'village' }, 400);
    const protos = String(req.headers.get('sec-websocket-protocol') || '').split(',').map(s => s.trim());
    if (!protos.includes(PROTOCOL)) return json({ ok: false, error: 'protocol' }, 400);
    let t;
    try { t = await verifyTicket((protos.find(p => p.startsWith('t.')) || '').slice(2), env); } catch (e) { return json({ ok: false, error: e.code || 'ticket' }, 401); }
    if (t.village && t.village !== village) return json({ ok: false, error: 'ticket is for another village' }, 401);
    const ident = { sub: t.sub, n: String(t.n || 'Rebel').slice(0, 40), k: ['discord', 'name', 'guest'].includes(t.k) ? t.k : 'guest', av: typeof t.av === 'string' && /^https:\/\/cdn\.discordapp\.com\//.test(t.av) ? t.av.slice(0, 160) : '', look: t.look && typeof t.look === 'object' ? t.look : { t: 'starter' } };
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
    this.ctx = ctx; this.env = env; this.max = Math.max(2, Math.min(200, +env.ROOM_MAX || 50));
    this.peers = new Map(); this.nextId = 1;
    // waking from hibernation: who is here comes back from the sockets' attachments
    for (const ws of ctx.getWebSockets()) { const a = ws.deserializeAttachment(); if (a && a.id) { this.peers.set(ws, this.live(a)); this.nextId = Math.max(this.nextId, a.id + 1); } }
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
  }
  live(a) { return { ...a, last: new Map(), win: 0, cnt: 0, em: 0 }; }
  slim(p) { return { id: p.id, sub: p.sub, n: p.n, k: p.k, av: p.av, look: p.look, s: p.s, village: p.village, copy: p.copy }; }
  pub(p) { return { id: p.id, n: p.n, k: p.k, av: p.av, look: p.look, s: p.s }; }
  async fetch(req) {
    const url = new URL(req.url), ident = JSON.parse(req.headers.get('x-ru-ident') || 'null');
    if (!ident || req.headers.get('upgrade') !== 'websocket') return json({ ok: false }, 400);
    // one socket per account: an older one is told and closed (guests get a new id with every ticket)
    for (const [w, p] of [...this.peers]) if (p.sub === ident.sub) { try { w.send('{"t":"dup"}'); w.close(4001, 'opened elsewhere'); } catch (e) {} this.drop(w); }
    if (this.peers.size >= this.max) return json({ ok: false, full: true }, 409);
    const village = url.searchParams.get('village'), copy = +url.searchParams.get('copy');
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    const p = this.live({ id: this.nextId++, ...ident, s: null, village, copy });
    server.serializeAttachment(this.slim(p)); this.peers.set(server, p);
    server.send(JSON.stringify({ t: 'hi', you: p.id, room: { village, copy, max: this.max }, peers: [...this.peers.values()].filter(q => q !== p).map(q => this.pub(q)) }));
    const join = JSON.stringify({ t: 'j', ...this.pub(p) });
    for (const w of this.peers.keys()) if (w !== server) try { w.send(join); } catch (e) {}
    return new Response(null, { status: 101, webSocket: client, headers: { 'sec-websocket-protocol': PROTOCOL } });
  }
  webSocketMessage(ws, data) {
    const p = this.peers.get(ws); if (!p) return;
    if (typeof data !== 'string' || data.length > 1024) return;
    const now = Date.now();
    if (now - p.win > 2000) { p.win = now; p.cnt = 0; }
    if (++p.cnt > 24) { if (p.cnt > 96) try { ws.close(4008, 'too many messages'); } catch (e) {} return; }
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    if (m && m.t === 's') this.state(ws, p, m, now);
    else if (m && m.t === 'e') this.emote(ws, p, m, now);
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
  }
  emote(ws, p, m, now) {
    if (!EMOTES.has(m.e) || now - p.em < 1200) return; p.em = now;
    const msg = JSON.stringify({ t: 'e', id: p.id, e: m.e });
    for (const [w, o] of this.peers) if (w !== ws && (!o.s || !p.s || o.s[5] === p.s[5])) try { w.send(msg); } catch (e) {}
  }
  drop(ws) {
    const p = this.peers.get(ws); if (!p) return; this.peers.delete(ws);
    const msg = JSON.stringify({ t: 'l', id: p.id });
    for (const w of this.peers.keys()) try { w.send(msg); } catch (e) {}
  }
  webSocketClose(ws, code) { this.drop(ws); try { ws.close(code === 1005 ? 1000 : code, 'bye'); } catch (e) {} }
  webSocketError(ws) { this.drop(ws); }
}
