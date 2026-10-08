# v2.14 NPC arms (NPC villagers only): Mixamo gestures were acted by a slim, long-armed actor; on a stocky villager with
# short arms, a big head and shoulder armour some of them read wrong. Per frame, with the hand path kept:
#  - FLICK (talking, talking2): as the hand drops the actor flicks the elbow out and up (100+ deg round the
#    shoulder-wrist line); the armoured arm visibly spins. The arm is turned back round that line (the wrist stays put)
#    so the elbow stays within FLICK_MAX of hanging back-and-down.
#  - POINT (pointing): the actor points with the elbow bent ~52 deg and the wrist ~25 deg, so on short arms the finger
#    did not line up with the arm. While the index is out, the arm straightens along the shoulder -> fingertip line and
#    the hand lines up with the forearm.
#  - WAVE (wave_short): the waving arm stuck straight forward from the chest (the shoulder pinched under the armour and
#    the hand waved in front of the big head). The raised arm swings round the shoulder (about the vertical) so the
#    upper arm goes out to the side under the shoulder pad: the hand waves beside the head, the wave itself unchanged.
#  - CLAP (clapping): the gloves stopped ~2 cm apart at every clap (the actor's hands, our wider body); at each clap
#    both hands move half the gap toward each other (eased over the frames round it) so the gloves meet.
# usage: python3.13 npcarms.py -- in.blend out.blend
import bpy, sys, os, math, numpy as np
from mathutils import Matrix, Vector, Quaternion
a = sys.argv[sys.argv.index('--') + 1:]; src, dst = a[0], a[1]
FLICK = {'talking', 'talking2'}
WAVE = {'wave_short'}
FLICK_MAX = math.radians(float(os.environ.get('FORGE_NPC_FLICK', '30')))
POINT_BEND = math.radians(float(os.environ.get('FORGE_NPC_POINT_BEND', '14')))   # elbow bend kept while pointing
WAVE_OUT = math.radians(float(os.environ.get('FORGE_NPC_WAVE_OUT', '70')))       # waving upper arm: degrees out from straight ahead
CLAP = {'clapping'}
CLAP_GAP = float(os.environ.get('FORGE_NPC_CLAP_GAP', '0.003'))                   # glove-to-glove gap left at a clap (m)
GESTURES = {'talking', 'talking2', 'waving', 'wave_short', 'bow', 'pointing', 'pick_up', 'nod_yes', 'shake_no', 'clapping',
            'rallying', 'yelling', 'look_around', 'idle_looking'}
bpy.ops.wm.open_mainfile(filepath=src)
arm = bpy.data.objects['Armature']; P = 'mixamorig_'; sc = bpy.context.scene; B = arm.data.bones; PB = arm.pose.bones
me = [o for o in bpy.data.objects if o.type == 'MESH'][0]
tracks = list(arm.animation_data.nla_tracks)
for t_ in tracks: t_.mute = True
Ai = arm.matrix_world.inverted().to_3x3()
UP = (Ai @ Vector((0, 0, 1))).normalized(); FWD = (Ai @ Vector((0, -1, 0))).normalized(); LEFT = UP.cross(FWD).normalized()   # characters face -Y
for pb in PB: pb.rotation_mode = 'QUATERNION'

gid = {g.index: g.name for g in me.vertex_groups}; Mm = arm.matrix_world.inverted() @ me.matrix_world
# glove vertices per hand (handswap's Glove material; the cuffs never touch)
gm = {i for i, m_ in enumerate(me.data.materials) if m_ and m_.name == 'Glove'}; GLOVE = {'Left': set(), 'Right': set()}
for poly in me.data.polygons:
    if poly.material_index in gm:
        for vi in poly.vertices:
            v = me.data.vertices[vi]
            if v.groups: GLOVE['Left' if gid.get(max(v.groups, key=lambda g: g.weight).group, '').startswith(P + 'Left') else 'Right'].add(vi)
GLOVE = {k: np.array(sorted(v), np.int64) for k, v in GLOVE.items()}


def basis(child, M_child, M_parent):
    rest_rel = B[child].parent.matrix_local.inverted() @ B[child].matrix_local
    return (M_parent @ rest_rel).inverted() @ M_child


def about(M, pivot, R):
    # rotate armature-space matrix M by rotation R (3x3) about point `pivot`
    out = (R @ M.to_3x3()).to_4x4(); out.translation = pivot + R @ (M.translation - pivot); return out


def aim(M, frm, to):
    # turn matrix M (about its own head) by the smallest rotation taking direction frm to direction to
    R = frm.rotation_difference(to).to_matrix(); out = (R @ M.to_3x3()).to_4x4(); out.translation = M.translation; return out


def smooth01(x, a_, b_):
    t = max(0.0, min(1.0, (x - a_) / (b_ - a_))); return t * t * (3 - 2 * t)


def two_bone(S, E, W, W2, la, lb):
    # elbow for a new wrist target W2, keeping the elbow on the same side of the shoulder -> wrist line
    d = max(1e-4, min((W2 - S).length, la + lb - 1e-4)); u = (W2 - S).normalized()
    pole = (E - S) - u * (E - S).dot(u)
    if pole.length < 1e-5: pole = -UP - u * (-UP).dot(u)
    pole.normalize(); ca = max(-1.0, min(1.0, (la * la + d * d - lb * lb) / (2 * la * d)))
    return S + (u * ca + pole * math.sqrt(1 - ca * ca)) * la, S + u * d


def channelbag(act):
    return act.layers[0].strips[0].channelbag(act.slots[0])


def write(cb, bone, vals, f0):
    for i in range(4):
        dp = f'pose.bones["{bone}"].rotation_quaternion'; fc = cb.fcurves.find(dp, index=i)
        if fc is None: fc = cb.fcurves.new(dp, index=i, group_name=bone)
        fc.keyframe_points.clear(); fc.keyframe_points.add(len(vals))
        fc.keyframe_points.foreach_set('co', np.c_[np.arange(len(vals), dtype=float) + f0, vals[:, i]].ravel())
        for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
        fc.update()


def point_weight(act, f0, f1):
    # the point pose from handswap: the right index is out while its first joint is straight
    cb = channelbag(act); fc = [cb.fcurves.find(f'pose.bones["{P}RightHandIndex1"].rotation_quaternion', index=i) for i in range(4)]
    if not all(fc): return np.zeros(f1 - f0 + 1)
    w = []
    for f in range(f0, f1 + 1):
        q = Quaternion([fc[i].evaluate(f) for i in range(4)]); ang = math.degrees(2 * math.acos(min(1.0, abs(q.w))))
        w.append(max(0.0, min(1.0, (30 - ang) / 20)))       # point pose ~2 deg, relaxed ~14+, fist ~88
    return np.array(w)


report = {}
for act in bpy.data.actions:
    name = act.name
    if name not in GESTURES: continue
    arm.animation_data.action = act; arm.animation_data.action_slot = act.slots[0]
    f0, f1 = int(act.frame_range[0]), int(act.frame_range[1]); nf = f1 - f0 + 1
    pw = point_weight(act, f0, f1) if name == 'pointing' else None
    if pw is not None: pw = np.convolve(np.pad(pw, 4, mode='edge'), np.ones(9) / 9, mode='valid')
    out = {s: {b: [] for b in ('Arm', 'ForeArm', 'Hand')} for s in ('Left', 'Right')}
    stats = {'flick': 0.0, 'point': 0.0}; changed = False
    flick_d = {s: np.zeros(nf) for s in ('Left', 'Right')}
    wave_w = {s: np.zeros(nf) for s in ('Left', 'Right')}; wave_dir = {s: Vector() for s in ('Left', 'Right')}
    clap_gap, clap_u = np.full(nf, 9.0), [Vector() for _ in range(nf)]
    frames = []
    for k, f in enumerate(range(f0, f1 + 1)):
        sc.frame_set(f)
        st = {}
        for s in ('Left', 'Right'):
            st[s] = {b: PB[P + s + b].matrix.copy() for b in ('Shoulder', 'Arm', 'ForeArm', 'Hand')}
            st[s]['tip'] = PB[P + s + 'HandIndex3'].tail.copy() if (P + s + 'HandIndex3') in PB else PB[P + s + 'Hand'].tail.copy()
        frames.append(st)
        if name in CLAP and len(GLOVE['Left']) and len(GLOVE['Right']):
            from scipy.spatial import cKDTree
            dg = bpy.context.evaluated_depsgraph_get(); ev = me.evaluated_get(dg); m_ = ev.to_mesh()
            V = np.zeros(len(m_.vertices) * 3); m_.vertices.foreach_get('co', V); ev.to_mesh_clear()
            V = V.reshape(-1, 3) @ np.array(Mm)[:3, :3].T + np.array(Mm)[:3, 3]
            dd, ii = cKDTree(V[GLOVE['Right']]).query(V[GLOVE['Left']]); j = int(np.argmin(dd))
            clap_gap[k] = float(dd[j]); clap_u[k] = (Vector(V[GLOVE['Right'][ii[j]]]) - Vector(V[GLOVE['Left'][j]])).normalized()
        for s in ('Left', 'Right'):
            if name in WAVE:   # a raised hand (above the shoulder): its upper arm's heading counts toward the swing
                S_ = st[s]['Arm'].translation; w_ = smooth01((st[s]['Hand'].translation - S_).dot(UP), -0.05, 0.08)
                wave_w[s][k] = w_; wave_dir[s] += (st[s]['ForeArm'].translation - S_).normalized() * w_
        if name in FLICK:
            for s in ('Left', 'Right'):
                S, E, W = st[s]['Arm'].translation, st[s]['ForeArm'].translation, st[s]['Hand'].translation
                ax = (W - S).normalized(); e = (E - S) - ax * (E - S).dot(ax)
                ref = (-FWD - UP); ref = ref - ax * ref.dot(ax)
                bend = (E - S).angle(W - E, 0.0)
                if e.length < 1e-4 or ref.length < 1e-3: continue
                dev = ref.angle(e); sgn = 1.0 if ref.cross(e).dot(ax) > 0 else -1.0
                if dev <= FLICK_MAX: continue
                want = FLICK_MAX + (dev - FLICK_MAX) * 0.15
                w = smooth01(math.degrees(bend), 12, 30) * (1 - smooth01(W.dot(UP) - S.dot(UP), -0.12, 0.05))
                flick_d[s][k] = -sgn * (dev - want) * w
    clap_d = {s: [Vector() for _ in range(nf)] for s in ('Left', 'Right')}
    if name in CLAP and nf > 4:
        loop = abs(clap_gap[0] - clap_gap[-1]) < 0.003; n_ = nf - 1 if loop else nf     # first frame == last frame: a loop
        for m in range(n_):
            g = clap_gap[m]; a_, b_ = clap_gap[(m - 1) % n_] if loop or m > 0 else 9.0, clap_gap[(m + 1) % n_] if loop or m < n_ - 1 else 9.0
            if not (g <= a_ and g <= b_ and CLAP_GAP < g < 0.06): continue
            half = clap_u[m] * ((g - CLAP_GAP) / 2)
            for k in range(nf):
                dk = abs(k - m); dk = min(dk, n_ - dk) if loop else dk
                if dk > 4: continue
                w = math.exp(-(dk / 1.1) ** 2); clap_d['Left'][k] += half * w; clap_d['Right'][k] -= half * w
    wave_yaw = {}
    for s in ('Left', 'Right'):     # ease the turn in and out (no pops)
        flick_d[s] = np.convolve(np.pad(flick_d[s], 2, mode='edge'), np.ones(5) / 5, mode='valid')
        # one yaw for the clip: the raised upper arm's mean heading -> WAVE_OUT from straight ahead, toward its own side
        wave_yaw[s] = 0.0; h = wave_dir[s] - UP * wave_dir[s].dot(UP)
        if h.length > 1e-3:
            out_ = LEFT if s == 'Left' else -LEFT; cur = math.atan2(h.dot(out_), h.dot(FWD))
            wave_yaw[s] = (WAVE_OUT - cur) * (1.0 if s == 'Left' else -1.0)   # +yaw about UP turns toward LEFT
        wave_w[s] = np.convolve(np.pad(wave_w[s], 2, mode='edge'), np.ones(5) / 5, mode='valid')
    for k, st in enumerate(frames):
        for s in ('Left', 'Right'):
            Ms = st[s]['Shoulder']; Ma, Mf, Mh = st[s]['Arm'], st[s]['ForeArm'], st[s]['Hand']
            S, E, W = Ma.translation.copy(), Mf.translation.copy(), Mh.translation.copy(); tip = st[s]['tip'].copy()
            la, lb = (E - S).length, (W - E).length
            # FLICK: turn the whole arm round the shoulder -> wrist line (the wrist and hand path stay where they are)
            if abs(flick_d[s][k]) > 1e-4:
                R = Quaternion((W - S).normalized(), flick_d[s][k]).to_matrix()
                Ma, Mf, Mh = about(Ma, S, R), about(Mf, S, R), about(Mh, S, R); E = Mf.translation.copy(); tip = S + R @ (tip - S)
                stats['flick'] = max(stats['flick'], math.degrees(abs(flick_d[s][k]))); changed = True
            # POINT: straighten the right arm along the shoulder -> fingertip line, then line the hand up with it
            if pw is not None and s == 'Right' and pw[k] > 1e-3:
                wgt = float(pw[k]); D = (tip - S).normalized()
                bend0 = (E - S).angle(W - E, 0.0); bend = bend0 + (POINT_BEND - bend0) * wgt
                d = math.sqrt(la * la + lb * lb + 2 * la * lb * math.cos(bend))
                W2 = S + D * d; E2, W2 = two_bone(S, E, W, W2, la, lb)
                Ma2 = aim(Ma, E - S, E2 - S); Mf2 = aim(Mf, W - E, W2 - E2); Mf2.translation = E2
                hand_dir = (tip - W).normalized()
                Mh2 = (Mf2.to_3x3() @ Mf.to_3x3().inverted() @ Mh.to_3x3()).to_4x4(); Mh2.translation = W2   # hand rides the forearm
                hd = (Mf2.to_3x3() @ Mf.to_3x3().inverted() @ hand_dir).normalized()
                Rw = Quaternion().slerp(hd.rotation_difference((W2 - E2).normalized()), wgt).to_matrix()      # straight wrist
                Mh2 = (Rw @ Mh2.to_3x3()).to_4x4(); Mh2.translation = W2
                stats['point'] = max(stats['point'], math.degrees(bend0 - bend)); Ma, Mf, Mh, E, W = Ma2, Mf2, Mh2, E2, W2; changed = True
            # CLAP: the hands close the last gap at each clap (hand keeps its world rotation)
            if clap_d[s][k].length > 1e-5:
                W2 = W + clap_d[s][k]; E2, W2 = two_bone(S, E, W, W2, la, lb)
                Ma2 = aim(Ma, E - S, E2 - S); Mf2 = aim(Mf, W - E, W2 - E2); Mf2.translation = E2
                Mh2 = Mh.copy(); Mh2.translation = W2
                stats['clap'] = max(stats.get('clap', 0.0), clap_d[s][k].length * 100); Ma, Mf, Mh, E, W = Ma2, Mf2, Mh2, E2, W2; changed = True
            # WAVE: swing the raised arm round the shoulder (vertical axis) out to the side; forearm and hand ride along
            ang = wave_yaw.get(s, 0.0) * wave_w[s][k]
            if abs(ang) > 1e-4:
                R = Quaternion(UP, ang).to_matrix()
                Ma, Mf, Mh = about(Ma, S, R), about(Mf, S, R), about(Mh, S, R); E, W = Mf.translation.copy(), Mh.translation.copy()
                Mh = about(Mh, W, Quaternion((W - E).normalized(), -ang).to_matrix())   # palm turned back to face forward
                stats['wave'] = max(stats.get('wave', 0.0), math.degrees(abs(ang))); changed = True
            out[s]['Arm'].append(basis(P + s + 'Arm', Ma, Ms).to_quaternion())
            out[s]['ForeArm'].append(basis(P + s + 'ForeArm', Mf, Ma).to_quaternion())
            out[s]['Hand'].append(basis(P + s + 'Hand', Mh, Mf).to_quaternion())
    if not changed: continue
    cb = channelbag(act)
    for s in ('Left', 'Right'):
        for b, qs in out[s].items():
            q = np.array([[x.w, x.x, x.y, x.z] for x in qs])
            for i in range(1, len(q)):
                if np.dot(q[i], q[i - 1]) < 0: q[i] = -q[i]
            write(cb, P + s + b, q, f0)
    report[name] = {k: round(v, 1) for k, v in stats.items() if v}
arm.animation_data.action = None
for t_ in tracks: t_.mute = False
print('npcarms (max: flick turned back deg, point elbow straightened deg, wave arm swung out deg, clap hand moved cm)', report)
bpy.ops.wm.save_as_mainfile(filepath=dst)
