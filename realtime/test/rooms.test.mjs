// node test/rooms.test.mjs   (env PORT, KEEP=1 leaves the dev server running)
// Starts the room server locally (wrangler dev --env dev, test signing keys, ROOM_MAX 4, its own empty storage) and
// checks it with bots: tickets (key, site, expiry), origin, protocol, joining and leaving, the hello and the peers, state
// relay near / far / final, emotes and their pace, the message limit, one socket per account, full copies, the ping auto
// response; the chat (channels, who may write, the limits, the filter, history, reports) and the Admin Hub's signed
// commands (online now, the log, mute / kick / ban, delete / clear, the settings).
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = +process.env.PORT || 8799, ROOT = fileURLToPath(new URL('..', import.meta.url));
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const PUB = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64url');
const OTHER = crypto.generateKeyPairSync('ed25519').privateKey;
const ADMIN = crypto.generateKeyPairSync('ed25519');
const ADMIN_PUB = ADMIN.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64url');
const STATE = fs.mkdtempSync(path.join(os.tmpdir(), 'rooms-test-'));
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

// an Admin Hub command as Universe signs it (api/mp-admin.mjs)
const command = (cmd, args = {}, o = {}, key = ADMIN.privateKey) => {
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ v: 1, typ: 'mp-admin', site: 'dev', cmd, args, iat: now, exp: now + 60, nonce: crypto.randomBytes(12).toString('base64url'), ...o })).toString('base64url');
  return body + '.' + crypto.sign(null, Buffer.from(body), key).toString('base64url');
};
const admin = async (cmd, args, o, key) => { const r = await fetch(`http://127.0.0.1:${PORT}/v1/admin`, { method: 'POST', body: command(cmd, args, o, key) }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
// the room's close: the socket closing (local wrangler dev leaves a close the room starts outside a socket event half
// done, so the page itself also closes on a kick / dup message: see village-multiplayer.js)
const closing = async (b, ms = 3000) => { const t0 = Date.now(); while (b.closed == null && b.ws.readyState < 2 && Date.now() - t0 < ms) await sleep(50); return b.closed != null || b.ws.readyState >= 2; };

const dev = spawn(ROOT + 'node_modules/.bin/wrangler', ['dev', '--env', 'dev', '--port', String(PORT), '--ip', '127.0.0.1', '--var', `TICKET_KEYS:${JSON.stringify({ dev: [PUB] })}`, '--var', `ADMIN_KEYS:${JSON.stringify({ dev: [ADMIN_PUB] })}`, '--var', 'ALLOW_NO_ORIGIN:1', '--var', 'ROOM_MAX:4', '--persist-to', STATE, '--show-interactive-dev-session=false', '--log-level', 'warn'],
  { cwd: ROOT, env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
const stop = () => { try { process.kill(-dev.pid, 'SIGTERM'); } catch (e) {} }; // the whole group (wrangler, workerd)
process.on('exit', () => { if (!process.env.KEEP) { stop(); try { fs.rmSync(STATE, { recursive: true, force: true }); } catch (e) {} } });
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


  console.log('chat: who may write');
  await admin('cfg-set', { chat: true, slow: 2, links: false, filter: true, words: [] });
  const csub = t => 'u:chat' + t + crypto.randomBytes(3).toString('hex');
  const CA = await bot(ticket({ sub: csub('a'), n: 'Ann' }), { village: 'sohei' }); const hCA = await CA.next(m => m.t === 'hi');
  ok(hCA.u && /^[A-Za-z0-9_-]{16}$/.test(hCA.u) && hCA.cfg && hCA.cfg.chat === true && hCA.cfg.slow === 2 && Array.isArray(hCA.hist) && hCA.mute === 0, 'the hello has the account code, the chat settings, the history and no mute');
  const CB = await bot(ticket({ sub: csub('b'), n: 'Ben', k: 'name' }), { village: 'sohei' }); const hCB = await CB.next(m => m.t === 'hi');
  ok(hCB.peers[0]?.u === hCA.u, 'peers carry their account code (for Block)');
  const GU = await bot(ticket({ sub: 'g:guest' + crypto.randomBytes(4).toString('hex'), n: 'Guest', k: 'guest' }), { village: 'sohei' }); const hGU = await GU.next(m => m.t === 'hi');
  await CA.next(m => m.t === 'j' && m.id === hCB.you); await CA.next(m => m.t === 'j' && m.id === hGU.you); await CB.next(m => m.t === 'j' && m.id === hGU.you);
  GU.send({ t: 'c', ch: 'v', x: 'hello from a guest' });
  ok((await GU.next(m => m.t === 'cx')).why === 'guest' && await CA.none(m => m.t === 'c', 400), 'a guest cannot write (cx guest), nobody gets it');
  CA.send({ t: 'c', ch: 'v', x: 'hi everyone' });
  const v1 = await CB.next(m => m.t === 'c'), v1g = await GU.next(m => m.t === 'c'), v1a = await CA.next(m => m.t === 'c');
  ok(v1.m.x === 'hi everyone' && v1.m.ch === 'v' && v1.m.n === 'Ann' && v1.m.k === 'discord' && v1.m.u === hCA.u && v1.m.id === hCA.you && v1.m.i > 0, 'a village message reaches the copy, with the name, kind, code and an id');
  ok(v1g.m.i === v1.m.i && v1a.m.i === v1.m.i, 'the guest reads it, the sender gets it back');

  console.log('chat: the limits');
  CA.send({ t: 'c', ch: 'v', x: 'again so soon' }); const slow = await CA.next(m => m.t === 'cx');
  ok(slow.why === 'slow' && slow.wait > 0 && slow.wait <= 2000, `a second message within 2 s: slow (wait ${slow.wait} ms)`);
  await sleep(2100); CA.send({ t: 'c', ch: 'v', x: 'HI everyone' }); ok((await CA.next(m => m.t === 'cx')).why === 'same', 'the same words again within 30 s: same');
  CB.send({ t: 'c', ch: 'v', x: 'x'.repeat(281) }); const long = await CB.next(m => m.t === 'cx'); ok(long.why === 'long' && long.max === 280, '281 characters: long');
  await sleep(100); CB.send({ t: 'c', ch: 'v', x: ' ​‮ \n ' }); ok((await CB.next(m => m.t === 'cx')).why === 'empty', 'only invisible characters: empty');
  CB.send({ t: 'c', ch: 'v', x: '🐜'.repeat(280) }); ok([...(await CA.next(m => m.t === 'c')).m.x].length === 280, '280 emoji (two code units each) go through');
  await sleep(2100);

  console.log('chat: the filter');
  CA.send({ t: 'c', ch: 'v', x: 'what the fuck, f u c k, free mint at https://evil.example/claim and discord.gg/abc but rebelants.io/shop is ours' });
  const f1 = await CB.next(m => m.t === 'c' && m.m.id === hCA.you);
  ok(f1.m.x === 'what the f***, f***, free mint at [link] and [link] but rebelants.io/shop is ours', 'swearing starred, spaced letters too, links out, our own site kept: ' + f1.m.x);
  await sleep(2100);

  console.log('chat: nearby and whispers');
  CA.send({ t: 'c', ch: 'n', x: 'anyone near?' }); ok((await CA.next(m => m.t === 'cx')).why === 'nopos', 'nearby before walking in: nopos');
  CA.send({ t: 's', p: [0, 0, 0], r: 0, a: 'idle', i: null }); CB.send({ t: 's', p: [12, 0, 9], r: 0, a: 'idle', i: null }); GU.send({ t: 's', p: [90, 0, 0], r: 0, a: 'idle', i: null });
  await sleep(300); CA.msgs.length = 0; CB.msgs.length = 0; GU.msgs.length = 0;
  await sleep(1900);
  CA.send({ t: 'c', ch: 'n', x: 'anyone near?' });
  const n1 = await CB.next(m => m.t === 'c'); ok(n1.m.ch === 'n' && n1.m.x === 'anyone near?', 'nearby (15 m): it arrives');
  ok(await GU.none(m => m.t === 'c', 500), 'nearby: a player 90 m off does not get it');
  await sleep(2000);
  CB.send({ t: 's', p: [12, 0, 9], r: 0, a: 'idle', i: 'sohei_great_dojo' }); await sleep(200);
  CA.send({ t: 'c', ch: 'n', x: 'and now?' }); await CA.next(m => m.t === 'c' && m.m.x === 'and now?');
  ok(await CB.none(m => m.t === 'c', 500), 'nearby: a player inside a room does not get it');
  CB.send({ t: 's', p: [12, 0, 9], r: 0, a: 'idle', i: null });
  await sleep(2000);
  CA.send({ t: 'c', ch: 'w', to: hCB.you, x: 'psst, Ben' });
  const w1 = await CB.next(m => m.t === 'c' && m.m.ch === 'w'), w1a = await CA.next(m => m.t === 'c' && m.m.ch === 'w');
  ok(w1.m.ch === 'w' && w1.m.to === hCB.you && w1.m.tn === 'Ben' && w1a.m.i === w1.m.i, 'a whisper reaches the one player and comes back to the sender');
  ok(await GU.none(m => m.t === 'c', 500), 'a whisper: nobody else gets it');
  await sleep(2000);
  CA.send({ t: 'c', ch: 'w', to: 9999, x: 'hello?' }); ok((await CA.next(m => m.t === 'cx')).why === 'gone', 'a whisper to someone not here: gone');
  CA.send({ t: 'c', ch: 'w', to: hCA.you, x: 'me myself' }); ok((await CA.next(m => m.t === 'cx')).why === 'gone', 'a whisper to yourself: gone');

  console.log('chat: history and reports');
  const CD = await bot(ticket({ sub: csub('d'), n: 'Dot' }), { village: 'sohei' }); const hCD = await CD.next(m => m.t === 'hi');
  ok(hCD.hist.length === 3 && hCD.hist.every(m => m.ch === 'v') && hCD.hist[0].x === 'hi everyone' && hCD.hist.at(-1).x.startsWith('what the f***'), 'a newcomer gets the village messages (not nearby, not whispers), filtered, oldest first');
  CD.send({ t: 'rp', i: v1.m.i, why: 'spam', note: 'test report' }); ok((await CD.next(m => m.t === 'rpok' || m.t === 'cx')).t === 'rpok', 'reporting a message: taken');
  CD.send({ t: 'rp', id: hCB.you, why: 'abuse' }); ok((await CD.next(m => m.t === 'cx')).why === 'report-slow', 'a second report within 15 s: refused');
  CB.send({ t: 'rp', i: w1.m.i, why: 'abuse' }); ok((await CB.next(m => m.t === 'rpok' || m.t === 'cx')).t === 'rpok', 'the whisper it was sent to can report it');
  GU.send({ t: 'rp', i: w1.m.i, why: 'abuse' }); ok((await GU.next(m => m.t === 'cx')).why === 'report-none', "someone else cannot report another's whisper");
  CA.send({ t: 'rp', id: hCA.you, why: 'spam' }); ok((await CA.next(m => m.t === 'cx')).why === 'report-none', 'reporting yourself: refused');
  CD.close(); await sleep(300); // (room for the next ones: ROOM_MAX 4)

  console.log('admin: the signature');
  ok((await admin('online', {}, {}, OTHER)).status === 401, 'a command signed with another key: 401');
  ok((await admin('online', {}, { exp: Math.floor(Date.now() / 1000) - 1 })).status === 401, 'an expired command: 401');
  ok((await admin('online', {}, { exp: Math.floor(Date.now() / 1000) + 3600 })).status === 401, 'a command that lives too long: 401');
  ok((await admin('online', {}, { site: 'prod' })).status === 401, 'a production command on the dev rooms: 401');
  ok((await admin('online', {}, { typ: undefined })).status === 401, 'a ticket-shaped body (no typ): 401');
  { const tk = ticket(); ok((await fetch(`http://127.0.0.1:${PORT}/v1/admin`, { method: 'POST', body: tk })).status === 401, 'a player ticket as a command: 401'); }
  { const c = command('online'); const r1 = await (await fetch(`http://127.0.0.1:${PORT}/v1/admin`, { method: 'POST', body: c })).json(); const r2 = await (await fetch(`http://127.0.0.1:${PORT}/v1/admin`, { method: 'POST', body: c })).json();
    ok(r1.ok && r2.ok === false && /already used/.test(r2.error), 'the same signed command twice: the second refused'); }

  console.log('admin: online now, the log, the reports');
  const on = await admin('online');
  const so = on.rooms.find(r => r.room === 'dev:sohei:1');
  ok(on.ok && so && so.players.length === 3 && so.players.some(p => p.n === 'Ann' && p.sub.startsWith('u:chata') && p.s && p.s[0] === 0), `online now lists the copy and its players (${on.total} online in ${on.rooms.length} copies)`);
  const lg = await admin('log', { room: 'dev:sohei:1', limit: 50 });
  const fl = lg.rows.find(r => r.x.startsWith('what the f***'));
  ok(lg.ok && lg.rows.length >= 6 && fl && fl.raw.startsWith('what the fuck') && lg.rows.some(r => r.ch === 'w' && r.tn === 'Ben'), 'the log has every message, the words as typed beside a filtered one, the whispers');
  ok((await admin('log', { q: 'psst' })).rows.length === 1, 'the log can be searched by words');
  const rps = await admin('reports');
  const rp1 = rps.rows.find(r => r.why === 'spam' && r.msg && r.msg.i === v1.m.i);
  ok(rps.ok && rps.open >= 2 && rp1 && rp1.by.n === 'Dot' && rp1.target.n === 'Ann' && rp1.note === 'test report' && rp1.context.length >= 3, 'the reports: who, about whom, the message, the note, the chat around it');
  ok((await admin('report-state', { id: rp1.id, state: 'done' })).ok && !(await admin('reports')).rows.some(r => r.id === rp1.id), 'a report marked done leaves the open list');

  console.log('admin: mute');
  const annSub = so.players.find(p => p.n === 'Ann').sub;
  { const r = (await admin('log', { sub: annSub })).rows; ok(r.length >= 5 && r.every(x => x.sub === annSub || x.tsub === annSub), 'the log by account: what they wrote and whispered'); }
  const mu = await admin('mute', { sub: annSub, minutes: 5, why: 'test', n: 'Ann' });
  ok(mu.ok && mu.reached === 1 && mu.until > Date.now(), 'mute: done, reached the one socket');
  const cm = await CA.next(m => m.t === 'cm'); ok(cm.until === mu.until, 'the muted player is told until when');
  await sleep(2100); CA.send({ t: 'c', ch: 'v', x: 'can I talk' }); const cxm = await CA.next(m => m.t === 'cx'); ok(cxm.why === 'muted' && cxm.until === mu.until, 'a muted player cannot write');
  const CA2 = await bot(ticket({ sub: annSub, n: 'Ann' }), { village: 'sohei' }); const hCA2 = await CA2.next(m => m.t === 'hi');
  ok(hCA2.mute === mu.until, 'the mute stays after a reconnect (the hello says until when)');
  ok((await admin('mods')).rows.some(r => r.sub === annSub && r.mute === mu.until && r.n === 'Ann'), 'the mods list has the mute');
  await admin('unmute', { sub: annSub }); ok((await CA2.next(m => m.t === 'cm')).until === 0, 'unmute: the player is told');
  CA2.send({ t: 'c', ch: 'v', x: 'thanks admin' }); ok((await CA2.next(m => m.t === 'c' || m.t === 'cx')).t === 'c', 'unmuted: the player writes again');

  console.log('admin: delete, clear, settings');
  const del = await admin('del', { room: 'dev:sohei:1', i: v1.m.i }); ok(del.ok && (await CB.next(m => m.t === 'cd')).i === v1.m.i, 'delete: the players are told which message');
  const CE = await bot(ticket({ sub: csub('e'), n: 'Eve' }), { village: 'sohei' }); const hCE = await CE.next(m => m.t === 'hi');
  ok(!hCE.hist.some(m => m.i === v1.m.i) && hCE.hist.length >= 2, 'a deleted message is not in the history any more');
  ok((await admin('log', { q: 'hi everyone' })).rows.some(r => r.del === 1), 'the log keeps it, marked deleted');
  CE.close();
  await admin('clear', { room: 'dev:sohei:1' }); ok((await CB.next(m => m.t === 'cc')).t === 'cc', 'clear: the players are told');
  const CF = await bot(ticket({ sub: csub('f'), n: 'Fay' }), { village: 'sohei' }); ok((await CF.next(m => m.t === 'hi')).hist.length === 0, 'after a clear the history is empty'); CF.close();
  const off = await admin('cfg-set', { chat: false }); ok(off.ok && off.cfg.chat === false && (await CB.next(m => m.t === 'cfg')).chat === false, 'chat off everywhere: the players are told');
  await sleep(2100); CB.send({ t: 'c', ch: 'v', x: 'is it off?' }); ok((await CB.next(m => m.t === 'cx')).why === 'off', 'chat off: nobody can write');
  const on2 = await admin('cfg-set', { chat: true, slow: 5, words: ['gnarly badger'], links: true }); ok(on2.cfg.chat && on2.cfg.slow === 5 && (await CB.next(m => m.t === 'cfg')).slow === 5, 'chat back on with slow mode 5 s');
  CB.send({ t: 'c', ch: 'v', x: 'the Gnarly Badger is at https://example.com' }); const ow = await CA2.next(m => m.t === 'c');
  ok(ow.m.x === 'the G************ is at https://example.com', 'the admins\' own words starred, links allowed now: ' + ow.m.x);
  await sleep(3000); CB.send({ t: 'c', ch: 'v', x: 'too soon for slow mode' }); const sm = await CB.next(m => m.t === 'cx'); ok(sm.why === 'slow' && sm.wait > 1000, 'slow mode 5 s: 3 s later is too soon');
  const cg = await admin('cfg-get'); ok(cg.cfg.slow === 5 && cg.cfg.words[0] === 'gnarly badger', 'the settings read back');
  await admin('cfg-set', { chat: true, slow: 2, words: [], links: false });

  console.log('admin: kick and ban');
  const benSub = so.players.find(p => p.n === 'Ben').sub;
  const kk = await admin('kick', { sub: benSub }); const kmsg = await CB.next(m => m.t === 'kick');
  ok(kk.reached === 1 && kmsg.why === 'kick' && await closing(CB), 'kick: told, then closed');
  ok((await CA2.next(m => m.t === 'l' && m.id === hCB.you)).id === hCB.you, 'the others see the kicked player go');
  const CB2 = await bot(ticket({ sub: benSub, n: 'Ben', k: 'name' }), { village: 'sohei' }); ok((await CB2.next(m => m.t === 'hi')).you > 0, 'after a kick the player can come back');
  const bn = await admin('ban', { sub: benSub, hours: 1, why: 'test', n: 'Ben' }); const bmsg = await CB2.next(m => m.t === 'kick');
  ok(bn.ok && bmsg.why === 'banned' && bmsg.until === bn.until && await closing(CB2), 'ban: told until when, closed');
  const CB3 = await bot(ticket({ sub: benSub, n: 'Ben', k: 'name' }), { village: 'bushi' }); const bm3 = await CB3.next(m => m.t === 'kick' || m.t === 'hi');
  ok(bm3.t === 'kick' && bm3.why === 'banned' && await closing(CB3), 'a banned account is turned away in any village');
  await admin('unban', { sub: benSub }); const CB4 = await bot(ticket({ sub: benSub, n: 'Ben', k: 'name' }), { village: 'bushi' }); ok((await CB4.next(m => m.t === 'hi' || m.t === 'kick')).t === 'hi', 'unban: the account comes in again');
  ok(!(await admin('mods')).rows.some(r => r.sub === benSub), 'after unban / unmute nothing is left in the mods list');
  ok((await admin('mute', { sub: 'admin' })).ok === false && (await admin('nope')).ok === false, 'a bad account or an unknown command: refused');
  for (const x of [CA, CA2, CB, CB2, CB3, CB4, CD, GU]) x.close();

  console.log('leaving');
  B.close(); ok((await A.next(m => m.t === 'l' && m.id === hiB.you)).id === hiB.you, 'closing a tab: the others hear it leave');
  for (const x of [A, D2, G, G2, H, ...F.map(f => f[0])]) x.close();
} catch (e) { fail++; console.log('  FAIL (exception)', e.message); }
console.log(`\n${pass} passed, ${fail} failed`);
if (fail && process.env.LOGS) console.log('--- dev server output ---\n' + out.slice(-4000));
await sleep(300);
process.exit(fail ? 1 : 0);
