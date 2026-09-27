# Forge Rigger v2.0 shoulders. In the A-pose the sleeve hangs next to the chest, so bone heat gave the sleeve up to half
# lower-spine (Spine / Spine1) weight. When the arm lifts into a guard the sleeve stayed with the belly and folded into
# itself at the armpit (#262 "right sleeve" patch). Like a hand-weighted game rig:
#  - everything inside the sleeve along the upper arm rides the Arm, blending into Shoulder + Spine2 over the top 35 %
#    of the upper arm (never into the lower spine);
#  - the chest next to the armpit keeps only a fading bit of Arm weight;
#  - then the shoulder weights are smoothed over the surface so there is no hard step.
# usage: python3.13 shoulderfix.py -- in.blend out.blend
import bpy, bmesh, sys, numpy as np
a = sys.argv[sys.argv.index('--') + 1:]; src, dst = a
bpy.ops.wm.open_mainfile(filepath=src)
arm = bpy.data.objects['Armature']; me = [o for o in bpy.data.objects if o.type == 'MESH'][0]; P = 'mixamorig_'
Aw = arm.matrix_world; Mw = np.array(me.matrix_world)
vg = me.vertex_groups; names = [g.name for g in vg]
nv = len(me.data.vertices)
co = np.array([v.co[:] for v in me.data.vertices]) @ Mw[:3, :3].T + Mw[:3, 3]
W = np.zeros((nv, len(names)), np.float64)
for v in me.data.vertices:
    for g in v.groups: W[v.index, g.group] = g.weight


def gi(n):
    global W
    g = vg.get(P + n) or vg.new(name=P + n)
    if g.index >= W.shape[1]:
        W = np.pad(W, ((0, 0), (0, g.index + 1 - W.shape[1])))
        names.append(g.name)
    return g.index


def smoothstep(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)


LOWSPINE = [gi(n) for n in ('Hips', 'Spine', 'Spine1')]
S2 = gi('Spine2')
# edges once, for the smoothing
bm = bmesh.new(); bm.from_mesh(me.data); E = np.array([[e.verts[0].index, e.verts[1].index] for e in bm.edges]); bm.free()
touched = np.zeros(nv, bool)
for side in ('Left', 'Right'):
    A = np.array((Aw @ arm.data.bones[P + side + 'Arm'].head_local)[:]); F = np.array((Aw @ arm.data.bones[P + side + 'ForeArm'].head_local)[:])
    Lu = np.linalg.norm(F - A); d = (F - A) / Lu
    ia, ish, ifo = gi(side + 'Arm'), gi(side + 'Shoulder'), gi(side + 'ForeArm')
    rel = co - A; t = rel @ d; r = np.linalg.norm(rel - np.outer(t, d), axis=1)
    tot = W.sum(1) + 1e-9
    upper = (W[:, [ia, ish, S2] + LOWSPINE].sum(1) / tot) > 0.6          # skin / cloth on the upper body only
    armdom = (W[:, ia] / tot > 0.6) & (t > 0.35 * Lu) & (t < 0.95 * Lu)
    if armdom.sum() < 20: print('shoulderfix', side, 'no sleeve found'); continue
    R = float(np.percentile(r[armdom], 95))
    sleeve = upper & (t > 0.02 * Lu) & (t < 1.05 * Lu) & (r < 1.08 * R)
    # 1) the sleeve rides the arm; its top blends into the shoulder and upper chest
    k = smoothstep((t / Lu - 0.02) / 0.33)
    for i in np.nonzero(sleeve)[0]:
        keep_fore = W[i, ifo]; rest = max(0.0, 1.0 - keep_fore)
        W[i, :] = 0; W[i, ifo] = keep_fore
        W[i, ia] = rest * k[i]; W[i, ish] = rest * (1 - k[i]) * 0.6; W[i, S2] = rest * (1 - k[i]) * 0.4
    # 2) the chest beside the armpit: arm weight fades out with distance from the sleeve
    chest = upper & ~sleeve & (W[:, ia] > 0) & (t < 1.05 * Lu)
    fade = np.clip(1 - (r - 1.08 * R) / (0.6 * R), 0, 1) * smoothstep((t / Lu) / 0.4)
    for i in np.nonzero(chest)[0]:
        old = W[i, ia]; new = old * fade[i]; W[i, ia] = new; W[i, S2] += old - new
    # the lower spine never reaches the shoulder: above the armpit it hands over to Spine2
    top = upper & (co[:, 2] > A[2] - 0.35 * Lu) & (np.abs(co[:, 0] - A[0]) < 0.9 * Lu)
    for i in np.nonzero(top & (t > -0.1 * Lu))[0]:
        s = W[i, LOWSPINE].sum()
        if s > 0:
            f = smoothstep((co[i, 2] - (A[2] - 0.35 * Lu)) / (0.3 * Lu)); W[i, S2] += s * f; W[i, LOWSPINE] *= (1 - f)
    touched |= sleeve | chest | top
    print(f'shoulderfix {side}: upper arm {Lu:.3f}, sleeve radius {R:.3f}, sleeve verts {int(sleeve.sum())}, chest verts {int(chest.sum())}')

# 3) smooth the shoulder weights over the surface (a few Laplacian passes on the touched area and its ring)
cols = [gi(n) for s in ('Left', 'Right') for n in (s + 'Arm', s + 'Shoulder')] + [S2] + LOWSPINE
region = touched.copy()
for _ in range(3):
    nb = np.zeros(nv, bool); nb[E[region[E[:, 0]], 1]] = True; nb[E[region[E[:, 1]], 0]] = True; region |= nb
deg = np.bincount(E.ravel(), minlength=nv).astype(float) + 1e-9
for _ in range(6):
    S = np.zeros((nv, len(cols)))
    np.add.at(S, E[:, 0], W[E[:, 1]][:, cols]); np.add.at(S, E[:, 1], W[E[:, 0]][:, cols])
    avg = S / deg[:, None]
    tot_c = W[:, cols].sum(1)
    Wn = 0.5 * W[:, cols] + 0.5 * avg
    s = Wn.sum(1) + 1e-12; Wn *= (tot_c / s)[:, None]             # keep the share the other bones (cloth, forearm) have
    W[np.ix_(region, cols)] = Wn[region]
for g in vg:
    if g.index >= W.shape[1]: continue
    col = W[:, g.index]; on = np.nonzero((col > 1e-4) & region)[0]; off = np.nonzero((col <= 1e-4) & region)[0]
    if len(off): g.remove(off.tolist())
    for i in on: g.add([int(i)], float(col[i]), 'REPLACE')
print('shoulderfix smoothed verts', int(region.sum()))
bpy.ops.wm.save_as_mainfile(filepath=dst)
