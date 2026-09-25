// Poll the automated Forge Rigger: GET ?buildId=... (or POST {buildId})
// While running it reports the current step; when the job ends it stores the rigged GLB in Blob,
// writes output.forgeRigGlbUrl + forgeRig.qa to the build record and stops the sandbox.
import { put } from '@vercel/blob';
import { Sandbox, creds, JOB_DIR, JOB_TIMEOUT_MS, redis, loadBuild, updateRigging, readText, sanitize, body } from './_forge-rig.mjs';

const STEPS = ['starting', 'download', 'normalize', 'landmarks', 'skeleton', 'weights', 'bind', 'hands', 'cloth', 'animate', 'moves', 'cleanup', 'export', 'qa', 'done'];

export default async function handler(req, res) {
  const buildId = req.query?.buildId || body(req).buildId;
  if (!buildId) return res.status(400).json({ ok: false, error: 'Missing buildId' });
  try {
    const rec = await loadBuild(buildId);
    const fr = rec.forgeRig || null;
    if (!fr || fr.status !== 'running') return res.status(200).json({ ok: true, forgeRig: fr, forgeRigGlbUrl: rec.output?.forgeRigGlbUrl || null });

    let sandbox;
    try { sandbox = await Sandbox.get({ name: fr.sandboxName, ...creds() }); } catch (e) {
      const next = await updateRigging(buildId, { status: 'failed', error: 'Rig sandbox ended before the result was collected', finishedAt: new Date().toISOString() });
      return res.status(200).json({ ok: true, forgeRig: next.forgeRig });
    }
    const cmd = await sandbox.getCommand(fr.cmdId);
    const progress = ((await readText(sandbox, `${JOB_DIR}/progress`)) || fr.progress || 'starting').trim();
    const pct = Math.round(100 * Math.max(0, STEPS.indexOf(progress)) / (STEPS.length - 1));

    if (cmd.exitCode === null || cmd.exitCode === undefined) {
      const late = Date.now() - Date.parse(fr.startedAt) > JOB_TIMEOUT_MS + 60000;
      if (late) {
        try { await sandbox.stop(); } catch (e) {}
        const next = await updateRigging(buildId, { status: 'failed', error: 'Rig job timed out', progress, finishedAt: new Date().toISOString() });
        return res.status(200).json({ ok: true, forgeRig: next.forgeRig });
      }
      if (progress !== fr.progress) await updateRigging(buildId, { progress });
      return res.status(200).json({ ok: true, forgeRig: { ...fr, progress }, percent: pct });
    }

    // Finished: only one poller finalizes.
    const [lock] = await redis([['SET', `forge:rig:finalize:${buildId}`, '1', 'NX', 'EX', 120]]);
    if (lock?.result !== 'OK') return res.status(200).json({ ok: true, forgeRig: { ...fr, progress: 'saving' }, percent: 99 });

    const result = JSON.parse((await readText(sandbox, `${JOB_DIR}/result.json`)) || '{}');
    if (cmd.exitCode !== 0 || !result.ok) {
      const log = (await readText(sandbox, `${JOB_DIR}/log`)) || '';
      try { await sandbox.stop(); } catch (e) {}
      const next = await updateRigging(buildId, {
        status: 'failed', progress, exitCode: cmd.exitCode, failedStep: result.step || progress,
        error: `Rig failed at step "${result.step || progress}"`, logTail: log.split('\n').slice(-25).join('\n'), finishedAt: new Date().toISOString()
      });
      return res.status(200).json({ ok: true, forgeRig: next.forgeRig });
    }

    const glb = await sandbox.readFileToBuffer({ path: `${JOB_DIR}/rig.glb` });
    if (!glb || !glb.length) throw new Error('Rig finished but rig.glb is missing');
    const path = `forge/3d-builds/${sanitize(rec.collectionKey, 'battle-for-colony')}/${sanitize(rec.tokenId || rec.rebelId, 'unknown-token')}/${sanitize(buildId, 'build')}_forge_rig.glb`;
    const blob = await put(path, glb, { access: 'public', addRandomSuffix: true, contentType: 'model/gltf-binary' });
    try { await sandbox.stop(); } catch (e) {}
    const next = await updateRigging(buildId, {
      status: 'succeeded', progress: 'done', forgeRigGlbUrl: blob.url, bytes: glb.length, seconds: result.seconds,
      qa: result.qa || null, verdict: result.qa?.verdict || null, finishedAt: new Date().toISOString()
    }, { forgeRigGlbUrl: blob.url });
    return res.status(200).json({ ok: true, forgeRig: next.forgeRig, forgeRigGlbUrl: blob.url, percent: 100 });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
