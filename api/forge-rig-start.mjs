// Start the automated Forge Rigger for a stored Meshy build: POST {buildId, force?}
// Admin-only extras: sourceUrl (rig a different static GLB for this build, e.g. a TRELLIS.2 source in the repo) and
// skirtfix (TRELLIS mode: open-cloth cleanup, hand/skirt webbing cut, bridge faces cut).
// One rig per build (idempotent). Re-rigging an already rigged build (force) is admin-only.
import { isAdminRequest } from './_admin-auth.mjs';
import { enforceRateLimit } from './_guard.mjs';
import { Sandbox, creds, WORKER_KEY, FW, JOB_DIR, JOB_TIMEOUT_MS, redis, getJson, loadBuild, updateRigging, sourceGlbUrl, sanitize, body } from './_forge-rig.mjs';

const SOURCE_OK = /^https:\/\/(raw\.githubusercontent\.com\/D1stknight\/rebel-ants-village\/[\w.-]+\/assets\/forge\/sources\/[\w.-]+\.glb|[a-z0-9]+\.public\.blob\.vercel-storage\.com\/[\w./-]+\.glb)$/;
const DAILY_LIMIT = parseInt(process.env.FORGE_RIG_DAILY_LIMIT || '200', 10);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const { buildId, force, sourceUrl, skirtfix } = body(req);
  if (!buildId) return res.status(400).json({ ok: false, error: 'Missing buildId' });
  try {
    const rec = await loadBuild(buildId);
    const admin = isAdminRequest(req);
    if ((sourceUrl || skirtfix) && !admin) return res.status(401).json({ ok: false, error: 'sourceUrl / skirtfix require admin' });
    if (sourceUrl && !SOURCE_OK.test(String(sourceUrl))) return res.status(400).json({ ok: false, error: 'sourceUrl must be a GLB in this repo or our Blob store' });
    const src = sourceUrl || sourceGlbUrl(rec);
    if (!src) return res.status(409).json({ ok: false, error: 'Build has no stored GLB yet (run forge-3d-store-glb first)' });
    const cur = rec.forgeRig || {};
    if (cur.status === 'running' && !(force && admin)) return res.status(200).json({ ok: true, forgeRig: cur, alreadyRunning: true });
    if (cur.status === 'succeeded' && !(force && admin)) return res.status(200).json({ ok: true, forgeRig: cur, alreadyDone: true });
    if (force && !admin) return res.status(401).json({ ok: false, error: 'Re-rigging requires admin' });

    // Phase 0: per-visitor limit first (so one visitor can't burn the global cap), then the global daily cap. Admins skip both.
    if (!admin) {
      if (!(await enforceRateLimit(req, res, 'rig-start', 6, 86400, 'rig jobs today'))) return;
      const day = new Date().toISOString().slice(0, 10);
      const [cnt] = await redis([['INCR', `forge:rig:count:${day}`], ['EXPIRE', `forge:rig:count:${day}`, 172800]]);
      if (Number(cnt?.result || 0) > DAILY_LIMIT) return res.status(429).json({ ok: false, error: 'Daily rig limit reached, try again tomorrow' });
    }

    const worker = await getJson(WORKER_KEY);
    if (!worker?.snapshotId) return res.status(503).json({ ok: false, error: 'Rig worker is not built yet' });

    const name = `rebel${sanitize(rec.tokenId || rec.rebelId, 'x')}`;
    const sandbox = await Sandbox.create({
      source: { type: 'snapshot', snapshotId: worker.snapshotId },
      persistent: false,
      resources: { vcpus: 2 },
      timeout: JOB_TIMEOUT_MS,
      tags: { purpose: 'forge-rig-job', build: String(buildId).slice(0, 200) },
      ...creds()
    });
    const cmd = await sandbox.runCommand({
      cmd: 'bash',
      args: ['-c', `mkdir -p ${JOB_DIR} && bash ${FW}/job.sh "$SRC_URL" "$RIG_NAME" ${JOB_DIR}`],
      env: { SRC_URL: src, RIG_NAME: name, ...(skirtfix ? { FORGE_SKIRTFIX: '1', FORGE_KEEP_TEAR: '', FORGE_KEEP_BRIDGE: '' } : {}) },
      sudo: true,
      detached: true
    });
    const next = await updateRigging(buildId, {
      engine: 'forge-rigger',
      status: 'running',
      progress: 'starting',
      sandboxName: sandbox.name,
      cmdId: cmd.cmdId,
      workerCommit: worker.commit || null,
      sourceGlbUrl: src,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      error: null
    });
    return res.status(200).json({ ok: true, forgeRig: next.forgeRig });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
