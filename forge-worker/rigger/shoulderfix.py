# Forge Rigger v2.0 shoulders. In the A-pose the sleeve hangs next to the chest, so bone heat gave the sleeve up to half
# lower-spine (Spine / Spine1) weight. When the arm lifts into a guard the sleeve stayed with the belly and folded into
# itself at the armpit (#262 "right sleeve" patch). Like a hand-weighted game rig:
#  - everything inside the sleeve along the upper arm rides the Arm, blending into Shoulder + Spine2 over the top 35 %
#    of the upper arm (never into the lower spine);
#  - the chest next to the armpit keeps only a fading bit of Arm weight;
#  - then the shoulder weights are smoothed over the surface so there is no hard step.
# usage: python3.13 shoulderfix.py -- in.blend out.blend
import bpy, bmesh, sys, os, numpy as np
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
# v2.38 Saints players (FORGE_HUMAN_SHOULDER, set by job.sh for FORGE_FRIEND=human): a person's shoulder, not a Rebel's
# armour. The cap of the shoulder rides the upper arm like a deltoid (a third of the arm's share at the joint line, all of
# it a fifth of the way down), the top of the shoulder over the joint is part of the sleeve on its outer side, what is
# left there goes mostly to the collarbone, and the shoulder blade and the top of the chest beside it follow the
# collarbone too (a person's scapula slides with it). Rebels, Chumpz and NPCs keep the v2.0 rule.
HUMAN = os.environ.get('FORGE_HUMAN_SHOULDER') == '1'
SP2H = np.array((Aw @ arm.data.bones[P + 'Spine2'].head_local)[:])
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
    k = smoothstep((t / Lu - 0.02) / 0.33); fsh = 0.6
    if HUMAN:
        out = A - SP2H; out[2] = 0; out /= np.linalg.norm(out) + 1e-9          # away from the body's middle
        outer = (co - A) @ out > -0.25 * R
        sleeve = upper & (t > -0.12 * Lu) & (t < 1.05 * Lu) & (r < 1.08 * R) & ((t > 0.02 * Lu) | outer)
        k = smoothstep((t / Lu + 0.12) / 0.30); fsh = 0.75
    for i in np.nonzero(sleeve)[0]:
        keep_fore = W[i, ifo]; rest = max(0.0, 1.0 - keep_fore)
        W[i, :] = 0; W[i, ifo] = keep_fore
        W[i, ia] = rest * k[i]; W[i, ish] = rest * (1 - k[i]) * fsh; W[i, S2] = rest * (1 - k[i]) * (1 - fsh)
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
    blade = np.zeros(nv, bool)
    if HUMAN:
        # the shoulder blade (behind) and the top of the chest (in front) beside this shoulder take collarbone weight from
        # the chest bone: up to half behind, a third in front, fading toward the spine and down the back
        half = abs(A[0] - SP2H[0]) + 1e-6
        fx = smoothstep((np.abs(co[:, 0] - SP2H[0]) / half - 0.3) / 0.5) * (np.sign(co[:, 0] - SP2H[0]) == np.sign(A[0] - SP2H[0]))
        fz = smoothstep((co[:, 2] - (A[2] - 0.8 * Lu)) / (0.5 * Lu)) * (co[:, 2] < A[2] + 0.3 * Lu)
        back = co[:, 1] > SP2H[1]
        tgt = np.where(back, 0.5, 0.3) * fx * fz
        blade = upper & ~sleeve & (tgt > 0.01)
        for i in np.nonzero(blade)[0]:
            mv = min(max(0.0, tgt[i] - W[i, ish]), W[i, S2]); W[i, S2] -= mv; W[i, ish] += mv
    touched |= sleeve | chest | top | blade
    print(f'shoulderfix {side}: upper arm {Lu:.3f}, sleeve radius {R:.3f}, sleeve verts {int(sleeve.sum())}, chest verts {int(chest.sum())}' + (f', blade verts {int(blade.sum())}' if HUMAN else ''))

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
# 4) v2.4 the collar belongs to the chest: near the neck the shoulder (clavicle) weight hands over to Spine2, fading in
# toward the shoulder joint. Shoulder weight on the collar dragged the two sides of the V-neck apart whenever the
# shoulders swung (walk, run: #262 "the neck looks so wide").
Nk = np.array((Aw @ arm.data.bones[P + 'Neck'].head_local)[:])
for side in ('Left', 'Right'):
    ish = gi(side + 'Shoulder'); A = np.array((Aw @ arm.data.bones[P + side + 'Arm'].head_local)[:])
    span = abs(A[0] - Nk[0]) + 1e-6
    dx = np.abs(co[:, 0] - Nk[0])
    near = (co[:, 2] > A[2] - 0.6 * span) & (dx < span) & (W[:, ish] > 0)
    f = smoothstep((dx - 0.35 * span) / (0.45 * span))
    for i in np.nonzero(near)[0]:
        old = W[i, ish]; new = old * f[i]; W[i, ish] = new; W[i, S2] += old - new
    region |= near
    print(f'shoulderfix {side}: collar verts handed to Spine2 {int(near.sum())}')
for g in vg:
    if g.index >= W.shape[1]: continue
    col = W[:, g.index]; on = np.nonzero((col > 1e-4) & region)[0]; off = np.nonzero((col <= 1e-4) & region)[0]
    if len(off): g.remove(off.tolist())
    for i in on: g.add([int(i)], float(col[i]), 'REPLACE')
print('shoulderfix smoothed verts', int(region.sum()))

# 5) v2.4 calmer collarbones. Mocap collarbones swing a lot (walk ~38 deg, run ~27 deg): on a big-headed Rebel that drops
# and rolls the shoulder under the robe and bunches the collar up around the neck. Keep CLAV_K of each collarbone
# rotation and hand the rest to the upper arm, so the arm still points exactly where the clip puts it.
import mathutils as mu
CLAV_K = float(os.environ.get('FORGE_CLAV_K', '0.4'))
# v2.38 Saints players (FORGE_CLAV_K_MOCAP, set by job.sh for FORGE_FRIEND=human): the Mixamo moves keep CLAV_K_MOCAP of
# the actor's collarbone turn (1 = all of it, as a person's shoulders lift and roll with a punch); the ant master's
# idle / walk / run / flip_kick keep CLAV_K (their collarbones follow the ant's own shoulders: in full they drop a
# person's shoulders ~30 deg in the walk). Unset = CLAV_K for every clip, as before.
CLAV_K_MOCAP = float(os.environ.get('FORGE_CLAV_K_MOCAP') or CLAV_K)
MASTER_CLIPS = {'idle', 'walk', 'run', 'flip_kick'}
def _bags(act):
    for Ly in act.layers:
        for st in Ly.strips:
            for cb in st.channelbags: yield cb
CLAV_SKIP = set(os.environ.get('FORGE_CLAV_SKIP', 'cartwheel,knockdown,get_up').split(','))   # hands plant on the ground
n_fix = 0
for act in bpy.data.actions:
    if act.name in CLAV_SKIP: continue
    K = CLAV_K if act.name in MASTER_CLIPS else CLAV_K_MOCAP
    for cb in _bags(act):
        for side in ('Left', 'Right'):
            sh, ar = P + side + 'Shoulder', P + side + 'Arm'
            fs = [cb.fcurves.find(f'pose.bones["{sh}"].rotation_quaternion', index=i) for i in range(4)]
            fa = [cb.fcurves.find(f'pose.bones["{ar}"].rotation_quaternion', index=i) for i in range(4)]
            if not all(fs) or not all(fa) or len(fs[0].keyframe_points) != len(fa[0].keyframe_points): continue
            nk = len(fs[0].keyframe_points)
            S = np.zeros((4, nk * 2)); A = np.zeros((4, nk * 2))
            for i in range(4): fs[i].keyframe_points.foreach_get('co', S[i]); fa[i].keyframe_points.foreach_get('co', A[i])
            if not np.allclose(S[0][0::2], A[0][0::2]): continue
            bs, ba = arm.data.bones[sh], arm.data.bones[ar]
            R = (bs.matrix_local.inverted() @ ba.matrix_local).to_quaternion()      # arm rest relative to the collarbone
            Ri = R.inverted(); I = mu.Quaternion()
            for k in range(nk):
                qs = mu.Quaternion([S[i][2 * k + 1] for i in range(4)]).normalized()
                qa = mu.Quaternion([A[i][2 * k + 1] for i in range(4)]).normalized()
                qs2 = I.slerp(qs, K)
                qa2 = Ri @ (qs2.inverted() @ qs) @ R @ qa
                for i in range(4): S[i][2 * k + 1] = qs2[i]; A[i][2 * k + 1] = qa2[i]
            for i in range(4):
                fs[i].keyframe_points.foreach_set('co', S[i]); fa[i].keyframe_points.foreach_set('co', A[i]); fs[i].update(); fa[i].update()
            n_fix += 1
print('shoulderfix collarbones calmed (clip sides)', n_fix, 'k', CLAV_K, *(['mocap k', CLAV_K_MOCAP] if CLAV_K_MOCAP != CLAV_K else []))
bpy.ops.wm.save_as_mainfile(filepath=dst)
