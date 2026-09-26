# v1.7 upper-back smoothing: shoulder armour, back plate, straps and the shirt under them sit in thin layers. Sharp
# weight changes between Spine2 / Shoulder / Arm across those layers make the plates shear apart in poses, so the
# shirt shows through ("see-through back"). Spatially smooth the torso/shoulder weights over the mesh surface in the
# upper-torso band (not the arms below the deltoid, not the head), keeping each vertex's total for these bones.
# usage: python3.13 smoothfix.py -- in.blend out.blend
import bpy, sys, os, numpy as np
a = sys.argv[sys.argv.index('--') + 1:]; src, dst = a[0], a[1]
ITERS = int(os.environ.get('FORGE_SMOOTH_ITERS', '8'))
ALPHA = float(os.environ.get('FORGE_SMOOTH_ALPHA', '0.5'))
bpy.ops.wm.open_mainfile(filepath=src)
arm = bpy.data.objects['Armature']; me = [o for o in bpy.data.objects if o.type == 'MESH'][0]; P = 'mixamorig_'
Mw = me.matrix_world; Aw = arm.matrix_world
# v1.8: Neck is left alone so the head keeps a clean neck joint
names = [P + n for n in ('Spine1', 'Spine2', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm')]
groups = [me.vertex_groups.get(n) for n in names]
if not all(groups): print('smoothfix: missing groups, skipped'); bpy.ops.wm.save_as_mainfile(filepath=dst); sys.exit(0)
gi = {g.index: k for k, g in enumerate(groups)}
nv = len(me.data.vertices)
V = np.empty(nv * 3); me.data.vertices.foreach_get('co', V); V = V.reshape(-1, 3)
V = (np.array(Mw)[:3, :3] @ V.T).T + np.array(Mw)[:3, 3]
W = np.zeros((nv, len(names)))
for v in me.data.vertices:
    for g in v.groups:
        k = gi.get(g.group)
        if k is not None: W[v.index, k] = g.weight
bone = lambda n: arm.data.bones[P + n]
bh = lambda n: np.array((Aw @ bone(n).head_local)[:])
bt = lambda n: np.array((Aw @ bone(n).tail_local)[:])
neck_z = bh('Neck')[2]; spine1_z = bh('Spine1')[2]
# band: from Spine1 up to the neck base; laterally out to 35% down the upper arm
region = (V[:, 2] > spine1_z) & (V[:, 2] < neck_z) & (W.sum(1) > 0.02)
for side in ('Left', 'Right'):
    h, t = bh(side + 'Arm'), bt(side + 'Arm'); L2 = np.sum((t - h) ** 2)
    s = ((V - h) @ (t - h)) / L2
    region &= ~((s > 0.35) & (W[:, names.index(P + side + 'Arm')] > 0.3))
idx = np.nonzero(region)[0]
# spatial (not topological) smoothing: plates, straps and the shirt under them are separate surface layers, so
# neighbours are all verts within RADIUS, Gaussian-weighted. Outside verts act as fixed boundary values.
from scipy.spatial import cKDTree
from scipy.sparse import csr_matrix
H = V[:, 2].max() - V[:, 2].min()
RADIUS = float(os.environ.get('FORGE_SMOOTH_RADIUS', '0.022')) * H
tree = cKDTree(V)
nb = tree.query_ball_point(V[idx], RADIUS)
rows, cols, vals = [], [], []
for r, lst in enumerate(nb):
    d = np.linalg.norm(V[lst] - V[idx[r]], axis=1); w = np.exp(-(d / (0.5 * RADIUS)) ** 2)
    rows += [r] * len(lst); cols += lst; vals += list(w / w.sum())
K = csr_matrix((vals, (rows, cols)), shape=(len(idx), nv))
tot = W.sum(1, keepdims=True)
Ws = W.copy()
for _ in range(ITERS):
    avg = K @ Ws
    Ws[idx] = (1 - ALPHA) * Ws[idx] + ALPHA * avg
    s_ = Ws[idx].sum(1, keepdims=True); s_[s_ == 0] = 1
    Ws[idx] = Ws[idx] / s_ * tot[idx]                      # keep each vertex's share for these bones
changed = 0
for k, g in enumerate(groups):
    col = Ws[idx, k]; old = W[idx, k]
    for vi, w, w0 in zip(idx, col, old):
        if abs(w - w0) < 1e-4: continue
        if w < 1e-4: g.remove([int(vi)])
        else: g.add([int(vi)], float(w), 'REPLACE')
        changed += 1
print('smoothfix region verts', len(idx), 'of', nv, 'weights changed', changed, 'iters', ITERS)
bpy.ops.wm.save_as_mainfile(filepath=dst)
