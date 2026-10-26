// node test/rooms.test.mjs   (env PORT, KEEP=1 leaves the dev server running)
// Starts the room server locally (wrangler dev --env dev, a test signing key, ROOM_MAX 4) and checks it with bots:
// tickets (key, site, expiry), origin, protocol, joining and leaving, the hello and the peers, state relay near / far /
// final, emotes and their pace, the message limit, one socket per account, full copies, the ping auto response.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const PORT = +process.env.PORT || 8799, ROOT = fileURLToPath(new URL('..', import.meta.url));
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const PUB = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64url');
const OTHER = crypto.generateKeyPairSync('ed25519').privateKey;
let n = 0;
const ticket = (o = {}, key = privateKey) => {
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ v: 1, site: 'dev', sub: 'u:bot' + (++n) + crypto.randomBytes(3).toString('hex'), n: 'Bot ' + n, k: 'discord', av: '', look: { t: 'starter' }, iat: now, exp: now + 120, ...o })).toString('base64url');
  return body + '.' + crypto.sign(null, Buffer.from(body), key).toString('base64url');
};
let pass = 0, fail = 0;
const ok = (c, what) => { if (c) { pass++; console.log('  ok  ', what); } else { fail++; console.log('  FAIL', what); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// a raw upgrade request: the status the worker answers (101 / 4xx), with any headers
const upgrade = (path, headers = {}) => new Promise(res => {
  const req = http.request({ host: '127.0.0.1', port: PORT, path, headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), ...headers } });
  req.on('upgrade', (r, sock) => { sock.destroy(); res({ status: 101, proto: r.headers['sec-websocket-protocol'] }); });
  req.on('response', r => { let b = ''; r.on('data', d => (b += d)); r.on('end', () => res({ status: r.statusCode, body: b })); });
  req.on('error', e => res({ status: 0, error: e.message }));
  req.end();
});
function bot(t, { village = 'hub', copy } = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/v1/room?village=${village}${copy ? '&copy=' + copy : ''}`, ['rebel-universe.v1', 't.' + t]);
    const b = { ws, msgs: [], waiters: [], closed: null };
    ws.onmessage = e => { const m = JSON.parse(e.data); for (const w of b.waiters) if (w(m)) return; b.msgs.push(m); };
    ws.onopen = () => resolve(b); ws.onerror = () => reject(new Error('socket error')); ws.onclose = e => { b.closed = e.code; };
    b.send = o => ws.send(typeof o === 'string' ? o : JSON.stringify(o));
    b.next = (pred, ms = 4000) => new Promise((yes, no) => {
      const i = b.msgs.findIndex(pred); if (i >= 0) return yes(b.msgs.splice(i, 1)[0]);
      const to = setTimeout(() => { b.waiters = b.waiters.filter(w => w !== f); no(new Error('timeout')); }, ms);
      const f = m => { if (!pred(m)) return false; clearTimeout(to); b.waiters = b.waiters.filter(w => w !== f); yes(m); return true; };
      b.waiters.push(f);
    });
    b.none = async (pred, ms = 700) => { await sleep(ms); return !b.msgs.some(pred); };
    b.count = pred => b.msgs.filter(pred).length;
    b.close = () => { try { ws.close(); } catch (e) {} };
  });
}

const dev = spawn(ROOT + 'node_modules/.bin/wrangler', ['dev', '--env', 'dev', '--port', String(PORT), '--ip', '127.0.0.1', '--var', `TICKET_KEYS:${JSON.stringify({ dev: [PUB] })}`, '--var', 'ALLOW_NO_ORIGIN:1', '--var', 'ROOM_MAX:4', '--show-interactive-dev-session=false', '--log-level', 'warn'],
  { cwd: ROOT, env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
const stop = () => { try { process.kill(-dev.pid, 'SIGTERM'); } catch (e) {} }; // the whole group (wrangler, workerd)
process.on('exit', () => { if (!process.env.KEEP) stop(); });
let out = ''; dev.stdout.on('data', d => (out += d)); dev.stderr.on('data', d => (out += d));
try { await fetch(`http://127.0.0.1:${PORT}/v1/health`); console.log(`port ${PORT} is already in use (an old dev server?)`); process.exit(1); } catch (e) {}
const t0 = Date.now(); let up = false;
while (Date.now() - t0 < 90000 && !up) { await sleep(500); try { up = (await fetch(`http://127.0.0.1:${PORT}/v1/health`)).ok; } catch (e) {} }
if (!up) { console.log('dev server did not start\n' + out.slice(-3000)); stop(); process.exit(1); }
console.log('dev server up in', ((Date.now() - t0) / 1000).toFixed(1), 's');
try {
  console.log('the door');
  const h = await (await fetch(`http://127.0.0.1:${PORT}/v1/health`)).json(); ok(h.ok && h.site === 'dev', 'health says site dev');
  const P = `rebel-universe.v1, t.${ticket()}`;
  ok((await upgrade('/v1/room?village=hub', { 'Sec-WebSocket-Protocol': P })).status === 101, 'a good ticket opens the room (101)');
  ok((await upgrade('/v1/room?village=hub', { 'Sec-WebSocket-Protocol': P })).proto === 'rebel-universe.v1', 'the room answers with our protocol');
  ok((await upgrade('/v1/room?village=hub', { 'Sec-WebSocket-Protocol': `rebel-universe.v1, t.${ticket({}, OTHER)}` })).status === 401, 'a ticket signed with another key: 401');
  ok((await upgrade('/v1/room?village=hub', { 'Sec-WebSocket-Protocol': `rebel-universe.v1, t.${ticket({ exp: Math.floor(Date.now() / 1000) - 5 })}` })).status === 401, 'an expired ticket: 401');
  ok((await upgrade('/v1/room?village=hub', { 'Sec-WebSocket-Protocol': `rebel-universe.v1, t.${ticket({ exp: Math.floor(Date.now() / 1000) + 3600 })}` })).status === 401, 'a ticket that lives too long: 401');
  ok((await upgrade('/v1/room?village=hub', { 'Sec-WebSocket-Protocol': `rebel-universe.v1, t.${ticket({ site: 'prod' })}` })).status === 401, "a production ticket on the dev rooms: 401");
  ok((await upgrade('/v1/room?village=hub', { 'Sec-WebSocket-Protocol': `rebel-universe.v1, t.${ticket({ sub: 'admin' })}` })).status === 401, 'a ticket with an odd account id: 401');
  { const tk = ticket(); const [b, s] = tk.split('.'); const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(b, 'base64url')), n: 'Miguel' })).toString('base64url');
    ok((await upgrade('/v1/room?village=hub', { 'Sec-WebSocket-Protocol': `rebel-universe.v1, t.${forged}.${s}` })).status === 401, 'a ticket with its name changed: 401'); }
  ok((await upgrade('/v1/room?village=hub', { 'Sec-WebSocket-Protocol': 'rebel-universe.v1' })).status === 401, 'no ticket: 401');
  ok((await upgrade('/v1/room?village=hub', { 'Sec-WebSocket-Protocol': `t.${ticket()}` })).status === 400, 'no protocol: 400');
  ok((await upgrade('/v1/room?village=atlantis', { 'Sec-WebSocket-Protocol': P })).status === 400, 'a village that does not exist: 400');
  ok((await upgrade('/v1/room?village=hub', { 'Sec-WebSocket-Protocol': P, Origin: 'https://evil.example' })).status === 403, 'another site: 403');
  ok((await upgrade('/v1/room?village=hub', { 'Sec-WebSocket-Protocol': P, Origin: 'https://rebel-ants-village-git-dev-miguel-concepcions-projects.vercel.app' })).status === 101, 'the dev preview: 101');
  ok((await upgrade('/v1/room?village=hub', { 'Sec-WebSocket-Protocol': P, Origin: 'https://rebel-ants-village-abc123-miguel-concepcions-projects.vercel.app' })).status === 101, 'a branch preview: 101');
  ok((await upgrade('/v1/room?village=hub', { 'Sec-WebSocket-Protocol': P, Origin: 'https://rebeluniverse.io' })).status === 403, 'production on the dev rooms: 403');
  ok((await fetch(`http://127.0.0.1:${PORT}/v1/room?village=hub`)).status === 426, 'a plain request: 426');
  await sleep(1500);

  console.log('joining');
  const A = await bot(ticket({ n: 'Alice', look: { t: 'rig', url: 'https://example/a.glb' } }), { village: 'samurai' });
  const hiA = await A.next(m => m.t === 'hi');
  ok(hiA.you > 0 && hiA.room.village === 'samurai' && hiA.room.copy === 1 && hiA.peers.length === 0, 'the first one in: hello, copy 1, nobody else');
  const B = await bot(ticket({ n: 'Bob' }), { village: 'samurai' });
  const hiB = await B.next(m => m.t === 'hi');
  ok(hiB.peers.length === 1 && hiB.peers[0].n === 'Alice' && hiB.peers[0].look.url === 'https://example/a.glb', "the second one in sees the first, with her name and look");
  const jA = await A.next(m => m.t === 'j'); ok(jA.n === 'Bob' && jA.id === hiB.you, 'the first one hears the second come in');

  console.log('states');
  B.send({ t: 's', p: [0, 0, 5], r: 0, a: 'idle', i: null });
  await A.next(m => m.t === 'u' && m.id === hiB.you);
  A.send({ t: 's', p: [1.23456, 2, 3.333333], r: 1.0004, a: 'walk', i: null });
  const u1 = await B.next(m => m.t === 'u'); ok(u1.id === hiA.you && u1.s[0] === 1.23 && u1.s[2] === 3.33 && u1.s[3] === 1 && u1.s[4] === 'walk' && u1.s[5] === null, 'a near state arrives, rounded');
  for (let k = 0; k < 3; k++) A.send({ t: 's', p: [2 + k, 0, 3], r: 0, a: 'run', i: null });
  await sleep(500); ok(B.count(m => m.t === 'u') >= 3, 'near: every state goes through');
  B.msgs.length = 0;
  B.send({ t: 's', p: [300, 0, 300], r: 0, a: 'idle', i: null }); await sleep(2100); A.msgs.length = 0;
  for (let k = 0; k < 4; k++) { A.send({ t: 's', p: [5 + k, 0, 3], r: 0, a: 'run', i: null }); await sleep(60); }
  await sleep(500); ok(B.count(m => m.t === 'u') === 1, 'far (300 m): one state in two seconds, not four');
  A.send({ t: 's', p: [9, 0, 3], r: 0, a: 'idle', i: null, f: 1 });
  await sleep(400); ok(B.count(m => m.t === 'u') === 2 && B.msgs.filter(m => m.t === 'u').pop().s[0] === 9, 'far: the final (stopped) state always goes through');
  B.msgs.length = 0;
  B.send({ t: 's', p: [5, 0, 3], r: 0, a: 'idle', i: 'samurai_great_dojo' }); await sleep(2100); A.msgs.length = 0;
  for (let k = 0; k < 3; k++) { A.send({ t: 's', p: [5 + k * .1, 0, 3], r: 0, a: 'walk', i: null }); await sleep(60); }
  await sleep(400); ok(B.count(m => m.t === 'u') === 1, 'a player inside a room hears the village only now and then');
  B.send({ t: 's', p: [5, 0, 3], r: 0, a: 'idle', i: null });
  B.msgs.length = 0;
  A.send({ t: 's', p: [NaN, 0, 0], r: 0 }); A.send({ t: 's', p: [1e9, 0, 0], r: 0 }); A.send({ t: 's', p: [1, 2], r: 0 }); A.send('{"t":"s","p":"x"}'); A.send('not json'); A.send({ t: 's', p: [1, 1, 1], r: 0, a: 'x'.repeat(1100) });
  ok(await B.none(m => m.t === 'u'), 'bad states (NaN, too far, too short, too long, not json) are dropped');
  A.send({ t: 's', p: [4, 0, 4], r: 0, a: 'DROP TABLE', i: '../../x' });
  const u2 = await B.next(m => m.t === 'u'); ok(u2.s[4] === 'idle' && u2.s[5] === null, 'an odd animation or room name falls back to idle / the village');

  console.log('emotes');
  A.send({ t: 'e', e: 'cheer' }); const e1 = await B.next(m => m.t === 'e'); ok(e1.e === 'cheer' && e1.id === hiA.you, 'an emote arrives');
  A.send({ t: 'e', e: 'dance_wave' }); ok(await B.none(m => m.t === 'e', 500), 'a second emote within 1.2 s is dropped');
  await sleep(900); A.send({ t: 'e', e: 'flip_table' }); ok(await B.none(m => m.t === 'e', 500), 'an emote that does not exist is dropped');
  A.send({ t: 'e', e: 'dance_house' }); ok((await B.next(m => m.t === 'e')).e === 'dance_house', 'after the pause the next emote goes through');

  console.log('ping');
  A.send('{"t":"ping"}'); ok((await A.next(m => m.t === 'pong')).t === 'pong', 'ping is answered (auto response)');

  console.log('limits');
  const C = await bot(ticket({ n: 'Chatty' }), { village: 'samurai' }); await C.next(m => m.t === 'hi'); await A.next(m => m.t === 'j'); await B.next(m => m.t === 'j');
  B.msgs.length = 0;
  for (let k = 0; k < 40; k++) C.send({ t: 's', p: [k * .01, 0, 3], r: 0, a: 'walk', i: null });
  await sleep(700); const got = B.count(m => m.t === 'u'); ok(got <= 24 && got >= 20, `a burst of 40 states: ${got} go through (24 a 2 s window)`);
  for (let k = 0; k < 120; k++) C.send({ t: 's', p: [0, 0, 3], r: 0, a: 'walk', i: null });
  await sleep(800); ok(C.closed === 4008, 'a flood closes the socket (4008)');
  ok((await B.next(m => m.t === 'l')).id !== undefined, 'the others hear the flooder leave');

  console.log('one socket per account');
  const sub = 'u:same' + crypto.randomBytes(3).toString('hex');
  const D1 = await bot(ticket({ sub, n: 'Dee' }), { village: 'kenshi' }); const h1 = await D1.next(m => m.t === 'hi');
  const D2 = await bot(ticket({ sub, n: 'Dee' }), { village: 'kenshi' }); const h2 = await D2.next(m => m.t === 'hi');
  await sleep(500); ok(D1.msgs.some(m => m.t === 'dup') || D1.closed === 4001, 'the older tab is told (dup) and closed');
  ok(h2.peers.every(p => p.id !== h1.you), 'the new tab does not see the old one as a peer');

  console.log('copies');
  const F = []; for (let k = 0; k < 4; k++) { const f = await bot(ticket({ n: 'Fill ' + k }), { village: 'ronin' }); F.push([f, await f.next(m => m.t === 'hi')]); }
  ok(F.every(([, h]) => h.room.copy === 1), 'the first four go into copy 1 (ROOM_MAX 4)');
  const G = await bot(ticket({ n: 'Fifth' }), { village: 'ronin' }); const hG = await G.next(m => m.t === 'hi');
  ok(hG.room.copy === 2 && hG.peers.length === 0, 'the fifth goes into copy 2');
  ok((await upgrade('/v1/room?village=ronin&copy=1', { 'Sec-WebSocket-Protocol': `rebel-universe.v1, t.${ticket()}` })).status === 409, 'asking for a full copy: 409');
  const G2 = await bot(ticket({ n: 'Friend' }), { village: 'ronin', copy: 2 }); const hG2 = await G2.next(m => m.t === 'hi');
  ok(hG2.room.copy === 2 && hG2.peers.some(p => p.n === 'Fifth'), 'asking for copy 2 joins the friend there');
  F[0][0].close(); await sleep(600);
  const H = await bot(ticket({ n: 'Late' }), { village: 'ronin' }); ok((await H.next(m => m.t === 'hi')).room.copy === 1, 'a place frees in copy 1: the next one goes there');

  console.log('leaving');
  B.close(); ok((await A.next(m => m.t === 'l' && m.id === hiB.you)).id === hiB.you, 'closing a tab: the others hear it leave');
  for (const x of [A, D2, G, G2, H, ...F.map(f => f[0])]) x.close();
} catch (e) { fail++; console.log('  FAIL (exception)', e.message); }
console.log(`\n${pass} passed, ${fail} failed`);
if (fail && process.env.LOGS) console.log('--- dev server output ---\n' + out.slice(-4000));
await sleep(300);
process.exit(fail ? 1 : 0);
