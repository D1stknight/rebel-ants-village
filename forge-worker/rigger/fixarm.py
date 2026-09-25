# v1.2 post-weight fix: cloth that touched the hand/arm in the static mesh (robe beside the hand) can keep arm weights
# and fly off with the hand. Vertices whose arm-chain weight is high but which sit closer to a leg/hips bone than to
# any arm bone get the weights of their nearest clean neighbours instead.
# usage: python3.13 fixarm.py -- in.blend out.blend
import bpy, sys, numpy as np
from scipy.spatial import cKDTree
a = sys.argv[sys.argv.index('--') + 1:]; src, dst = a[0], a[1]
bpy.ops.wm.open_mainfile(filepath=src)
arm = bpy.data.objects['Armature']; me = [o for o in bpy.data.objects if o.type == 'MESH'][0]
P = 'mixamorig_'; vg = {g.index: g.name for g in me.vertex_groups}
Mw = me.matrix_world; Aw = arm.matrix_world
V = np.array([(Mw @ v.co)[:] for v in me.data.vertices])
R3 = Mw.to_3x3(); Nw = np.array([(R3 @ v.normal).normalized()[:] for v in me.data.vertices])
def seg(bn):
    b = arm.data.bones[bn]; return np.array((Aw @ b.head_local)[:]), np.array((Aw @ b.tail_local)[:])
def dseg(p, a_, b_):
    ab = b_ - a_; t = np.clip(((p - a_) @ ab) / max(ab @ ab, 1e-9), 0, 1); return np.linalg.norm(p - (a_ + t[:, None] * ab), axis=1)
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
_E = np.zeros(len(me.data.edges) * 2, np.int64); me.data.edges.foreach_get('vertices', _E); _E = _E.reshape(-1, 2)
_, lab = connected_components(coo_matrix((np.ones(len(_E)), (_E[:, 0], _E[:, 1])), shape=(len(V), len(V))), directed=False)
_o = np.argsort(lab, kind='stable'); _b = np.searchsorted(lab[_o], np.arange(lab.max() + 2))
comp = {c: _o[_b[c]:_b[c + 1]] for c in range(lab.max() + 1)}
report = {}
for side in ('Left', 'Right'):
    chain = [n for n in vg.values() if n.startswith(P + side) and any(k in n for k in ('Arm', 'ForeArm', 'Hand', 'Thumb', 'Index', 'Middle', 'Ring', 'Pinky')) and 'Shoulder' not in n]
    armsegs = [seg(n) for n in (P + side + 'Arm', P + side + 'ForeArm', P + side + 'Hand', P + side + 'HandMiddle1')]
    legsegs = [seg(n) for n in (P + 'Hips', P + 'LeftUpLeg', P + 'RightUpLeg', P + 'LeftLeg', P + 'RightLeg')]
    cidx = [i for i, n in vg.items() if n in chain]
    W = np.zeros(len(V))
    for v in me.data.vertices:
        W[v.index] = sum(g.weight for g in v.groups if g.group in cidx)
    cand = np.where(W > 0.3)[0]
    da = np.min([dseg(V[cand], *s) for s in armsegs], axis=0)
    dl = np.min([dseg(V[cand], *s) for s in legsegs], axis=0)
    # v1.5: robe / sash hanging BELOW the fist (hands resting against the robe in a reference-pose model, #4998 v4b)
    hz = min(seg(P + side + 'Hand')[0][2], seg(P + side + 'HandMiddle1')[1][2])
    below = V[cand][:, 2] < hz - 0.05
    # v1.5: torso side facing a close-hanging arm (bone heat bleeds upper-arm weight into the ribs; stretches when the
    # arm is raised). Medial of the upper arm, below the armpit, with a normal facing OUT (torso skin), not in (sleeve).
    ua, ub = seg(P + side + 'Arm'); uab = ub - ua; lat = np.sign(ua[0]) or 1.0
    pc = V[cand]; tt = np.clip(((pc - ua) @ uab) / max(uab @ uab, 1e-9), 0, 1); off = pc - (ua + tt[:, None] * uab)
    med = -lat * off[:, 0]
    torso = (tt > 0.12) & (med > 0.015) & (Nw[cand, 0] * lat > 0.25) & (pc[:, 2] < ua[2] - 0.05)
    bad = cand[((da > 0.06) & (dl < da)) | (below & (da > 0.035))]
    good = np.where(W < 0.01)[0]
    # v1.5b: rigid pieces (sword at the hip, chest plate) that bone heat split between arm and body. A separate mesh
    # island with only some arm-weighted verts, whose centre sits nearer the body axis than the arm, or which hangs
    # below the fist, belongs to the body: its arm-weighted verts take weights from clean verts of the same island.
    bodysegs = [seg(P + n) for n in ('Hips', 'Spine', 'Spine1', 'Spine2', 'LeftUpLeg', 'RightUpLeg')]
    isl = []
    for c in np.unique(lab[cand]):
        ids = comp[c]
        if len(ids) > 0.08 * len(V): continue
        fr = (W[ids] > 0.3).mean()
        if fr > 0.85: continue
        cen = V[ids].mean(0)[None]
        dac = min(dseg(cen, *s_)[0] for s_ in armsegs); dbc = min(dseg(cen, *s_)[0] for s_ in bodysegs)
        if dbc < dac or V[ids, 2].min() < hz - 0.08:
            isl.append(ids[W[ids] > 0.02])
    isl = np.concatenate(isl) if isl else np.zeros(0, int)
    bad = np.union1d(bad, isl).astype(int)
    tree = cKDTree(V[good]); _, nn = tree.query(V[bad], k=6)
    for vi, nbrs in zip(bad.tolist(), nn):
        acc = {}
        for gi in good[nbrs]:
            for g in me.data.vertices[gi].groups: acc[g.group] = acc.get(g.group, 0) + g.weight
        tot = sum(acc.values()) or 1
        v = me.data.vertices[vi]
        for g in list(v.groups): me.vertex_groups[g.group].remove([vi])
        for gidx, w in sorted(acc.items(), key=lambda x: -x[1])[:4]: me.vertex_groups[gidx].add([vi], float(w / tot), 'REPLACE')
    report[side] = (int(len(bad)), int(len(isl)))
print('fixarm reassigned', report)
bpy.ops.wm.save_as_mainfile(filepath=dst)
