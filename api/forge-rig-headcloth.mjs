// Head-cloth upgrade for a LIVE rig (admin, rigger 2.12): runs forge-worker/rigger/headcloth.py on the rig GLB in the
// worker sandbox (skully-wrap flaps / bandana tails get spring chains, and a flap half fused into the surface under it
// is repainted as cloth), stores the
// result as a new Blob file and links it: forge:rig-latest:v1:<old> -> new (village + Forge follow it), the weapon
// moves pack is linked to the new URL too, and the build record (if given) points at it.
//   POST {rigUrl, buildId?}  -> start
//   GET  ?rigUrl=...         -> poll; when done: {status:'done', url, report} (status 'none' = no loose head cloth found)
import { put } from '@vercel/blob';
import { isAdminRequest } from './_admin-auth.mjs';
import { Sandbox, creds, WORKER_KEY, FW, JOB_DIR, redis, getJson, loadBuild, updateRigging, readText, body } from './_forge-rig.mjs';

const KEY = (u) => `forge:headcloth-job:v1:${u}`;
const BLOB = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//;
async function getJob(u) { const [r] = await redis([['GET', KEY(u)]]); try { return r?.result ? JSON.parse(r.result) : null; } catch (e) { return null; } }
async function setJob(u, v) { await redis([['SET', KEY(u), JSON.stringify(v), 'EX', 7 * 86400]]); return v; }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!isAdminRequest(req)) return res.status(401).json({ ok: false, error: 'Admin only' });
  const b = body(req);
  const rigUrl = String(req.query?.rigUrl || b.rigUrl || '');
  if (!BLOB.test(rigUrl)) return res.status(400).json({ ok: false, error: 'Missing rigUrl' });
  try {
    if (req.method === 'POST') {
      const worker = await getJson(WORKER_KEY);
      if (!worker?.snapshotId) return res.status(503).json({ ok: false, error: 'Rig worker is not built yet' });
      const sandbox = await Sandbox.create({ source: { type: 'snapshot', snapshotId: worker.snapshotId }, persistent: false, resources: { vcpus: 2 }, timeout: 10 * 60 * 1000,
        tags: { purpose: 'forge-headcloth' }, ...creds() });
      const sh = `mkdir -p ${JOB_DIR} && cd ${JOB_DIR} && curl -fsSL --retry 3 "$RIG_URL" -o in.glb && `
        + `(${FW}/venv/bin/python ${FW}/rigger/headcloth.py in.glb out.glb --report report.json > log 2>&1; echo $? > exit)`;
      const cmd = await sandbox.runCommand({ cmd: 'bash', args: ['-c', sh], env: { RIG_URL: rigUrl }, sudo: true, detached: true });
      const job = await setJob(rigUrl, { status: 'running', sandboxName: sandbox.name, cmdId: cmd.cmdId, rigUrl, buildId: b.buildId || null, workerCommit: worker.commit || null, startedAt: new Date().toISOString() });
      return res.status(200).json({ ok: true, job });
    }
    const job = await getJob(rigUrl);
    if (!job || job.status !== 'running') return res.status(200).json({ ok: true, job });
    let sandbox;
    try { sandbox = await Sandbox.get({ name: job.sandboxName, ...creds() }); } catch (e) { return res.status(200).json({ ok: true, job: await setJob(rigUrl, { ...job, status: 'failed', error: 'sandbox ended' }) }); }
    const exit = ((await readText(sandbox, `${JOB_DIR}/exit`)) || '').trim();
    if (!exit) {
      if (Date.now() - Date.parse(job.startedAt) > 9 * 60 * 1000) { try { await sandbox.stop(); } catch (e) {} return res.status(200).json({ ok: true, job: await setJob(rigUrl, { ...job, status: 'failed', error: 'timed out' }) }); }
      return res.status(200).json({ ok: true, job });
    }
    const [lock] = await redis([['SET', `forge:headcloth-job:lock:${rigUrl}`, '1', 'NX', 'EX', 120]]);
    if (lock?.result !== 'OK') return res.status(200).json({ ok: true, job: { ...job, progress: 'saving' } });
    const log = (await readText(sandbox, `${JOB_DIR}/log`)) || '';
    let report = null; try { report = JSON.parse((await readText(sandbox, `${JOB_DIR}/report.json`)) || 'null'); } catch (e) {}
    if (exit !== '0' || !report) { try { await sandbox.stop(); } catch (e) {} return res.status(200).json({ ok: true, job: await setJob(rigUrl, { ...job, status: 'failed', error: 'headcloth failed', logTail: log.split('\n').slice(-20).join('\n') }) }); }
    if (!(report.changed ?? report.chains)) { try { await sandbox.stop(); } catch (e) {} return res.status(200).json({ ok: true, job: await setJob(rigUrl, { ...job, status: 'none', report }) }); }
    const glb = await sandbox.readFileToBuffer({ path: `${JOB_DIR}/out.glb` });
    const path = new URL(rigUrl).pathname.slice(1).replace(/(-[A-Za-z0-9]+)?\.glb$/, '').replace(/(_cloth\d*)+$/, '') + '_cloth.glb';
    const url = (await put(path, glb, { access: 'public', addRandomSuffix: true, contentType: 'model/gltf-binary' })).url;
    const [mv] = await redis([['GET', `forge:moves:v1:${rigUrl}`]]);
    await redis([['SET', `forge:rig-latest:v1:${rigUrl}`, url], ...(mv?.result ? [['SET', `forge:moves:v1:${url}`, mv.result]] : [])]);
    if (job.buildId) {
      try {
        const rec = await loadBuild(job.buildId);
        if (rec.output?.forgeRigGlbUrl === rigUrl) await updateRigging(job.buildId, { forgeRigGlbUrl: url, headcloth: report }, { forgeRigGlbUrl: url });
      } catch (e) { /* the latest link is enough */ }
    }
    try { await sandbox.stop(); } catch (e) {}
    return res.status(200).json({ ok: true, job: await setJob(rigUrl, { ...job, status: 'done', url, report, bytes: glb.length, finishedAt: new Date().toISOString() }) });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
