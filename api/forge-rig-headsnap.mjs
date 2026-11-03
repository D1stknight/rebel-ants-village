// Head / neck snaps mended in a LIVE rig (admin, Nov 3, for rigs made before rigger 2.44): the rig file and its weapon
// moves pack go through api/_rig-headsnap.mjs (only the neck / head keys of a turn-round or a one-key drop change; every
// other byte stays), are stored as new Blob files and linked as the head-cloth upgrade does: forge:rig-latest:v1:<old>
// -> new (the village, the Forge and the room tickets follow it), the moves / games packs on the new URL, the build
// record pointing at it. A rig with nothing to mend is left as it is (the note says so). No sandbox: a few seconds.
//   POST { buildId } -> { ok, status: 'mended' | 'clean', url, report }
//   GET  ?buildId=   -> { ok, headsnap } (the build record's note)
import { put } from '@vercel/blob';
import { isAdminRequest } from './_admin-auth.mjs';
import { redis, loadBuild, updateRigging, body } from './_forge-rig.mjs';
import { mendHeadSnaps } from './_rig-headsnap.mjs';

const BLOB = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//;
async function download(u) {
  const r = await fetch(u, { signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`could not download ${new URL(u).pathname.split('/').pop()} (${r.status})`);
  return new Uint8Array(await r.arrayBuffer());
}
// the new file's path: the old one without its random suffix (and any earlier _hs), then _hs
const pathFor = (u) => new URL(u).pathname.slice(1).replace(/(-[A-Za-z0-9]+)?\.glb$/, '').replace(/(_hs)+$/, '') + '_hs.glb';
const store = async (u, bytes) => (await put(pathFor(u), Buffer.from(bytes), { access: 'public', addRandomSuffix: true, contentType: 'model/gltf-binary' })).url;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!isAdminRequest(req)) return res.status(401).json({ ok: false, error: 'Admin only' });
  const b = body(req), buildId = String(req.query?.buildId || b.buildId || '');
  if (!/^build_[A-Za-z0-9_-]{4,80}$/.test(buildId)) return res.status(400).json({ ok: false, error: 'Missing buildId' });
  try {
    const rec = await loadBuild(buildId);
    if (req.method !== 'POST') return res.status(200).json({ ok: true, headsnap: rec.forgeRig?.headsnap || null });
    if (rec.forgeRig?.status === 'running') return res.status(409).json({ ok: false, error: 'A rig job is running for this character: try again when it is done' });
    const rig = rec.output?.forgeRigGlbUrl;
    if (!BLOB.test(rig || '')) return res.status(409).json({ ok: false, error: 'This build has no rig' });
    const [lock] = await redis([['SET', `forge:headsnap:lock:${buildId}`, '1', 'NX', 'EX', 90]]);
    if (lock?.result !== 'OK') return res.status(409).json({ ok: false, error: 'Already being mended' });
    try {
      const [mv, gm, gc] = await redis([['GET', `forge:moves:v1:${rig}`], ['GET', `forge:games:v1:${rig}`], ['GET', `forge:games-clips:v1:${rig}`]]);
      const movesUrl = BLOB.test(mv?.result || '') ? mv.result : null;
      const fixRig = mendHeadSnaps(await download(rig));
      const fixMoves = movesUrl ? mendHeadSnaps(await download(movesUrl)) : { buffer: null, report: { keys: 0, clips: {} } };
      const at = new Date().toISOString();
      if (!fixRig.buffer && !fixMoves.buffer) {
        const note = { at, keys: 0, clean: true, rig };
        await updateRigging(buildId, { headsnap: note });
        return res.status(200).json({ ok: true, status: 'clean', url: rig, report: note });
      }
      const newRig = fixRig.buffer ? await store(rig, fixRig.buffer) : rig;
      const newMoves = fixMoves.buffer ? await store(movesUrl, fixMoves.buffer) : movesUrl;
      const cmds = [];
      if (newRig !== rig) {
        cmds.push(['SET', `forge:rig-latest:v1:${rig}`, newRig]);
        if (gm?.result) cmds.push(['SET', `forge:games:v1:${newRig}`, gm.result]);
        if (gc?.result) cmds.push(['SET', `forge:games-clips:v1:${newRig}`, gc.result]);
      }
      if (newMoves) cmds.push(['SET', `forge:moves:v1:${newRig}`, newMoves]);
      await redis(cmds);
      const note = { at, from: rig, keys: fixRig.report.keys + fixMoves.report.keys, rigClips: fixRig.report.clips, movesClips: fixMoves.report.clips };
      await updateRigging(buildId, { headsnap: note, ...(newRig !== rig ? { forgeRigGlbUrl: newRig } : {}), ...(fixMoves.buffer ? { movesGlbUrl: newMoves } : {}) },
        newRig !== rig ? { forgeRigGlbUrl: newRig } : undefined);
      return res.status(200).json({ ok: true, status: 'mended', url: newRig, moves: newMoves, report: note });
    } finally {
      try { await redis([['DEL', `forge:headsnap:lock:${buildId}`]]); } catch (e) {}
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
