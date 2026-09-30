# v1.9c armpit fix: generator meshes fuse the inner sleeve and the torso side into layers a few mm apart. Bone heat
# gives one layer Arm weights and the touching layer Spine weights, so when the arm swings the tiny faces joining
# them stretch into long spikes ("shards" under the arm). Around each armpit, verts whose spatial neighbours (other
# layers included) disagree between the arm and the torso get spatially smoothed weights, so the layers move together
# and the transition spreads over a few cm instead of one face.
# usage: python3.13 armpitfix.py -- in.blend out.blend
import bpy, sys, os, numpy as np
from scipy.spatial import cKDTree
from scipy.sparse import csr_matrix
a = sys.argv[sys.argv.index('--') + 1:]; src, dst = a
R_ZONE = float(os.environ.get("FORGE_ARMPIT_ZONE", "0.30"))    # around the upper-arm joint (m, 1.8 m body)
R_NB = float(os.environ.get('FORGE_ARMPIT_R', '0.02'))
ITERS = int(os.environ.get('FORGE_ARMPIT_ITERS', '6'))
bpy.ops.wm.open_mainfile(filepath=src)
arm = bpy.data.objects['Armature']; me = [o for o in bpy.data.objects if o.type == 'MESH'][0]; md = me.data; P = 'mixamorig_'
Mw = np.array(me.matrix_world); Aw = arm.matrix_world
nv = len(md.vertices); G = len(me.vertex_groups)
V = np.empty(nv * 3); md.vertices.foreach_get('co', V); V = V.reshape(-1, 3) @ Mw[:3, :3].T + Mw[:3, 3]
W = np.zeros((nv, G))
for v in md.vertices:
    for g in v.groups: W[v.index, g.group] = g.weight
W /= np.maximum(W.sum(1, keepdims=True), 1e-9)
names = [g.name[len(P):] if g.name.startswith(P) else g.name for g in me.vertex_groups]
fixed = np.zeros(nv, bool)
for p in md.polygons:
    m = md.materials[p.material_index] if p.material_index < len(md.materials) else None
    if m and (m.name.startswith('ARMOR_') or m.name.startswith('HEAD_')): fixed[list(p.vertices)] = True
tree = cKDTree(V)
total = 0
for side in ('Left', 'Right'):
    armset = [i for i, n in enumerate(names) if n.startswith(side + 'Arm') or n.startswith(side + 'ForeArm')]
    torso = [i for i, n in enumerate(names) if n in ('Spine', 'Spine1', 'Spine2', 'Hips', side + 'Shoulder')]
    if not armset or not torso: continue
    j = np.array((Aw @ arm.data.bones[P + side + 'Arm'].head_local)[:])
    zone = (np.linalg.norm(V - j, axis=1) < R_ZONE) & (V[:, 2] < j[2] + 0.03) & ~fixed
    zi = np.nonzero(zone)[0]
    if len(zi) == 0: continue
    fa = W[:, armset].sum(1)                      # arm share per vertex
    # disagreement: arm share differs by > 0.4 from some neighbour within R_NB (any layer)
    pairs = tree.query_ball_point(V[zi], R_NB)
    dis = np.array([np.ptp(fa[p]) > 0.4 for p in pairs])
    core = zi[dis]
    if len(core) == 0: continue
    # grow a little so the transition is spread, then spatially smooth those verts (others act as boundary)
    grow = np.unique(np.concatenate(tree.query_ball_point(V[core], R_NB * 1.5)))
    grow = grow[~fixed[grow]]
    rows, cols, vals = [], [], []
    nb = tree.query_ball_point(V[grow], R_NB)
    for r_, (vi, p) in enumerate(zip(grow, nb)):
        p = np.array(p); d = np.linalg.norm(V[p] - V[vi], axis=1); w = np.exp(-(d / (0.6 * R_NB)) ** 2)
        rows += [r_] * len(p); cols += p.tolist(); vals += (w / w.sum()).tolist()
    Mx = csr_matrix((vals, (rows, cols)), shape=(len(grow), nv))
    for _ in range(ITERS):
        W[grow] = Mx @ W
    total += len(grow)
    print('armpitfix', side, 'disagreeing verts', len(core), 'smoothed', len(grow))
W /= np.maximum(W.sum(1, keepdims=True), 1e-9)
# rewrite weights for all non-fixed verts in the zones (cheap enough: a few thousand verts)
W_all = W
zones = np.zeros(nv, bool)
for side in ('Left', 'Right'):
    j = np.array((Aw @ arm.data.bones[P + side + 'Arm'].head_local)[:])
    zones |= (np.linalg.norm(V - j, axis=1) < R_ZONE + 0.05) & ~fixed
for vi in np.nonzero(zones)[0]:
    vi = int(vi)
    for g in me.vertex_groups: g.remove([vi])
    row = W_all[vi]; top = np.argsort(row)[::-1][:4]; s = row[top].sum()
    for t in top:
        if row[t] > 1e-3: me.vertex_groups[int(t)].add([vi], float(row[t] / s), 'REPLACE')
print('armpitfix total smoothed', total)
bpy.ops.wm.save_as_mainfile(filepath=dst)
