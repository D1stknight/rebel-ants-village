# Retarget CMU BVH segments onto a Forge-rigged character (65-bone mixamorig_ rig in an anim.blend).
# Same method as retarget.py: world-space rest-relative rotation deltas + per-bone rest direction alignment,
# hips height scaled by leg-length ratio, horizontal travel removed (in place), yaw normalised to face forward.
# usage: python3.13 retarget_bvh.py -- in.blend out.blend clips.json
import bpy, sys, json, numpy as np
import os as _o; sys.path.insert(0, _o.path.dirname(_o.path.abspath(__file__)))
from bvhfk import BVH
from npzsrc import NPZSrc
from scipy.spatial.transform import Rotation as Rot

args = sys.argv[sys.argv.index('--') + 1:]
src_blend, dst_blend, clips_json = args[0], args[1], args[2]
CLIPS = json.load(open(clips_json))
FPS = 30; P = 'mixamorig_'
C = Rot.from_matrix(np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]], float)); CM = C.as_matrix()   # Y-up -> Blender Z-up

MAP = {'Hips': 'Hips', 'Spine': 'LowerBack', 'Spine1': 'Spine', 'Spine2': 'Spine1', 'Neck': 'Neck', 'Head': 'Head'}
for s in ('Left', 'Right'):
    for b in ('Shoulder', 'Arm', 'ForeArm', 'Hand', 'UpLeg', 'Leg', 'Foot', 'ToeBase'): MAP[s + b] = s + b
SRC_CHILD = {'LowerBack': 'Spine', 'Spine': 'Spine1', 'Spine1': 'Neck1', 'Neck': 'Head'}
for s in ('Left', 'Right'):
    SRC_CHILD.update({s + 'Shoulder': s + 'Arm', s + 'Arm': s + 'ForeArm', s + 'ForeArm': s + 'Hand', s + 'Hand': s + 'HandIndex1',
                      s + 'UpLeg': s + 'Leg', s + 'Leg': s + 'Foot', s + 'Foot': s + 'ToeBase'})
DST_CHILD = {'Spine': 'Spine1', 'Spine1': 'Spine2', 'Spine2': 'Neck', 'Neck': 'Head'}
for s in ('Left', 'Right'):
    DST_CHILD.update({s + 'Shoulder': s + 'Arm', s + 'Arm': s + 'ForeArm', s + 'ForeArm': s + 'Hand', s + 'Hand': s + 'HandMiddle1',
                      s + 'UpLeg': s + 'Leg', s + 'Leg': s + 'Foot', s + 'Foot': s + 'ToeBase'})

# Mixamo sources (fbx2npz .npz) use the same bone names as the target
MAP_MX = {d: d for d in MAP}
SRC_CHILD_MX = dict(DST_CHILD)
bpy.ops.wm.open_mainfile(filepath=src_blend)
arm = bpy.data.objects['Armature']; bones = arm.data.bones; names = [b.name for b in bones]
order = []
def visit(b):
    order.append(b.name)
    for c in b.children: visit(c)
for b in bones:
    if b.parent is None: visit(b)
def rotof(M):
    U = np.array(M)[:3, :3].copy(); U /= np.linalg.norm(U, axis=0); return Rot.from_matrix(U)
Rrest = {n: rotof(bones[n].matrix_local) for n in names}
Hrest = {n: np.array(bones[n].head_local) for n in names}
par = {n: (bones[n].parent.name if bones[n].parent else None) for n in names}
def leglen(pos, s, pre): return np.linalg.norm(pos[pre + s + 'Leg'] - pos[pre + s + 'UpLeg']) + np.linalg.norm(pos[pre + s + 'Foot'] - pos[pre + s + 'Leg'])
t_ank = np.mean([Hrest[P + s + 'Foot'][2] for s in ('Left', 'Right')])

def make_action(name):
    if name in bpy.data.actions: bpy.data.actions.remove(bpy.data.actions[name])
    act = bpy.data.actions.new(name); act.use_fake_user = True
    slot = act.slots.new(id_type='OBJECT', name='Armature'); lay = act.layers.new('Layer'); st = lay.strips.new(type='KEYFRAME')
    return act, slot, st.channelbag(slot, ensure=True)

cache = {}
report = {}
for clip in CLIPS:
    name, f = clip['name'], clip['file']
    if not _o.path.isabs(f): f = _o.path.join(_o.environ.get('FORGE_PACK', '.'), f)
    IS_MX = f.endswith('.npz')
    MAP_, SC_ = (MAP_MX, SRC_CHILD_MX) if IS_MX else (MAP, SRC_CHILD)
    if f not in cache: cache[f] = NPZSrc(f) if IS_MX else BVH(f)
    t0 = clip.get('t0', 0.0); t1 = clip.get('t1', 1e9)
    b = cache[f]; bi = {n: i for i, n in enumerate(b.names)}
    # source rest (zero rotations): world positions from offsets, Blender frame
    rest = np.zeros((len(b.names), 3))
    for j in range(len(b.names)):
        rest[j] = b.offset[j] + (rest[b.parent[j]] if b.parent[j] >= 0 else 0)
    restB = {n: CM @ rest[bi[n]] for n in b.names}
    k = np.mean([leglen(Hrest, s, P) / leglen(restB, s, '') for s in ('Left', 'Right')])
    src_stand = rest[bi['Hips'], 1] - min(rest[bi[s + 'ToeBase'], 1] for s in ('Left', 'Right'))
    # alignment: rotate target rest bone direction onto source rest bone direction
    A = {}
    for d, sname in MAP_.items():
        n = P + d
        if d in ('Hips', 'Head') or d.endswith('ToeBase') or d.endswith('Foot') or d not in DST_CHILD or sname not in SC_: A[n] = Rot.identity(); continue
        dt = Hrest[P + DST_CHILD[d]] - Hrest[n]; ds = restB[SC_[sname]] - restB[sname]
        if np.linalg.norm(dt) < 1e-6 or np.linalg.norm(ds) < 1e-6: A[n] = Rot.identity(); print('no-align', d); continue
        dt /= np.linalg.norm(dt); ds /= np.linalg.norm(ds)
        ax = np.cross(dt, ds); sn = np.linalg.norm(ax); cs = float(np.dot(dt, ds))
        A[n] = Rot.identity() if sn < 1e-6 else Rot.from_rotvec(ax / sn * np.arctan2(sn, cs))
    step = max(1, int(round(1 / (FPS * b.dt))))
    frames = np.arange(int(t0 / b.dt), min(int(t1 / b.dt), b.nf - 1) + 1, step)
    Pw, Rw = b.fk(frames); nf = len(frames)
    # yaw normalisation (BVH frame, about +Y): hips forward at the first frame -> +Z
    fwd = Rw[bi['Hips']][0].apply([0, 0, 1]); yaw = np.arctan2(fwd[0], fwd[2]) + np.radians(clip.get('yaw_deg', 0))
    if IS_MX: yaw = np.radians(clip.get('yaw_deg', 0))     # Mixamo clips are authored facing +Z; fight stances turn the hips on purpose
    Y = Rot.from_euler('y', -yaw)
    Q = {n: np.zeros((nf, 4)) for n in names}
    for fi in range(nf):
        Rt = {}
        for n in order:
            d = n[len(P):]
            if d in MAP_:
                Dw = C * Y * Rw[bi[MAP_[d]]][fi] * C.inv()            # source rest is identity
                if clip.get('mirror'):
                    pass
                Rt[n] = Dw * A[n] * Rrest[n]
            else:
                p = par[n]; Rt[n] = Rt[p] * (Rrest[p].inv() * Rrest[n]) if p else Rrest[n]
            p = par[n]
            basis = Rrest[n].inv() * Rt[n] if p is None else (Rrest[p].inv() * Rrest[n]).inv() * Rt[p].inv() * Rt[n]
            q = basis.as_quat(); Q[n][fi] = [q[3], q[0], q[1], q[2]]
    hp = Y.apply(Pw[:, bi['Hips']] - np.array([Pw[0, bi['Hips'], 0], 0, Pw[0, bi['Hips'], 2]]))
    hpB = (CM @ hp.T).T
    tgt = np.zeros_like(hpB)
    tgt[:, 0] = Hrest[P + 'Hips'][0] + k * hpB[:, 0]
    tgt[:, 1] = Hrest[P + 'Hips'][1] + k * hpB[:, 1]
    tgt[:, 2] = Hrest[P + 'Hips'][2] + k * (hpB[:, 2] - src_stand)
    if clip.get('in_place', True):
        u = np.linspace(0, 1, nf)
        for a in (0, 1): tgt[:, a] -= tgt[0, a] - Hrest[P + 'Hips'][a] + u * (tgt[-1, a] - tgt[0, a])
    L = Rrest[P + 'Hips'].inv().apply(tgt - Hrest[P + 'Hips'])
    for n in names:
        a = Q[n]
        for fi in range(1, nf):
            if np.dot(a[fi], a[fi - 1]) < 0: a[fi] = -a[fi]
    act, slot, cb = make_action(name)
    fr = np.arange(nf, dtype=float)
    for n in names:
        for ci in range(4):
            fc = cb.fcurves.new(f'pose.bones["{n}"].rotation_quaternion', index=ci, group_name=n)
            fc.keyframe_points.add(nf); fc.keyframe_points.foreach_set('co', np.c_[fr, Q[n][:, ci]].ravel())
            for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
    for ci in range(3):
        fc = cb.fcurves.new(f'pose.bones["{P}Hips"].location', index=ci, group_name=P + 'Hips')
        fc.keyframe_points.add(nf); fc.keyframe_points.foreach_set('co', np.c_[fr, L[:, ci]].ravel())
        for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
    act.frame_range = (0, nf - 1)
    tr = arm.animation_data.nla_tracks.get(name) or arm.animation_data.nla_tracks.new()
    for s_ in list(tr.strips): tr.strips.remove(s_)
    tr.name = name; s_ = tr.strips.new(name, 0, act); s_.action_slot = act.slots[0]; tr.mute = False
    report[name] = dict(frames=nf, dur=round((nf - 1) / FPS, 2), k=round(float(k), 3), hips_z=[round(float(tgt[:, 2].min()), 3), round(float(tgt[:, 2].max()), 3)])
    print(name, report[name])
# ---- ground-contact pass: keep the lowest contact (feet/toes/hands/head) on the floor every frame ----
sc = bpy.context.scene
CONTACT = {P + 'LeftFoot': t_ank, P + 'RightFoot': t_ank, P + 'LeftToeBase': 0.035, P + 'RightToeBase': 0.035,
           P + 'LeftHand': 0.05, P + 'RightHand': 0.05, P + 'HeadTop_End': 0.05, P + 'Head': 0.12}
for clip in CLIPS:
    if not clip.get('grounded', True): continue
    name = clip['name']; act = bpy.data.actions[name]
    for t_ in arm.animation_data.nla_tracks: t_.mute = True
    arm.animation_data.action = act; arm.animation_data.action_slot = act.slots[0]
    nf = int(act.frame_range[1]) + 1; delta = np.zeros(nf)
    for fi in range(nf):
        sc.frame_set(fi); dg = bpy.context.evaluated_depsgraph_get()
        mw = arm.matrix_world
        vals = [thr - (mw @ arm.pose.bones[b].head).z for b, thr in CONTACT.items() if b in arm.pose.bones]
        delta[fi] = max(vals)
    if clip.get('airborne'):
        # airborne clips (jumps, flips): only correct frames that are near the floor; interpolate across flight
        ok_ = delta > -0.10
        if ok_.sum() >= 2: delta = np.interp(np.arange(nf), np.nonzero(ok_)[0], delta[ok_])
    k_ = np.ones(5) / 5; ds = np.convolve(np.pad(delta, 2, mode='edge'), k_, mode='valid')
    cb = act.layers[0].strips[0].channelbag(act.slots[0])
    Rh = Rrest[P + 'Hips']; dl = Rh.inv().apply(np.c_[np.zeros(nf), np.zeros(nf), ds])
    for ci in range(3):
        fc = cb.fcurves.find(f'pose.bones["{P}Hips"].location', index=ci)
        co = np.zeros(nf * 2); fc.keyframe_points.foreach_get('co', co); co = co.reshape(-1, 2); co[:, 1] += dl[:, ci]
        fc.keyframe_points.foreach_set('co', co.ravel()); fc.update()
    report[name]['ground_shift'] = [round(float(ds.min()), 3), round(float(ds.max()), 3)]
    print(name, 'ground shift', report[name]['ground_shift'])
for t_ in arm.animation_data.nla_tracks: t_.mute = False
arm.animation_data.action = None
bpy.ops.wm.save_as_mainfile(filepath=dst_blend)
json.dump(report, open(dst_blend + '.json', 'w'), indent=1)
