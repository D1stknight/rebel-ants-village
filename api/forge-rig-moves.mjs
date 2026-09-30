// Weapon moves pack for an EXISTING rig (admin, Sept 29): re-runs the Forge Rigger on the build's own source with its
// recorded options (same skeleton as the live rig), keeps only moves.glb and links it to the live rig URL.
// The build record and its rig are not touched.
//   POST {buildId, rigUrl?}  -> start (rigUrl defaults to the build's current rig)
//   GET  ?buildId=...        -> poll; when done: {status:'done', moves}
import { put } from '@vercel/blob';
import { isAdminRequest } from './_admin-auth.mjs';
import { Sandbox, creds, WORKER_KEY, FW, JOB_DIR, JOB_TIMEOUT_MS, redis, getJson, loadBuild, sourceGlbUrl, readText, sanitize, body } from './_forge-rig.mjs';

const KEY = (id) => `forge:moves-job:v1:${id}`;
const BLOB = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//;
async function getJob(id) { const [r] = await redis([['GET', KEY(id)]]); try { return r?.result ? JSON.parse(r.result) : null; } catch (e) { return null; } }
async function setJob(id, v) { await redis([['SET', KEY(id), JSON.stringify(v), 'EX', 7 * 86400]]); return v; }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!isAdminRequest(req)) return res.status(401).json({ ok: false, error: 'Admin only' });
  const b = body(req);
  const buildId = String(req.query?.buildId || b.buildId || '');
  if (!buildId) return res.status(400).json({ ok: false, error: 'Missing buildId' });
  try {
    if (req.method === 'POST') {
      const rec = await loadBuild(buildId);
      const fr = rec.forgeRig || {};
      const rigUrl = String(b.rigUrl || rec.output?.forgeRigGlbUrl || fr.forgeRigGlbUrl || '');
      if (!BLOB.test(rigUrl)) return res.status(409).json({ ok: false, error: 'No live rig for this build' });
      const src = fr.sourceGlbUrl || sourceGlbUrl(rec);
      if (!src) return res.status(409).json({ ok: false, error: 'Build has no source GLB' });
      const worker = await getJson(WORKER_KEY);
      if (!worker?.snapshotId) return res.status(503).json({ ok: false, error: 'Rig worker is not built yet' });
      const o = fr.options || {};
      const env = { SRC_URL: src, RIG_NAME: `rebel${sanitize(rec.tokenId || rec.rebelId, 'x')}`,
        ...(o.skirtfix ? { FORGE_SKIRTFIX: '1', FORGE_KEEP_TEAR: '', FORGE_KEEP_BRIDGE: '' } : {}), ...(o.headUp ? { FORGE_HEAD_UP: String(o.headUp) } : {}),
        ...(o.headUrl ? { FORGE_HEAD_URL: String(o.headUrl) } : {}), ...(o.armorUrl ? { FORGE_ARMOR_URL: String(o.armorUrl), FORGE_ANCHORS_URL: String(o.anchorsUrl) } : {}),
        ...(o.cutBridges && !o.skirtfix ? { FORGE_KEEP_TEAR: '', FORGE_KEEP_BRIDGE: '' } : {}), ...(o.headScale != null ? { FORGE_HEAD_SCALE: String(o.headScale) } : {}),
        ...(o.headAuto ? { FORGE_HEAD_AUTO: '1' } : {}) };
      const sandbox = await Sandbox.create({ source: { type: 'snapshot', snapshotId: worker.snapshotId }, persistent: false, resources: { vcpus: 2 }, timeout: JOB_TIMEOUT_MS,
        tags: { purpose: 'forge-moves-job', build: buildId.slice(0, 200) }, ...creds() });
      const cmd = await sandbox.runCommand({ cmd: 'bash', args: ['-c', `mkdir -p ${JOB_DIR} && bash ${FW}/job.sh "$SRC_URL" "$RIG_NAME" ${JOB_DIR}`], env, sudo: true, detached: true });
      const job = await setJob(buildId, { status: 'running', sandboxName: sandbox.name, cmdId: cmd.cmdId, rigUrl, src, workerCommit: worker.commit || null, startedAt: new Date().toISOString() });
      return res.status(200).json({ ok: true, job });
    }
    const job = await getJob(buildId);
    if (!job || job.status !== 'running') return res.status(200).json({ ok: true, job });
    let sandbox;
    try { sandbox = await Sandbox.get({ name: job.sandboxName, ...creds() }); } catch (e) { return res.status(200).json({ ok: true, job: await setJob(buildId, { ...job, status: 'failed', error: 'sandbox ended' }) }); }
    const cmd = await sandbox.getCommand(job.cmdId);
    const progress = ((await readText(sandbox, `${JOB_DIR}/progress`)) || 'starting').trim();
    const resultText = await readText(sandbox, `${JOB_DIR}/result.json`);
    if (!resultText && (cmd.exitCode === null || cmd.exitCode === undefined)) {
      if (Date.now() - Date.parse(job.startedAt) > JOB_TIMEOUT_MS + 60000) { try { await sandbox.stop(); } catch (e) {} return res.status(200).json({ ok: true, job: await setJob(buildId, { ...job, status: 'failed', error: 'timed out', progress }) }); }
      return res.status(200).json({ ok: true, job: { ...job, progress } });
    }
    const [lock] = await redis([['SET', `forge:moves-job:lock:${buildId}`, '1', 'NX', 'EX', 120]]);
    if (lock?.result !== 'OK') return res.status(200).json({ ok: true, job: { ...job, progress: 'saving' } });
    const result = JSON.parse(resultText || '{}');
    if (!result.ok || !result.moves) {
      const log = (await readText(sandbox, `${JOB_DIR}/log`)) || '';
      try { await sandbox.stop(); } catch (e) {}
      return res.status(200).json({ ok: true, job: await setJob(buildId, { ...job, status: 'failed', error: `failed at ${result.step || progress}`, logTail: log.split('\n').slice(-20).join('\n') }) });
    }
    const mv = await sandbox.readFileToBuffer({ path: `${JOB_DIR}/moves.glb` });
    const path = `forge/3d-builds/moves/${sanitize(buildId, 'build')}_forge_moves.glb`;
    const url = (await put(path, mv, { access: 'public', addRandomSuffix: true, contentType: 'model/gltf-binary' })).url;
    await redis([['SET', `forge:moves:v1:${job.rigUrl}`, url]]);
    try { await sandbox.stop(); } catch (e) {}
    return res.status(200).json({ ok: true, job: await setJob(buildId, { ...job, status: 'done', moves: url, bytes: mv.length, seconds: result.seconds, finishedAt: new Date().toISOString() }) });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
