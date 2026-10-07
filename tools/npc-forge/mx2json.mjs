// Mixamo clip GLB (FBX2glTF, skinless) -> joint world rotations (rest = identity) + positions, 30 fps, as JSON for fbx2npz-style .npz
import { NodeIO } from '@gltf-transform/core'; import { ALL_EXTENSIONS } from '@gltf-transform/extensions'; import d3 from 'draco3dgltf'; import fs from 'fs';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'draco3d.decoder': await d3.createDecoderModule() });
const [inp, out] = process.argv.slice(2); const D = await io.read(inp), R = D.getRoot();
const qm = (a, b) => [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1], a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0], a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3], a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
const qi = a => [-a[0], -a[1], -a[2], a[3]];
const qn = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };
const qv = (q, v) => { const [x, y, z, w] = q, tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]); return [v[0] + w * tx + y * tz - z * ty, v[1] + w * ty + z * tx - x * tz, v[2] + w * tz + x * ty - y * tx]; };
const joints = R.listNodes().filter(n => /^mixamorig[:_]?/.test(n.getName()));
const js = new Set(joints); const short = n => n.getName().replace(/^mixamorig[:_]?/, '');
const anim = R.listAnimations()[0]; const ch = new Map();
for (const c of anim.listChannels()) { const n = c.getTargetNode(); if (!ch.has(n)) ch.set(n, {}); ch.get(n)[c.getTargetPath()] = c.getSampler(); }
const end = Math.max(...anim.listSamplers().map(s => s.getInput().getArray().at(-1)));
const fps = 30, nf = Math.max(2, Math.round(end * fps) + 1);
const samp = (s, t, n) => { const T = s.getInput().getArray(), o = s.getOutput().getArray(), K = T.length; if (t <= T[0] || K === 1) return Array.from(o.slice(0, n)); if (t >= T[K - 1]) return Array.from(o.slice((K - 1) * n, K * n)); let lo = 0, hi = K - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m] <= t) lo = m; else hi = m; } const u = (t - T[lo]) / (T[hi] - T[lo]), a = o.slice(lo * n, lo * n + n), b = o.slice(hi * n, hi * n + n); const sg = n === 4 && a[0]*b[0]+a[1]*b[1]+a[2]*b[2]+a[3]*b[3] < 0 ? -1 : 1; const r = Array.from(a, (v, j) => v + (sg * b[j] - v) * u); return n === 4 ? qn(r) : r; };
// world TRS (rotation + position, uniform scale handled through the chain) for every joint at time t (null = rest)
const world = t => { const W = new Map(); const go = n => { if (W.has(n)) return W.get(n); const p = n.getParentNode(); const c = t === null ? null : ch.get(n);
    const lr = c?.rotation ? samp(c.rotation, t, 4) : n.getRotation(), lt = c?.translation ? samp(c.translation, t, 3) : n.getTranslation(), ls = n.getScale();
    let r; if (p) { const pw = go(p); const v = qv(pw.r, [lt[0] * pw.s, lt[1] * pw.s, lt[2] * pw.s]); r = { r: qn(qm(pw.r, lr)), p: [pw.p[0] + v[0], pw.p[1] + v[1], pw.p[2] + v[2]], s: pw.s * ls[0] }; } else r = { r: lr, p: lt, s: ls[0] };
    W.set(n, r); return r; }; joints.forEach(go); return W; };
const W0 = world(null);
const Q = [], P = [];
for (let f = 0; f < nf; f++) { const W = world(f / fps); Q.push(joints.map(j => qn(qm(W.get(j).r, qi(W0.get(j).r))))); P.push(joints.map(j => W.get(j).p)); }
const parent = joints.map(j => { let p = j.getParentNode(); return js.has(p) ? joints.indexOf(p) : -1; });
fs.writeFileSync(out, JSON.stringify({ names: joints.map(short), parent, rest: joints.map(j => W0.get(j).p), Q, P, dt: 1 / fps }));
console.log(inp.split('/').pop(), 'joints', joints.length, 'frames', nf, 'dur', end.toFixed(2));
