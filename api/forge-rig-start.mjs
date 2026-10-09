// Start the automated Forge Rigger for a stored Meshy build: POST {buildId, force?}
// Admin-only extras: sourceUrl (rig a different static GLB for this build, e.g. a TRELLIS.2 source in the repo) and
// skirtfix (TRELLIS mode: open-cloth cleanup, hand/skirt webbing cut, bridge faces cut) and headUp (degrees to raise
// the chin, for models whose mask sits low and reads as looking down) and headUrl (a separately generated head GLB,
// e.g. image-to-3D of the head crop, that replaces the body's own head before rigging), armorUrl + anchorsUrl (part-built
// characters: a separately generated armour set fitted onto the body) and cutBridges (cut hand-to-robe bridge faces).
// One rig per build (idempotent). Re-rigging an already rigged build (force) is admin-only.
import { isAdminRequest } from './_admin-auth.mjs';
import { getToken } from './_nft.mjs';
import { requireForgeStep } from './_wallet.mjs';
import { enforceRateLimit } from './_guard.mjs';
import { Sandbox, creds, WORKER_KEY, FW, JOB_DIR, JOB_TIMEOUT_MS, redis, getJson, loadBuild, updateRigging, sourceGlbUrl, sanitize, body } from './_forge-rig.mjs';

const SOURCE_OK = /^https:\/\/(raw\.githubusercontent\.com\/D1stknight\/rebel-ants-village\/[\w.-]+\/assets\/forge\/sources\/[\w.-]+\.glb|[a-z0-9]+\.public\.blob\.vercel-storage\.com\/[\w./-]+\.glb)$/;
const ANCHORS_OK = /^https:\/\/raw\.githubusercontent\.com\/D1stknight\/rebel-ants-village\/[\w.-]+\/assets\/forge\/sources\/[\w.-]+\.json$/;
// v2.9 head size: only plain and hair heads are checked against #262. A helmet, hood, space helmet or mask (full face
// or ninja wrap) means the head is never touched. Unknown traits -> not checked.
async function headAutoFor(rec) {
  try {
    if (!rec?.tokenId) return false;
    const tok = await getToken(rec.collectionKey || 'battle_for_colony', String(rec.tokenId));
    if (!tok?.traits?.length) return false;
    const tr = Object.fromEntries(tok.traits.map((x) => [x.trait_type, String(x.value || '')]));
    const has = (k) => tr[k] && !/^none$/i.test(tr[k]);
    const gear = has('Ranger Helmets') || has('Full Face Masks') || has('Ninja Masks') || /Kimono-Head/i.test(tr['Heads'] || '') || /Helmet|Hat/i.test(tr['Head Accessories'] || '');
    return !gear;
  } catch (e) { return false; }
}
const DAILY_LIMIT = parseInt(process.env.FORGE_RIG_DAILY_LIMIT || '200', 10);
// v2.18 NPC Forge hands panel: per hand offsets (fractions of the hand length) and size, glove / cuff colours (#rrggbb)
function cleanHandFit(h) {
  if (!h || typeof h !== 'object') return null;
  const side = (s) => {
    const o = h[s]; if (!o || typeof o !== 'object') return null;
    const n = (k, lo, hi, d) => { const v = Number(o[k]); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
    const r = { along: n('along', -0.6, 0.6, 0), thumb: n('thumb', -0.6, 0.6, 0), back: n('back', -0.6, 0.6, 0), size: n('size', 0.6, 1.5, 1) };
    return r.along || r.thumb || r.back || r.size !== 1 ? r : null;
  };
  const hex = (v) => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v).toLowerCase() : null);
  const out = { Left: side('Left'), Right: side('Right'), glove: hex(h.glove), cuff: hex(h.cuff) };
  return out.Left || out.Right || out.glove || out.cuff ? out : null;
}
const srgb01 = (hex) => { const x = parseInt(hex.slice(1), 16); return [(x >> 16) & 255, (x >> 8) & 255, x & 255].map((c) => (c / 255).toFixed(3)).join(','); };
function handFitEnv(hf) {
  if (!hf) return {};
  const fit = { ...(hf.Left ? { Left: hf.Left } : {}), ...(hf.Right ? { Right: hf.Right } : {}) };
  return { ...(Object.keys(fit).length ? { FORGE_HAND_FIT: JSON.stringify(fit) } : {}), ...(hf.glove ? { FORGE_GLOVE_RGB: srgb01(hf.glove) } : {}), ...(hf.cuff ? { FORGE_CUFF_RGB: srgb01(hf.cuff) } : {}) };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const { buildId, force, sourceUrl, skirtfix, headUp, headUrl, armorUrl, anchorsUrl, cutBridges, headScale, npc, handFit } = body(req);
  if (!buildId) return res.status(400).json({ ok: false, error: 'Missing buildId' });
  try {
    const rec = await loadBuild(buildId);
    const admin = isAdminRequest(req);
    if ((sourceUrl || skirtfix || headUp || headUrl || armorUrl || anchorsUrl || cutBridges || headScale || npc || handFit) && !admin) return res.status(401).json({ ok: false, error: 'sourceUrl / skirtfix / headUp / headUrl / armorUrl / anchorsUrl / cutBridges / headScale / npc / handFit require admin' });
    const hf = npc ? cleanHandFit(handFit) : null;
    const hs = headScale == null || headScale === '' ? null : Number(headScale); if (hs !== null && (!Number.isFinite(hs) || hs < 0.8 || hs > 1.1)) return res.status(400).json({ ok: false, error: 'headScale must be 0.8..1.1' });
    const up = Number(headUp || 0); if (!Number.isFinite(up) || up < -20 || up > 25) return res.status(400).json({ ok: false, error: 'headUp must be -20..25 degrees' });
    if (sourceUrl && !SOURCE_OK.test(String(sourceUrl))) return res.status(400).json({ ok: false, error: 'sourceUrl must be a GLB in this repo or our Blob store' });
    if (headUrl && !SOURCE_OK.test(String(headUrl))) return res.status(400).json({ ok: false, error: 'headUrl must be a GLB in this repo or our Blob store' });
    if (armorUrl && !SOURCE_OK.test(String(armorUrl))) return res.status(400).json({ ok: false, error: 'armorUrl must be a GLB in this repo or our Blob store' });
    if (!!armorUrl !== !!anchorsUrl || (anchorsUrl && !ANCHORS_OK.test(String(anchorsUrl)))) return res.status(400).json({ ok: false, error: 'armorUrl needs anchorsUrl (a .json in assets/forge/sources)' });
    const src = sourceUrl || sourceGlbUrl(rec);
    if (!src) return res.status(409).json({ ok: false, error: 'Build has no stored GLB yet (run forge-3d-store-glb first)' });
    const cur = rec.forgeRig || {};
    if (cur.status === 'running' && !(force && admin)) return res.status(200).json({ ok: true, forgeRig: cur, alreadyRunning: true });
    if (cur.status === 'succeeded' && !(force && admin)) return res.status(200).json({ ok: true, forgeRig: cur, alreadyDone: true });
    if (force && !admin) return res.status(401).json({ ok: false, error: 'Re-rigging requires admin' });

    // Phase 0: per-visitor limit first (so one visitor can't burn the global cap), then the global daily cap. Admins skip both.
    if (!admin) {
      // Phase 2: only inside a forge the Rebel's owner started
      if (!(await requireForgeStep(req, res, { collectionKey: rec.collectionKey, tokenId: rec.tokenId, step: 'rig' }))) return;
      if (!(await enforceRateLimit(req, res, 'rig-start', 6, 86400, 'rig jobs today'))) return;
      const day = new Date().toISOString().slice(0, 10);
      const [cnt] = await redis([['INCR', `forge:rig:count:${day}`], ['EXPIRE', `forge:rig:count:${day}`, 172800]]);
      if (Number(cnt?.result || 0) > DAILY_LIMIT) return res.status(429).json({ ok: false, error: 'Daily rig limit reached, try again tomorrow' });
    }

    const worker = await getJson(WORKER_KEY);
    if (!worker?.snapshotId) return res.status(503).json({ ok: false, error: 'Rig worker is not built yet' });

    // v2.13 NPC Forge (admin): the NPC clip set instead of the fight / weapon moves (job.sh FORGE_NPC)
    const name = npc ? `npc_${sanitize(rec.tokenId || rec.rebelId, 'x')}` : `rebel${sanitize(rec.tokenId || rec.rebelId, 'x')}`;
    const headAuto = hs === null && !npc ? await headAutoFor(rec) : false;
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
      env: { SRC_URL: src, RIG_NAME: name, ...(skirtfix ? { FORGE_SKIRTFIX: '1', FORGE_KEEP_TEAR: '', FORGE_KEEP_BRIDGE: '' } : {}), ...(up ? { FORGE_HEAD_UP: String(up) } : {}), ...(headUrl ? { FORGE_HEAD_URL: String(headUrl) } : {}), ...(armorUrl ? { FORGE_ARMOR_URL: String(armorUrl), FORGE_ANCHORS_URL: String(anchorsUrl) } : {}), ...(cutBridges && !skirtfix ? { FORGE_KEEP_TEAR: '', FORGE_KEEP_BRIDGE: '' } : {}), ...(hs !== null ? { FORGE_HEAD_SCALE: String(hs) } : {}), ...(headAuto ? { FORGE_HEAD_AUTO: '1' } : {}), ...(npc ? { FORGE_NPC: '1' } : {}), ...handFitEnv(hf) },
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
      options: { skirtfix: !!skirtfix, headUp: up || 0, headUrl: headUrl || null, armorUrl: armorUrl || null, anchorsUrl: anchorsUrl || null, cutBridges: !!cutBridges, headScale: hs, headAuto, npc: !!npc, handFit: hf },
      startedAt: new Date().toISOString(),
      finishedAt: null,
      error: null
    });
    try { await redis([['SADD', 'forge:pending:v1', String(buildId)]]); } catch (e) {}   // Phase 2: the finisher collects the result
    return res.status(200).json({ ok: true, forgeRig: next.forgeRig });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
