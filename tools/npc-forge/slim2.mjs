// Forge Rigger rig.glb -> village NPC GLB: resample animation, dedup, prune, Draco mesh compression
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS, KHRDracoMeshCompression } from '@gltf-transform/extensions'; import { resample, prune, dedup, draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf'; import fs from 'fs';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule(), 'draco3d.encoder': await draco3d.createEncoderModule() });
const [src, out, tol] = process.argv.slice(2); const doc = await io.read(src);
const drop = (process.env.DROP || '').split(',').filter(Boolean); doc.getRoot().listAnimations().forEach(a => { if (drop.includes(a.getName())) a.dispose(); });
// tracks that sit at the node's rest value in every clip carry nothing (Blender bakes T/R/S for every bone): drop them.
// A track is kept everywhere if any clip moves it, so switching clips never leaves a bone in the last clip's pose.
{ const byKey = new Map();
  for (const a of doc.getRoot().listAnimations()) for (const c of a.listChannels()) { const k = c.getTargetNode(); const key = k.getName() + '|' + c.getTargetPath(); if (!byKey.has(key)) byKey.set(key, { node: k, path: c.getTargetPath(), list: [] }); byKey.get(key).list.push([a, c]); }
  let dropped = 0;
  for (const { node, path, list } of byKey.values()) {
    const rest = path === 'translation' ? node.getTranslation() : path === 'rotation' ? node.getRotation() : path === 'scale' ? node.getScale() : null; if (!rest) continue;
    const eps = path === 'rotation' ? 2e-4 : path === 'scale' ? 1e-4 : 1e-4 * Math.max(1e-3, Math.hypot(...rest));
    const atRest = list.every(([, c]) => { const o = c.getSampler().getOutput().getArray(), n = rest.length; for (let i = 0; i < o.length; i += n) { let d = 0; for (let k = 0; k < n; k++) d = Math.max(d, Math.abs(o[i + k] - rest[k])); if (path === 'rotation') { let d2 = 0; for (let k = 0; k < n; k++) d2 = Math.max(d2, Math.abs(-o[i + k] - rest[k])); d = Math.min(d, d2); } if (d > eps) return false; } return true; });
    if (atRest) for (const [a, c] of list) { const s_ = c.getSampler(); c.dispose(); if (!s_.listParents().some(p => p.propertyType === 'AnimationChannel')) s_.dispose(); dropped++; }
  }
  console.log('static tracks dropped', dropped); }
// keyframe reduction: 2e-4 keeps the small motion (idle breathing, arm sway, gesture accents). 3e-3 flattened the idle
// into a frozen pose (slow curves fall under the tolerance one key at a time); Rebels keep every key.
await doc.transform(resample({ tolerance: Number(tol || 2e-4) }), dedup(), prune({ keepLeaves: true }));
if (process.env.DMODE === 'fn') await doc.transform(draco({ method: 'edgebreaker' })); else doc.createExtension(KHRDracoMeshCompression).setRequired(true).setEncoderOptions({ method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER, encodeSpeed: 5, decodeSpeed: 5 });
if (process.env.HEIGHT) { // the rigger normalises to 1.8 m; scale the root so the model keeps its old village height (saved layouts keep their modelScale)
  const k = Number(process.env.HEIGHT) / 1.8; for (const n of doc.getRoot().listScenes()[0].listChildren()) { const s_ = n.getScale(); n.setScale([s_[0] * k, s_[1] * k, s_[2] * k]); const t_ = n.getTranslation(); n.setTranslation([t_[0] * k, t_[1] * k, t_[2] * k]); } }
await io.write(out, doc);
const R = doc.getRoot(); console.log((fs.statSync(src).size / 1048576).toFixed(2), '->', (fs.statSync(out).size / 1048576).toFixed(2), 'MB | joints', R.listSkins()[0]?.listJoints().length, 'clips', R.listAnimations().length);
