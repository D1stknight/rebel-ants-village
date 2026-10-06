// Mixamo -> Mixamo retarget (world-space rotation deltas from the rest pose) + hips height scaled to the target.
// usage: [FEET=0] [ALIGN=1] [FINGERS=pose.json] [SKIP=re] [STRAIGHTEN=re] [PLANT=1] [UPRIGHT=re] node tools/retarget-mixamo.mjs target.glb out.glb src1.glb:Name1 src2.glb:Name2 ...
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await draco3d.createDecoderModule(), 'draco3d.encoder': await draco3d.createEncoderModule() });
const q = {
  mul: (a, b) => [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1], a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0], a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3], a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]],
  inv: a => [-a[0], -a[1], -a[2], a[3]],
  norm: a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); },
  rot: (q_, v) => { const [x, y, z, w] = q_, tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]); return [v[0] + w * tx + y * tz - z * ty, v[1] + w * ty + z * tx - x * tz, v[2] + w * tz + x * ty - y * tx]; },
  arc: (a, b) => { const d = a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; if (d < -0.9999) return [1, 0, 0, 0]; const c = [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; const r = [c[0], c[1], c[2], 1 + d]; const l = Math.hypot(...r); return r.map(v => v / l); }
};
const [tgtPath, outPath, ...srcs] = process.argv.slice(2);
const dst = await io.read(tgtPath), D = dst.getRoot();
const bone = n => n.getName().replace(/^mixamorig[:_]?/, '');
// target skeleton: its skin joints, named the Mixamo way (Meshy rigs: Spine02/Spine01/Spine/neck -> Spine/Spine1/Spine2/Neck)
const MESHY_T = { Spine02:'Spine', Spine01:'Spine1', Spine:'Spine2', neck:'Neck' };
const dstJoints = new Set(D.listSkins()[0].listJoints());
const dstName = n => /^mixamorig/.test(n.getName()) ? bone(n) : (MESHY_T[n.getName()] || n.getName());
const dstBones = new Map([...dstJoints].map(n => [dstName(n), n]));
const isBone = n => n && dstJoints.has(n);
// where the target's feet are in skeleton units (Kenshi -94: origin at the waist, lifted outside; Meshy 0)
const FEET = Number(process.env.FEET ?? 0);
// FINGERS=pose.json: fingers keep this fixed pose (the target's own relaxed hand) instead of following the source
const FINGERS = process.env.FINGERS ? JSON.parse((await import('fs')).readFileSync(process.env.FINGERS, 'utf8')) : null;
const isFinger = b => /Hand(Thumb|Index|Middle|Ring|Pinky)/.test(b);
// SKIP=regex: bones left at their rest pose (e.g. SKIP='^(Left|Right)Hand$' keeps wrists straight in line with the forearm)
const SKIP = process.env.SKIP ? new RegExp(process.env.SKIP) : null;
// STRAIGHTEN=regex: for these bones the clip's average offset from the target rest is removed (keeps the motion,
// drops a constant hunch / head-down / splayed stance that the source character has)
const STRAIGHTEN = process.env.STRAIGHTEN ? new RegExp(process.env.STRAIGHTEN) : null;
// UPRIGHT=regex of clip names: tilt the hips so the clip's average hips->head line is vertical (no lean forward / back)
// PLANT=1: per frame, hips height set so the lowest foot / toe sits where it does in the rest pose (feet on the ground)
const UPRIGHT = process.env.UPRIGHT ? new RegExp(process.env.UPRIGHT) : null;
const PLANT = process.env.PLANT === '1';
// world rotation from rest locals (only the mixamo chain; the roots above have no rotation)
const restWorld = (nodes, getLocal) => { const W = new Map(); const w = n => { if (W.has(n)) return W.get(n); const p = n.getParentNode(); const r = q.mul(isBone(p) ? w(p) : [0, 0, 0, 1], getLocal(n)); W.set(n, r); return r; }; nodes.forEach(w); return W; };
const dstRestW = restWorld([...dstBones.values()], n => n.getRotation());
const dstHips = dstBones.get('Hips'), dstHipsRest = dstHips.getTranslation();
// ALIGN=1: first pose the target into the source's rest pose (bone directions), then apply the source motion; needed when
// the rests differ (A-pose models vs T-pose clips), else arms over-rotate
const ALIGN = process.env.ALIGN === '1';
const restPos = (nodes, isB, W) => { const P = new Map(); const pos = n => { if (P.has(n)) return P.get(n); const p = n.getParentNode(); let r; if (isB(p)) { const pp = pos(p), v = q.rot(W.get(p), n.getTranslation()); r = [pp[0] + v[0], pp[1] + v[1], pp[2] + v[2]]; } else r = [0, 0, 0]; P.set(n, r); return r; }; nodes.forEach(pos); return P; };
const dstRestP = restPos([...dstBones.values()], isBone, dstRestW);
// the joint a bone points at (for direction): its main child in the Mixamo chain
const AIM = { Hips:'Spine', Spine:'Spine1', Spine1:'Spine2', Spine2:'Neck', Neck:'Head', LeftShoulder:'LeftArm', LeftArm:'LeftForeArm', LeftForeArm:'LeftHand', LeftHand:'LeftHandMiddle1', RightShoulder:'RightArm', RightArm:'RightForeArm', RightForeArm:'RightHand', RightHand:'RightHandMiddle1', LeftUpLeg:'LeftLeg', LeftLeg:'LeftFoot', LeftFoot:'LeftToeBase', RightUpLeg:'RightLeg', RightLeg:'RightFoot', RightFoot:'RightToeBase' };
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
  const srcRestP = restPos([...srcBones.values()], isSrcBone, srcRestW);
  // C[b]: world rotation taking the target bone's rest direction onto the source's (identity where either end is missing)
  const C = new Map();
  if (ALIGN) for (const [b, dn] of dstBones) { const a = AIM[b]; const sn = srcBones.get(b), sa = a && srcBones.get(a), da = a && dstBones.get(a); if (!sn || !sa || !da) continue;
    const dv = q.norm(dstRestP.get(da).map((v, k) => v - dstRestP.get(dn)[k])), sv = q.norm(srcRestP.get(sa).map((v, k) => v - srcRestP.get(sn)[k])); C.set(b, q.arc(dv, sv)); }
  const Cof = b => C.get(b) || [0, 0, 0, 1];
  const anim = clip ? S.listAnimations().find(a => a.getName() === clip) : S.listAnimations()[0];
  const rotCh = new Map(), trCh = new Map();
  anim.listChannels().forEach(c => { const n = c.getTargetNode(); if (!joints.has(n)) return; const b = sb(n); if (c.getTargetPath() === 'rotation') rotCh.set(b, c.getSampler()); if (c.getTargetPath() === 'translation') trCh.set(b, c.getSampler()); });
  // sample times: an even 30 fps over the whole clip (compressed sources have sparse, uneven keys per track)
  const tEnd = Math.max(...anim.listSamplers().map(sm => { const T = sm.getInput().getArray(); return T[T.length - 1]; }));
  const tStart = Math.min(...anim.listSamplers().map(sm => sm.getInput().getArray()[0]));
  const NF = Math.max(2, Math.round((tEnd - tStart) * 30) + 1);
  const times = Float32Array.from({ length: NF }, (_, i) => tStart + (tEnd - tStart) * i / (NF - 1));
  // sample every track at the hips' key times (compressed sources have fewer keys on some bones): linear, quats normalised
  const F = times.length, sample = (s, i, n) => {
    const t = times[i], T = s.getInput().getArray(), o = s.getOutput().getArray(), K = T.length;
    if (K === 1 || t <= T[0]) return Array.from(o.slice(0, n));
    if (t >= T[K - 1]) return Array.from(o.slice((K - 1) * n, K * n));
    let lo = 0, hi = K - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m] <= t) lo = m; else hi = m; }
    const u = (t - T[lo]) / (T[hi] - T[lo] || 1), a = o.slice(lo * n, lo * n + n), b = o.slice(hi * n, hi * n + n);
    const sg = n === 4 && a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3] < 0 ? -1 : 1;
    const r = Array.from(a, (v, j) => v + (sg * b[j] - v) * u);
    return n === 4 ? q.norm(r) : r;
  };
  // source hips height: first frame (standing) vs the target's standing hips above its feet
  const sh0 = sample(trCh.get('Hips'), 0, 3);
  const kH = (dstHipsRest[1] - FEET) / sh0[1];
  const out = dst.createAnimation(name);
  const inAcc = dst.createAccessor().setType('SCALAR').setArray(new Float32Array(times)).setBuffer(buffer);
  const tracks = new Map();
  for (const [b, dn] of dstBones) {
    if (FINGERS && isFinger(b)) continue;
    if (SKIP && SKIP.test(b)) continue;
    const sn = srcBones.get(b); if (!sn || !rotCh.has(b)) continue;
    const vals = new Float32Array(F * 4);
    for (let i = 0; i < F; i++) {
      // source world rotation this frame
      const sw = (n) => { let r = [0, 0, 0, 1]; const chain = []; let p = n; while (isSrcBone(p)) { chain.unshift(p); p = p.getParentNode(); } for (const c of chain) { const cb = sb(c); r = q.mul(r, rotCh.has(cb) ? sample(rotCh.get(cb), i, 4) : c.getRotation()); } return r; };
      const delta = q.mul(sw(sn), q.inv(srcRestW.get(sn)));
      const dw = q.mul(delta, q.mul(Cof(b), dstRestW.get(dn)));
      // parent's animated world rotation on the target = delta(parent) * rest(parent)
      const dp = dn.getParentNode();
      let pw = [0, 0, 0, 1];
      if (isBone(dp)) { const pb = dstName(dp), sp = srcBones.get(pb); pw = sp && !(FINGERS && isFinger(pb)) ? q.mul(q.mul(sw(sp), q.inv(srcRestW.get(sp))), q.mul(Cof(pb), dstRestW.get(dp))) : dstRestW.get(dp); }
      const local = q.norm(q.mul(q.inv(pw), dw));
      vals.set(local, i * 4);
    }
    if (STRAIGHTEN && STRAIGHTEN.test(b)) {
      const m = [0, 0, 0, 0], r0 = Array.from(vals.slice(0, 4));
      for (let i = 0; i < F; i++) { const v = Array.from(vals.slice(i * 4, i * 4 + 4)), sg = v[0]*r0[0] + v[1]*r0[1] + v[2]*r0[2] + v[3]*r0[3] < 0 ? -1 : 1; for (let k = 0; k < 4; k++) m[k] += sg * v[k]; }
      const M = q.norm(m), corr = q.mul(dn.getRotation(), q.inv(M));
      for (let i = 0; i < F; i++) vals.set(q.norm(q.mul(corr, Array.from(vals.slice(i * 4, i * 4 + 4)))), i * 4);
    }
    tracks.set(dn, vals);
    const acc = dst.createAccessor().setType('VEC4').setArray(vals).setBuffer(buffer);
    const smp = dst.createAnimationSampler().setInput(inAcc).setOutput(acc).setInterpolation('LINEAR');
    out.addSampler(smp); out.addChannel(dst.createAnimationChannel().setTargetNode(dn).setTargetPath('rotation').setSampler(smp));
  }
  if (FINGERS) for (const [b, dn] of dstBones) { const r = FINGERS[dn.getName()]; if (!isFinger(b) || !r) continue;
    const ti = dst.createAccessor().setType('SCALAR').setArray(new Float32Array([times[0], times[F - 1]])).setBuffer(buffer);
    const fs_ = dst.createAnimationSampler().setInput(ti).setOutput(dst.createAccessor().setType('VEC4').setArray(new Float32Array([...r, ...r])).setBuffer(buffer)).setInterpolation('LINEAR');
    out.addSampler(fs_); out.addChannel(dst.createAnimationChannel().setTargetNode(dn).setTargetPath('rotation').setSampler(fs_)); }
  // hips translation: height scaled, horizontal motion kept relative to the first frame
  const hv = new Float32Array(F * 3);
  // in place: the straight-line drift from the first to the last frame is removed (the NPC code moves the root),
  // the sway around it stays
  const shN = sample(trCh.get('Hips'), F - 1, 3);
  for (let i = 0; i < F; i++) { const t = sample(trCh.get('Hips'), i, 3), u = F > 1 ? i / (F - 1) : 0; const dx = t[0] - (sh0[0] + (shN[0] - sh0[0]) * u), dz = t[2] - (sh0[2] + (shN[2] - sh0[2]) * u); hv.set([dstHipsRest[0] + dx * kH, FEET + t[1] * kH, dstHipsRest[2] + dz * kH], i * 3); }
  // skeleton-space FK for frame i (null = rest pose): world positions of the bones
  const fkPos = i => { const W = new Map(), P = new Map();
    const go = n => { if (P.has(n)) return; const p = n.getParentNode(), tr = tracks.get(n), fr = FINGERS && FINGERS[n.getName()];
      const lr = i === null ? n.getRotation() : tr ? Array.from(tr.slice(i * 4, i * 4 + 4)) : fr || n.getRotation();
      const lt = n === dstHips ? (i === null ? dstHipsRest : Array.from(hv.slice(i * 3, i * 3 + 3))) : n.getTranslation();
      if (isBone(p)) { go(p); const v = q.rot(W.get(p), lt), pp = P.get(p); P.set(n, [pp[0] + v[0], pp[1] + v[1], pp[2] + v[2]]); W.set(n, q.mul(W.get(p), lr)); }
      else { P.set(n, [lt[0], lt[1], lt[2]]); W.set(n, lr); } };
    for (const n of dstBones.values()) go(n); return P; };
  const FOOT = ['LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase', 'LeftToe_End', 'RightToe_End'].map(k => dstBones.get(k)).filter(Boolean);
  if (UPRIGHT && UPRIGHT.test(name) && tracks.has(dstHips) && dstBones.get(process.env.UPBONE || 'Neck')) {
    const head = dstBones.get(process.env.UPBONE || 'Neck'); const m = [0, 0, 0];
    for (let i = 0; i < F; i++) { const P = fkPos(i), a = P.get(dstHips), h = P.get(head); const d = q.norm([h[0] - a[0], h[1] - a[1], h[2] - a[2]]); m[0] += d[0]; m[1] += d[1]; m[2] += d[2]; }
    const R0 = fkPos(null), ra = R0.get(dstHips), rh = R0.get(head); const restLean = Math.acos(Math.min(1, q.norm([rh[0] - ra[0], rh[1] - ra[1], rh[2] - ra[2]])[1])) * 57.3;
    const C = q.arc(q.norm(m), [0, 1, 0]), hr = tracks.get(dstHips);
    for (let i = 0; i < F; i++) hr.set(q.norm(q.mul(C, Array.from(hr.slice(i * 4, i * 4 + 4)))), i * 4);
    console.log('  upright: average lean was', (Math.acos(Math.min(1, q.norm(m)[1])) * 57.3).toFixed(1), 'deg (rest pose', restLean.toFixed(1) + ')');
  }
  if (PLANT && FOOT.length) {
    const R0 = fkPos(null), ground = Math.min(...FOOT.map(n => R0.get(n)[1])); let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < F; i++) { const P = fkPos(i), d = ground - Math.min(...FOOT.map(n => P.get(n)[1])); hv[i * 3 + 1] += d; lo = Math.min(lo, d); hi = Math.max(hi, d); }
    console.log('  plant: hips moved', lo.toFixed(3), '..', hi.toFixed(3));
  }
  console.log('  hips drift removed', ((shN[0] - sh0[0]) * kH).toFixed(1), ((shN[2] - sh0[2]) * kH).toFixed(1), 'cm');
  const hs = dst.createAnimationSampler().setInput(inAcc).setOutput(dst.createAccessor().setType('VEC3').setArray(hv).setBuffer(buffer)).setInterpolation('LINEAR');
  out.addSampler(hs); out.addChannel(dst.createAnimationChannel().setTargetNode(dstHips).setTargetPath('translation').setSampler(hs));
  console.log(name, 'frames', F, 'dur', times[F - 1].toFixed(2), 'bones', out.listChannels().length - 1, 'kH', kH.toFixed(3));
}
await io.write(outPath, dst);
