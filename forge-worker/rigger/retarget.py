# Retarget master ant clips (ant_*_c.glb, 65-bone mixamo, T-pose bind) onto a Forge-rigged character.
# Method: world-space rest-relative rotation deltas + per-bone T->A alignment; hips height scaled by leg length.
# usage: python3.13 retarget.py -- in.blend out.blend [--freeze-fingers]
import bpy, sys, json, numpy as np, mathutils as mu
import os as _os, sys as _sys; _sys.path.insert(0,_os.path.dirname(_os.path.abspath(__file__))); OUT=_os.environ.get('FORGE_OUT','.'); CLIPS_DIR=_os.environ.get('FORGE_CLIPS','assets/character')
from master import Master
from scipy.spatial.transform import Rotation as Rot

args = sys.argv[sys.argv.index('--') + 1:]
src, dst = args[0], args[1]
FREEZE_FINGERS = '--freeze-fingers' in args
CLIPS = [('idle', 'ant_idle_c'), ('walk', 'ant_walk_c'), ('run', 'ant_run_c'),
         ('jump', 'ant_jumping_c'), ('flip_kick', 'ant_flip_kick_c')]
IN_PLACE = {'walk', 'run'}                       # strip forward root drift (village strips hips pos anyway)
FPS = 30
P = 'mixamorig_'
# glTF (Y-up, +Z fwd, cm) -> Blender (Z-up, -Y fwd, m)
C = Rot.from_matrix(np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]], float))
CM = np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]], float)

bpy.ops.wm.open_mainfile(filepath=src)
arm = bpy.data.objects['Armature']
bones = arm.data.bones
names = [b.name for b in bones]
order = []                                        # parents first
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

# direction child used for alignment (same on both rigs)
def dir_child(short):
    if short == 'Spine2': return 'Neck'
    if short.endswith('Hand') and not short.endswith('Hand' + 'X'): return short + 'Middle1'
    if short.endswith('Shoulder'): return short[:-8] + 'Arm'
    return None
# v1.3: feet are NOT direction-aligned. Aligning the Foot bone to the master's steeper foot bone tipped the toes down
# (characters stood on tiptoe). Both rests have flat soles, so the raw world delta keeps the sole flat.
NO_ALIGN = {'Hips', 'Head', 'HeadTop_End', 'LeftToeBase', 'RightToeBase', 'LeftToe_End', 'RightToe_End', 'LeftFoot', 'RightFoot'}

m0 = Master(f'{CLIPS_DIR}/{CLIPS[0][1]}.glb')
MESHNODE = None
for i, n in enumerate(m0.N):
    if 'mesh' in n:
        t = n.get('translation', [0, 0, 0]); r = n.get('rotation', [0, 0, 0, 1]); s = n.get('scale', [1, 1, 1])
        MESHNODE = np.eye(4); MESHNODE[:3, :3] = Rot.from_quat(r).as_matrix() * np.array(s); MESHNODE[:3, 3] = t
Bm = {k: MESHNODE @ v for k, v in m0.bind.items()}                    # master bind, glTF world (cm)
BmR = {k: rotof(v) for k, v in Bm.items()}
Bpos = {k: CM @ v[:3, 3] / 100 for k, v in Bm.items()}                # Blender frame, metres

def mchild(short):
    """primary child of a master bone (by hierarchy)"""
    d = dir_child(short)
    if d: return d
    i = m0.names.index(P + short); ch = m0.N[i].get('children', [])
    return m0.names[ch[0]][len(P):] if ch else None

A = {}
for n in names:
    s = n[len(P):]
    if s in NO_ALIGN or (P + s) not in Bm: A[n] = Rot.identity(); continue
    c = mchild(s)
    tc = [b.name for b in bones[n].children if b.name == P + (dir_child(s) or '')] or [b.name for b in bones[n].children]
    if not c or not tc or (P + c) not in Bpos: A[n] = Rot.identity(); continue
    dt = Hrest[tc[0]] - Hrest[n]; ds = Bpos[P + c] - Bpos[n]
    dt /= np.linalg.norm(dt); ds /= np.linalg.norm(ds)
    ax = np.cross(dt, ds); sn = np.linalg.norm(ax); cs = float(np.dot(dt, ds))
    A[n] = Rot.identity() if sn < 1e-6 else Rot.from_rotvec(ax / sn * np.arctan2(sn, cs))

# leg scale + hips reference
def leglen(pos, s): return np.linalg.norm(pos[P + s + 'Leg'] - pos[P + s + 'UpLeg']) + np.linalg.norm(pos[P + s + 'Foot'] - pos[P + s + 'Leg'])
k = np.mean([leglen(Hrest, s) / leglen(Bpos, s) for s in ('Left', 'Right')])
t_ank = np.mean([Hrest[P + s + 'Foot'][2] for s in ('Left', 'Right')])
M_ANK = 0.10                                        # master ankle height above ground (m), from clip minima
print('leg scale k', round(k, 3), 'target ankle h', round(t_ank, 3))

def is_finger(n):
    s = n[len(P):]; return any(f in s for f in ('Thumb', 'Index', 'Middle', 'Ring', 'Pinky'))

def make_action(name):
    act = bpy.data.actions.new(name); act.use_fake_user = True
    slot = act.slots.new(id_type='OBJECT', name='Armature'); lay = act.layers.new('Layer'); st = lay.strips.new(type='KEYFRAME')
    return act, slot, st.channelbag(slot, ensure=True)

report = {}
for clip, fname in CLIPS:
    m = Master(f'{CLIPS_DIR}/{fname}.glb')
    times = np.arange(0, m.dur + 1e-6, 1 / FPS); nf = len(times)
    Q = {n: np.zeros((nf, 4)) for n in names}; L = np.zeros((nf, 3))
    hp = []
    for fi, t in enumerate(times):
        W = m.world(t)
        Rt = {}
        for n in order:
            if n in W and n in BmR and not (FREEZE_FINGERS and is_finger(n)) and not n.endswith('_End') and not (is_finger(n) and n.endswith('4')):
                D = C * rotof(W[n]) * BmR[n].inv() * C.inv()
                Rt[n] = D * A[n] * Rrest[n]
            else:                                   # follow parent rigidly
                p = par[n]; Rt[n] = Rt[p] * (Rrest[p].inv() * Rrest[n]) if p else Rrest[n]
            p = par[n]
            if p is None: basis = Rrest[n].inv() * Rt[n]
            else: basis = (Rrest[p].inv() * Rrest[n]).inv() * Rt[p].inv() * Rt[n]
            q = basis.as_quat()                     # x y z w
            Q[n][fi] = [q[3], q[0], q[1], q[2]]
        hp.append(CM @ W[P + 'Hips'][:3, 3] / 100)
    hp = np.array(hp)
    tgt = np.zeros_like(hp)
    tgt[:, 0] = Hrest[P + 'Hips'][0] + k * (hp[:, 0] - hp[0, 0])
    tgt[:, 1] = Hrest[P + 'Hips'][1] + k * (hp[:, 1] - hp[0, 1])
    tgt[:, 2] = t_ank + k * (hp[:, 2] - M_ANK)
    # in place: remove horizontal travel (line from first to last frame); keeps sway, bob and vertical motion
    u = times / max(times[-1], 1e-6)
    for ax_ in (0, 1):
        tgt[:, ax_] -= u * (tgt[-1, ax_] - tgt[0, ax_])
    # hips basis location (bone-local): pose = rest @ basis
    Rh = Rrest[P + 'Hips']
    L = Rh.inv().apply(tgt - Hrest[P + 'Hips'])
    # quaternion continuity
    for n in names:
        a = Q[n]
        for fi in range(1, nf):
            if np.dot(a[fi], a[fi - 1]) < 0: a[fi] = -a[fi]
    act, slot, cb = make_action(clip)
    frames = np.arange(nf, dtype=float)
    for n in names:
        for ci in range(4):
            fc = cb.fcurves.new(f'pose.bones["{n}"].rotation_quaternion', index=ci, group_name=n)
            fc.keyframe_points.add(nf); fc.keyframe_points.foreach_set('co', np.c_[frames, Q[n][:, ci]].ravel())
            for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
    for ci in range(3):
        fc = cb.fcurves.new(f'pose.bones["{P}Hips"].location', index=ci, group_name=P + 'Hips')
        fc.keyframe_points.add(nf); fc.keyframe_points.foreach_set('co', np.c_[frames, L[:, ci]].ravel())
        for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
    act.frame_range = (0, nf - 1)
    report[clip] = dict(frames=nf, dur=float(times[-1]), hips_z=[float(tgt[:, 2].min()), float(tgt[:, 2].max())])
    print(clip, report[clip])

for pb in arm.pose.bones: pb.rotation_mode = 'QUATERNION'
arm.animation_data_create()
# NLA: one track per clip so the glTF exporter emits one animation per action
for clip, _ in CLIPS:
    act = bpy.data.actions[clip]
    tr = arm.animation_data.nla_tracks.new(); tr.name = clip
    s = tr.strips.new(clip, 0, act); s.action_slot = act.slots[0]; tr.mute = False
arm.animation_data.action = None
bpy.ops.wm.save_as_mainfile(filepath=dst)
json.dump(report, open(dst + '.json', 'w'), indent=1)
