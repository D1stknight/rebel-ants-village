# v1.8 natural head carriage. Mocap actors tuck the chin (fight stance, strikes), which reads as "looking at the floor"
# on a big ant head. v1.7 levelled the head in world space, but then the head no longer followed the chest: with the
# body leaning it looked tilted and neckless. Now, per frame:
#   - keep the head's world yaw (where it looks),
#   - drop roll entirely (no sideways tilt),
#   - lean = FOLLOW x chest lean + KEEP x the head's own nod relative to the chest (the chin tuck), clamped,
#   - the neck first continues the chest line (so the head sits up on a visible neck instead of sinking into the collar).
# usage: python3.13 headfix.py -- in.blend out.blend
import bpy, sys, os, math, numpy as np
from mathutils import Quaternion, Vector
a = sys.argv[sys.argv.index('--') + 1:]; src, dst = a[0], a[1]
FOLLOW = float(os.environ.get('FORGE_HEAD_FOLLOW', '0.3'))
KEEP = float(os.environ.get('FORGE_HEAD_KEEP', '0.1'))
NECK_FOLLOW = float(os.environ.get('FORGE_NECK_FOLLOW', '0.8'))
NECK_KEEP = float(os.environ.get('FORGE_NECK_KEEP', '0.3'))
CLAMP = math.radians(float(os.environ.get('FORGE_HEAD_CLAMP', '12')))
LIFT = float(os.environ.get('FORGE_NECK_LIFT', '0.022'))    # fraction of body height the head is raised off the collar
SKIP = set(os.environ.get('FORGE_HEAD_SKIP', 'cartwheel,backflip,front_flip,flip_kick,spin_flip_kick,knockdown,get_up').split(','))
bpy.ops.wm.open_mainfile(filepath=src)
arm = bpy.data.objects['Armature']; P = 'mixamorig_'; sc = bpy.context.scene
Aw = arm.matrix_world

# --- neck lift: generator meshes often seat the head straight on the collar. Raise the head bone (and everything under
# it) by LIFT x height and move each vertex up by its head-subtree weight, so the Neck/Head blend zone becomes a short
# visible neck. Rest-pose edit, so every clip keeps its rotations.
me = [o for o in bpy.data.objects if o.type == 'MESH'][0]
if LIFT > 0:
    zs = [(me.matrix_world @ v.co).z for v in me.data.vertices]; Hh = max(zs) - min(zs)
    dw = Vector((0, 0, LIFT * Hh))
    sub = [b.name for b in arm.data.bones if b.name == P + 'Head' or b.parent_recursive and arm.data.bones[P + 'Head'] in b.parent_recursive]
    gidx = {me.vertex_groups[n].index for n in sub if n in me.vertex_groups}
    dl = me.matrix_world.to_3x3().inverted() @ dw
    for v in me.data.vertices:
        w = sum(g.weight for g in v.groups if g.group in gidx)
        if w > 1e-4: v.co += dl * min(1.0, w)
    bpy.context.view_layer.objects.active = arm; arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    da = Aw.to_3x3().inverted() @ dw
    for n in sub:
        eb = arm.data.edit_bones[n]; eb.head += da; eb.tail += da
    bpy.ops.object.mode_set(mode='OBJECT')
    print('headfix neck lift', round(LIFT * Hh, 4), 'bones', len(sub))
FWD = Vector((0, -1, 0))                      # characters face -Y after import
X, Z, UP = Vector((1, 0, 0)), Vector((0, 0, 1)), Vector((0, 1, 0))
pc = arm.pose.bones[P + 'Spine2']
REST = {n: (Aw @ arm.pose.bones[P + n].bone.matrix_local) for n in ('Spine2', 'Neck', 'Head')}


def lean(M, F):
    """forward lean (radians, + = tipping forward) of a bone's long (Y) axis, measured in the plane of facing F"""
    d = M.to_3x3() @ UP
    return math.atan2(d.dot(F), d.z)


RLEAN = {n: lean(m, FWD) for n, m in REST.items()}


def level(bone, follow, keep, clamp, frames_out):
    pb = arm.pose.bones[P + bone]; Rrest = REST[bone].to_quaternion()
    cb = act.layers[0].strips[0].channelbag(act.slots[0])
    fcs = [cb.fcurves.find(f'pose.bones["{P}{bone}"].rotation_quaternion', index=i) for i in range(4)]
    if not all(fcs): return None
    nk = len(fcs[0].keyframe_points)
    frames = [int(round(kp.co[0])) for kp in fcs[0].keyframe_points]
    out = np.zeros((nk, 4)); before = []; after = []
    for k, fi in enumerate(frames):
        sc.frame_set(fi)
        Mw = Aw @ pb.matrix
        D = Mw.to_quaternion() @ Rrest.inverted()
        f = D @ FWD; yaw = math.atan2(f.y, f.x) - math.atan2(FWD.y, FWD.x)
        Y = Quaternion(Z, yaw); F = Y @ FWD
        c = lean(Aw @ pc.matrix, F)                  # chest lean from world vertical (rest chest bones often tip back)
        h = lean(Mw, F) - RLEAN[bone]
        t = max(-clamp, min(clamp, follow * c + keep * (h - c)))
        before.append(math.degrees(h)); after.append(math.degrees(t))
        Rn = Quaternion(Y @ X, t) @ Y @ Rrest          # yaw kept, roll dropped, lean t about the yawed side axis
        Mn = Rn.to_matrix().to_4x4(); Mn.translation = Mw.translation
        pb.matrix = Aw.inverted() @ Mn
        q = pb.rotation_quaternion.copy()
        if k and np.dot(out[k - 1], [q.w, q.x, q.y, q.z]) < 0: q = -q
        out[k] = [q.w, q.x, q.y, q.z]
    for i in range(4):
        co = np.zeros(nk * 2); fcs[i].keyframe_points.foreach_get('co', co); co = co.reshape(-1, 2)
        co[:, 1] = out[:, i]; fcs[i].keyframe_points.foreach_set('co', co.ravel()); fcs[i].update()
    return (round(float(np.mean(before)), 1), round(float(np.mean(after)), 1))


tracks = list(arm.animation_data.nla_tracks)
report = {}
for t_ in tracks: t_.mute = True
for act in bpy.data.actions:
    if not act.layers or act.name in SKIP: continue
    arm.animation_data.action = act; arm.animation_data.action_slot = act.slots[0]
    # neck first (continues the chest line so the head sits up on a visible neck), then the head
    n = level('Neck', NECK_FOLLOW, NECK_KEEP, math.radians(30), None)
    h = level('Head', FOLLOW, KEEP, CLAMP, None)
    report[act.name] = {'neck': n, 'head': h}
arm.animation_data.action = None
for t_ in tracks: t_.mute = False
print('headfix v1.8 mean forward lean deg (before, after):', report)
bpy.ops.wm.save_as_mainfile(filepath=dst)
