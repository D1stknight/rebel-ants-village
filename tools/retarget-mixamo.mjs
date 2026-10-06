// Mixamo -> Mixamo (or Meshy -> Mixamo names) retarget: world-space rotation deltas from the rest pose, hips height scaled, clips made in place.
// Needs @gltf-transform/{core,extensions} + draco3dgltf (adjust the draco import path). Kenshi villager clips (Oct 6); then resample(3e-3).
// usage: node retarget.mjs target.glb out.glb src1.glb:Name1 src2.glb:Name2 ...
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from '../t/node_modules/draco3dgltf/draco3dgltf.js';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule(), 'draco3d.encoder': await draco3d.createEncoderModule() });
const q = {
  mul: (a, b) => [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1], a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0], a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3], a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]],
  inv: a => [-a[0], -a[1], -a[2], a[3]],
  norm: a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); }
};
const [tgtPath, outPath, ...srcs] = process.argv.slice(2);
const dst = await io.read(tgtPath), D = dst.getRoot();
const bone = n => n.getName().replace(/^mixamorig[:_]?/, '');
const dstBones = new Map(D.listNodes().filter(n => /^mixamorig/.test(n.getName())).map(n => [bone(n), n]));
const isBone = n => n && /^mixamorig/.test(n.getName());
// world rotation from rest locals (only the mixamo chain; the roots above have no rotation)
const restWorld = (nodes, getLocal) => { const W = new Map(); const w = n => { if (W.has(n)) return W.get(n); const p = n.getParentNode(); const r = q.mul(isBone(p) ? w(p) : [0, 0, 0, 1], getLocal(n)); W.set(n, r); return r; }; nodes.forEach(w); return W; };
const dstRestW = restWorld([...dstBones.values()], n => n.getRotation());
const dstHips = dstBones.get('Hips'), dstHipsRest = dstHips.getTranslation();
const buffer = D.listBuffers()[0];
for (const spec of srcs) {
  // spec: file:NewName[:sourceClipName]; Meshy rigs (no mixamorig_ prefix) map onto Mixamo bone names
  const [path, name, clip] = spec.split(':');
  const src = await io.read(path), S = src.getRoot();
  const MESHY = { Spine02:'Spine', Spine01:'Spine1', Spine:'Spine2', neck:'Neck' };
  // animation-only files (Mixamo 'without skin') have no skin: the skeleton is the mixamorig nodes
  const joints = new Set(S.listSkins()[0]?.listJoints() || S.listNodes().filter(n => /^mixamorig/.test(n.getName())));
  const sb = n => { const raw = n.getName(); return /^mixamorig/.test(raw) ? bone(n) : (MESHY[raw] || raw); };
  const srcBones = new Map([...joints].map(n => [sb(n), n]));
  const isSrcBone = n => n && joints.has(n);
  const restWorldS = (nodes) => { const W = new Map(); const w = n => { if (W.has(n)) return W.get(n); const p = n.getParentNode(); const r = q.mul(isSrcBone(p) ? w(p) : [0, 0, 0, 1], n.getRotation()); W.set(n, r); return r; }; nodes.forEach(w); return W; };
  const srcRestW = restWorldS([...srcBones.values()]);
  const anim = clip ? S.listAnimations().find(a => a.getName() === clip) : S.listAnimations()[0];
  const rotCh = new Map(), trCh = new Map();
  anim.listChannels().forEach(c => { const n = c.getTargetNode(); if (!joints.has(n)) return; const b = sb(n); if (c.getTargetPath() === 'rotation') rotCh.set(b, c.getSampler()); if (c.getTargetPath() === 'translation') trCh.set(b, c.getSampler()); });
  const times = rotCh.get('Hips').getInput().getArray();
  const F = times.length, sample = (s, i, n) => { const o = s.getOutput().getArray(); return Array.from(o.slice(i * n, i * n + n)); };
  // source hips height: first frame (standing) vs the target's standing hips above its feet
  const sh0 = sample(trCh.get('Hips'), 0, 3);
  const kH = (dstHipsRest[1] + 94) / sh0[1]; // target feet sit 94 units below its skeleton origin (lifted by 0.94 m outside)
  const out = dst.createAnimation(name);
  const inAcc = dst.createAccessor().setType('SCALAR').setArray(new Float32Array(times)).setBuffer(buffer);
  for (const [b, dn] of dstBones) {
    const sn = srcBones.get(b); if (!sn || !rotCh.has(b)) continue;
    const vals = new Float32Array(F * 4);
    for (let i = 0; i < F; i++) {
      // source world rotation this frame
      const sw = (n) => { let r = [0, 0, 0, 1]; const chain = []; let p = n; while (isSrcBone(p)) { chain.unshift(p); p = p.getParentNode(); } for (const c of chain) { const cb = sb(c); r = q.mul(r, rotCh.has(cb) ? sample(rotCh.get(cb), i, 4) : c.getRotation()); } return r; };
      const delta = q.mul(sw(sn), q.inv(srcRestW.get(sn)));
      const dw = q.mul(delta, dstRestW.get(dn));
      // parent's animated world rotation on the target = delta(parent) * rest(parent)
      const dp = dn.getParentNode();
      let pw = [0, 0, 0, 1];
      if (isBone(dp)) { const sp = srcBones.get(bone(dp)); pw = sp ? q.mul(q.mul(sw(sp), q.inv(srcRestW.get(sp))), dstRestW.get(dp)) : dstRestW.get(dp); }
      const local = q.norm(q.mul(q.inv(pw), dw));
      vals.set(local, i * 4);
    }
    const acc = dst.createAccessor().setType('VEC4').setArray(vals).setBuffer(buffer);
    const smp = dst.createAnimationSampler().setInput(inAcc).setOutput(acc).setInterpolation('LINEAR');
    out.addSampler(smp); out.addChannel(dst.createAnimationChannel().setTargetNode(dn).setTargetPath('rotation').setSampler(smp));
  }
  // hips translation: height scaled, horizontal motion kept relative to the first frame
  const hv = new Float32Array(F * 3);
  // in place: the straight-line drift from the first to the last frame is removed (the NPC code moves the root),
  // the sway around it stays
  const shN = sample(trCh.get('Hips'), F - 1, 3);
  for (let i = 0; i < F; i++) { const t = sample(trCh.get('Hips'), i, 3), u = F > 1 ? i / (F - 1) : 0; const dx = t[0] - (sh0[0] + (shN[0] - sh0[0]) * u), dz = t[2] - (sh0[2] + (shN[2] - sh0[2]) * u); hv.set([dstHipsRest[0] + dx * kH, -94 + t[1] * kH, dstHipsRest[2] + dz * kH], i * 3); }
  console.log('  hips drift removed', ((shN[0] - sh0[0]) * kH).toFixed(1), ((shN[2] - sh0[2]) * kH).toFixed(1), 'cm');
  const hs = dst.createAnimationSampler().setInput(inAcc).setOutput(dst.createAccessor().setType('VEC3').setArray(hv).setBuffer(buffer)).setInterpolation('LINEAR');
  out.addSampler(hs); out.addChannel(dst.createAnimationChannel().setTargetNode(dstHips).setTargetPath('translation').setSampler(hs));
  console.log(name, 'frames', F, 'dur', times[F - 1].toFixed(2), 'bones', out.listChannels().length - 1, 'kH', kH.toFixed(3));
}
await io.write(outPath, dst);
