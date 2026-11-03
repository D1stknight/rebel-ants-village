// Nov 3 (rigger 2.44, for rigs made before it): mends the neck / head snaps of a LIVE rig file in place. Rigs made on an
// older rigger turn the neck or head round in a frame or two: #001's and #609's mocap jump (the neck turned 142-158 deg
// for three keys, the head "spinning" on Miguel's phone), every roundhouse kick (the head dropped 50-180 deg onto the
// leaning chest in one key), a few weapon moves. Only those keys change; every other byte of the file stays the same,
// so a rig Miguel calls perfect keeps its hands, gloves, jaw and every other move exactly.
//   - a key that turns the bone more than HI deg from the key before it starts a snap;
//   - if the bone comes back within WIN keys (within RET deg of a key up to LEAD keys before the snap: the levelling
//     often drifts a key or two first), the keys between are the slerp across, for the neck AND the head of that clip
//     (in a turn-round the head's keys are made against the turned neck, so both are wrong there);
//   - else (it stays turned) it eases there at RATE deg a frame, as the 2.44 rigger's own limit does.
// Neck and head rotation channels only (mixamorig_Neck / mixamorig_Head), float32 LINEAR keys (the Forge Rigger's export).
const HI = 45, RET = 25, WIN = 12, LEAD = 4, RATE = 30, FPS = 30;
const NODES = /^mixamorig[_:]?(Neck|Head)$/;
const D = Math.PI / 180;

function parseGlb(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB');
  const jl = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(buf.subarray(20, 20 + jl)));
  const bo = 20 + jl, bl = dv.getUint32(bo, true);
  if (dv.getUint32(bo + 4, true) !== 0x004e4942) throw new Error('GLB has no BIN chunk');
  return { json, jsonBytes: buf.subarray(12, 20 + jl), bin: buf.subarray(bo + 8, bo + 8 + bl), binStart: bo + 8 };
}
const ang = (q, a, b) => { let d = 0; for (let c = 0; c < 4; c++) d += q[a * 4 + c] * q[b * 4 + c]; return 2 * Math.acos(Math.min(1, Math.abs(d))); };
const angTo = (q, a, t) => { let d = 0; for (let c = 0; c < 4; c++) d += q[a * 4 + c] * t[c]; return 2 * Math.acos(Math.min(1, Math.abs(d))); };
function slerp(a, b, t) {   // a, b: [x, y, z, w]
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]; const s = d < 0 ? -1 : 1; d *= s;
  let k0, k1;
  if (d > 0.9995) { k0 = 1 - t; k1 = t; } else { const th = Math.acos(d), sn = Math.sin(th); k0 = Math.sin((1 - t) * th) / sn; k1 = Math.sin(t * th) / sn; }
  const o = [0, 1, 2, 3].map((c) => k0 * a[c] + k1 * s * b[c]); const n = Math.hypot(...o) || 1;
  return o.map((v) => v / n);
}
const get = (q, i) => [q[i * 4], q[i * 4 + 1], q[i * 4 + 2], q[i * 4 + 3]];
const set = (q, i, v) => { for (let c = 0; c < 4; c++) q[i * 4 + c] = v[c]; };

// the windows to bridge in one channel: a snap at key k (more than HI from k - 1) that comes back within WIN keys to
// within RET of a key up to LEAD keys before it (the levelling often drifts a key or two before it turns round): the
// earliest such return, and the latest key before the snap it returns to
export function snapWindows(q, t) {
  const n = t.length, out = []; let k = 1;
  while (k < n) {
    if (ang(q, k - 1, k) <= HI * D) { k++; continue; }
    let w = null;
    for (let j = k + 1; j < n && j <= k + WIN && !w; j++) for (let i = k - 1; i >= Math.max(0, k - LEAD) && !w; i--) if (ang(q, i, j) <= RET * D) w = { i, j };
    if (w) { out.push(w); k = w.j + 1; } else k++;
  }
  return out;
}
// slerps keys i+1 .. j-1 across from key i to key j
function bridge(q, t, i, j) {
  const a = get(q, i), b = get(q, j); let c = 0;
  for (let m = i + 1; m < j; m++) { set(q, m, slerp(a, b, (t[m] - t[i]) / (t[j] - t[i]))); c++; }
  return c;
}
// what is left after the bridges (a snap that does not come back): ease there at RATE a frame, as the 2.44 rigger does;
// returns the number of keys changed
export function easeSnaps(q, t) {
  const n = t.length, orig = Float32Array.from(q); let changed = 0, k = 1;
  const frames = (a, b) => Math.max(1, Math.round((t[b] - t[a]) * FPS));
  while (k < n) {
    if (ang(q, k - 1, k) <= HI * D) { k++; continue; }
    let prev = get(q, k - 1), i = k;
    while (i < n) {
      const tgt = get(orig, i), a = angTo(prev, 0, tgt), allowed = RATE * D * frames(i - 1, i);
      if (a <= allowed) break;
      prev = slerp(prev, tgt, allowed / a); set(q, i, prev); changed++; i++;
    }
    k = Math.max(i, k + 1);
  }
  return changed;
}
function sameSide(q) {   // neighbouring keys on the same side (q and -q)
  for (let i = 1; i < q.length / 4; i++) {
    let d = 0; for (let c = 0; c < 4; c++) d += q[(i - 1) * 4 + c] * q[i * 4 + c];
    if (d < 0) for (let c = 0; c < 4; c++) q[i * 4 + c] = -q[i * 4 + c];
  }
}

// mends a whole GLB; returns { buffer (a new GLB, same layout and size) | null when nothing to mend, report }
export function mendHeadSnaps(input) {
  const src = input instanceof Uint8Array ? input : new Uint8Array(input);
  const { json, binStart } = parseGlb(src);
  const out = new Uint8Array(src);   // a copy: the same JSON, the BIN with the mended keys
  const uses = new Map();
  for (const an of json.animations || []) for (const ch of an.channels) { const o = an.samplers[ch.sampler].output; uses.set(o, (uses.get(o) || 0) + 1); }
  const report = { clips: {}, keys: 0, skipped: 0 };
  for (const an of json.animations || []) {
    const chans = [];
    for (const ch of an.channels) {
      const node = json.nodes[ch.target.node]; const m = NODES.exec(node?.name || '');
      if (!m || ch.target.path !== 'rotation') continue;
      const s = an.samplers[ch.sampler];
      if ((s.interpolation || 'LINEAR') !== 'LINEAR') continue;
      const ai = json.accessors[s.input], ao = json.accessors[s.output];
      if (ai.componentType !== 5126 || ao.componentType !== 5126 || ao.type !== 'VEC4' || ao.count < 3 || ao.count !== ai.count || uses.get(s.output) !== 1) { report.skipped++; continue; }
      const bvI = json.bufferViews[ai.bufferView], bvO = json.bufferViews[ao.bufferView];
      if (bvI.byteStride || bvO.byteStride) { report.skipped++; continue; }
      const ti = binStart + (bvI.byteOffset || 0) + (ai.byteOffset || 0), to = binStart + (bvO.byteOffset || 0) + (ao.byteOffset || 0);
      chans.push({ bone: m[1], to, t: new Float32Array(out.buffer.slice(out.byteOffset + ti, out.byteOffset + ti + ai.count * 4)),
        q: new Float32Array(out.buffer.slice(out.byteOffset + to, out.byteOffset + to + ao.count * 16)), n: 0 });
    }
    if (!chans.length) continue;
    // the bridges of every channel, over the channels with the same key times
    const sameTimes = (a, b) => a.t.length === b.t.length && a.t.every((v, i) => Math.abs(v - b.t[i]) < 1e-4);
    for (const c of chans) for (const w of snapWindows(c.q, c.t)) for (const d of chans) if (d === c || sameTimes(c, d)) d.n += bridge(d.q, d.t, w.i, w.j);
    for (const c of chans) c.n += easeSnaps(c.q, c.t);
    for (const c of chans) {
      if (!c.n) continue;
      sameSide(c.q); out.set(new Uint8Array(c.q.buffer), c.to);
      (report.clips[an.name] = report.clips[an.name] || {})[c.bone] = c.n; report.keys += c.n;
    }
  }
  return { buffer: report.keys ? out : null, report };
}
