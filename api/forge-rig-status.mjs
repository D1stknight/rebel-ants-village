// Poll the automated Forge Rigger: GET ?buildId=... (or POST {buildId})
// While running it reports the current step; when the job ends it stores the rigged GLB in Blob,
// writes output.forgeRigGlbUrl + forgeRig.qa to the build record and stops the sandbox.
import { put } from '@vercel/blob';
import { Sandbox, creds, JOB_DIR, JOB_TIMEOUT_MS, redis, loadBuild, updateRigging, readText, sanitize, body } from './_forge-rig.mjs';
import { keepForge } from './_forge-charge.mjs';

// Rebel Forge gloves (rigger 2.33): a gloves re-rig that fails puts the rig back as it was (its file, options and QA) with
// the error on the gloves note; one that succeeds links every rig the build had to the new file (forge-rig-latest), so
// saved characters, the village and the Forge follow it.
const BLOB = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//;
const glovesJob = (fr) => !!(fr?.gloves?.prev && fr.gloves.startedAt === fr.startedAt);
async function failRig(buildId, fr, patch) {
  if (!glovesJob(fr)) return updateRigging(buildId, patch);
  const { prev, ...g } = fr.gloves;
  const next = await updateRigging(buildId, { ...prev, gloves: { ...g, failedAt: patch.finishedAt || new Date().toISOString(), error: patch.error, ...(patch.failedStep ? { failedStep: patch.failedStep, logTail: patch.logTail } : {}) } });
  // a job that failed does not count against the holder's glove forgings of the day
  if (g.by === 'holder') { try { await redis([['DECR', `forge:gloves:count:${next.collectionKey || 'battle_for_colony'}:${next.tokenId}:${String(g.startedAt).slice(0, 10)}`]]); } catch (e) {} }
  return next;
}

const STEPS = ['starting', 'download', 'armor', 'head', 'normalize', 'landmarks', 'skeleton', 'weights', 'bind', 'hands', 'cloth', 'animate', 'moves', 'weapons', 'games', 'cleanup', 'export', 'headcloth', 'movespack', 'gamespack', 'qa', 'thumb', 'done'];

export default async function handler(req, res) {
  const buildId = req.query?.buildId || body(req).buildId;
  if (!buildId) return res.status(400).json({ ok: false, error: 'Missing buildId' });
  try {
    const rec = await loadBuild(buildId);
    const fr = rec.forgeRig || null;
    if (!fr || fr.status !== 'running') return res.status(200).json({ ok: true, forgeRig: fr, forgeRigGlbUrl: rec.output?.forgeRigGlbUrl || null });

    let sandbox;
    try { sandbox = await Sandbox.get({ name: fr.sandboxName, ...creds() }); } catch (e) {
      const next = await failRig(buildId, fr, { status: 'failed', error: 'Rig sandbox ended before the result was collected', finishedAt: new Date().toISOString() });
      return res.status(200).json({ ok: true, forgeRig: next.forgeRig });
    }
    const cmd = await sandbox.getCommand(fr.cmdId);
    const progress = ((await readText(sandbox, `${JOB_DIR}/progress`)) || fr.progress || 'starting').trim();
    const pct = Math.round(100 * Math.max(0, STEPS.indexOf(progress)) / (STEPS.length - 1));

    // result.json is written last (success or failure); the command's exit status can lag behind it.
    const resultText = await readText(sandbox, `${JOB_DIR}/result.json`);
    const finished = Boolean(resultText) || !(cmd.exitCode === null || cmd.exitCode === undefined);
    if (!finished) {
      const late = Date.now() - Date.parse(fr.startedAt) > JOB_TIMEOUT_MS + 60000;
      if (late) {
        try { await sandbox.stop(); } catch (e) {}
        const next = await failRig(buildId, fr, { status: 'failed', error: 'Rig job timed out', progress, finishedAt: new Date().toISOString() });
        return res.status(200).json({ ok: true, forgeRig: next.forgeRig });
      }
      if (progress !== fr.progress) await updateRigging(buildId, { progress });
      return res.status(200).json({ ok: true, forgeRig: { ...fr, progress }, percent: pct });
    }

    // Finished: only one poller finalizes.
    const [lock] = await redis([['SET', `forge:rig:finalize:${buildId}`, '1', 'NX', 'EX', 120]]);
    if (lock?.result !== 'OK') return res.status(200).json({ ok: true, forgeRig: { ...fr, progress: 'saving' }, percent: 99 });

    const result = JSON.parse(resultText || (await readText(sandbox, `${JOB_DIR}/result.json`)) || '{}');
    if (!result.ok) {
      const log = (await readText(sandbox, `${JOB_DIR}/log`)) || '';
      try { await sandbox.stop(); } catch (e) {}
      const next = await failRig(buildId, fr, {
        status: 'failed', progress, exitCode: cmd.exitCode, failedStep: result.step || progress,
        error: `Rig failed at step "${result.step || progress}"`, logTail: log.split('\n').slice(-25).join('\n'), finishedAt: new Date().toISOString()
      });
      return res.status(200).json({ ok: true, forgeRig: next.forgeRig });
    }

    // a gloves re-rig that fails the rig checks never replaces a rig that passed them
    const was = fr.gloves?.prev?.qa?.verdict || fr.gloves?.prev?.verdict;
    if (glovesJob(fr) && result.qa?.verdict === 'fail' && was !== 'fail') {
      try { await sandbox.stop(); } catch (e) {}
      const next = await failRig(buildId, fr, { error: `The new rig did not pass the checks (${(result.qa.reasons || []).slice(0, 2).join('; ') || 'QA'})`, finishedAt: new Date().toISOString() });
      return res.status(200).json({ ok: true, forgeRig: next.forgeRig });
    }
    const glb = await sandbox.readFileToBuffer({ path: `${JOB_DIR}/rig.glb` });
    if (!glb || !glb.length) throw new Error('Rig finished but rig.glb is missing');
    const path = `forge/3d-builds/${sanitize(rec.collectionKey, 'battle-for-colony')}/${sanitize(rec.tokenId || rec.rebelId, 'unknown-token')}/${sanitize(buildId, 'build')}_forge_rig.glb`;
    const blob = await put(path, glb, { access: 'public', addRandomSuffix: true, contentType: 'model/gltf-binary' });
    // Portrait render of the rigged character (lobby card + village hub). Optional.
    let thumbUrl = null;
    if (result.thumb) {
      try {
        const jpg = await sandbox.readFileToBuffer({ path: `${JOB_DIR}/thumb.jpg` });
        if (jpg && jpg.length) thumbUrl = (await put(path.replace(/\.glb$/, '_thumb.jpg'), jpg, { access: 'public', addRandomSuffix: true, contentType: 'image/jpeg' })).url;
      } catch (e) { /* keep the rig even if the thumbnail fails */ }
    }
    // v2.11 weapon moves pack (skeleton + weapon clips), played on this rig in the Forge and the village
    let movesUrl = null;
    if (result.moves) {
      try {
        const mv = await sandbox.readFileToBuffer({ path: `${JOB_DIR}/moves.glb` });
        if (mv && mv.length) {
          movesUrl = (await put(path.replace(/_forge_rig\.glb$/, '_forge_moves.glb'), mv, { access: 'public', addRandomSuffix: true, contentType: 'model/gltf-binary' })).url;
          await redis([['SET', `forge:moves:v1:${blob.url}`, movesUrl]]);
        }
      } catch (e) { /* the rig works without weapon moves */ }
    }
    // v2.24 games pack (skeleton + the village games' moves); a worker built before the pack was uploaded makes none
    let gamesUrl = null;
    if (result.games) {
      try {
        const gm = await sandbox.readFileToBuffer({ path: `${JOB_DIR}/games.glb` });
        if (gm && gm.length) {
          gamesUrl = (await put(path.replace(/_forge_rig\.glb$/, '_forge_games.glb'), gm, { access: 'public', addRandomSuffix: true, contentType: 'model/gltf-binary' })).url;
          await redis([['SET', `forge:games:v1:${blob.url}`, gamesUrl], ...(Array.isArray(result.gamesClips) ? [['SET', `forge:games-clips:v1:${blob.url}`, JSON.stringify(result.gamesClips)]] : [])]);
        }
      } catch (e) { /* the rig works without the games pack (games fall back to its own clips) */ }
    }
    try { await sandbox.stop(); } catch (e) {}
    // a build whose gloves were forged keeps a list of its rigs (+ the one replaced now): all of them lead to the new file.
    // v2.37 so does an admin re-rig of a Saints player's build (the Forge's RE-RIG WITH THE LATEST RIGGER): its saved
    // character follows the new rig; Oct 25 a Chumpz player's too. Rebels and NPCs as before.
    const relink = fr.rigHistory?.length || (['human', 'ape'].includes(fr.options?.friend) && rec.output?.forgeRigGlbUrl);
    const links = relink ? [...new Set([...(fr.rigHistory || []), rec.output?.forgeRigGlbUrl])].filter((u) => BLOB.test(u || '') && u !== blob.url).slice(-20) : [];
    if (links.length) { try { await redis(links.map((u) => ['SET', `forge:rig-latest:v1:${u}`, blob.url])); } catch (e) {} }
    const at = new Date().toISOString(), gj = glovesJob(fr) ? (({ prev, ...g }) => g)(fr.gloves) : null;
    const next = await updateRigging(buildId, {
      status: 'succeeded', movesGlbUrl: movesUrl, gamesGlbUrl: gamesUrl, progress: 'done', forgeRigGlbUrl: blob.url, thumbUrl, bytes: glb.length, seconds: result.seconds,
      qa: result.qa || null, verdict: result.qa?.verdict || null, finishedAt: at, ...(links.length ? { rigHistory: links } : {}), ...(gj ? { gloves: { ...gj, doneAt: at, url: blob.url } } : {})
    }, { forgeRigGlbUrl: blob.url, ...(thumbUrl ? { forgeRigThumbUrl: thumbUrl } : {}) });
    // a paid forge keeps its points once a rig of a build made in its window finishes (not a gloves re-rig, not an NPC)
    if (!gj && rec.collectionKey && rec.collectionKey !== 'npc' && !fr.options?.npc && !rec.master001) {   // (#001's own body: an admin rig, never a forge)
      try { await keepForge(rec.collectionKey, String(rec.tokenId), Date.parse(rec.createdAt || '') || Date.now()); } catch (e) { console.warn('[forge-rig-status] keep', e.message); }
    }
    return res.status(200).json({ ok: true, forgeRig: next.forgeRig, forgeRigGlbUrl: blob.url, percent: 100 });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
