// Start the automated Forge Rigger for a stored Meshy build: POST {buildId, force?}
// Admin-only extras: sourceUrl (rig a different static GLB for this build, e.g. a TRELLIS.2 source in the repo) and
// skirtfix (TRELLIS mode: open-cloth cleanup, hand/skirt webbing cut, bridge faces cut) and headUp (degrees to raise
// the chin, for models whose mask sits low and reads as looking down) and headUrl (a separately generated head GLB,
// e.g. image-to-3D of the head crop, that replaces the body's own head before rigging), armorUrl + anchorsUrl (part-built
// characters: a separately generated armour set fitted onto the body) and cutBridges (cut hand-to-robe bridge faces).
// One rig per build (idempotent). Re-rigging an already rigged build (force) is admin-only.
// Rebel Forge gloves (Oct 18, rigger 2.33): POST {buildId, gloves: {Left, Right, glove, cuff}} (the NPC Forge hand fit)
// re-rigs a rigged Rebel with its holder's glove fit: same sculpt and rig options, today's worker, no Rebel Forge credits
// and no forge used (3 a day per Rebel). The Rebel's holder or an admin; never #001. A re-rig keeps the fit.
// Oct 20 (rigger 2.36): a build of a friend collection (Chumpz, Saints: assets/friend-collections.json) is rigged as a
// player with its species' body fixes (job.sh FORGE_FRIEND), never with the Rebels' head sizing.
import { isAdminRequest } from './_admin-auth.mjs';
import { getToken } from './_nft.mjs';
import { getCollection } from './_collections.mjs';
import { requireForgeStep, walletOf, holderOf } from './_wallet.mjs';
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
// a friend collection's species (ape / human) for its players' rigs, '' for the Rebels
async function friendSpeciesOf(rec) {
  try { const c = await getCollection(rec?.collectionKey || 'battle_for_colony'); return c?.friend ? c.species : ''; } catch (e) { return ''; }
}
const DAILY_LIMIT = parseInt(process.env.FORGE_RIG_DAILY_LIMIT || '200', 10);
// v2.18 NPC Forge hands panel: per hand offsets (fractions of the hand length) and size, glove / cuff colours (#rrggbb);
// v2.20 per hand cuff width and length (factors); v2.34 the width from 0.1 (the Rebel Forge's slim cuffs)
function cleanHandFit(h) {
  if (!h || typeof h !== 'object') return null;
  const side = (s) => {
    const o = h[s]; if (!o || typeof o !== 'object') return null;
    const n = (k, lo, hi, d) => { const v = Number(o[k]); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
    const r = { along: n('along', -0.6, 0.6, 0), thumb: n('thumb', -0.6, 0.6, 0), back: n('back', -0.6, 0.6, 0), size: n('size', 0.6, 1.5, 1), cuffSize: n('cuffSize', 0.1, 1.5, 1), cuffLen: n('cuffLen', 0.4, 1.6, 1) };
    return r.along || r.thumb || r.back || r.size !== 1 || r.cuffSize !== 1 || r.cuffLen !== 1 ? r : null;
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
// the job's env for a build's rig options
function optionEnv({ skirtfix, up, headUrl, armorUrl, anchorsUrl, cutBridges, hs, headAuto, npc, npcSpecies, friend, hf }) {
  return { ...(friend && !npc ? { FORGE_FRIEND: friend } : {}), ...(skirtfix ? { FORGE_SKIRTFIX: '1', FORGE_KEEP_TEAR: '', FORGE_KEEP_BRIDGE: '' } : {}), ...(up ? { FORGE_HEAD_UP: String(up) } : {}), ...(headUrl ? { FORGE_HEAD_URL: String(headUrl) } : {}), ...(armorUrl ? { FORGE_ARMOR_URL: String(armorUrl), FORGE_ANCHORS_URL: String(anchorsUrl) } : {}), ...(cutBridges && !skirtfix ? { FORGE_KEEP_TEAR: '', FORGE_KEEP_BRIDGE: '' } : {}), ...(hs !== null ? { FORGE_HEAD_SCALE: String(hs) } : {}), ...(headAuto ? { FORGE_HEAD_AUTO: '1' } : {}), ...(npc ? { FORGE_NPC: '1' } : {}), ...(npcSpecies ? { FORGE_NPC_SPECIES: npcSpecies } : {}), ...handFitEnv(hf) };
}
// one rig job in a fresh sandbox from the worker image
async function runJob(worker, buildId, src, name, env) {
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
    env: { SRC_URL: src, RIG_NAME: name, ...env },
    sudo: true,
    detached: true
  });
  return { sandbox, cmd };
}

// ---- Rebel Forge gloves ----
const GLOVES_DAILY = Math.max(1, parseInt(process.env.FORGE_GLOVES_DAILY || '3', 10));   // glove re-rigs per Rebel per day
const BLOB = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//;
const fitKey = (h) => JSON.stringify(cleanHandFit(h));   // null = the automatic gloves
const hexOf = (v) => (/^#[0-9a-f]{6}$/i.test(String(v || '')) ? String(v).toLowerCase() : null);
// #001 is the master: its gloves are never refitted
const isMaster = (rec) => (rec.collectionKey || 'battle_for_colony') === 'battle_for_colony' && /^0*1$/.test(String(rec.tokenId || ''));
async function startGloves(req, res, rec, buildId, admin, gloves) {
  const cur = rec.forgeRig || {}, rigUrl = rec.output?.forgeRigGlbUrl || '';
  if (cur.options?.npc) return res.status(400).json({ ok: false, error: 'NPC hands are fitted in the NPC Forge' });
  if (cur.options?.friend || (await friendSpeciesOf(rec))) return res.status(400).json({ ok: false, error: 'Chumpz and Saints keep the gloves they were forged with', code: 'friend_gloves' });
  if (isMaster(rec)) return res.status(403).json({ ok: false, error: 'Rebel #001 keeps its gloves', code: 'master' });
  if (!BLOB.test(rigUrl)) return res.status(409).json({ ok: false, error: 'Forge this Rebel first', code: 'no_rig' });
  if (cur.status === 'running') return res.status(200).json({ ok: true, forgeRig: cur, alreadyRunning: true });
  const hf = cleanHandFit(gloves);
  if (fitKey(hf) === fitKey(cur.options?.handFit)) return res.status(200).json({ ok: true, forgeRig: cur, alreadyDone: true });
  const col = rec.collectionKey || 'battle_for_colony', tok = String(rec.tokenId || '');
  if (!admin) {
    const wallet = walletOf(req);
    if (!wallet) return res.status(401).json({ ok: false, error: 'Sign in with your wallet to forge its gloves', code: 'wallet_required' });
    if (!/^\d{1,78}$/.test(tok)) return res.status(400).json({ ok: false, error: 'This build has no Rebel token', code: 'bad_token' });
    const h = await holderOf(col, tok, wallet, { fresh: true });
    if (!h.holder) return res.status(403).json({ ok: false, error: 'Only the wallet that holds this Rebel (or its delegate.xyz delegate) can forge its gloves', code: 'not_owner' });
    if (!(await enforceRateLimit(req, res, 'rig-gloves', 6, 86400, 'glove forgings today'))) return;
    const day = new Date().toISOString().slice(0, 10), rk = `forge:gloves:count:${col}:${tok}:${day}`, gk = `forge:rig:count:${day}`;
    const [n, , g] = await redis([['INCR', rk], ['EXPIRE', rk, 172800], ['INCR', gk], ['EXPIRE', gk, 172800]]);
    if (Number(n?.result || 0) > GLOVES_DAILY) return res.status(429).json({ ok: false, error: `A Rebel's gloves can be forged ${GLOVES_DAILY} times a day. Try again tomorrow.`, code: 'gloves_daily' });
    if (Number(g?.result || 0) > DAILY_LIMIT) return res.status(429).json({ ok: false, error: 'Daily rig limit reached, try again tomorrow' });
  }
  const lockKey = `forge:rig:start-lock:${buildId}`;
  const [lock] = await redis([['SET', lockKey, '1', 'NX', 'EX', 60]]);
  if (lock?.result !== 'OK') return res.status(409).json({ ok: false, error: 'These gloves are already being forged', code: 'starting' });
  try {
    const worker = await getJson(WORKER_KEY);
    if (!worker?.snapshotId) throw Object.assign(new Error('Rig worker is not built yet'), { status: 503 });
    // the rig as it was made (options, source), only the gloves new
    const o = cur.options || {}, hs = o.headScale == null || o.headScale === '' ? null : Number(o.headScale);
    const src = cur.sourceGlbUrl || sourceGlbUrl(rec);
    if (!src) throw Object.assign(new Error('Build has no stored GLB'), { status: 409 });
    const headAuto = hs === null ? await headAutoFor(rec) : false;
    const up = Number(o.headUp || 0);
    const { sandbox, cmd } = await runJob(worker, buildId, src, `rebel${sanitize(rec.tokenId || rec.rebelId, 'x')}`,
      optionEnv({ skirtfix: o.skirtfix, up, headUrl: o.headUrl, armorUrl: o.armorUrl, anchorsUrl: o.anchorsUrl, cutBridges: o.cutBridges, hs, headAuto, npc: false, npcSpecies: '', hf }));
    // prev: the rig as it is, put back if the job fails; rigHistory: every rig this build had, linked to the new one when
    // it is done (saved characters keep the URL they were saved with)
    const prev = { ...cur }; delete prev.gloves;
    const at = new Date().toISOString();
    // the sculpt's own glove / cuff colours (the Forge's "Forged" swatch once a rig has other colours): sent by the page
    // while the rig still has them
    const was = cur.options?.handFit || {}, sent = (gloves && typeof gloves === 'object' && gloves.auto) || {};
    const autoColors = { glove: cur.autoColors?.glove || (!was.glove && hexOf(sent.glove)) || null, cuff: cur.autoColors?.cuff || (!was.cuff && hexOf(sent.cuff)) || null };
    const next = await updateRigging(buildId, {
      engine: 'forge-rigger', status: 'running', progress: 'starting', sandboxName: sandbox.name, cmdId: cmd.cmdId,
      workerCommit: worker.commit || null, sourceGlbUrl: src,
      options: { ...o, headUp: up, headScale: hs, headAuto, npc: false, handFit: hf, species: null },
      gloves: { from: rigUrl, by: admin ? 'admin' : 'holder', startedAt: at, prev },
      rigHistory: [...new Set([...(cur.rigHistory || []), rigUrl])].filter((u) => BLOB.test(u)).slice(-20), autoColors,
      startedAt: at, finishedAt: null, error: null
    });
    try { await redis([['SADD', 'forge:pending:v1', String(buildId)]]); } catch (e) {}
    const { prev: _p, ...g } = next.forgeRig.gloves;
    return res.status(200).json({ ok: true, forgeRig: { ...next.forgeRig, gloves: g } });
  } catch (err) {
    try { await redis([['DEL', lockKey]]); } catch (e) {}
    return res.status(err.status || 500).json({ ok: false, error: err?.message || String(err) });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const { buildId, force, sourceUrl, skirtfix, headUp, headUrl, armorUrl, anchorsUrl, cutBridges, headScale, npc, handFit, species, gloves } = body(req);
  if (!buildId) return res.status(400).json({ ok: false, error: 'Missing buildId' });
  try {
    const rec = await loadBuild(buildId);
    const admin = isAdminRequest(req);
    if (gloves !== undefined) return await startGloves(req, res, rec, buildId, admin, gloves);
    if ((sourceUrl || skirtfix || headUp || headUrl || armorUrl || anchorsUrl || cutBridges || headScale || npc || handFit) && !admin) return res.status(401).json({ ok: false, error: 'sourceUrl / skirtfix / headUp / headUrl / armorUrl / anchorsUrl / cutBridges / headScale / npc / handFit require admin' });
    const hs = headScale == null || headScale === '' ? null : Number(headScale); if (hs !== null && (!Number.isFinite(hs) || hs < 0.8 || hs > 1.1)) return res.status(400).json({ ok: false, error: 'headScale must be 0.8..1.1' });
    const up = Number(headUp || 0); if (!Number.isFinite(up) || up < -20 || up > 25) return res.status(400).json({ ok: false, error: 'headUp must be -20..25 degrees' });
    if (sourceUrl && !SOURCE_OK.test(String(sourceUrl))) return res.status(400).json({ ok: false, error: 'sourceUrl must be a GLB in this repo or our Blob store' });
    if (headUrl && !SOURCE_OK.test(String(headUrl))) return res.status(400).json({ ok: false, error: 'headUrl must be a GLB in this repo or our Blob store' });
    if (armorUrl && !SOURCE_OK.test(String(armorUrl))) return res.status(400).json({ ok: false, error: 'armorUrl must be a GLB in this repo or our Blob store' });
    if (!!armorUrl !== !!anchorsUrl || (anchorsUrl && !ANCHORS_OK.test(String(anchorsUrl)))) return res.status(400).json({ ok: false, error: 'armorUrl needs anchorsUrl (a .json in assets/forge/sources)' });
    const src = sourceUrl || sourceGlbUrl(rec);
    if (!src) return res.status(409).json({ ok: false, error: 'Build has no stored GLB yet (run forge-3d-store-glb first)' });
    const cur = rec.forgeRig || {};
    // v2.18 the NPC Forge's hand fit; a Rebel's re-rig keeps the gloves its holder forged (Rebel Forge gloves)
    const hf = npc ? cleanHandFit(handFit) : cleanHandFit(handFit !== undefined ? handFit : cur.options?.handFit);
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
    const friend = npc ? '' : await friendSpeciesOf(rec);   // v2.36 Chumpz / Saints players
    const headAuto = hs === null && !npc && !friend ? await headAutoFor(rec) : false;
    // v2.23 NPC species (the NPC Forge's collection): Chumpz are apes, Saints are humans, from the page or the NPC's key
    // (chumpz_ / saints_). Only those get FORGE_NPC_SPECIES; Rebel villagers (ants) run exactly as before.
    const npcSpecies = !npc ? '' : ['ape', 'human'].includes(String(species)) ? String(species) : String(species) === 'ant' ? '' : /^chumpz_/.test(rec.tokenId || '') ? 'ape' : /^saints_/.test(rec.tokenId || '') ? 'human' : '';
    const { sandbox, cmd } = await runJob(worker, buildId, src, name, optionEnv({ skirtfix, up, headUrl, armorUrl, anchorsUrl, cutBridges, hs, headAuto, npc, npcSpecies, friend, hf }));
    const next = await updateRigging(buildId, {
      engine: 'forge-rigger',
      status: 'running',
      progress: 'starting',
      sandboxName: sandbox.name,
      cmdId: cmd.cmdId,
      workerCommit: worker.commit || null,
      sourceGlbUrl: src,
      options: { skirtfix: !!skirtfix, headUp: up || 0, headUrl: headUrl || null, armorUrl: armorUrl || null, anchorsUrl: anchorsUrl || null, cutBridges: !!cutBridges, headScale: hs, headAuto, npc: !!npc, handFit: hf, species: npcSpecies || null, friend: friend || null },
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
