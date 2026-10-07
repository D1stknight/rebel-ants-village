# NPC hands on the floor: a clip that reaches down (pick_up) puts the hands where the mocap actor's were. A villager
# with longer arms than the actor then pushes the fingertips 8-12 cm into the ground (Warrior, Samurai, Bushi). Per
# frame, when a fingertip is below the floor, the upper arm is raised at the shoulder just enough to set the tip on
# the floor (smoothed over neighbouring frames so the correction eases in and out). Everything else is unchanged.
# usage: python3.13 handfloor.py -- in.blend out.blend
import bpy, sys, os, math, numpy as np
from mathutils import Quaternion, Vector
a = sys.argv[sys.argv.index('--') + 1:]; src, dst = a[0], a[1]
CLEAR = float(os.environ.get('FORGE_HAND_FLOOR', '0.012'))      # fingertip height kept above the floor (m)
bpy.ops.wm.open_mainfile(filepath=src)
arm = bpy.data.objects['Armature']; P = 'mixamorig_'; sc = bpy.context.scene; Aw = arm.matrix_world
FING = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky']
tracks = list(arm.animation_data.nla_tracks)
for t_ in tracks: t_.mute = True
report = {}


def tips(side):
    out = []
    for f in FING:
        for k in (4, 3):
            b = arm.pose.bones.get(f'{P}{side}Hand{f}{k}')
            if b: out.append(Aw @ b.tail); break
    return out


for act in bpy.data.actions:
    if not act.layers: continue
    arm.animation_data.action = act; arm.animation_data.action_slot = act.slots[0]
    cb = act.layers[0].strips[0].channelbag(act.slots[0])
    f0, f1 = int(act.frame_range[0]), int(act.frame_range[1]); nf = f1 - f0 + 1
    fixed = {}
    for side in ('Left', 'Right'):
        pb = arm.pose.bones.get(P + side + 'Arm')
        fcs = [cb.fcurves.find(f'pose.bones["{P}{side}Arm"].rotation_quaternion', index=i) for i in range(4)]
        if pb is None or not all(fcs): continue
        need = np.zeros(nf); axes = [None] * nf
        for k in range(nf):
            sc.frame_set(f0 + k)
            tp = tips(side)
            if not tp: break
            low = min(tp, key=lambda v: v.z)
            if low.z >= CLEAR: continue
            sh = Aw @ pb.head; v = low - sh; L = v.length
            if L < 1e-4: continue
            ax = v.cross(Vector((0, 0, 1)))
            if ax.length < 1e-6: continue
            ax.normalize()
            # angle that lifts the lowest tip by (CLEAR - z) in the vertical plane through the shoulder
            s0 = max(-1.0, min(1.0, v.z / L)); s1 = max(-1.0, min(1.0, (v.z + CLEAR - low.z) / L))
            need[k] = math.asin(s1) - math.asin(s0); axes[k] = ax
        if not need.any(): continue
        # ease in / out: hold the peak over +-3 frames, then a 7-frame blur
        d = np.array([need[max(0, i - 3):i + 4].max() for i in range(nf)])
        kk = np.ones(7) / 7; d = np.convolve(np.pad(d, 3, mode='edge'), kk, mode='valid')
        last = None
        for k in range(nf):
            if axes[k] is not None: last = axes[k]
            if d[k] < 1e-4: continue
            ax = axes[k] or last
            if ax is None:
                j = next((j for j in range(k, nf) if axes[j] is not None), None)
                if j is None: continue
                ax = axes[j]
            sc.frame_set(f0 + k)
            Mw = Aw @ pb.matrix                                       # world matrix of the upper arm now
            R = Quaternion(Aw.to_3x3().inverted() @ ax, d[k])         # rotation about the lift axis, armature space
            M = pb.matrix.copy(); loc = M.translation.copy()
            Mn = (R.to_matrix() @ M.to_3x3()).to_4x4(); Mn.translation = loc
            pb.matrix = Mn
            q = pb.rotation_quaternion.copy()
            for i in range(4):
                kp = fcs[i].keyframe_points
                for p in kp:
                    if int(round(p.co[0])) == f0 + k: p.co[1] = q[i]; break
            for i in range(4): fcs[i].update()
        fixed[side] = round(math.degrees(float(d.max())), 1)
    if fixed: report[act.name] = fixed
arm.animation_data.action = None
for t_ in tracks: t_.mute = False
print('handfloor: max shoulder lift (deg) per clip', report)
bpy.ops.wm.save_as_mainfile(filepath=dst)
