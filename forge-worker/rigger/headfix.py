# v1.7 head level: mocap actors tuck the chin (fight stance, strikes), which reads as "looking at the floor" on a
# big ant head. For every clip, keep the head's world yaw but only KEEP (default 30%) of its pitch/roll relative to the
# rest pose, so the Rebel looks straight ahead while the body still leans into moves.
# usage: python3.13 headfix.py -- in.blend out.blend
import bpy, sys, os, math, numpy as np
from mathutils import Quaternion, Vector
a = sys.argv[sys.argv.index('--') + 1:]; src, dst = a[0], a[1]
KEEP = float(os.environ.get('FORGE_HEAD_KEEP', '0.3'))
SKIP = set(os.environ.get('FORGE_HEAD_SKIP', 'cartwheel,backflip,front_flip,flip_kick,spin_flip_kick,knockdown,get_up').split(','))
bpy.ops.wm.open_mainfile(filepath=src)
arm = bpy.data.objects['Armature']; P = 'mixamorig_'; sc = bpy.context.scene
pb = arm.pose.bones[P + 'Head']
Aw = arm.matrix_world
Rrest = (Aw @ pb.bone.matrix_local).to_quaternion()
FWD = Vector((0, -1, 0))                      # characters face -Y after import
tracks = list(arm.animation_data.nla_tracks)
report = {}
for t_ in tracks: t_.mute = True
for act in bpy.data.actions:
    if not act.layers or act.name in SKIP: continue
    cb = act.layers[0].strips[0].channelbag(act.slots[0])
    fcs = [cb.fcurves.find(f'pose.bones["{P}Head"].rotation_quaternion', index=i) for i in range(4)]
    if not all(fcs): continue
    arm.animation_data.action = act; arm.animation_data.action_slot = act.slots[0]
    nk = len(fcs[0].keyframe_points)
    frames = [int(round(kp.co[0])) for kp in fcs[0].keyframe_points]
    out = np.zeros((nk, 4)); pitch = []
    for k, fi in enumerate(frames):
        sc.frame_set(fi)
        Mw = Aw @ pb.matrix
        D = Mw.to_quaternion() @ Rrest.inverted()               # world delta from the rest head
        f = D @ FWD
        yaw = math.atan2(f.y, f.x) - math.atan2(FWD.y, FWD.x)       # heading of the head about +Z, relative to rest
        Y = Quaternion((0, 0, 1), yaw)
        T = Y.inverted() @ D                                      # pitch/roll part
        pitch.append(math.degrees(2 * math.acos(min(1.0, abs(T.w)))))
        Tn = Quaternion().slerp(T, KEEP)
        Rn = (Y @ Tn) @ Rrest
        Mn = Rn.to_matrix().to_4x4(); Mn.translation = Mw.translation
        pb.matrix = Aw.inverted() @ Mn                            # sets the basis for this frame
        q = pb.rotation_quaternion.copy()
        if k and np.dot(out[k - 1], [q.w, q.x, q.y, q.z]) < 0: q = -q
        out[k] = [q.w, q.x, q.y, q.z]
    for i in range(4):
        co = np.zeros(nk * 2); fcs[i].keyframe_points.foreach_get('co', co); co = co.reshape(-1, 2)
        co[:, 1] = out[:, i]; fcs[i].keyframe_points.foreach_set('co', co.ravel()); fcs[i].update()
    report[act.name] = round(float(np.mean(pitch)), 1)
arm.animation_data.action = None
for t_ in tracks: t_.mute = False
print('headfix mean head tilt before (deg):', report, 'keep', KEEP)
bpy.ops.wm.save_as_mainfile(filepath=dst)
