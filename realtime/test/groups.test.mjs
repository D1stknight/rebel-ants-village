// node test/groups.test.mjs   (env PORT, KEEP=1 leaves the dev server running)
// Starts the room server locally (wrangler dev --env dev, test signing keys, its own empty storage) and checks groups with
// bots: who may open one (signed-in players, not guests), making one, invites through the room (the invite message, then
// the group lets the invited one in; others are turned away), the hello (members, leader, history), where members are,
// group chat (the room chat's rules and filter, logged for the admins), going away and coming back (online / offline),
// one socket per account, the admins' mute / delete / settings / kick reaching groups, leaving, the leader passing on, the
// leader taking a member off, the size limit, a report, members away too long taken off, the daily limit on new groups.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = +process.env.PORT || 8796, ROOT = fileURLToPath(new URL('..', import.meta.url));
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const PUB = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64url');
const ADMIN = crypto.generateKeyPairSync('ed25519');
const ADMIN_PUB = ADMIN.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64url');
const STATE = fs.mkdtempSync(path.join(os.tmpdir(), 'groups-test-'));
const ticket = (o = {}) => {
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ v: 1, site: 'dev', sub: 'u:' + crypto.randomBytes(6).toString('hex'), n: 'Bot', k: 'discord', av: '', village: 'hub', look: { t: 'rig', col: 'battle_for_colony', tok: '262' }, iat: now, exp: now + 120, ...o })).toString('base64url');
  return body + '.' + crypto.sign(null, Buffer.from(body), privateKey).toString('base64url');
};
const uidOf = sub => crypto.createHash('sha256').update('rebel-universe:uid:v1:' + sub).digest('base64url').slice(0, 16);
let pass = 0, fail = 0;
const ok = (c, what, x) => { if (c) { pass++; console.log('  ok  ', what); } else { fail++; console.log('  FAIL', what, x !== undefined ? JSON.stringify(x).slice(0, 500) : ''); } };
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
    b.next = (pred, ms = 4000) => new Promise((yes, no) => {
      const i = b.msgs.findIndex(pred); if (i >= 0) return yes(b.msgs.splice(i, 1)[0]);
      const to = setTimeout(() => { b.waiters = b.waiters.filter(w => w !== f); no(new Error('timeout')); }, ms);
      const f = m => { if (!pred(m)) return false; clearTimeout(to); b.waiters = b.waiters.filter(w => w !== f); yes(m); return true; };
      b.waiters.push(f);
    });
    b.none = async (pred, ms = 700) => { await sleep(ms); return !b.msgs.some(pred); };
    b.close = () => { try { ws.close(); } catch (e) {} };
  });
}
// a player: an account (sub), a room socket and, once in a group, a group socket
async function player(n, o = {}) {
  const sub = 'u:' + crypto.randomBytes(6).toString('hex');
  const P = { n, sub, u: uidOf(sub), o };
  P.room = await sock('/v1/room?village=hub', ticket({ sub, n, ...o })); P.hi = await P.room.next(m => m.t === 'hi');
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

const dev = spawn(ROOT + 'node_modules/.bin/wrangler', ['dev', '--env', 'dev', '--port', String(PORT), '--ip', '127.0.0.1', '--var', `TICKET_KEYS:${JSON.stringify({ dev: [PUB] })}`, '--var', `ADMIN_KEYS:${JSON.stringify({ dev: [ADMIN_PUB] })}`, '--var', 'ALLOW_NO_ORIGIN:1', '--var', 'GROUP_AWAY_MS:6000', '--var', 'GROUPS_A_DAY:3', '--persist-to', STATE, '--show-interactive-dev-session=false', '--log-level', 'warn'],
  { cwd: ROOT, env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
const stop = () => { try { process.kill(-dev.pid, 'SIGTERM'); } catch (e) {} };
process.on('exit', () => { if (!process.env.KEEP) { stop(); try { fs.rmSync(STATE, { recursive: true, force: true }); } catch (e) {} } });
let out = ''; dev.stdout.on('data', d => (out += d)); dev.stderr.on('data', d => (out += d));
try { await fetch(`http://127.0.0.1:${PORT}/v1/health`); console.log(`port ${PORT} is already in use`); process.exit(1); } catch (e) {}
const t0 = Date.now(); let up = false;
while (Date.now() - t0 < 90000 && !up) { await sleep(500); try { up = (await fetch(`http://127.0.0.1:${PORT}/v1/health`)).ok; } catch (e) {} }
if (!up) { console.log('dev server did not start\n' + out.slice(-3000)); stop(); process.exit(1); }
try {
  console.log('the door');
  ok((await upgrade('/v1/group?id=new', { 'Sec-WebSocket-Protocol': `rebel-universe.v1, t.${ticket({ k: 'guest', sub: 'g:abcdef12' })}` })).status === 403, 'a guest cannot open a group (403)');
  ok((await upgrade('/v1/group?id=new', { 'Sec-WebSocket-Protocol': 'rebel-universe.v1' })).status === 401, 'no ticket: 401');
  ok((await upgrade('/v1/group?id=../x', { 'Sec-WebSocket-Protocol': `rebel-universe.v1, t.${ticket()}` })).status === 400, 'an odd group id: 400');
  ok((await upgrade('/v1/group?id=nosuchgroup1', { 'Sec-WebSocket-Protocol': `rebel-universe.v1, t.${ticket()}` })).status === 404, 'a group that does not exist: 404');
  ok((await upgrade('/v1/group?id=new', { 'Sec-WebSocket-Protocol': `rebel-universe.v1, t.${ticket()}`, Origin: 'https://evil.example' })).status === 403, 'another site: 403');

  console.log('making a group, inviting through the room');
  const A = await player('Ana'), Bo = await player('Bo'), C = await player('Cy'), G = await player('Guest', { k: 'guest', sub: 'g:guest' + crypto.randomBytes(4).toString('hex') });
  const ga = await A.group('new'); const hiA = await ga.next(m => m.t === 'ghi');
  ok(/^[A-Za-z0-9_-]{12}$/.test(hiA.g) && hiA.you === A.u && hiA.lead === A.u && hiA.members.length === 1 && hiA.members[0].n === 'Ana' && hiA.members[0].on && hiA.max === 8, 'Ana makes a group: its id, she leads, one member', hiA);
  const gid = hiA.g;
  ok((await upgrade('/v1/group?id=' + gid, { 'Sec-WebSocket-Protocol': `rebel-universe.v1, t.${ticket({ sub: Bo.sub, n: 'Bo' })}` })).status === 403, 'Bo, not invited, is turned away (403)');
  ga.send({ t: 'gi', u: Bo.u, n: 'Bo' });
  ok((await ga.next(m => m.t === 'gi')).ok === true, 'Ana invites Bo: noted');
  A.room.send({ t: 'gi', to: Bo.hi.you, g: gid });
  const inv = await Bo.room.next(m => m.t === 'gi');
  ok(inv.g === gid && inv.from.n === 'Ana' && inv.from.u === A.u && inv.from.id === A.hi.you, 'the room hands Bo the invite: from Ana, the group id', inv);
  ok(await C.room.none(m => m.t === 'gi'), 'nobody else in the room hears it');
  await sleep(2100); A.room.send({ t: 'gi', to: G.hi.you, g: gid });
  ok(await G.room.none(m => m.t === 'gi', 900), 'no invites to guests');
  G.room.send({ t: 'gi', to: A.hi.you, g: gid });
  ok(await A.room.none(m => m.t === 'gi', 900), 'no invites from guests');
  const gb = await Bo.group(gid); const hiB = await gb.next(m => m.t === 'ghi');
  ok(hiB.g === gid && hiB.members.length === 2 && hiB.members.some(m => m.n === 'Ana' && m.lead) && hiB.lead === A.u, 'Bo comes in: both members, Ana leads', hiB);
  const jB = await ga.next(m => m.t === 'gj'); ok(jB.m.n === 'Bo' && jB.m.u === Bo.u && jB.m.on, 'Ana hears Bo join');
  ok((await upgrade('/v1/group?id=' + gid, { 'Sec-WebSocket-Protocol': `rebel-universe.v1, t.${ticket({ sub: C.sub, n: 'Cy' })}` })).status === 403, 'an invite is for one player: Cy is still turned away');

  console.log('where members are');
  ga.send({ t: 'gp', v: 'ronin', c: 2, i: null, p: [12.345, -40.06] });
  const wp = await gb.next(m => m.t === 'gp'); ok(wp.u === A.u && wp.v === 'ronin' && wp.c === 2 && wp.i === null && wp.p[0] === 12.3 && wp.p[1] === -40.1, 'Ana\'s village, copy and spot reach Bo (rounded)', wp);
  ga.send({ t: 'gp', v: 'ronin', i: null, p: [13, -40] });
  ok(await gb.none(m => m.t === 'gp', 500), 'more than one a second: dropped');
  await sleep(1000); ga.send({ t: 'gp', v: 'atlantis', i: null, p: [1, 1] }); ga.send({ t: 'gp', v: 'hub', i: '../x', p: [NaN, 1] });
  ok(await gb.none(m => m.t === 'gp', 500), 'bad villages / spots: dropped');
  await sleep(1000); ga.send({ t: 'gp', v: 'samurai', i: 'samurai_great_dojo', p: [0, 55] });
  const wp2 = await gb.next(m => m.t === 'gp'); ok(wp2.v === 'samurai' && wp2.i === 'samurai_great_dojo', 'in a room: the room id too');

  console.log('group chat');
  ga.send({ t: 'gc', x: 'meet at the samurai dojo' });
  const c1 = await gb.next(m => m.t === 'gc'); ok(c1.m.x === 'meet at the samurai dojo' && c1.m.n === 'Ana' && c1.m.u === A.u, 'a message reaches the group');
  ok((await ga.next(m => m.t === 'gc')).m.i === c1.m.i, 'the sender gets it back');
  ok(await C.room.none(m => m.t === 'c'), 'the room does not hear group messages');
  ga.send({ t: 'gc', x: 'again' }); ok((await ga.next(m => m.t === 'gcx')).why === 'slow', 'one message every 2 s');
  await sleep(2100); gb.send({ t: 'gc', x: 'you are a fucking legend' });
  const c2 = await ga.next(m => m.t === 'gc'); ok(/f\*+/.test(c2.m.x) && !/fucking/.test(c2.m.x), 'the word filter stars swear words', c2.m.x);
  const lg = await admin('log', { q: 'samurai dojo' });
  ok(lg.rows?.some(r => /group:/.test(r.room) && r.x === 'meet at the samurai dojo' && r.ch === 'g'), 'the admins\' log has the group message', lg.rows?.[0]);

  console.log('the admins reach groups');
  const mu = await admin('mute', { sub: Bo.sub, n: 'Bo', minutes: 5 });
  ok(mu.ok && mu.reached >= 2, 'a mute reaches Bo\'s room and his group', mu);
  ok((await gb.next(m => m.t === 'gcm')).until > Date.now(), 'his group socket hears he is muted');
  await sleep(2100); gb.send({ t: 'gc', x: 'can i still talk' });
  ok((await gb.next(m => m.t === 'gcx')).why === 'muted', 'muted: his group messages are refused');
  await admin('unmute', { sub: Bo.sub }); await gb.next(m => m.t === 'gcm');
  const dl = await admin('del', { room: `dev:group:${gid}`, i: c2.m.i });
  ok(dl.ok && dl.reached === 1, 'an admin deletes a group message (by the group\'s room name)', dl);
  ok((await ga.next(m => m.t === 'gcd')).i === c2.m.i, 'the group hears it is gone');
  await admin('cfg-set', { chat: false });
  ok((await ga.next(m => m.t === 'gcfg')).chat === false, 'the chat switched off everywhere: groups too');
  await sleep(2100); ga.send({ t: 'gc', x: 'hello anyone' }); ok((await ga.next(m => m.t === 'gcx')).why === 'off', 'and group messages wait');
  await admin('cfg-set', { chat: true }); ok((await ga.next(m => m.t === 'gcfg')).chat === true, 'switched on again');
  const on = await admin('online'); ok(on.ok && on.rooms.every(r => r.village !== 'group'), 'online now lists room copies only (group members are in rooms)', on.rooms?.map(r => r.room));

  console.log('away and back, one socket per account');
  gb.close(); await sleep(500);
  const off = await ga.next(m => m.t === 'gon'); ok(off.u === Bo.u && off.on === false, 'Bo\'s page goes (a new village): offline, still a member');
  const gb2 = await Bo.group(gid); const hiB2 = await gb2.next(m => m.t === 'ghi');
  ok(hiB2.members.length === 2 && hiB2.hist.some(m => /samurai dojo/.test(m.x)), 'Bo back: still a member, the history with him');
  ok((await ga.next(m => m.t === 'gon')).on === true, 'online again');
  const gb3 = await Bo.group(gid); await gb3.next(m => m.t === 'ghi');
  ok(await closing(gb2), 'the same account again (another tab): the older group socket closes');

  console.log('the leader, leaving, the size limit');
  ga.send({ t: 'gi', u: C.u, n: 'Cy' }); await ga.next(m => m.t === 'gi');
  const gc = await C.group(gid); await gc.next(m => m.t === 'ghi');
  gb3.send({ t: 'gk', u: C.u });
  ok(await gc.none(m => m.t === 'gx', 600), 'only the leader takes members off');
  ga.send({ t: 'gk', u: C.u });
  ok((await gb3.next(m => m.t === 'gx')).u === C.u && await closing(gc), 'Ana takes Cy off: the others hear it, his socket closes');
  ok((await upgrade('/v1/group?id=' + gid, { 'Sec-WebSocket-Protocol': `rebel-universe.v1, t.${ticket({ sub: C.sub, n: 'Cy' })}` })).status === 403, 'taken off: he cannot come back without a new invite');
  ga.send({ t: 'gl' });
  const lead = await gb3.next(m => m.t === 'glead'); ok(lead.u === Bo.u, 'Ana leaves: Bo leads now');
  // fill it up to 8 (Bo + 7), the ninth is refused
  const more = [];
  for (let k = 0; k < 7; k++) { const Q = await player('P' + k); await sleep(2050); gb3.send({ t: 'gi', u: Q.u, n: Q.n }); await gb3.next(m => m.t === 'gi'); const g = await Q.group(gid); await g.next(m => m.t === 'ghi'); more.push(Q); }
  const Z = await player('Zed'); await sleep(2050); gb3.send({ t: 'gi', u: Z.u, n: 'Zed' });
  ok((await gb3.next(m => m.t === 'gi')).why === 'full', 'eight members: no more invites');

  console.log('a report');
  await sleep(2100); more[0].g.send({ t: 'gc', x: 'buy cheap gems at scam dot com' });
  const sc = await gb3.next(m => m.t === 'gc');
  gb3.send({ t: 'rp', i: sc.m.i, why: 'scam' });
  ok((await gb3.next(m => m.t === 'rpok')) && true, 'a group message reported');
  const rps = await admin('reports');
  ok(rps.rows?.some(r => r.why === 'scam' && r.target?.n === 'P0' && /group:/.test(r.room)), 'the admins have the report', rps.rows?.[0]);

  console.log('an admin kick, a member away too long');
  const kk = await admin('kick', { sub: more[1].sub });
  ok(kk.ok && kk.reached >= 2, 'an admin kick reaches the room and the group', kk);
  ok((await more[1].g.next(m => m.t === 'kick')).why === 'kick' && await closing(more[1].g), 'kicked: told, the group socket closes');
  const g1 = await more[1].group(gid); ok((await g1.next(m => m.t === 'ghi')).g === gid, 'a kick is not a ban: he comes back next visit, still a member');
  more[2].g.close();
  const aw = await gb3.next(m => m.t === 'gx' && m.u === more[2].u, 20000);
  ok(aw.why === 'away', 'a member gone for longer than the away time is taken off (the alarm)', aw);

  console.log('the last one out ends it');
  for (const Q of more) { Q.g.send({ t: 'gl' }); await sleep(150); }
  gb3.send({ t: 'gl' }); await sleep(600);
  ok((await upgrade('/v1/group?id=' + gid, { 'Sec-WebSocket-Protocol': `rebel-universe.v1, t.${ticket({ sub: Bo.sub, n: 'Bo' })}` })).status === 404, 'everyone left: the group is gone (404)');

  console.log('new groups a day');
  const X = 'u:maker' + crypto.randomBytes(4).toString('hex'), made = [];
  for (let k = 0; k < 4; k++) made.push((await upgrade('/v1/group?id=new', { 'Sec-WebSocket-Protocol': `rebel-universe.v1, t.${ticket({ sub: X, n: 'Maker' })}` })).status);
  ok(made.join() === '101,101,101,429', 'an account makes at most GROUPS_A_DAY groups a day (3 here), then 429', made);
} catch (e) { fail++; console.log('  FAIL (exception)', e.message, e.stack?.split('\n')[1]); }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
