// node test/perf.test.mjs   (env PORT)
// Starts the room server locally with PERF_FLUSH_S 2 / PERF_MIN_S 1 and checks the dashboard's numbers: pages' minute
// reports ({t:'pf'}: fps, slow frames, freezes, ping, reconnects, device) are clamped and kept by the room, sent to the
// control desk with who is in the room and how sockets closed, and the Admin Hub's 'stats' command adds them up (the series,
// each village, phones vs computers, devices, close codes, the last five minutes). Junk and too-short reports are dropped,
// one report a player per PERF_MIN_S, and the last one out of a room sends what the room still held.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = +process.env.PORT || 8803, ROOT = fileURLToPath(new URL('..', import.meta.url));
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const PUB = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64url');
const ADMIN = crypto.generateKeyPairSync('ed25519');
const ADMIN_PUB = ADMIN.publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64url');
const STATE = fs.mkdtempSync(path.join(os.tmpdir(), 'rooms-perf-'));
let n = 0;
const ticket = (o = {}) => {
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ v: 1, site: 'dev', sub: 'u:bot' + (++n) + crypto.randomBytes(3).toString('hex'), n: 'Bot ' + n, k: 'discord', av: '', look: { t: 'starter' }, iat: now, exp: now + 120, ...o })).toString('base64url');
  return body + '.' + crypto.sign(null, Buffer.from(body), privateKey).toString('base64url');
};
const command = (cmd, args = {}) => {
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ v: 1, typ: 'mp-admin', site: 'dev', cmd, args, iat: now, exp: now + 60, nonce: crypto.randomBytes(12).toString('base64url') })).toString('base64url');
  return body + '.' + crypto.sign(null, Buffer.from(body), ADMIN.privateKey).toString('base64url');
};
const admin = async (cmd, args) => { const r = await fetch(`http://127.0.0.1:${PORT}/v1/admin`, { method: 'POST', body: command(cmd, args) }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; };
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
    b.close = (code) => { try { ws.close(code); } catch (e) {} };
  });
}
const state = (b, x, i = null) => b.send({ t: 's', p: [x, 0, 3], r: 0, a: 'idle', i });
const report = (o = {}) => ({ t: 'pf', f: 58.4, ft: 21, sl: 3, fr: 0, s: 60, rtt: 80, rc: 0, d: 'd', o: 'win', b: 'chrome', l: 0, m: 210, n: 2, g: 0, ...o });
// the desk's numbers, asked until `until` says they are in (the room sends them on without waiting)
async function statsWhen(until, args = { hours: 1, step: 5 }, ms = 8000) {
  const t0 = Date.now(); let s;
  while (Date.now() - t0 < ms) { s = await admin('stats', args); if (s.ok && until(s)) return s; await sleep(250); }
  return s;
}
const sum = (rows, k) => rows.reduce((a, r) => a + (r[k] || 0), 0);

const dev = spawn(ROOT + 'node_modules/.bin/wrangler', ['dev', '--env', 'dev', '--port', String(PORT), '--ip', '127.0.0.1', '--var', `TICKET_KEYS:${JSON.stringify({ dev: [PUB] })}`, '--var', `ADMIN_KEYS:${JSON.stringify({ dev: [ADMIN_PUB] })}`,
  '--var', 'ALLOW_NO_ORIGIN:1', '--var', 'PERF_FLUSH_S:2', '--var', 'PERF_MIN_S:1', '--persist-to', STATE, '--show-interactive-dev-session=false', '--log-level', 'warn'],
  { cwd: ROOT, env: { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' }, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
const stop = () => { try { process.kill(-dev.pid, 'SIGTERM'); } catch (e) {} };
process.on('exit', () => { stop(); try { fs.rmSync(STATE, { recursive: true, force: true }); } catch (e) {} });
let out = ''; dev.stdout.on('data', d => (out += d)); dev.stderr.on('data', d => (out += d));
try { await fetch(`http://127.0.0.1:${PORT}/v1/health`); console.log(`port ${PORT} is already in use (an old dev server?)`); process.exit(1); } catch (e) {}
const t0 = Date.now(); let up = false;
while (Date.now() - t0 < 90000 && !up) { await sleep(500); try { up = (await fetch(`http://127.0.0.1:${PORT}/v1/health`)).ok; } catch (e) {} }
if (!up) { console.log('dev server did not start\n' + out.slice(-3000)); stop(); process.exit(1); }
console.log('dev server up in', ((Date.now() - t0) / 1000).toFixed(1), 's');
try {
  console.log('nothing yet');
  const s0 = await admin('stats', { hours: 1 });
  ok(s0.ok && Array.isArray(s0.series) && s0.series.length === 0 && s0.villages.length === 0 && s0.now.reports === 0 && s0.now.fpsD === null, 'stats with no reports: empty, no numbers made up');
  ok((await fetch(`http://127.0.0.1:${PORT}/v1/admin`, { method: 'POST', body: 'x.y' })).status === 401, 'stats need a signed command');

  console.log('reports from a computer and a phone in the Hub');
  const A = await bot(ticket({ n: 'Desk' })); const hA = await A.next(m => m.t === 'hi');
  const P = await bot(ticket({ n: 'Phone', k: 'guest', sub: 'g:phone' + crypto.randomBytes(4).toString('hex') })); await P.next(m => m.t === 'hi');
  state(A, 1); state(P, 2, 'hub_comedy_club'); // (the phone in a room)
  A.send(report());
  P.send(report({ f: 24.6, ft: 88, sl: 140, fr: 2, rtt: 260, rc: 1, d: 'p', o: 'ios', b: 'safari', l: 1, m: null, g: 1 }));
  await sleep(2300); // (past PERF_FLUSH_S: the next report sends the room's batch on)
  A.send(report({ f: 61.6, rtt: 120 })); // (too soon after its first? no: PERF_MIN_S is 1)
  let s = await statsWhen(x => x.now.reports >= 3);
  const hub = s.villages.find(v => v.v === 'hub');
  ok(s.now.reports === 3, `three reports kept (${s.now.reports})`);
  ok(s.now.fpsD === 60 && s.now.fpsP === 24.6, `fps by device: computers ${s.now.fpsD}, phones ${s.now.fpsP}`);
  ok(Math.abs(s.now.slowPct - 33.3) < .1, `the share of reports under 30 fps (${s.now.slowPct} %)`);
  ok(s.now.rtt === Math.round((80 + 260 + 120) / 3) && Math.abs(s.now.lagPct - 33.3) < .1, `ping ${s.now.rtt} ms, ${s.now.lagPct} % at 200 ms or more`);
  ok(s.now.memMB === 210, `memory where the browser says it (${s.now.memMB} MB)`);
  ok(s.now.online === 2 && s.now.rooms === 1, `players online from the room's own count (${s.now.online} in ${s.now.rooms} room)`);
  ok(hub && hub.reports === 3 && hub.freezes === 2 && hub.slowFrames === 146 && hub.peak === 2, 'the Hub: reports, freezes, slow frames, its peak');
  ok(hub && JSON.stringify(hub.bands) === '[0,1,0,0,2]', `fps bands <20 / 20-29 / 30-44 / 45-54 / 55+ (${hub && hub.bands})`);
  ok(hub && Math.abs(hub.inRooms - 33.3) < .1 && Math.abs(hub.inGames - 33.3) < .1, 'the share of reports from a room / a game');
  const ios = s.devices.find(d => d.o === 'ios'), win = s.devices.find(d => d.o === 'win');
  ok(ios && ios.d === 'p' && ios.b === 'safari' && ios.reports === 1 && ios.slowPct === 100 && win && win.reports === 2 && win.fps === 60, 'devices: iPhone Safari (phone), Windows Chrome');
  ok(s.series.length >= 1 && sum(s.series, 'reports') === 3 && s.series.some(x => x.online === 2) && sum(s.series, 'reconnects') === 1, 'the series: reports, players online, reconnects');

  console.log('what is dropped');
  A.send(report({ f: 200 })); // (too soon: one a player per PERF_MIN_S)
  P.send({ t: 'pf', f: 'fast', s: 60 }); // (not a number)
  await sleep(1200);
  const J = await bot(ticket({ n: 'Junk' })); await J.next(m => m.t === 'hi');
  J.send(report({ s: 2 })); // (hardly on screen)
  await sleep(1200);
  J.send(report({ f: 9999, ft: 1e9, sl: -5, rtt: -20, o: 'beos', b: 'netscape', d: 'tablet', n: 4000 })); // (clamped, unknown names folded)
  await sleep(2300);
  A.send(report()); // (sends the batch on)
  s = await statsWhen(x => x.now.reports >= 5);
  ok(s.now.reports === 5, `only the two good ones more (${s.now.reports})`);
  const other = s.devices.find(d => d.o === 'other' && d.b === 'other');
  ok(other && other.fps === 240 && other.d === 'd', 'out-of-range numbers clamped (fps 240), unknown OS / browser as other, unknown device as computer');
  ok(!s.villages.some(v => v.fps > 240), 'no village averages past the clamp');

  console.log('closes and the last one out');
  const Z = await bot(ticket({ n: 'Zed' }), 'sohei'); await Z.next(m => m.t === 'hi');
  Z.send(report({ f: 40, rtt: 450 })); // (held by the Sohei room: under PERF_FLUSH_S since its first report? its first: sent at once)
  await sleep(300);
  Z.close(); // (the last one out: the room sends what it held, the 0 players and the close)
  s = await statsWhen(x => x.villages.some(v => v.v === 'sohei') && Object.keys(x.closes).length > 0);
  const sohei = s.villages.find(v => v.v === 'sohei');
  ok(sohei && sohei.reports === 1 && sohei.rtt === 450 && sohei.peak === 1, 'the Sohei room: its report and its peak');
  ok(Object.values(s.closes).reduce((a, b) => a + b, 0) >= 1, `the close counted (${JSON.stringify(s.closes)})`);
  ok(s.now.online === 3 && s.now.rooms === 1, `online now: the Hub's 3, Sohei's room empty (${s.now.online} in ${s.now.rooms})`);

  console.log('the steps and spans');
  const s24 = await admin('stats', { hours: 24 }), s7 = await admin('stats', { hours: 168 }), sx = await admin('stats', { hours: 99999, step: -3 });
  ok(s24.step === 15 && s7.step === 60 && sx.hours === 336 && sx.step === 1, `default steps 15 min / 1 h, spans clamped (${s24.step}, ${s7.step}, ${sx.hours} h / ${sx.step})`);
  ok(sum(s24.series, 'reports') === 6, 'the 24 h series holds every report');
  for (const x of [A, P, J]) x.close();
  void hA;
} catch (e) { fail++; console.log('  FAIL (exception)', e.message); }
console.log(`\n${pass} passed, ${fail} failed`);
if (fail && process.env.LOGS) console.log('--- dev server output ---\n' + out.slice(-4000));
await sleep(300);
process.exit(fail ? 1 : 0);
