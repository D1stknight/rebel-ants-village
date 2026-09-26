# v1.8 layer fix for fused generator meshes (Meshy): the shirt under the pauldrons, straps and back plate is a separate
# surface a hair under the armour. Small weight differences between the two layers let the dark inner shell and the
# shirt poke through each other in strikes ("see-through" shoulders). Verts are split into cloth / not-cloth by the
# base-colour texture; each cloth vert with an armour vert within REACH that sits farther from the bone axis (i.e. the
# cloth is the inner layer) takes COPY of that armour vert's weights, so the layers move together.
# FORGE_LAYER_MODE=both also lets armour copy cloth (smeared the pauldrons on #4998), FORGE_LAYER_SINK pushes the inner
# layer inward (also smeared) — both off by default.
# usage: python3.13 layerfix.py -- in.blend out.blend
import bpy, sys, os, numpy as np
from scipy.spatial import cKDTree
a = sys.argv[sys.argv.index('--') + 1:]; src, dst = a[0], a[1]
SINK = float(os.environ.get('FORGE_LAYER_SINK', '0'))          # tested 0.003–0.004: smeared plates; off      # fraction of body height
REACH = float(os.environ.get('FORGE_LAYER_REACH', '0.015'))    # other layer within this distance (fraction of height)
COPY = float(os.environ.get('FORGE_LAYER_COPY', '0.9'))
bpy.ops.wm.open_mainfile(filepath=src)
arm = bpy.data.objects['Armature']; me = [o for o in bpy.data.objects if o.type == 'MESH'][0]; P = 'mixamorig_'
md = me.data; nv = len(md.vertices)


def fail(msg):
    print('layerfix skipped:', msg); bpy.ops.wm.save_as_mainfile(filepath=dst); sys.exit(0)


# base colour image
img = None
for m in md.materials:
    if m and m.node_tree:
        for n in m.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and any(l.to_socket.name == 'Base Color' for l in n.outputs[0].links): img = n.image
if img is None or not md.uv_layers: fail('no base colour texture')
w_, h_ = img.size
px = np.empty(w_ * h_ * 4, np.float32); img.pixels.foreach_get(px); px = px.reshape(h_, w_, 4)
uv = np.empty(len(md.loops) * 2, np.float32); md.uv_layers.active.data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
lv = np.empty(len(md.loops), np.int64); md.loops.foreach_get('vertex_index', lv)
xi = np.clip((uv[:, 0] % 1) * w_, 0, w_ - 1).astype(int); yi = np.clip((uv[:, 1] % 1) * h_, 0, h_ - 1).astype(int)
col = np.zeros((nv, 3)); cnt = np.zeros(nv)
np.add.at(col, lv, px[yi, xi, :3]); np.add.at(cnt, lv, 1); col /= np.maximum(cnt, 1)[:, None]
r, g, b = col.T
cloth = (g > 0.18) & (g > r * 1.35) & (g > b * 1.35)          # the green shirt / kimono

V = np.empty(nv * 3); md.vertices.foreach_get('co', V); V = V.reshape(-1, 3)
Mw = np.array(me.matrix_world); Vw = V @ Mw[:3, :3].T + Mw[:3, 3]
Hh = Vw[:, 2].max() - Vw[:, 2].min()
Aw = arm.matrix_world
bh = lambda n: np.array((Aw @ arm.data.bones[P + n].head_local)[:]); bt = lambda n: np.array((Aw @ arm.data.bones[P + n].tail_local)[:])
segs = [n for n in ('Spine', 'Spine1', 'Spine2', 'Neck', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm') if P + n in arm.data.bones]
# radial depth = distance to the nearest torso/arm bone segment; the push direction is away from that point
best = np.full(nv, 9.0); foot = np.zeros((nv, 3))
for n in segs:
    a_, b_ = bh(n), bt(n); ab = b_ - a_; t = np.clip(((Vw - a_) @ ab) / (ab @ ab), 0, 1); q = a_ + t[:, None] * ab
    dd = np.linalg.norm(Vw - q, axis=1); m = dd < best; best[m] = dd[m]; foot[m] = q[m]
band = (Vw[:, 2] > bh('Spine1')[2]) & (Vw[:, 2] < bh('Neck')[2] + 0.02 * Hh) & (best < 0.16 * Hh)
# pairs of different layers (cloth vs armour/inner shell) lying on top of each other: the inner one sinks
inner_idx, outer_idx = [], []
PAIRS = ((cloth & band, ~cloth & band),) if os.environ.get('FORGE_LAYER_MODE', 'cloth') == 'cloth' else ((cloth & band, ~cloth & band), (~cloth & band, cloth & band))
for A, Bm in PAIRS:
    ai = np.nonzero(A)[0]; bi = np.nonzero(Bm)[0]
    if len(ai) < 50 or len(bi) < 50: continue
    d, k = cKDTree(Vw[bi]).query(Vw[ai], k=1, distance_upper_bound=REACH * Hh)
    ok = np.isfinite(d); ai = ai[ok]; nb = bi[k[ok]]
    inner = best[ai] < best[nb]
    inner_idx.append(ai[inner]); outer_idx.append(nb[inner])
if not inner_idx: fail('no overlapping layers')
ci = np.concatenate(inner_idx); nb = np.concatenate(outer_idx)
ci, first = np.unique(ci, return_index=True); nb = nb[first]
# 1) sink the inner layer toward the bone axis
dirv = Vw[ci] - foot[ci]; dirv /= np.maximum(np.linalg.norm(dirv, axis=1, keepdims=True), 1e-9)
Vw[ci] -= dirv * SINK * Hh
Vl = (Vw - Mw[:3, 3]) @ np.linalg.inv(Mw[:3, :3]).T
md.vertices.foreach_set('co', Vl.ravel()); md.update()
# 2) weights: the inner vert follows the outer layer it sits under
G = len(me.vertex_groups)
Wc = np.zeros((len(ci), G)); Wa = np.zeros((len(ci), G))
pos = {v: i for i, v in enumerate(ci)}; posa = {}
for i, v in enumerate(nb): posa.setdefault(v, []).append(i)
for v in md.vertices:
    j = pos.get(v.index); ja = posa.get(v.index)
    if j is None and ja is None: continue
    for gg in v.groups:
        if j is not None: Wc[j, gg.group] = gg.weight
        if ja is not None:
            for q in ja: Wa[q, gg.group] = gg.weight
Wn = (1 - COPY) * Wc + COPY * Wa
Wn /= np.maximum(Wn.sum(1, keepdims=True), 1e-9)
for j, v in enumerate(ci):
    top = np.argsort(Wn[j])[::-1][:4]
    for gg in list(md.vertices[int(v)].groups): me.vertex_groups[gg.group].remove([int(v)])
    s = Wn[j, top].sum()
    for t in top:
        if Wn[j, t] > 1e-4: me.vertex_groups[int(t)].add([int(v)], float(Wn[j, t] / s), 'REPLACE')
print('layerfix band verts', int(band.sum()), 'inner-layer verts sunk', len(ci), 'sink mm', round(SINK * Hh * 1000, 1))
bpy.ops.wm.save_as_mainfile(filepath=dst)
