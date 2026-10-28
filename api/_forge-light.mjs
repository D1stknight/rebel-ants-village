// Light copies of Forge rigs, for crowds (multiplayer, Oct 28). Universe draws other players beyond the nearest few with
// one (assets/village-multiplayer.js): the same character at about a fifteenth of its triangles, its picture at 256 px,
// 22 joints (the fingers onto the hands, antennae and the jaw onto the head, the skirt chains onto the hips, toes onto the
// feet), and only the moves seen from afar: idle, walk, run, jump and the emotes (from the rig's games pack), a key every
// 1/15 s. Made once per rig by api/forge-light.mjs; tools/make-light.mjs makes the starter ant's from its files.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, compactPrimitive, prune, resample, dedup } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

export const LIGHT_VERSION = 1;
export const LIGHT_CLIPS = ['idle', 'walk', 'run', 'jump'];
export const LIGHT_PACK_CLIPS = ['game_cheer', 'dance_wave', 'dance_tut', 'dance_house', 'dance_gangnam'];
export const LIGHT_JOINTS = ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head',
  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'].map((n) => 'mixamorig_' + n);

export function lightIO(deps = null) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  if (deps) io.registerDependencies(deps);
  return io;
}

// moves from another file of the same skeleton (the games pack; the starter ant's move files): its clips named in
// `clips` ({ name in that file: name here }) onto this file's nodes, by node name
async function mergeClips(io, doc, bytes, clips) {
  const src = await io.readBinary(bytes), root = doc.getRoot(), buf = root.listBuffers()[0];
  const byName = new Map(root.listNodes().map((n) => [n.getName(), n]));
  for (const a of src.getRoot().listAnimations()) {
    const name = clips[a.getName()]; if (!name) continue;
    if (root.listAnimations().some((x) => x.getName() === name)) continue;
    const na = doc.createAnimation(name);
    for (const ch of a.listChannels()) {
      const node = byName.get(ch.getTargetNode()?.getName()); if (!node) continue;
      const s = ch.getSampler(), inp = s.getInput(), out = s.getOutput();
      const ni = doc.createAccessor().setType(inp.getType()).setArray(inp.getArray().slice()).setBuffer(buf);
      const no = doc.createAccessor().setType(out.getType()).setArray(out.getArray().slice()).setBuffer(buf);
      const ns = doc.createAnimationSampler().setInput(ni).setOutput(no).setInterpolation(s.getInterpolation());
      na.addSampler(ns); na.addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(ch.getTargetPath()).setSampler(ns));
    }
  }
}
// smooth normals for an indexed primitive: each corner's face normal (area-weighted) summed at its position, so the
// shading runs on across UV seams
function smoothNormals(doc, prim) {
  const P = prim.getAttribute('POSITION'), I = prim.getIndices(); if (!P || !I) return;
  const pos = P.getArray(), idx = I.getArray(), n = P.getCount(), key = new Array(n), sums = new Map();
  for (let i = 0; i < n; i++) key[i] = pos[i * 3].toFixed(5) + ',' + pos[i * 3 + 1].toFixed(5) + ',' + pos[i * 3 + 2].toFixed(5);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const v of [idx[t], idx[t + 1], idx[t + 2]]) { const s = sums.get(key[v]) || [0, 0, 0]; s[0] += nx; s[1] += ny; s[2] += nz; sums.set(key[v], s); }
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const s = sums.get(key[i]) || [0, 1, 0], l = Math.hypot(s[0], s[1], s[2]) || 1; out[i * 3] = s[0] / l; out[i * 3 + 1] = s[1] / l; out[i * 3 + 2] = s[2] / l; }
  prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(out).setBuffer(doc.getRoot().listBuffers()[0]));
}
const dropAnimation = (a) => { a.listChannels().forEach((c) => c.dispose()); a.listSamplers().forEach((s) => s.dispose()); a.dispose(); };

// rigBytes: the rig's GLB. opts: pack (the games pack's bytes), more ([{ bytes, clips }]: other files' moves), rename
// ({ clip: new name } for this file's own), inPlace (no hip travel: the starter ant), tris (about how many are kept) within
// error (of the model's size), flags (meshoptimizer's: Permissive, Prune ...), seams ('protect': a texture seam keeps its
// place (its vertices only slide along it), 'free': collapses cross it), uv (how much the texture's stretch counts), fps, tex
export async function makeLight(rigBytes, { pack = null, more = [], rename = {}, inPlace = false, tris: target = 6000, error = 0.03, flags = ['Permissive'], seams = 'protect', uv = 0.5, fps = 15, tex = 256, io = lightIO() } = {}) {
  await MeshoptSimplifier.ready;
  const doc = await io.readBinary(rigBytes), root = doc.getRoot();
  for (const a of root.listAnimations()) if (rename[a.getName()]) a.setName(rename[a.getName()]);
  const skin = root.listSkins()[0]; if (!skin) throw new Error('no skin');
  const joints = skin.listJoints();
  const keep = new Set(LIGHT_JOINTS.map((n) => joints.find((j) => j.getName() === n)).filter(Boolean));
  if (keep.size < LIGHT_JOINTS.length) throw new Error('not a Mixamo skeleton (' + keep.size + ' of ' + LIGHT_JOINTS.length + ' joints)');
  for (const m of more) await mergeClips(io, doc, m.bytes, m.clips);
  if (pack) await mergeClips(io, doc, pack, Object.fromEntries(LIGHT_PACK_CLIPS.map((n) => [n, n])));
  // every joint onto its nearest kept ancestor
  const parentOf = new Map();
  for (const n of root.listNodes()) for (const c of n.listChildren()) parentOf.set(c, n);
  const keptOf = (j) => { let n = j; while (n && !keep.has(n)) n = parentOf.get(n); return n || null; };
  const kept = [...keep], idx = new Map(kept.map((j, i) => [j, i]));
  const map = joints.map((j) => { const k = keptOf(j); return k ? idx.get(k) : 0; });
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    const J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0'); if (!J || !W) continue;
    if (prim.getAttribute('JOINTS_1')) { prim.setAttribute('JOINTS_1', null); prim.setAttribute('WEIGHTS_1', null); }
    const n = J.getCount(), ja = new Uint8Array(n * 4), wa = new Float32Array(n * 4), jv = [0, 0, 0, 0], wv = [0, 0, 0, 0];
    for (let i = 0; i < n; i++) {
      J.getElement(i, jv); W.getElement(i, wv);
      const acc = new Map();
      for (let k = 0; k < 4; k++) if (wv[k] > 0) { const t = map[jv[k]] ?? 0; acc.set(t, (acc.get(t) || 0) + wv[k]); }
      const top = [...acc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4), s = top.reduce((a, e) => a + e[1], 0);
      if (!top.length || !(s > 0)) { ja[i * 4] = 0; wa[i * 4] = 1; continue; }
      top.forEach(([t, w], k) => { ja[i * 4 + k] = t; wa[i * 4 + k] = w / s; });
    }
    J.setArray(ja); W.setArray(wa);
  }
  const ibm = skin.getInverseBindMatrices();
  if (ibm) { const old = ibm.getArray(), nb = new Float32Array(kept.length * 16); kept.forEach((j, i) => { const k = joints.indexOf(j); nb.set(old.subarray(k * 16, k * 16 + 16), i * 16); }); ibm.setArray(nb); }
  for (const j of joints) skin.removeJoint(j);
  for (const j of kept) skin.addJoint(j);
  // the moves seen from afar: the kept joints' turns (and the hips' travel), a key every 1/fps s
  const want = new Set([...LIGHT_CLIPS, ...LIGHT_PACK_CLIPS]);
  for (const a of root.listAnimations()) {
    if (!want.has(a.getName())) { dropAnimation(a); continue; }
    for (const ch of a.listChannels()) {
      const node = ch.getTargetNode(), path = ch.getTargetPath(), s = ch.getSampler();
      const hips = node?.getName() === 'mixamorig_Hips';
      if (!keep.has(node) || path === 'scale' || path === 'weights' || (path === 'translation' && (!hips || inPlace))) { ch.dispose(); s.dispose(); continue; }
      const inp = s.getInput(), out = s.getOutput(), ti = inp.getArray(), to = out.getArray(), w = out.getElementSize();
      if (s.getInterpolation() === 'CUBICSPLINE') continue; // (none in Forge rigs; left as they are)
      const ks = []; let last = -1e9;
      for (let k = 0; k < ti.length; k++) if (ti[k] - last >= 1 / fps - 1e-4 || k === ti.length - 1) { ks.push(k); last = ti[k]; }
      const nt = new Float32Array(ks.length), nv = new Float32Array(ks.length * w);
      ks.forEach((k, i) => { nt[i] = ti[k]; for (let e = 0; e < w; e++) nv[i * w + e] = to[k * w + e]; });
      inp.setArray(nt); out.setArray(nv);
    }
  }
  for (const n of root.listNodes()) if (joints.includes(n) && !keep.has(n)) n.dispose();
  // the picture small, the other maps gone (far away nobody sees a normal map)
  for (const m of root.listMaterials()) {
    m.setNormalTexture(null); m.setOcclusionTexture(null); m.setEmissiveTexture(null); m.setMetallicRoughnessTexture(null);
    m.setMetallicFactor(0); m.setRoughnessFactor(Math.max(0.7, m.getRoughnessFactor()));
    const t = m.getBaseColorTexture(); if (!t || !t.getImage()) continue;
    const img = sharp(Buffer.from(t.getImage())), meta = await img.metadata();
    const small = img.resize(Math.min(tex, meta.width || tex), Math.min(tex, meta.height || tex), { fit: 'fill' });
    const out = meta.hasAlpha ? await small.png({ compressionLevel: 9, palette: true }).toBuffer() : await small.jpeg({ quality: 82 }).toBuffer();
    t.setImage(new Uint8Array(out)).setMimeType(meta.hasAlpha ? 'image/png' : 'image/jpeg');
  }
  for (const e of root.listExtensionsUsed()) if (e.extensionName === 'KHR_draco_mesh_compression') e.dispose(); // (written plain: small already)
  // fewer triangles: the normals go before the welding (split normals keep a mesh in islands the simplifier can't join)
  // and come back smooth. Permissive lets collapses cross attribute seams; seams 'protect' keeps a texture seam's vertices
  // on it (they only slide along it), else a triangle spans two places of the picture (blotches). A Forge rig comes down
  // to the ~6k asked for; the starter ant's 1,300 islands of seams keep it at ~18k (of 553k)
  const prims = []; let all = 0;
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) { if (p.getAttribute('NORMAL')) p.setAttribute('NORMAL', null); prims.push(p); }
  await doc.transform(weld());
  for (const p of prims) all += (p.getIndices()?.getCount() || 0) / 3;
  const ratio = Math.min(0.5, Math.max(0.004, target / Math.max(1, all)));
  for (const p of prims) {
    const I = p.getIndices(), P = p.getAttribute('POSITION'); if (!I || !P) continue;
    const idx = new Uint32Array(I.getArray()), want3 = Math.max(3, Math.floor(idx.length * ratio / 3) * 3), pos = new Float32Array(P.getArray());
    const T = p.getAttribute('TEXCOORD_0'), n = P.getCount();
    let lock = null, attrs = null;
    if (seams === 'protect' && T) {
      const at = new Map(); lock = new Uint8Array(n);
      for (let i = 0; i < n; i++) { const k = pos[i * 3] + ',' + pos[i * 3 + 1] + ',' + pos[i * 3 + 2]; const o = at.get(k); if (o === undefined) at.set(k, i); else lock[i] = lock[o] = 2; }
    }
    if (T && uv > 0) attrs = new Float32Array(T.getArray());
    const [out] = attrs || lock
      ? MeshoptSimplifier.simplifyWithAttributes(idx, pos, 3, attrs || new Float32Array(n * 2), 2, attrs ? [uv, uv] : [0, 0], lock, want3, error, flags)
      : MeshoptSimplifier.simplify(idx, pos, 3, want3, error, flags);
    I.setArray(out.length < 65536 * 3 ? new Uint32Array(out) : out);
    compactPrimitive(p);
    smoothNormals(doc, p);
  }
  await doc.transform(resample({ tolerance: 2e-3 }), dedup(), prune());
  const glb = await io.writeBinary(doc);
  let tris = 0; for (const m of root.listMeshes()) for (const p of m.listPrimitives()) tris += (p.getIndices()?.getCount() || 0) / 3;
  return { glb, info: { bytes: glb.length, tris, joints: skin.listJoints().length, clips: root.listAnimations().map((a) => a.getName()) } };
}
