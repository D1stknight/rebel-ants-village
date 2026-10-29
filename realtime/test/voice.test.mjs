// node test/voice.test.mjs   (env PORT, SPORT, KEEP=1 leaves the dev server running)
// Starts the room server locally (wrangler dev --env dev, test signing keys, its own storage) with its SFU calls pointed
// at a stand-in for Cloudflare Realtime SFU (the same HTTP routes and answers, no media: sdp strings only) and checks
// voice with bots: the hello says voice is on (off without the app), guests can't publish or listen, publishing (one
// SFU session, the track, every other page told), newcomers see who has a voice, listening (only speakers near enough
// in the same place, the SFU pull, the offer, the answer renegotiated), walking away (the room closes the voice and tells
// the page), a big offer gets through (other messages stay under 1 KB), an admin mute and the voice switch (every voice
// off, publishing refused), leaving (the tracks closed), and a group's voices (members only, from any village, the
// member's leaving).
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = +process.env.PORT || 8797, SPORT = +process.env.SPORT || 8798, ROOT = fileURLToPath(new URL('..', import.meta.url));
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const PUB = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64url');
const ADMIN = crypto.generateKeyPairSync('ed25519');
const ADMIN_PUB = ADMIN.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64url');
const STATE = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-test-'));
const ticket = (o = {}) => {
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ v: 1, site: 'dev', sub: 'u:' + crypto.randomBytes(6).toString('hex'), n: 'Bot', k: 'discord', av: '', village: 'hub', look: { t: 'starter' }, iat: now, exp: now + 120, ...o })).toString('base64url');
  return body + '.' + crypto.sign(null, Buffer.from(body), privateKey).toString('base64url');
};
const uidOf = sub => crypto.createHash('sha256').update('rebel-universe:uid:v1:' + sub).digest('base64url').slice(0, 16);
let pass = 0, fail = 0;
const ok = (c, what, x) => { if (c) { pass++; console.log('  ok  ', what); } else { fail++; console.log('  FAIL', what, x !== undefined ? JSON.stringify(x).slice(0, 600) : ''); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- the stand-in SFU: sessions, tracks (local = published, remote = pulled from another session), renegotiate, close ----
const sfu = { sessions: new Map(), calls: [], token: 'test-secret' };
let mid = 0;
const srv = http.createServer(async (req, res) => {
  const body = await new Promise(r => { let b = ''; req.on('data', d => (b += d)); req.on('end', () => r(b)); });
  const send = (st, o) => { res.writeHead(st, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (req.headers.authorization !== 'Bearer ' + sfu.token) return send(401, { errorCode: 'unauthorized' });
  const m = /^\/v1\/apps\/([^/]+)\/sessions\/(new|([^/]+)\/(tracks\/new|renegotiate|tracks\/close))$/.exec(req.url);
  if (!m) return send(404, {});
  let b = null; try { b = body ? JSON.parse(body) : null; } catch (e) {}
  const op = m[2] === 'new' ? 'new' : m[4] === 'tracks/new' ? 'tracks' : m[4] === 'renegotiate' ? 'reneg' : 'close';
  sfu.calls.push({ app: m[1], op, id: m[3] || null, body: b, method: req.method });
  if (op === 'new') { const id = crypto.randomBytes(8).toString('hex'); sfu.sessions.set(id, { local: new Map(), remote: new Map() }); return send(200, { sessionId: id }); }
  const s = sfu.sessions.get(m[3]); if (!s) return send(404, { errorCode: 'not_found_session_error' });
  if (op === 'tracks') {
    if (b?.sessionDescription?.type === 'offer') { for (const t of b.tracks || []) s.local.set(t.trackName, t.mid); return send(200, { sessionDescription: { type: 'answer', sdp: 'v=0 answer' }, tracks: (b.tracks || []).map(t => ({ mid: t.mid, trackName: t.trackName })) }); }
    const out = [];
    for (const t of b?.tracks || []) {
      const src = sfu.sessions.get(t.sessionId);
      if (!src || !src.local.has(t.trackName)) { out.push({ trackName: t.trackName, sessionId: t.sessionId, errorCode: 'not_found_track_error' }); continue; }
      const id = String(++mid); s.remote.set(id, t.sessionId); out.push({ mid: id, trackName: t.trackName, sessionId: t.sessionId });
    }
    return send(200, { requiresImmediateRenegotiation: out.some(o => o.mid), ...(out.some(o => o.mid) ? { sessionDescription: { type: 'offer', sdp: 'v=0 offer ' + out.map(o => o.mid).join(',') } } : {}), tracks: out });
  }
  if (op === 'reneg') return send(200, {});
  if (op === 'close') { for (const t of b?.tracks || []) { s.remote.delete(t.mid); for (const [n, x] of s.local) if (x === t.mid) s.local.delete(n); } return send(200, { tracks: (b?.tracks || []).map(t => ({ mid: t.mid })) }); }
}).listen(SPORT, '127.0.0.1');

function sock(url, t) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}${url}`, ['rebel-universe.v1', 't.' + t]);
    const b = { ws, msgs: [], waiters: [], closed: null };
    ws.onmessage = e => { const m = JSON.parse(e.data); for (const w of b.waiters) if (w(m)) return; b.msgs.push(m); };
    ws.onopen = () => resolve(b); ws.onerror = () => reject(new Error('socket error')); ws.onclose = e => { b.closed = e.code; };
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
async function player(n, o = {}, village = 'hub') {
  const sub = 'u:' + crypto.randomBytes(6).toString('hex');
  const P = { n, sub, u: uidOf(sub), o };
  P.room = await sock('/v1/room?village=' + village, ticket({ sub, n, village, ...o })); P.hi = await P.room.next(m => m.t === 'hi'); P.id = P.hi.you;
  P.at = (x, z, i = null) => P.room.send({ t: 's', p: [x, 0, z], r: 0, a: 'idle', i, f: 1 });
  P.group = async id => { P.g = await sock('/v1/group?id=' + id, ticket({ sub, n, ...o })); P.ghi = await P.g.next(m => m.t === 'ghi'); return P.g; };
  return P;
}
const command = (cmd, args = {}) => {
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ v: 1, typ: 'mp-admin', site: 'dev', cmd, args, iat: now, exp: now + 60, nonce: crypto.randomBytes(12).toString('base64url') })).toString('base64url');
  return body + '.' + crypto.sign(null, Buffer.from(body), ADMIN.privateKey).toString('base64url');
};
const admin = async (cmd, args) => (await fetch(`http://127.0.0.1:${PORT}/v1/admin`, { method: 'POST', body: command(cmd, args) })).json();
const OFFER = 'v=0\r\n' + 'a=x'.repeat(1800); // (about 5.4 KB: a real Opus offer is 2-6 KB)

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
  console.log('the room');
  const A = await player('Ana'), Bo = await player('Bo'), G = await player('Guest', { k: 'guest', sub: 'g:' + crypto.randomBytes(6).toString('hex') });
  ok(A.hi.cfg?.voice === true, 'the hello says voice is on (the SFU app is set)', A.hi.cfg);
  A.at(0, 0); Bo.at(5, 0); G.at(3, 0); await sleep(300);
  G.room.send({ t: 'vp', sdp: OFFER, mid: '0' });
  ok((await G.room.next(m => m.t === 'vp')).no === 'guest', 'a guest can\'t publish');
  G.room.send({ t: 'vs', want: [String(A.id)] });
  const gs = await G.room.next(m => m.t === 'vs');
  ok(gs.no === 'guest' && gs.subs.length === 0, 'a guest can\'t listen (answered: guest)', gs);
  const before = sfu.calls.length;
  A.room.send({ t: 'vp', sdp: OFFER, mid: '0' });
  const ap = await A.room.next(m => m.t === 'vp');
  ok(ap.sdp === 'v=0 answer' && !ap.no, 'Ana publishes: the SFU\'s answer comes back (a 5 KB offer got through)', ap);
  const nc = sfu.calls.slice(before);
  ok(nc[0]?.op === 'new' && nc[1]?.op === 'tracks' && nc[1].body.tracks[0].location === 'local' && nc[1].body.tracks[0].trackName === 'v' && nc[1].body.sessionDescription.sdp === OFFER, 'one producer session, the offer, a local track \'v\'', nc.map(c => c.op));
  ok(nc.every(c => c.app === 'testapp'), 'the app id in every SFU path');
  const vo = await Bo.room.next(m => m.t === 'vo');
  ok(vo.key === A.id && vo.on === true, 'Bo is told Ana has a voice now', vo);
  ok(await G.room.next(m => m.t === 'vo').then(m => m.key === A.id).catch(() => false), 'the guest is told too (sees who talks)');
  const Cy = await player('Cy'); Cy.at(4, 1);
  const peerA = Cy.hi.peers.find(p => p.id === A.id);
  ok(peerA?.vo === 1, 'a newcomer\'s hello marks Ana as having a voice', peerA);
  // Bo listens to Ana
  Bo.room.send({ t: 'vs', want: [String(A.id), String(Cy.id), '999'] });
  const bs = await Bo.room.next(m => m.t === 'vs');
  ok(bs.subs.length === 1 && bs.subs[0].key === A.id && bs.subs[0].mid && bs.sdp === 'v=0 offer ' + bs.subs[0].mid, 'Bo listens: only Ana (Cy has no voice, 999 is nobody), a mid and the SFU\'s offer', bs);
  const pull = sfu.calls.filter(c => c.op === 'tracks' && !c.body.sessionDescription).pop();
  ok(pull?.body.tracks.length === 1 && pull.body.tracks[0].location === 'remote' && pull.body.tracks[0].trackName === 'v', 'the pull: a remote track from Ana\'s session', pull?.body);
  Bo.room.send({ t: 'va', sdp: 'v=0\r\n' + 'a=y'.repeat(1500) });
  await sleep(500);
  const rn = sfu.calls.filter(c => c.op === 'reneg').pop();
  ok(rn && rn.method === 'PUT' && rn.body.sessionDescription.type === 'answer', 'Bo\'s answer renegotiates his consumer session (a 4.5 KB answer)', rn?.body?.sessionDescription?.type);
  // a big message that is not voice is still refused
  Bo.room.send({ t: 'c', ch: 'v', x: 'hello '.repeat(200) });
  ok(await Bo.room.none(m => m.t === 'c' || m.t === 'cx', 600), 'other messages over 1 KB are still dropped');
  // too far: a listener 60 m off gets nothing; walking away closes the voice
  const Far = await player('Far'); Far.at(60, 0); await sleep(300);
  Far.room.send({ t: 'vs', want: [String(A.id)] });
  const fs1 = await Far.room.next(m => m.t === 'vs');
  ok(fs1.subs.length === 0 && !fs1.sdp, 'from 60 m: nothing to hear', fs1);
  const R = await player('Roomie'); R.at(1, 1, 'hub_after_dark'); await sleep(300);
  R.room.send({ t: 'vs', want: [String(A.id)] });
  ok((await R.room.next(m => m.t === 'vs')).subs.length === 0, 'inside a room: the voices outside aren\'t heard');
  const closesBefore = sfu.calls.filter(c => c.op === 'close').length;
  await sleep(2100); Bo.at(70, 0); // (the room checks who hears whom at most every 2 s, as states come in)
  const push = await Bo.room.next(m => m.t === 'vs' && m.push === 1, 6000).catch(() => null);
  ok(push && push.subs.length === 0, 'Bo walks 70 m off: the room closes Ana\'s voice for him and tells his page', push);
  const cl = sfu.calls.filter(c => c.op === 'close').slice(closesBefore);
  ok(cl.some(c => c.body.force === true && c.body.tracks.length === 1), 'the SFU: his pulled track closed', cl.map(c => c.body));
  Bo.at(5, 0); await sleep(300);
  Bo.room.send({ t: 'vs', want: [String(A.id)] });
  ok((await Bo.room.next(m => m.t === 'vs')).subs.length === 1, 'back near: he hears Ana again');
  // an admin mute: Ana's voice goes for everyone, publishing again refused; unmute
  await admin('mute', { sub: A.sub, n: 'Ana', minutes: 5 });
  ok(await Bo.room.next(m => m.t === 'vo' && m.key === A.id && m.on === false).then(() => true).catch(() => false), 'an admin mute: Ana\'s voice goes off for everyone');
  ok(await A.room.next(m => m.t === 'vo' && m.key === A.id && m.on === false).then(() => true).catch(() => false), 'and her own page is told (its track is gone there)');
  A.room.send({ t: 'vp', sdp: OFFER, mid: '0' });
  ok((await A.room.next(m => m.t === 'vp')).no === 'muted', 'muted: publishing is refused (muted)');
  await admin('unmute', { sub: A.sub });
  await sleep(300);
  A.room.send({ t: 'vp', sdp: OFFER, mid: '0' });
  ok(!(await A.room.next(m => m.t === 'vp')).no, 'unmuted: she publishes again');
  await Bo.room.next(m => m.t === 'vo' && m.on).catch(() => {});
  // the voice switch (the admins' settings)
  const off = await admin('cfg-set', { voice: false });
  ok(off.ok && off.cfg.voice === false, 'the admins switch voice off', off);
  const cf = await Bo.room.next(m => m.t === 'cfg');
  ok(cf.voice === false, 'every page is told (cfg voice false)', cf);
  ok(await Bo.room.next(m => m.t === 'vo' && m.key === A.id && m.on === false).then(() => true).catch(() => false), 'and every voice stops');
  A.room.send({ t: 'vp', sdp: OFFER, mid: '0' });
  ok((await A.room.next(m => m.t === 'vp')).no === 'off', 'voice off: publishing refused (off)');
  const D = await player('Dee'); ok(D.hi.cfg.voice === false, 'a newcomer\'s hello: voice off');
  await admin('cfg-set', { voice: true });
  ok((await Bo.room.next(m => m.t === 'cfg')).voice === true, 'switched on again');
  // leaving: her tracks closed at the SFU, the others told
  A.room.send({ t: 'vp', sdp: OFFER, mid: '0' }); await A.room.next(m => m.t === 'vp');
  await Bo.room.next(m => m.t === 'vo' && m.on).catch(() => {});
  const cl0 = sfu.calls.filter(c => c.op === 'close').length;
  A.room.close();
  ok(await Bo.room.next(m => m.t === 'vo' && m.key === A.id && m.on === false).then(() => true).catch(() => false), 'Ana leaves: her voice off for the others');
  await sleep(400);
  ok(sfu.calls.filter(c => c.op === 'close').length > cl0, 'and her track closed at the SFU');
  for (const P of [Bo, G, Cy, Far, R, D]) P.room.close();

  console.log('a group');
  const M = await player('Mia'), N = await player('Nico', {}, 'samurai'), X = await player('Xan');
  M.g = await sock('/v1/group?id=new', ticket({ sub: M.sub, n: 'Mia' }));
  const mh = await M.g.next(m => m.t === 'ghi');
  ok(mh.cfg?.voice === true, 'the group\'s hello says voice is on', mh.cfg);
  M.g.send({ t: 'gi', u: N.u }); await M.g.next(m => m.t === 'gi' && m.ok);
  await N.group(mh.g);
  ok(N.ghi.members.length === 2, 'Nico (in Samurai) joins');
  M.g.send({ t: 'vp', sdp: OFFER, mid: '0' });
  ok(!(await M.g.next(m => m.t === 'vp')).no, 'Mia publishes to the group');
  ok((await N.g.next(m => m.t === 'vo')).key === M.u, 'Nico is told: Mia\'s member code has a voice');
  N.g.send({ t: 'vs', want: [M.u, X.u] });
  const ns = await N.g.next(m => m.t === 'vs');
  ok(ns.subs.length === 1 && ns.subs[0].key === M.u && ns.sdp, 'Nico hears Mia from another village (members only: Xan is not one)', ns);
  const xs = await sock('/v1/group?id=' + mh.g, ticket({ sub: X.sub, n: 'Xan' })).then(b => b.next(m => m.t === 'ghi', 1500).then(() => 'in').catch(() => 'no hello')).catch(() => 'refused');
  ok(xs !== 'in', 'someone not invited can\'t open the group (so no voice either)', xs);
  const nk = await sock('/v1/room?village=samurai', ticket({ sub: 'u:' + crypto.randomBytes(6).toString('hex'), n: 'Kim', village: 'samurai' })); await nk.next(m => m.t === 'hi');
  M.g.send({ t: 'gl' });
  ok(await N.g.next(m => m.t === 'vo' && m.key === M.u && m.on === false).then(() => true).catch(() => false), 'Mia leaves the group: her group voice off');
  ok(await nk.none(m => m.t === 'vo', 500), 'the room never hears group voices');
  for (const P of [M, N, X]) { P.room.close(); try { P.g?.close(); } catch (e) {} }
  nk.close();
} catch (e) { fail++; console.log('  FAIL (exception)', e.stack); }
console.log(`\n${pass} passed, ${fail} failed`);
stop(); process.exit(fail ? 1 : 0);
