// Rebel #001's source for the Forge Rigger (Oct 26, rigger 2.40): the starter ant (assets/character/ant_idle_c.glb, the
// master every Forge rig takes its idle / walk / run from) as a plain mesh in the Forge A-pose, plus its own skeleton's
// joints in the rigger's frame. api/forge-rig-start.mjs ({ rebel001: true }, admin) rigs it with those joints
// (FORGE_JOINTS): the silhouette landmarks put #001's right shoulder 9-10 cm back toward its quiver and the arm tore
// the side open.
//   node tools/make-rebel001-source.mjs [in.glb] [out.glb] [joints.json]
//   defaults: assets/character/ant_idle_c.glb -> assets/forge/sources/rebel001_apose.glb + rebel001_apose.joints.json
//   ARM_DEG (default 40): each arm's angle from straight down (the Forge's A-pose)
// The mesh: the skinned positions and normals at the skeleton's rest with both arms turned out at the shoulder, skinned
// with the model's own weights; no skin, joints, animation or Draco (the worker's Blender has no Draco decoder).
import fs from 'fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';

const [IN = 'assets/character/ant_idle_c.glb', OUT = 'assets/forge/sources/rebel001_apose.glb', JOINTS = OUT.replace(/\.glb$/, '.joints.json')] = process.argv.slice(2);
const ARM_DEG = +(process.env.ARM_DEG || 40);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule() });
const doc = await io.read(IN);
const root = doc.getRoot();
const meshNode = root.listNodes().find((n) => n.getMesh() && n.getSkin());
const skin = meshNode.getSkin(), joints = skin.listJoints(), ibmA = skin.getInverseBindMatrices();
const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; };
const wpos = (n) => { const m = n.getWorldMatrix(); return [m[12], m[13], m[14]]; };
const byName = Object.fromEntries(root.listNodes().map((n) => [n.getName(), n]));

// A-pose: the whole arm turned about the front axis (z) at its shoulder joint, so hand-to-shoulder points ARM_DEG off
// straight down (elbow straight, as in the Forge's renders)
const pose = new Map();   // joint -> world pivot rotation (4x4, column-major)
for (const side of ['Left', 'Right']) {
  const arm = byName['mixamorig_' + side + 'Arm'], hand = byName['mixamorig_' + side + 'Hand'];
  const a = wpos(arm), h = wpos(hand), dx = h[0] - a[0], dy = h[1] - a[1];
  const now = Math.atan2(dx, -dy), th = Math.sign(dx) * ARM_DEG * Math.PI / 180 - now;
  const c = Math.cos(th), s = Math.sin(th);
  const T = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
  const M = mul(T(a[0], a[1], a[2]), mul([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], T(-a[0], -a[1], -a[2])));
  const walk = (n) => { pose.set(n, M); n.listChildren().forEach(walk); }; walk(arm);
  console.log(side, 'arm from straight down', (now * 180 / Math.PI).toFixed(1), '->', ARM_DEG, 'deg');
}
const J = joints.map((j, i) => { const ibm = new Array(16); ibmA.getElement(i, ibm); const W = j.getWorldMatrix(); return mul(pose.has(j) ? mul(pose.get(j), W) : W, ibm); });
// the joints' posed world positions, read before the skeleton is removed
const JPOS = new Map(joints.map((j) => { const W = pose.has(j) ? mul(pose.get(j), j.getWorldMatrix()) : j.getWorldMatrix(); return [j.getName(), [W[12], W[13], W[14]]]; }));

// skin every vertex (positions and normals) with its four weights
const prim = meshNode.getMesh().listPrimitives()[0];
const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL'), JA = prim.getAttribute('JOINTS_0'), WA = prim.getAttribute('WEIGHTS_0');
const n = P.getCount(), outP = new Float32Array(n * 3), outN = new Float32Array(n * 3);
const v = [0, 0, 0], nv = [0, 0, 0], jj = [0, 0, 0, 0], ww = [0, 0, 0, 0];
for (let i = 0; i < n; i++) {
  P.getElement(i, v); N.getElement(i, nv); JA.getElement(i, jj); WA.getElement(i, ww);
  const M = new Array(16).fill(0); let ws = 0;
  for (let k = 0; k < 4; k++) { if (!ww[k]) continue; ws += ww[k]; const A = J[jj[k]]; for (let e = 0; e < 16; e++) M[e] += ww[k] * A[e]; }
  for (let e = 0; e < 16; e++) M[e] /= ws || 1;
  const p = [0, 1, 2].map((r) => M[r] * v[0] + M[4 + r] * v[1] + M[8 + r] * v[2] + M[12 + r]);
  let q = [0, 1, 2].map((r) => M[r] * nv[0] + M[4 + r] * nv[1] + M[8 + r] * nv[2]); const L = Math.hypot(...q) || 1; q = q.map((x) => x / L);
  outP.set(p, i * 3); outN.set(q, i * 3);
}
P.setArray(outP); N.setArray(outN);

// a plain mesh: no skin, joints, animation, other nodes or Draco
prim.setAttribute('JOINTS_0', null); prim.setAttribute('WEIGHTS_0', null); JA.dispose(); WA.dispose();
meshNode.setSkin(null); skin.dispose();
meshNode.setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
for (const a of root.listAnimations()) a.dispose();
for (const c of root.listScenes()[0].listChildren()) if (c !== meshNode) { const kill = (x) => { x.listChildren().forEach(kill); x.dispose(); }; kill(c); }
for (const e of root.listExtensionsUsed()) if (/draco/i.test(e.extensionName)) e.dispose();
await doc.transform(prune());
await io.write(OUT, doc);
console.log('mesh', n, 'vertices ->', OUT);

// the joints buildrig reads (joints.json) in the rigger's frame: normalize.py turns glTF (x, y, z) into Blender
// (x, -z, y), scales the body to 1.8 tall with the feet at 0 and centres it on its box; _handC / _tip = the middle finger
const B = (p) => [p[0], -p[2], p[1]];
const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
for (let i = 0; i < n; i++) { const q = B([outP[i * 3], outP[i * 3 + 1], outP[i * 3 + 2]]); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], q[k]); hi[k] = Math.max(hi[k], q[k]); } }
const sc = 1.8 / (hi[2] - lo[2]), cc = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, lo[2]];
const at = (name) => B(JPOS.get('mixamorig_' + name)).map((x, k) => +((x - cc[k]) * sc).toFixed(5));
const out = {};
for (const k of ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'HeadTop_End']) out[k] = at(k);
for (const s of ['Left', 'Right']) {
  for (const k of ['Shoulder', 'Arm', 'ForeArm', 'Hand', 'UpLeg', 'Leg', 'Foot', 'ToeBase', 'Toe_End']) out[s + k] = at(s + k);
  out[s + '_handC'] = at(s + 'HandMiddle1'); out[s + '_tip'] = at(s + 'HandMiddle4');
}
fs.writeFileSync(JOINTS, JSON.stringify(out, null, 0).replace(/\],"/g, '],\n"') + '\n');
console.log('joints', Object.keys(out).length, '->', JOINTS);
