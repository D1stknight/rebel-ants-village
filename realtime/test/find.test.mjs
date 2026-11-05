// node test/find.test.mjs   (env PORT, KEEP=1 leaves the dev server running)
// Nov 5 (Miguel: the Limits page, Find a friend, a message to everyone): starts the room server locally (wrangler dev
// --env dev, test signing keys, its own storage, ROOM_MAX 2 so copies fill fast, the copies and roster caches short) and
// checks: copies per village from the control desk (1 copy: the third player is turned away; 2: the third opens copy 2;
// a copy asked for past the limit still opens), finding players by name in every village (signed-in only, the village not
// the copy, hidden players left out, short / guest / slow), far invites through the control desk (to the copy they are
// in, from someone in another village; hidden, offline, guests, the per-player limit), the admins' message to everyone
// (every copy now, newcomers in their hello, stopped, too long / empty refused, cfg-get shows it).
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = +process.env.PORT || 8797, ROOT = fileURLToPath(new URL('..', import.meta.url));
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const PUB = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64url');
const ADMIN = crypto.generateKeyPairSync('ed25519');
const ADMIN_PUB = ADMIN.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64url');
const STATE = fs.mkdtempSync(path.join(os.tmpdir(), 'find-test-'));
const ticket = (o = {}) => {
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ v: 1, site: 'dev', sub: 'u:' + crypto.randomBytes(6).toString('hex'), n: 'Bot', k: 'discord', av: '', village: 'hub', look: { t: 'rig', col: 'battle_for_colony', tok: '262' }, iat: now, exp: now + 120, ...o })).toString('base64url');
  return body + '.' + crypto.sign(null, Buffer.from(body), privateKey).toString('base64url');
};
const uidOf = sub => crypto.createHash('sha256').update('rebel-universe:uid:v1:' + sub).digest('base64url').slice(0, 16);
let pass = 0, fail = 0;
const ok = (c, what, x) => { if (c) { pass++; console.log('  ok  ', what); } else { fail++; console.log('  FAIL', what, x !== undefined ? JSON.stringify(x).slice(0, 600) : ''); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const upgrade = (p, headers = {}) => new Promise(res => {
  const req = http.request({ host: '127.0.0.1', port: PORT, path: p, headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'), ...headers } });
  req.on('upgrade', (r, sock) => { sock.destroy(); res({ status: 101 }); });
  req.on('response', r => { let b = ''; r.on('data', d => (b += d)); r.on('end', () => res({ status: r.statusCode, body: b })); });
  req.on('error', e => res({ status: 0, error: e.message }));
  req.end();
});
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
    b.none = async (pred, ms = 700) => { await sleep(ms); return !b.msgs.some(pred); };
    b.close = () => { try { ws.close(); } catch (e) {} };
  });
}
// a player in a village: an account (sub), its room socket and hello
async function player(n, village = 'hub', o = {}, q = '') {
  const sub = o.sub || 'u:' + crypto.randomBytes(6).toString('hex');
  const P = { n, sub, u: uidOf(sub), village };
  P.room = await sock(`/v1/room?village=${village}${q}`, ticket({ sub, n, village, ...o })); P.hi = await P.room.next(m => m.t === 'hi');
  P.group = async id => { P.g = await sock('/v1/group?id=' + id, ticket({ sub, n, ...o })); return P.g; };
  return P;
}
const command = (cmd, args = {}) => {
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ v: 1, typ: 'mp-admin', site: 'dev', cmd, args, iat: now, exp: now + 60, nonce: crypto.randomBytes(12).toString('base64url') })).toString('base64url');
  return body + '.' + crypto.sign(null, Buffer.from(body), ADMIN.privateKey).toString('base64url');
};
const admin = async (cmd, args) => (await fetch(`http://127.0.0.1:${PORT}/v1/admin`, { method: 'POST', body: command(cmd, args) })).json();
const closing = async (b, ms = 3000) => { const t0 = Date.now(); while (b.closed == null && b.ws.readyState < 2 && Date.now() - t0 < ms) await sleep(50); return b.closed != null || b.ws.readyState >= 2; };

const dev = spawn(ROOT + 'node_modules/.bin/wrangler', ['dev', '--env', 'dev', '--port', String(PORT), '--ip', '127.0.0.1', '--var', `TICKET_KEYS:${JSON.stringify({ dev: [PUB] })}`, '--var', `ADMIN_KEYS:${JSON.stringify({ dev: [ADMIN_PUB] })}`, '--var', 'ALLOW_NO_ORIGIN:1',
  '--var', 'ROOM_MAX:2', '--var', 'COPIES_CACHE_S:1', '--var', 'ROSTER_S:0', '--persist-to', STATE, '--show-interactive-dev-session=false', '--log-level', 'warn'],
{ cwd: ROOT, env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
const stop = () => { try { process.kill(-dev.pid, 'SIGTERM'); } catch (e) {} };
process.on('exit', () => { if (!process.env.KEEP) { stop(); try { fs.rmSync(STATE, { recursive: true, force: true }); } catch (e) {} } });
let out = ''; dev.stdout.on('data', d => (out += d)); dev.stderr.on('data', d => (out += d));
try { await fetch(`http://127.0.0.1:${PORT}/v1/health`); console.log(`port ${PORT} is already in use`); process.exit(1); } catch (e) {}
const t0 = Date.now(); let up = false;
while (Date.now() - t0 < 90000 && !up) { await sleep(500); try { up = (await fetch(`http://127.0.0.1:${PORT}/v1/health`)).ok; } catch (e) {} }
if (!up) { console.log('dev server did not start\n' + out.slice(-3000)); stop(); process.exit(1); }
const closeAll = async (...ps) => { for (const p of ps) { p?.room?.close(); p?.g?.close(); } await sleep(400); };
try {
  console.log('copies per village (the Limits page)');
  const c0 = await admin('cfg-get');
  ok(c0.ok && c0.cfg.copies === 24 && c0.say === null, 'the settings start with 24 copies a village and no message', c0);
  ok((await admin('cfg-set', { copies: 1 })).cfg.copies === 1, 'set to 1 copy a village');
  ok((await admin('cfg-set', { copies: 0 })).cfg.copies === 24 && (await admin('cfg-set', { copies: 500 })).cfg.copies === 99 && (await admin('cfg-set', { copies: 'x' })).cfg.copies === 24, 'out of range: 0 / junk = the default 24, 500 = 99 at most');
  await admin('cfg-set', { copies: 1 }); await sleep(1300); // (the worker reads it again after COPIES_CACHE_S)
  const k1 = await player('Kai', 'kenshi'), k2 = await player('Kim', 'kenshi');
  ok(k1.hi.room.copy === 1 && k2.hi.room.copy === 1 && k1.hi.room.max === 2, 'two players fill kenshi copy 1 (2 a copy here)', [k1.hi.room, k2.hi.room]);
  const third = await upgrade('/v1/room?village=kenshi', { 'Sec-WebSocket-Protocol': `rebel-universe.v1, t.${ticket({ village: 'kenshi' })}` });
  ok(third.status === 409 && /full/.test(third.body || ''), 'with 1 copy a village the third player is turned away (409 full)', third);
  ok(k1.hi.can?.find === 1 && k1.hi.can?.far === 1 && k1.hi.can?.say === 1, 'the hello says what the rooms can do (find, far invites, the message)', k1.hi.can);
  await admin('cfg-set', { copies: 2 }); await sleep(1300);
  const k3 = await player('Kip', 'kenshi');
  ok(k3.hi.room.copy === 2, 'with 2 copies the third player opens kenshi copy 2', k3.hi.room);
  await admin('cfg-set', { copies: 1 }); await sleep(1300);
  const k4 = await player('Kat', 'kenshi', {}, '&copy=2');
  ok(k4.hi.room.copy === 2, 'a copy asked for (Go to them) still opens past today\'s limit', k4.hi.room);
  const k5 = await upgrade('/v1/room?village=kenshi&copy=100', { 'Sec-WebSocket-Protocol': `rebel-universe.v1, t.${ticket({ village: 'kenshi' })}` });
  ok(k5.status === 400, 'copy 100 does not exist (99 at most)', k5);
  await closeAll(k1, k2, k3, k4);
  await admin('cfg-set', { copies: 24 }); await sleep(1300);

  console.log('find a player by name');
  const A = await player('Ana Star', 'hub'), B = await player('Bobby Tables', 'samurai'), B2 = await player('Bobcat', 'samurai'), H = await player('Bob Hidden', 'ronin');
  const G = await player('Guest Bob', 'hub', { k: 'guest', sub: 'g:guest' + crypto.randomBytes(4).toString('hex') });
  H.room.send({ t: 'pv', f: 0 }); await sleep(300);
  A.room.send({ t: 'find', q: 'bob' });
  const f1 = await A.room.next(m => m.t === 'found');
  const names = (f1.list || []).map(x => x.n);
  ok(names.includes('Bobby Tables') && names.includes('Bobcat'), 'Ana finds Bobby Tables and Bobcat in another village', f1);
  ok(!names.includes('Bob Hidden'), 'a player who hides from the search is left out', names);
  ok(!names.includes('Guest Bob'), 'guests are never found', names);
  const bob = f1.list.find(x => x.n === 'Bobby Tables');
  ok(bob && bob.v === 'samurai' && bob.u === B.u && bob.k === 'discord' && bob.look?.tok === '262' && bob.copy === undefined && bob.s === undefined && bob.sub === undefined, 'a result: the village, the player\'s code, kind and look; never the copy, the spot or the account', bob);
  await sleep(2100); A.room.send({ t: 'find', q: 'BOBBY tables' });
  const f2 = await A.room.next(m => m.t === 'found'); ok(f2.list.length === 1 && f2.list[0].n === 'Bobby Tables', 'any case, the whole name: one result', f2.list);
  A.room.send({ t: 'find', q: 'bob' });
  ok((await A.room.next(m => m.t === 'found')).why === 'slow', 'one search every 2 s');
  await sleep(2100); A.room.send({ t: 'find', q: 'b' });
  ok((await A.room.next(m => m.t === 'found')).why === 'short', 'a one-letter search: too short');
  G.room.send({ t: 'find', q: 'ana' });
  ok((await G.room.next(m => m.t === 'found')).why === 'guest', 'guests cannot search');
  await sleep(2100); B.room.send({ t: 'find', q: 'bobby' });
  const f3 = await B.room.next(m => m.t === 'found'); ok(!f3.list.some(x => x.u === B.u), 'a search never finds the one searching', f3.list);
  H.room.send({ t: 'pv', f: 1 }); await sleep(2100); A.room.send({ t: 'find', q: 'hidden' });
  ok((await A.room.next(m => m.t === 'found')).list.some(x => x.n === 'Bob Hidden'), 'found again once they let others find them');
  H.room.send({ t: 'pv', f: 0 }); await sleep(300);

  console.log('an invite from anywhere');
  const ga = await A.group('new'); const gid = (await ga.next(m => m.t === 'ghi')).g;
  ga.send({ t: 'gi', u: B.u, n: 'Bobby Tables' }); ok((await ga.next(m => m.t === 'gi')).ok, 'Ana\'s group notes the invite for Bobby');
  A.room.send({ t: 'gx', u: B.u, g: gid });
  const inv = await B.room.next(m => m.t === 'gi');
  ok(inv.g === gid && inv.far === 1 && inv.from.n === 'Ana Star' && inv.from.u === A.u, 'Bobby, in Samurai, gets Ana\'s invite card through the control desk', inv);
  ok((await A.room.next(m => m.t === 'gxr')).ok === true, 'Ana is told it reached them');
  const gb = await B.group(gid); const hb = await gb.next(m => m.t === 'ghi');
  ok(hb.g === gid && hb.members.length === 2, 'Bobby joins the group from another village', hb.members);
  await sleep(3100); A.room.send({ t: 'gx', u: H.u, g: gid });
  ok((await A.room.next(m => m.t === 'gxr')).why === 'hidden', 'a hidden player gets no far invites');
  ok(await H.room.none(m => m.t === 'gi', 500), '(and no card)');
  await sleep(3100); A.room.send({ t: 'gx', u: uidOf('u:nobody-here'), g: gid });
  ok((await A.room.next(m => m.t === 'gxr')).why === 'offline', 'someone not playing: offline');
  A.room.send({ t: 'gx', u: B2.u, g: gid });
  ok((await A.room.next(m => m.t === 'gxr')).why === 'slow', 'one far invite every 3 s');
  G.room.send({ t: 'gx', u: A.u, g: gid });
  ok((await G.room.next(m => m.t === 'gxr')).why === 'who', 'guests cannot invite');
  await sleep(3100); A.room.send({ t: 'gx', u: G.u, g: gid });
  ok((await A.room.next(m => m.t === 'gxr')).why === 'offline', 'guests cannot be invited (offline)');

  console.log('a message to everyone');
  const s1 = await admin('say', { x: 'Town hall in the Hub courtyard in 10 minutes!', mins: 10 });
  ok(s1.ok && s1.say?.x === 'Town hall in the Hub courtyard in 10 minutes!' && s1.reached >= 5 && s1.rooms >= 3, 'the admins send a message: it reaches every room copy open', { reached: s1.reached, rooms: s1.rooms });
  const got = await Promise.all([A, B, B2, H, G].map(p => p.room.next(m => m.t === 'say')));
  ok(got.every(m => m.say?.id === s1.say.id && m.say.x === s1.say.x), 'every player in Hub, Samurai and Ronin gets it, guests too');
  const N = await player('Newcomer', 'shogun');
  ok(N.hi.say?.id === s1.say.id, 'a newcomer gets it in the hello', N.hi.say);
  ok((await admin('cfg-get')).say?.id === s1.say.id, 'cfg-get shows the message on now');
  ok((await admin('say', { x: 'x'.repeat(281), mins: 10 })).ok === false, 'over 280 characters: refused');
  ok((await admin('say', { x: '   ', mins: 10 })).ok === false, 'nothing written: refused');
  const s0 = await admin('say', { mins: 0 });
  ok(s0.ok && s0.say === null, 'stopped (newcomers no longer get it)');
  ok((await A.room.next(m => m.t === 'say')).say === null, 'the copies are told it stopped');
  const N2 = await player('Newcomer Two', 'shogun');
  ok(N2.hi.say === undefined, 'a newcomer after that gets no message', N2.hi.say);
  ok((await admin('cfg-get')).say === null, 'cfg-get: no message on');
  await closeAll(A, B, B2, H, G, N, N2);
} catch (e) { fail++; console.log('  FAIL (threw)', e.stack || e); }
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) console.log(out.slice(-3000));
if (!process.env.KEEP) stop();
process.exit(fail ? 1 : 0);
