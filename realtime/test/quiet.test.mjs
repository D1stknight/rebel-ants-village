// node test/quiet.test.mjs   (env PORT)
// Starts the room server locally with STALE_S 6 and checks that a socket which goes quiet (no state, no ping: a phone
// put away, a connection gone half-open that the room never hears close) is dropped: the others hear it leave, a
// newcomer's hello leaves it out, while players who keep pinging or moving stay. And one socket per account: a page that
// comes back on a new ticket of the same account replaces its old socket (a guest keeps its id while its tab keeps its
// guest key), so it never meets its old self.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = +process.env.PORT || 8802, ROOT = fileURLToPath(new URL('..', import.meta.url));
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const PUB = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64url');
const STATE = fs.mkdtempSync(path.join(os.tmpdir(), 'rooms-quiet-'));
let n = 0;
const ticket = (o = {}) => {
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ v: 1, site: 'dev', sub: 'u:bot' + (++n) + crypto.randomBytes(3).toString('hex'), n: 'Bot ' + n, k: 'discord', av: '', look: { t: 'starter' }, iat: now, exp: now + 120, ...o })).toString('base64url');
  return body + '.' + crypto.sign(null, Buffer.from(body), privateKey).toString('base64url');
};
let pass = 0, fail = 0;
const ok = (c, what) => { if (c) { pass++; console.log('  ok  ', what); } else { fail++; console.log('  FAIL', what); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function bot(t, village = 'hub') {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/v1/room?village=${village}`, ['rebel-universe.v1', 't.' + t]);
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
    b.close = () => { try { ws.close(); } catch (e) {} };
  });
}
const state = (b, x) => b.send({ t: 's', p: [x, 0, 3], r: 0, a: 'idle', i: null });

const dev = spawn(ROOT + 'node_modules/.bin/wrangler', ['dev', '--env', 'dev', '--port', String(PORT), '--ip', '127.0.0.1', '--var', `TICKET_KEYS:${JSON.stringify({ dev: [PUB] })}`, '--var', 'ALLOW_NO_ORIGIN:1', '--var', 'STALE_S:6', '--persist-to', STATE, '--show-interactive-dev-session=false', '--log-level', 'warn'],
  { cwd: ROOT, env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
const stop = () => { try { process.kill(-dev.pid, 'SIGTERM'); } catch (e) {} };
process.on('exit', () => { stop(); try { fs.rmSync(STATE, { recursive: true, force: true }); } catch (e) {} });
let out = ''; dev.stdout.on('data', d => (out += d)); dev.stderr.on('data', d => (out += d));
try { await fetch(`http://127.0.0.1:${PORT}/v1/health`); console.log(`port ${PORT} is already in use (an old dev server?)`); process.exit(1); } catch (e) {}
const t0 = Date.now(); let up = false;
while (Date.now() - t0 < 90000 && !up) { await sleep(500); try { up = (await fetch(`http://127.0.0.1:${PORT}/v1/health`)).ok; } catch (e) {} }
if (!up) { console.log('dev server did not start\n' + out.slice(-3000)); stop(); process.exit(1); }
console.log('dev server up in', ((Date.now() - t0) / 1000).toFixed(1), 's');
const timers = [];
try {
  console.log('a quiet socket');
  const S = await bot(ticket({ n: 'Steady' })); const hS = await S.next(m => m.t === 'hi');
  const P = await bot(ticket({ n: 'Pinger' })); const hP = await P.next(m => m.t === 'hi');
  const Q = await bot(ticket({ n: 'Quiet', k: 'guest', sub: 'g:quiet' + crypto.randomBytes(4).toString('hex') })); const hQ = await Q.next(m => m.t === 'hi');
  await S.next(m => m.t === 'j' && m.id === hQ.you);
  state(Q, 1); // (the quiet one stands somewhere, then says nothing more: no state, no ping)
  timers.push(setInterval(() => state(S, 2), 1000), setInterval(() => P.send('{"t":"ping"}'), 2000)); // (one moves, one only pings)
  const left = await S.next(m => m.t === 'l', 22000).catch(() => null);
  ok(left && left.id === hQ.you, 'the quiet socket is dropped: the others hear it leave (STALE_S 6)');
  ok(!S.msgs.some(m => m.t === 'l' && (m.id === hP.you || m.id === hS.you)), 'a player who only pings and one who moves both stay');
  const N = await bot(ticket({ n: 'Newcomer' })); const hN = await N.next(m => m.t === 'hi');
  ok(!hN.peers.some(p => p.id === hQ.you) && hN.peers.some(p => p.id === hP.you) && hN.peers.some(p => p.id === hS.you), 'a newcomer: the pinger and the mover, not the quiet one');

  console.log('quiet, then a newcomer');
  const Q2 = await bot(ticket({ n: 'Quiet 2' })); const hQ2 = await Q2.next(m => m.t === 'hi');
  await sleep(7500); // (quiet past STALE_S; no other message since)
  const N2 = await bot(ticket({ n: 'Newcomer 2' })); const hN2 = await N2.next(m => m.t === 'hi');
  ok(!hN2.peers.some(p => p.id === hQ2.you), 'a newcomer right after: the quiet one is left out of its hello');
  ok((await S.next(m => m.t === 'l' && m.id === hQ2.you, 3000).catch(() => null))?.id === hQ2.you, 'and the others hear it leave then');

  console.log('the same guest on a new ticket');
  const sub = 'g:samepage' + crypto.randomBytes(4).toString('hex');
  const G1 = await bot(ticket({ sub, n: 'Guest', k: 'guest' })); const hG1 = await G1.next(m => m.t === 'hi');
  state(G1, 4);
  await S.next(m => m.t === 'j' && m.id === hG1.you);
  // the page lost its socket without the room hearing it (half-open): it simply knocks again with a new ticket
  const G2 = await bot(ticket({ sub, n: 'Guest', k: 'guest' })); const hG2 = await G2.next(m => m.t === 'hi');
  ok(!hG2.peers.some(p => p.id === hG1.you), 'the page does not meet its old self');
  ok((await S.next(m => m.t === 'l' && m.id === hG1.you, 3000).catch(() => null))?.id === hG1.you, 'the others see the old socket go and the new one come');
  for (const x of [S, P, Q, N, Q2, N2, G1, G2]) x.close();
} catch (e) { fail++; console.log('  FAIL (exception)', e.message); }
for (const t of timers) clearInterval(t);
console.log(`\n${pass} passed, ${fail} failed`);
if (fail && process.env.LOGS) console.log('--- dev server output ---\n' + out.slice(-4000));
await sleep(300);
process.exit(fail ? 1 : 0);
