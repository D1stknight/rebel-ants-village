# v2.14 NPC stance (NPC villagers only). The master idle and most Mixamo gestures stand with the knees bent 15-37 deg;
# on a short-legged villager in baggy trousers that reads as sitting. Per frame the knee bend is scaled down (STAND x
# its bend above the rest pose), the hips rise to match and both legs are re-solved (two-bone IK) so the ankles stay
# exactly where they were and the feet keep their world rotation (no foot slide). A standing leg never locks past
# LOCK deg. The run keeps its stride but the head comes up: its forward pitch is scaled by RUN_HEAD.
# usage: python3.13 npcstance.py -- in.blend out.blend
import bpy, sys, os, math, numpy as np
from mathutils import Matrix, Vector, Quaternion
a = sys.argv[sys.argv.index('--') + 1:]; src, dst = a[0], a[1]
CALM = float(os.environ.get('FORGE_NPC_STAND', '0.2'))        # knee bend kept in calm clips
LIVELY = float(os.environ.get('FORGE_NPC_STAND_LIVELY', '0.5'))
LOCK = math.radians(float(os.environ.get('FORGE_NPC_LOCK', '3')))
RUN_HEAD = float(os.environ.get('FORGE_NPC_RUN_HEAD', '0.35'))
STAND = {c: CALM for c in ('idle', 'talking', 'talking2', 'waving', 'wave_short', 'pointing', 'nod_yes', 'shake_no', 'clapping',
                           'look_around', 'idle_looking')}
STAND.update({c: LIVELY for c in ('rallying', 'yelling')})
bpy.ops.wm.open_mainfile(filepath=src)
arm = bpy.data.objects['Armature']; P = 'mixamorig_'; sc = bpy.context.scene
Aw = arm.matrix_world; Ai = Aw.inverted(); B = arm.data.bones; PB = arm.pose.bones
tracks = list(arm.animation_data.nla_tracks)
for t_ in tracks: t_.mute = True
up = (Ai.to_3x3() @ Vector((0, 0, 1))).normalized()                # world up in armature space
LEGS = [(P + s + 'UpLeg', P + s + 'Leg', P + s + 'Foot') for s in ('Left', 'Right')]
REST_FLEX = {}
for u, l, f in LEGS:
    h, k, an = B[u].head_local, B[l].head_local, B[f].head_local
    REST_FLEX[u] = (k - h).angle(an - k, 0.0)


def channelbag(act):
    return act.layers[0].strips[0].channelbag(act.slots[0])


def write(cb, bone, path, n, vals, f0):
    # dense LINEAR keys, one per frame (like the retargeted clips)
    for i in range(n):
        dp = f'pose.bones["{bone}"].{path}'; fc = cb.fcurves.find(dp, index=i)
        if fc is None: fc = cb.fcurves.new(dp, index=i, group_name=bone)
        fc.keyframe_points.clear(); fc.keyframe_points.add(len(vals))
        fc.keyframe_points.foreach_set('co', np.c_[np.arange(len(vals), dtype=float) + f0, vals[:, i]].ravel())
        for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
        fc.update()


def basis(child, M_child, M_parent):
    # bone-local basis that puts `child` at armature-space matrix M_child under a parent posed at M_parent
    rest_rel = B[child].parent.matrix_local.inverted() @ B[child].matrix_local
    return (M_parent @ rest_rel).inverted() @ M_child


def quats(qs):
    out = np.array([[q.w, q.x, q.y, q.z] for q in qs])
    for i in range(1, len(out)):
        if np.dot(out[i], out[i - 1]) < 0: out[i] = -out[i]
    return out


report = {}
for act in bpy.data.actions:
    name = act.name
    if name not in STAND and name != 'run': continue
    arm.animation_data.action = act; arm.animation_data.action_slot = act.slots[0]
    cb = channelbag(act); f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
    if name == 'run':
        hq, worst = [], 0.0
        for f in range(f0, f1 + 1):
            sc.frame_set(f)
            Mh = PB[P + 'Head'].matrix.copy(); Mn = PB[P + 'Neck'].matrix.copy()
            d = (Mh.to_3x3() @ Vector((0, 1, 0))).normalized()           # the head bone points up the head
            fwd = (Ai.to_3x3() @ Vector((0, -1, 0))).normalized()       # characters face -Y
            pitch = math.atan2(d.dot(fwd), d.dot(up))
            side = up.cross(fwd).normalized()
            R = Quaternion(side, -(1 - RUN_HEAD) * pitch).to_matrix().to_4x4()
            M = R @ Mh.to_3x3().to_4x4(); M.translation = Mh.translation
            hq.append(basis(P + 'Head', M, Mn).to_quaternion()); worst = max(worst, math.degrees(pitch))
        write(cb, P + 'Head', 'rotation_quaternion', 4, quats(hq), f0)
        report[name] = {'headPitchMax': round(worst, 1), 'kept': RUN_HEAD}
        continue
    keep = STAND[name]
    hips_loc, legq = [], {b: [] for leg in LEGS for b in leg}
    flex_before, flex_after, lift = [], [], []
    for f in range(f0, f1 + 1):
        sc.frame_set(f)
        Mhip = PB[P + 'Hips'].matrix.copy()
        legs = []
        for u, l, ft in LEGS:
            H, K, A = PB[u].head.copy(), PB[l].head.copy(), PB[ft].head.copy()
            ta, tb = (K - H).length, (A - K).length
            flex = (K - H).angle(A - K, 0.0); r0 = REST_FLEX[u]
            want = max(LOCK, r0 + max(0.0, flex - r0) * keep) if flex > r0 else flex
            legs.append(dict(H=H, K=K, A=A, a=ta, b=tb, flex=flex, want=want, Mu=PB[u].matrix.copy(), Ml=PB[l].matrix.copy(), Mf=PB[ft].matrix.copy()))

        def rise(g, fl):
            # how far the hip joint has to go up (along `up`) for this leg to bend `fl`
            d = math.sqrt(g['a'] ** 2 + g['b'] ** 2 + 2 * g['a'] * g['b'] * math.cos(fl))
            v = g['H'] - g['A']; vz = v.dot(up); hz = (v - up * vz).length
            return math.sqrt(max(0.0, d * d - hz * hz)) - vz if d > hz else 0.0
        dz = sum(rise(g, g['want']) for g in legs) / 2
        dz = max(0.0, min(dz, min(rise(g, LOCK) for g in legs)))
        D = up * dz
        Mhip2 = Mhip.copy(); Mhip2.translation = Mhip.translation + D
        hips_loc.append(np.array((B[P + 'Hips'].matrix_local.inverted() @ Mhip2).translation))   # root bone: pose = rest @ basis
        fb, fa = [], []
        for (u, l, ft), g in zip(LEGS, legs):
            H2 = g['H'] + D; A = g['A']; d = (A - H2).length
            ca = max(-1.0, min(1.0, (g['a'] ** 2 + d * d - g['b'] ** 2) / (2 * g['a'] * d)))
            al = math.acos(ca); uu = (A - H2).normalized()
            pole = (g['K'] - g['H']); pole = pole - uu * pole.dot(uu)
            if pole.length < 1e-6: pole = (Ai.to_3x3() @ Vector((0, -1, 0)))
            pole = (pole - uu * pole.dot(uu)).normalized()
            K2 = H2 + (uu * math.cos(al) + pole * math.sin(al)) * g['a']
            Ru = (g['K'] - g['H']).rotation_difference(K2 - H2).to_matrix()
            Mu2 = (Ru @ g['Mu'].to_3x3()).to_4x4(); Mu2.translation = H2
            Rl = (g['A'] - g['K']).rotation_difference(A - K2).to_matrix()
            Ml2 = (Rl @ g['Ml'].to_3x3()).to_4x4(); Ml2.translation = K2
            legq[u].append(basis(u, Mu2, Mhip2).to_quaternion())
            legq[l].append(basis(l, Ml2, Mu2).to_quaternion())
            legq[ft].append(basis(ft, g['Mf'], Ml2).to_quaternion())
            fb.append(math.degrees(g['flex'])); fa.append(math.degrees((K2 - H2).angle(A - K2, 0.0)))
        flex_before.append(fb); flex_after.append(fa); lift.append(dz)
    write(cb, P + 'Hips', 'location', 3, np.array(hips_loc), f0)
    for b, qs in legq.items(): write(cb, b, 'rotation_quaternion', 4, quats(qs), f0)
    fb, fa = np.array(flex_before), np.array(flex_after)
    report[name] = {'knee': [round(float(fb.min()), 1), round(float(fb.max()), 1)], 'kneeNow': [round(float(fa.min()), 1), round(float(fa.max()), 1)], 'liftCm': round(100 * max(lift), 1)}
arm.animation_data.action = None
for t_ in tracks: t_.mute = False
print('npcstance', report)
bpy.ops.wm.save_as_mainfile(filepath=dst)
