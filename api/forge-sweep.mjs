// Phase 2 server finisher: forges keep going when the player closes the tab.
// Runs every few minutes (Vercel cron, production) or by hand as admin: GET /api/forge-sweep
// For every build in forge:pending:v1 it
//   - polls the Meshy sculpt and stores the finished GLB in our Blob,
//   - collects a finished rig job (rigged GLB, portrait, QA) so the result is saved even if nobody is watching.
// When the player comes back the Forge picks up where it is (the versions wait to be picked; a finished rig awakens).
import { isAdminRequest, createAdminSessionToken } from './_admin-auth.mjs';
import { redis } from './_wallet.mjs';

const SET = 'forge:pending:v1';
const MAX_AGE_MS = 26 * 3600 * 1000;
const PER_RUN = 25;

// call another API handler in-process, as admin (the finisher is trusted server code)
async function call(file, { method = 'POST', body = {}, query = {} }) {
  const mod = await import(`./${file}.mjs`);
  const cookie = `ra_admin_session=${encodeURIComponent(createAdminSessionToken())}`;
  return new Promise((resolve) => {
    const res = {
      code: 200, headers: {},
      setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; },
      json(j) { resolve({ status: this.code, body: j }); }, end() { resolve({ status: this.code, body: null }); }, send(b) { resolve({ status: this.code, body: b }); }
    };
    Promise.resolve(mod.default({ method, body, query, headers: { cookie, host: 'forge-sweep', 'x-forwarded-for': 'forge-sweep' } }, res))
      .catch((e) => resolve({ status: 500, body: { error: e.message } }));
  });
}

async function loadBuild(buildId) {
  const [r] = await redis([['GET', `forge:3d-build:v1:${buildId}`]]);
  try { return r?.result ? JSON.parse(r.result) : null; } catch (e) { return null; }
}

async function sweepOne(buildId) {
  let rec = await loadBuild(buildId);
  if (!rec) return { buildId, done: true, note: 'gone' };
  const age = Date.now() - Date.parse(rec.createdAt || rec.updatedAt || 0);
  const steps = [];
  // 1. the sculpt
  if (rec.engine?.taskId && !rec.output?.rebelGlbUrl) {
    const s = await call('forge-3d-engine-meshy-status', { body: { buildId } });
    const st = String(s.body?.meshyStatus || '').toUpperCase();
    steps.push(`meshy ${st || s.status}`);
    if (s.body?.glbUrl) {
      const st2 = await call('forge-3d-store-glb', { body: { buildId } });
      steps.push(`store ${st2.status}`);
    } else if (['FAILED', 'CANCELED', 'EXPIRED'].includes(st)) {
      return { buildId, done: true, steps };
    }
    rec = await loadBuild(buildId) || rec;
  }
  // 2. the rig
  if (rec.forgeRig?.status === 'running') {
    const r = await call('forge-rig-status', { method: 'GET', query: { buildId } });
    steps.push(`rig ${r.body?.forgeRig?.status || r.status}`);
    rec = await loadBuild(buildId) || rec;
  }
  const sculptDone = !rec.engine?.taskId || !!rec.output?.rebelGlbUrl;
  const rigDone = !rec.forgeRig || rec.forgeRig.status !== 'running';
  return { buildId, done: (sculptDone && rigDone) || age > MAX_AGE_MS, steps };
}

export default async function handler(req, res) {
  res.setHeader?.('Cache-Control', 'no-store');
  const bearer = String(req.headers?.authorization || '');
  // Vercel cron sends "Bearer CRON_SECRET" when that env var is set; without it, the cron user agent is accepted.
  // A spoofed call can only make pending forges finish sooner, and one sweep runs at a time (lock below).
  const ua = String(req.headers?.['user-agent'] || '');
  const cronOk = process.env.CRON_SECRET ? bearer === `Bearer ${process.env.CRON_SECRET}` : /vercel-cron/i.test(ua);
  if (!cronOk && !isAdminRequest(req)) return res.status(401).json({ ok: false, error: 'Cron or admin only' });
  try {
    const [lock] = await redis([['SET', 'forge:sweep:lock:v1', '1', 'NX', 'EX', 240]]);
    if (lock?.result !== 'OK') return res.status(200).json({ ok: true, skipped: 'another sweep is running' });
    const [m] = await redis([['SMEMBERS', SET]]);
    const ids = (m?.result || []).slice(0, PER_RUN);
    const out = [], t0 = Date.now();
    for (const id of ids) {   // one at a time: each call can take a few seconds (store downloads the GLB)
      if (Date.now() - t0 > 200000) break;   // leave room inside the 300 s limit; the next run continues
      let r; try { r = await sweepOne(id); } catch (e) { r = { buildId: id, error: e.message }; }
      if (r.done) await redis([['SREM', SET, id]]);
      out.push(r);
    }
    await redis([['DEL', 'forge:sweep:lock:v1']]);
    return res.status(200).json({ ok: true, pending: (m?.result || []).length, swept: out });
  } catch (e) {
    try { await redis([['DEL', 'forge:sweep:lock:v1']]); } catch (e2) {}
    return res.status(500).json({ ok: false, error: e.message });
  }
}
