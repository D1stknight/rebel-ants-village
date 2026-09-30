# v1.9 part-built characters: armour pieces (materials ARMOR_<role>) ride their bone instead of copying the cloth
# weights under them (which split a plate between a hand and a thigh and tore it in motion).
#   forearm_S / wrist_S -> S ForeArm      shin_S -> S Leg
#   tasset_S            -> Hips at the top blending to S UpLeg at the bottom (plates hang from the belt)
#   torso (harness + pauldrons) -> the cloth weights under it limited to spine / shoulder / upper-arm bones, smoothed
# usage: python3.13 armorfix.py -- in.blend out.blend
import bpy, sys, os, numpy as np
from scipy.spatial import cKDTree
a = sys.argv[sys.argv.index('--') + 1:]; src, dst = a
bpy.ops.wm.open_mainfile(filepath=src)
me = [o for o in bpy.data.objects if o.type == 'MESH'][0]; md = me.data; P = 'mixamorig_'
roles = {i: m.name[6:] for i, m in enumerate(md.materials) if m and m.name.startswith('ARMOR_')}
if not roles:
    print('armorfix: no armour pieces'); bpy.ops.wm.save_as_mainfile(filepath=dst); sys.exit(0)
V = np.array([v.co[:] for v in md.vertices]); nv = len(V)
role_v = {}
for p in md.polygons:
    r = roles.get(p.material_index)
    if r: role_v.setdefault(r, set()).update(p.vertices)
arm_all = set().union(*role_v.values())
gi = {g.name: g.index for g in me.vertex_groups}
def setw(vs, wmap):
    vs = [int(v) for v in vs]
    for g in me.vertex_groups: g.remove(vs)
    for v, w in zip(vs, wmap):
        for b, x in w.items():
            if x > 1e-4: me.vertex_groups[gi[P + b]].add([v], float(x), 'REPLACE')
# body weights (non-armour verts) for the torso piece
cloth = np.array(sorted(set(range(nv)) - arm_all))
G = len(me.vertex_groups); Wc = np.zeros((nv, G))
for v in md.vertices:
    for g in v.groups: Wc[v.index, g.group] = g.weight
tree = cKDTree(V[cloth])
for r, vs in role_v.items():
    vs = np.array(sorted(vs)); S = r.split('_')[-1] if '_' in r else ''
    if r.startswith('forearm') or r.startswith('wrist'):
        setw(vs, [{S + 'ForeArm': 1.0}] * len(vs))
    elif r.startswith('shin'):
        setw(vs, [{S + 'Leg': 1.0}] * len(vs))
    elif r.startswith('tasset'):
        z = V[vs, 2]; t = (z.max() - z) / max(1e-6, z.max() - z.min())
        setw(vs, [{'Hips': 1 - 0.55 * x, S + 'UpLeg': 0.55 * x} for x in t])
    elif r == 'torso' and os.environ.get('FORGE_ARMOR_TORSO', 'split') == 'split':
        # harness on the chest bone, pauldrons on the upper arms (a plate split between spine and arm tears when the arm moves)
        armo = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
        ax = abs((armo.matrix_world @ armo.data.bones[P + 'LeftArm'].head_local).x)
        mw = np.array(me.matrix_world); Vw = V[vs] @ mw[:3, :3].T + mw[:3, 3]
        x = Vw[:, 0]; t = np.clip((np.abs(x) - (ax - 0.05)) / 0.05, 0, 1)
        out = []
        for xi, ti in zip(x, t):
            S2 = 'Left' if xi > 0 else 'Right'
            out.append({'Spine2': 1 - ti, S2 + 'Shoulder': 0.25 * ti, S2 + 'Arm': 0.75 * ti})
        setw(vs, out)
    else:
        allow = [gi[P + b] for b in ('Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'RightArm') if P + b in gi]
        _, k = tree.query(V[vs], k=8)
        W = Wc[cloth[k]].mean(1); M = np.zeros(G); M[allow] = 1; W *= M
        W /= np.maximum(W.sum(1, keepdims=True), 1e-9)
        tv = cKDTree(V[vs]); _, kk = tv.query(V[vs], k=24)
        for _ in range(4): W = W[kk].mean(1)          # smooth over the piece so it bends as one plate
        names = [g.name[len(P):] for g in me.vertex_groups]
        out = []
        for row in W:
            top = np.argsort(row)[::-1][:4]; s = row[top].sum()
            out.append({names[j]: row[j] / s for j in top if row[j] > 1e-3})
        setw(vs, out)
    print('armorfix', r, len(vs))
bpy.ops.wm.save_as_mainfile(filepath=dst)
