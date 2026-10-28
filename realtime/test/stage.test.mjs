// node test/stage.test.mjs   (env PORT, SPORT, KEEP=1 leaves the dev server running)
// Starts the room server locally (wrangler dev --env dev, test keys, its own storage, a stand-in SFU as in voice.test.mjs)
// and checks the Colony Stage with bots and signed admin commands: making events (and what is refused), the public list
// (live, next, no account ids, CORS for allowed origins), who may come in (not before it starts unless a host, never after
// it ends), the hall's hello, its chat (guests read, the slow mode, hosts never slowed, the filter, the admins' log),
// raised hands, bringing a hand up and sending it down, the stage's voices (hosts and speakers talk, everyone hears, guests
// too), the show started by a host or the Admin Hub (the same start for a late arrival, stopped), hosts added and taken off
// in the Admin Hub, an admin mute and kick in a hall, ending (everyone told, the door shut), the end-time alarm, deleting.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = +process.env.PORT || 8799, SPORT = +process.env.SPORT || 8800, ROOT = fileURLToPath(new URL('..', import.meta.url));
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const PUB = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64url');
const ADMIN = crypto.generateKeyPairSync('ed25519');
const ADMIN_PUB = ADMIN.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64url');
const STATE = fs.mkdtempSync(path.join(os.tmpdir(), 'stage-test-'));
const ticket = (o = {}) => {
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ v: 1, site: 'dev', sub: 'u:' + crypto.randomBytes(6).toString('hex'), n: 'Bot', k: 'discord', av: '', village: 'hub', look: { t: 'starter' }, iat: now, exp: now + 120, ...o })).toString('base64url');
  return body + '.' + crypto.sign(null, Buffer.from(body), privateKey).toString('base64url');
};
const uidOf = sub => crypto.createHash('sha256').update('rebel-universe:uid:v1:' + sub).digest('base64url').slice(0, 16);
let pass = 0, fail = 0;
const ok = (c, what, x) => { if (c) { pass++; console.log('  ok  ', what); } else { fail++; console.log('  FAIL', what, x !== undefined ? JSON.stringify(x).slice(0, 600) : ''); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
// the stand-in SFU (sdp strings only)
const sfu = { sessions: new Map(), token: 'test-secret' }; let mid = 0;
const srv = http.createServer(async (req, res) => {
  const body = await new Promise(r => { let b = ''; req.on('data', d => (b += d)); req.on('end', () => r(b)); });
  const send = (st, o) => { res.writeHead(st, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.headers.authorization !== 'Bearer ' + sfu.token) return send(401, {});
  const m = /^\/v1\/apps\/[^/]+\/sessions\/(new|([^/]+)\/(tracks\/new|renegotiate|tracks\/close))$/.exec(req.url); if (!m) return send(404, {});
  let b = null; try { b = body ? JSON.parse(body) : null; } catch (e) {}
  if (m[1] === 'new') { const id = crypto.randomBytes(8).toString('hex'); sfu.sessions.set(id, { local: new Set() }); return send(200, { sessionId: id }); }
  const s = sfu.sessions.get(m[2]); if (!s) return send(404, { errorCode: 'not_found_session_error' });
  if (m[3] === 'tracks/new') {
    if (b?.sessionDescription?.type === 'offer') { for (const t of b.tracks || []) s.local.add(t.trackName); return send(200, { sessionDescription: { type: 'answer', sdp: 'answer' }, tracks: b.tracks.map(t => ({ mid: t.mid, trackName: t.trackName })) }); }
    const out = (b?.tracks || []).map(t => sfu.sessions.get(t.sessionId)?.local.has(t.trackName) ? { mid: String(++mid), trackName: t.trackName, sessionId: t.sessionId } : { trackName: t.trackName, sessionId: t.sessionId, errorCode: 'not_found_track_error' });
    return send(200, { requiresImmediateRenegotiation: out.some(o => o.mid), sessionDescription: { type: 'offer', sdp: 'offer' }, tracks: out });
  }
  return send(200, { tracks: [] });
}).listen(SPORT, '127.0.0.1');

function sock(url, t) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}${url}`, ['rebel-universe.v1', 't.' + t]);
    const b = { ws, msgs: [], waiters: [], closed: null, reason: '' };
    ws.onmessage = e => { const m = JSON.parse(e.data); for (const w of b.waiters) if (w(m)) return; b.msgs.push(m); };
    ws.onopen = () => resolve(b); ws.onerror = () => reject(new Error('socket error')); ws.onclose = e => { b.closed = e.code; b.reason = e.reason; };
    b.send = o => ws.send(typeof o === 'string' ? o : JSON.stringify(o));
    b.next = (pred, ms = 5000) => new Promise((yes, no) => {
      const i = b.msgs.findIndex(pred); if (i >= 0) return yes(b.msgs.splice(i, 1)[0]);
      const to = setTimeout(() => { b.waiters = b.waiters.filter(w => w !== f); no(new Error('timeout')); }, ms);
      const f = m => { if (!pred(m)) return false; clearTimeout(to); b.waiters = b.waiters.filter(w => w !== f); yes(m); return true; };
      b.waiters.push(f);
    });
    b.none = async (pred, ms = 800) => { await sleep(ms); return !b.msgs.some(pred); };
    b.close = () => { try { ws.close(); } catch (e) {} };
  });
}
const who = (n, o = {}) => { const sub = o.sub || 'u:' + crypto.randomBytes(6).toString('hex'); return { n, sub, u: uidOf(sub), t: () => ticket({ sub, n, ...o }) }; };
const enter = async (P, id) => { P.s = await sock('/v1/stage?id=' + id, P.t()); P.hi = await P.s.next(m => m.t === 'shi'); return P; };
const knock = (id, t) => new Promise(res => { // the status a refused knock gets (an upgrade over plain http)
  const req = http.request({ host: '127.0.0.1', port: PORT, path: '/v1/stage?id=' + id, headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), 'Sec-WebSocket-Protocol': 'rebel-universe.v1, t.' + t } });
  req.on('upgrade', (r, s) => { s.destroy(); res(101); }); req.on('response', r => { r.resume(); res(r.statusCode); }); req.on('error', () => res(0)); req.end();
});
const command = (cmd, args = {}) => {
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ v: 1, typ: 'mp-admin', site: 'dev', cmd, args, iat: now, exp: now + 60, nonce: crypto.randomBytes(12).toString('base64url') })).toString('base64url');
  return body + '.' + crypto.sign(null, Buffer.from(body), ADMIN.privateKey).toString('base64url');
};
const admin = async (cmd, args) => (await fetch(`http://127.0.0.1:${PORT}/v1/admin`, { method: 'POST', body: command(cmd, args) })).json();
const events = async origin => { const r = await fetch(`http://127.0.0.1:${PORT}/v1/events`, origin ? { headers: { origin } } : {}); return { cors: r.headers.get('access-control-allow-origin'), cache: r.headers.get('cache-control'), ...(await r.json()) }; };
const CLUB = { village: 'hub', room: 'hub_comedy_club', label: "Antthony's Comedy Club" };
const SHOW = { title: 'Opening Night', len: 60, cues: [{ t: 1, say: 'Good evening, Colony!' }, { t: 3, sfx: 'applause' }, { t: 5, clip: 'front_flip' }, { t: 7, sfx: 'boom' }, { t: 99, say: 'past the end' }] };

const dev = spawn(ROOT + 'node_modules/.bin/wrangler', ['dev', '--env', 'dev', '--port', String(PORT), '--ip', '127.0.0.1', '--var', `TICKET_KEYS:${JSON.stringify({ dev: [PUB] })}`, '--var', `ADMIN_KEYS:${JSON.stringify({ dev: [ADMIN_PUB] })}`, '--var', 'ALLOW_NO_ORIGIN:1',
  '--var', `REALTIME_API:http://127.0.0.1:${SPORT}/v1`, '--var', 'REALTIME_APP_ID:testapp', '--var', `REALTIME_APP_SECRET:${sfu.token}`, '--persist-to', STATE, '--show-interactive-dev-session=false', '--log-level', 'warn'],
  { cwd: ROOT, env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
const stop = () => { try { process.kill(-dev.pid, 'SIGTERM'); } catch (e) {} try { srv.close(); } catch (e) {} };
process.on('exit', () => { if (!process.env.KEEP) { stop(); try { fs.rmSync(STATE, { recursive: true, force: true }); } catch (e) {} } });
let out = ''; dev.stdout.on('data', d => (out += d)); dev.stderr.on('data', d => (out += d));
try { await fetch(`http://127.0.0.1:${PORT}/v1/health`); console.log(`port ${PORT} is already in use`); process.exit(1); } catch (e) {}
const t0 = Date.now(); let up = false;
while (Date.now() - t0 < 90000 && !up) { await sleep(500); try { up = (await fetch(`http://127.0.0.1:${PORT}/v1/health`)).ok; } catch (e) {} }
if (!up) { console.log('dev server did not start\n' + out.slice(-3000)); stop(); process.exit(1); }
try {
  console.log('making events');
  const e0 = await events();
  ok(e0.ok && e0.live.length === 0 && e0.next.length === 0, 'no events yet', e0);
  const now = Date.now();
  ok((await admin('event-save', { title: 'x', place: CLUB, starts: now, ends: now + 3600000 })).error, 'refused: a title too short');
  ok((await admin('event-save', { title: 'Opening Night', place: { village: 'atlantis' }, starts: now, ends: now + 3600000 })).error, 'refused: no such village');
  ok((await admin('event-save', { title: 'Opening Night', place: CLUB, starts: now, ends: now - 1 })).error, 'refused: it ends before it starts');
  ok((await admin('event-save', { title: 'Opening Night', place: CLUB, starts: now, ends: now + 13 * 3600000 })).error, 'refused: longer than 12 hours');
  const sv = await admin('event-save', { title: "Antthony's Opening Night", place: CLUB, starts: now - 60000, ends: now + 3600000, show: SHOW });
  ok(sv.ok && /^[A-Za-z0-9_-]{10}$/.test(sv.ev.id), 'an event made (an id)', sv);
  const id = sv.ev.id;
  ok(sv.ev.show.cues.length === 3 && !sv.ev.show.cues.some(c => c.sfx === 'boom') && sv.ev.show.cues.every(c => c.t <= 60), 'the show checked: unknown sounds and lines past its end dropped', sv.ev.show.cues);
  const later = await admin('event-save', { title: 'Saints Block Party', place: { village: 'saints-la', room: null, label: 'Saints of LA' }, starts: now + 2 * 3600000, ends: now + 3 * 3600000 });
  const e1 = await events('http://127.0.0.1:8765');
  ok(e1.live.length === 1 && e1.live[0].id === id && e1.live[0].live && e1.live[0].show === 'Opening Night', 'the public list: live now (with its show\'s title)', e1.live);
  ok(e1.next.length === 1 && e1.next[0].id === later.ev.id, 'and next', e1.next);
  ok(!JSON.stringify(e1).includes('u:'), 'no account ids in the public list');
  ok(e1.cors === 'http://127.0.0.1:8765' && /max-age=15/.test(e1.cache), 'CORS for an allowed origin, cached 15 s', [e1.cors, e1.cache]);
  ok(!(await events('https://evil.example')).cors, 'no CORS for others');

  console.log('who comes in');
  const Host = who('Antthony'), Aud = who('Bo'), Cy = who('Cy', { k: 'name' }), G = who('Guest', { k: 'guest', sub: 'g:' + crypto.randomBytes(6).toString('hex') });
  ok(await knock(later.ev.id, Aud.t()) === 403, 'not before it starts (403)');
  ok((await admin('event-host', { id, sub: Host.sub, u: Host.u, n: 'Antthony' })).ok, 'the Admin Hub makes Antthony a host');
  ok((await admin('event-host', { id, sub: G.sub, u: G.u, n: 'Guest' })).error, 'a guest can\'t host');
  await enter(Host, id); await enter(Aud, id); await enter(Cy, id); await enter(G, id);
  ok(Host.hi.host === true && Aud.hi.host === false && G.hi.host === false, 'the hello: Antthony is the host, the others not');
  ok(Host.hi.ev.title === "Antthony's Opening Night" && Host.hi.ev.place.room === 'hub_comedy_club' && Host.hi.ev.hosts[0].n === 'Antthony' && !JSON.stringify(Host.hi).includes(Host.sub), 'the event in the hello (no account ids)', Host.hi.ev);
  ok(Array.isArray(Host.hi.hands) && Aud.hi.hands === undefined, 'raised hands only in the host\'s hello');
  ok(G.hi.cfg.voice === true && G.hi.cfg.slow >= 5, 'voice on, the slow mode at least 5 s', G.hi.cfg);
  ok(Math.abs(Host.hi.now - Date.now()) < 3000, 'the hall\'s clock in the hello (for the show)');

  console.log('chat');
  G.s.send({ t: 'sc', x: 'hi' });
  ok((await G.s.next(m => m.t === 'scx')).why === 'guest', 'a guest reads, can\'t write');
  Aud.s.send({ t: 'sc', x: 'this show is shit' });
  const c1 = await G.s.next(m => m.t === 'sc');
  ok(c1.m.n === 'Bo' && c1.m.x !== 'this show is shit' && /s\*+/.test(c1.m.x) && !c1.m.h, 'Bo\'s line reaches everyone (the guest too), filtered', c1.m);
  Aud.s.send({ t: 'sc', x: 'again' });
  ok((await Aud.s.next(m => m.t === 'scx')).why === 'slow', 'the slow mode (5 s)');
  Host.s.send({ t: 'sc', x: 'Welcome everyone!' }); await sleep(150); Host.s.send({ t: 'sc', x: 'Settle in.' });
  const h1 = await Aud.s.next(m => m.t === 'sc' && m.m.x === 'Welcome everyone!'), h2 = await Aud.s.next(m => m.t === 'sc' && m.m.x === 'Settle in.').catch(() => null);
  ok(h1.m.h === 1 && h2, 'the host is never slowed down, and marked as host');
  await sleep(300);
  const lg = await admin('log', { room: `dev:event:${id}` });
  ok(lg.ok && lg.rows.some(r => r.ch === 'e' && r.n === 'Bo' && r.raw === 'this show is shit'), 'the admins\' log has the event chat (the words as typed)', lg.rows?.slice(0, 3));

  console.log('hands and the stage');
  G.s.send({ t: 'hand', on: true });
  Aud.s.send({ t: 'hand', on: true });
  const hs = await Host.s.next(m => m.t === 'shands' && m.hands.length > 0);
  ok(hs.hands.length === 1 && hs.hands[0].n === 'Bo', 'Bo raises a hand (the guest can\'t): the host sees it', hs.hands);
  ok((await Aud.s.next(m => m.t === 'shand')).on === true, 'Bo\'s page: hand up');
  Cy.s.send({ t: 'vp', sdp: 'offer', mid: '0' });
  ok((await Cy.s.next(m => m.t === 'vp')).no === 'stage', 'the audience can\'t talk to the stage (stage)');
  G.s.send({ t: 'vp', sdp: 'offer', mid: '0' });
  ok((await G.s.next(m => m.t === 'vp')).no === 'guest', 'nor a guest (guest)');
  Host.s.send({ t: 'vp', sdp: 'offer', mid: '0' });
  ok(!(await Host.s.next(m => m.t === 'vp')).no, 'the host talks');
  ok((await G.s.next(m => m.t === 'vo')).key === Host.u, 'everyone is told the host has a voice');
  G.s.send({ t: 'vs', want: [Host.u, Cy.u] });
  const gv = await G.s.next(m => m.t === 'vs');
  ok(gv.subs.length === 1 && gv.subs[0].key === Host.u, 'the guest hears the host (everyone at the event does); not Cy', gv);
  Host.s.send({ t: 'up', u: Aud.u });
  const sp = await G.s.next(m => m.t === 'sspk');
  ok(sp.speakers.length === 1 && sp.speakers[0].n === 'Bo', 'the host brings Bo up: everyone sees him on stage', sp);
  ok((await Host.s.next(m => m.t === 'shands')).hands.length === 0, 'his hand comes down');
  Aud.s.send({ t: 'vp', sdp: 'offer', mid: '0' });
  ok(!(await Aud.s.next(m => m.t === 'vp')).no, 'on stage, Bo talks');
  Cy.s.send({ t: 'vs', want: [Aud.u, Host.u] });
  ok((await Cy.s.next(m => m.t === 'vs')).subs.length === 2, 'Cy hears the host and Bo');
  Host.s.send({ t: 'down', u: Aud.u });
  ok(await Cy.s.next(m => m.t === 'sspk' && m.speakers.length === 0).then(() => true).catch(() => false), 'the host sends Bo down');
  ok(await Cy.s.next(m => m.t === 'vo' && m.key === Aud.u && m.on === false).then(() => true).catch(() => false), 'and Bo\'s voice stops');
  await sleep(300); Host.s.msgs.length = 0; Aud.s.send({ t: 'up', u: Cy.u });
  ok(await Host.s.none(m => m.t === 'sspk', 600), 'only hosts bring people up');

  console.log('the show');
  Host.s.send({ t: 'show', go: 1 });
  const sh = await G.s.next(m => m.t === 'sshow');
  ok(sh.show && sh.show.title === 'Opening Night' && sh.show.startAt - sh.now > 2000 && sh.show.startAt - sh.now < 4000 && sh.show.cues.length === 3, 'the host starts the show: everyone gets it, 3 s ahead', sh);
  const Late = who('Late'); await enter(Late, id);
  ok(Late.hi.show && Late.hi.show.startAt === sh.show.startAt, 'a late arrival gets the same start');
  await sleep(300);
  const ad = await admin('events');
  ok(ad.events.find(e => e.id === id)?.showAt === sh.show.startAt, 'the desk keeps when it started (for halls and pages later)');
  Host.s.send({ t: 'show', go: 0 });
  ok((await G.s.next(m => m.t === 'sshow')).show === null, 'stopped');
  const as = await admin('event-show', { id, go: true });
  ok(as.ok && as.reached >= 1, 'the Admin Hub starts it too', as);
  ok((await G.s.next(m => m.t === 'sshow')).show?.startAt === as.ev.showAt, 'the pages get the desk\'s start');
  Aud.s.send({ t: 'show', go: 0 });
  ok(await G.s.none(m => m.t === 'sshow', 600), 'only hosts start or stop the show');

  console.log('the Admin Hub');
  ok((await admin('event-host', { id, sub: Cy.sub, u: Cy.u, n: 'Cy' })).ok, 'Cy made a host while there');
  ok((await Cy.s.next(m => m.t === 'shost')).host === true, 'Cy\'s page: you host now');
  await admin('event-host', { id, sub: Cy.sub, on: false });
  ok((await Cy.s.next(m => m.t === 'shost')).host === false, 'and taken off');
  const on = await admin('online');
  ok(!on.rooms.some(r => /:event:/.test(r.room)), 'Online now lists room copies only (not the hall)');
  await admin('mute', { sub: Aud.sub, n: 'Bo', minutes: 5 });
  ok((await Aud.s.next(m => m.t === 'scm')).until > Date.now(), 'an admin mute reaches the hall');
  await sleep(5200); Aud.s.send({ t: 'sc', x: 'hello?' });
  ok((await Aud.s.next(m => m.t === 'scx')).why === 'muted', 'muted: no chat');
  await admin('kick', { sub: Late.sub, n: 'Late' });
  const km = await Late.s.next(m => m.t === 'kick').catch(() => null); await sleep(800);
  ok(km && km.why === 'kick', 'a kick reaches the hall (the page is told: it closes; the hall closes it too: 4003)', [km, Late.s.closed]);
  const del = await admin('del', { room: `dev:event:${id}`, i: c1.m.i });
  ok(del.ok && (await G.s.next(m => m.t === 'scd')).i === c1.m.i, 'a message deleted in the hall');

  console.log('the end');
  const en = await admin('event-end', { id });
  ok(en.ok, 'the Admin Hub ends it');
  ok(await G.s.next(m => m.t === 'send').then(() => true).catch(() => false), 'everyone is told');
  await sleep(500);
  ok(G.s.closed === 4004 && Host.s.closed === 4004, 'the sockets close (4004)', [G.s.closed, Host.s.closed]);
  ok(!(await events()).live.some(e => e.id === id), 'gone from the public list');
  ok(await knock(id, Aud.t()) === 410, 'a late knock: 410');
  // the end-time alarm: an event that ends 6 s from now
  const short = await admin('event-save', { title: 'A short one', place: CLUB, starts: Date.now() - 1000, ends: Date.now() + 6000 });
  const S1 = who('Sho'); await enter(S1, short.ev.id);
  const sm = await S1.s.next(m => m.t === 'send', 15000).catch(() => null); await sleep(500);
  ok(!!sm, 'its end time closes the hall by itself (the alarm: the page is told the event is over)', S1.s.closed);
  ok((await admin('event-delete', { id })).ok && !(await admin('events')).events.some(e => e.id === id), 'deleted');
} catch (e) { fail++; console.log('  FAIL (exception)', e.stack); }
console.log(`\n${pass} passed, ${fail} failed`);
stop(); process.exit(fail ? 1 : 0);
