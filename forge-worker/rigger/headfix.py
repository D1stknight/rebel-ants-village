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
RELMAX_H = math.radians(float(os.environ.get('FORGE_HEAD_RELMAX', '8')))    # head: max chin-up against the chest line
RELMAX_N = math.radians(float(os.environ.get('FORGE_NECK_RELMAX', '3')))    # neck: max lean-back against the chest line
UPBIAS = math.radians(float(os.environ.get('FORGE_HEAD_UP', '0')))   # per-model: raise the chin (generators often seat the mask low)
LIFT = float(os.environ.get('FORGE_NECK_LIFT', '0.022'))    # fraction of body height the head is raised off the collar
SKIP = set(os.environ.get('FORGE_HEAD_SKIP', 'cartwheel,backflip,front_flip,flip_kick,spin_flip_kick,knockdown,get_up').split(','))
# v2.19 NPCs: the head's yaw is the twist of its turn about world up. The facing vector's heading flips 180 deg once the
# bone pitches past vertical against its rest: a Shogun neck reached 92 deg in the jump's landing crouch, so the neck
# and head turned round for three frames (the "360" of the head). Same yaw as before while the bone is upright-ish
# (idle / walk / run within 0.5-4 deg). Rebels keep the facing yaw.
NPCM = bool(os.environ.get('FORGE_NPC'))
bpy.ops.wm.open_mainfile(filepath=src)
arm = bpy.data.objects['Armature']; P = 'mixamorig_'; sc = bpy.context.scene
Aw = arm.matrix_world

# --- neck lift: generator meshes often seat the head straight on the collar. Raise the head bone (and everything under
# it) by LIFT x height and move each vertex up by its head-subtree weight, so the Neck/Head blend zone becomes a short
# visible neck. Rest-pose edit, so every clip keeps its rotations.
me = [o for o in bpy.data.objects if o.type == 'MESH'][0]
# rigid head parts: sources prepared with a rebuilt head (newhead.py) name those materials HEAD_* (skin, mask plate,
# antennae). They must move exactly with the Head bone, whatever bone heat gave them (small separate shells).
hm = {i for i, m in enumerate(me.data.materials) if m and m.name.startswith('HEAD_')}
if hm:
    hg = me.vertex_groups.get(P + 'Head')
    rv = set()
    for poly in me.data.polygons:
        if poly.material_index in hm: rv.update(poly.vertices)
    rv = sorted(rv)
    for gg in me.vertex_groups: gg.remove(rv)
    hg.add(rv, 1.0, 'REPLACE')
    print('headfix rigid head verts', len(rv))
    if 'FORGE_NECK_LIFT' not in os.environ: LIFT = 0.0      # rebuilt heads already sit right on the neck
# v2.2 adaptive lift: only open the gap between the collar and the head up to a small natural neck. A fixed 2.2 % lift
# stretched a thin sliver of neck into view on Rebels whose chin already sat just above the collar (#262 "giraffe").
if LIFT > 0 and 'FORGE_NECK_LIFT' not in os.environ:
    Mw_ = np.array(me.matrix_world); co_ = np.array([v.co[:] for v in me.data.vertices]) @ Mw_[:3, :3].T + Mw_[:3, 3]
    gn = [g.name for g in me.vertex_groups]; Wg = np.zeros((len(co_), len(gn)))
    for v in me.data.vertices:
        for g in v.groups: Wg[v.index, g.group] = g.weight
    tot_ = Wg.sum(1) + 1e-9
    def share(ns): return Wg[:, [gn.index(P + n) for n in ns if P + n in gn]].sum(1) / tot_
    headw = share(['Head']); torsow = share(['Spine2', 'Spine1', 'LeftShoulder', 'RightShoulder'])
    Nk = np.array((Aw @ arm.data.bones[P + 'Neck'].head_local)[:]); Hh0 = co_[:, 2].max() - co_[:, 2].min()
    front = (np.linalg.norm(co_[:, :2] - Nk[:2], axis=1) < 0.05 * Hh0) & (co_[:, 1] < Nk[1])
    ct, hb = co_[front & (torsow > 0.5), 2], co_[front & (headw > 0.5), 2]
    if len(ct) > 5 and len(hb) > 5:
        gap = float(np.percentile(hb, 1) - np.percentile(ct, 99))
        want = float(os.environ.get('FORGE_NECK_GAP', '0.0')) * Hh0      # lift only a chin that sinks into the collar
        LIFT = max(0.0, min(LIFT * Hh0, want - gap)) / Hh0
        print(f'headfix neck gap {gap:.4f} m, target {want:.4f} m -> lift {LIFT * Hh0:.4f} m')
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
# v2.5 the chest-line rest lean for the chin-up floor: the Spine2 bone alone can tip far back when the generator's torso
# places the spine joints in a zigzag (#469 re-forge: Spine2 -28 deg), which pushed the head down onto the chest in
# every move. Use the Hips -> Neck line instead (about upright on every Rebel).
_h0 = Aw @ arm.data.bones[P + 'Hips'].head_local; _n0 = Aw @ arm.data.bones[P + 'Neck'].head_local
CHEST0 = math.atan2((_n0 - _h0).dot(FWD), (_n0 - _h0).z)
print('headfix rest lean Spine2 %.1f, chest line %.1f' % (math.degrees(RLEAN['Spine2']), math.degrees(CHEST0)))
if abs(RLEAN['Spine2'] - CHEST0) < math.radians(10): CHEST0 = RLEAN['Spine2']     # normal spines keep the v2.3 behaviour


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
        if NPCM: yaw = 2 * math.atan2(D.z, D.w)    # v2.19 NPCs: the twist about world up (see NPCM)
        else: f = D @ FWD; yaw = math.atan2(f.y, f.x) - math.atan2(FWD.y, FWD.x)
        Y = Quaternion(Z, yaw); F = Y @ FWD
        c = lean(Aw @ pc.matrix, F)                  # chest lean from world vertical (rest chest bones often tip back)
        h = lean(Mw, F) - RLEAN[bone]
        t = max(-clamp, min(clamp, follow * c + keep * (h - c)))
        if bone == 'Head': t -= UPBIAS
        # v2.2b: never tip back more than RELMAX against the chest line. Levelling the head while the chest leans forward
        # (walk, run, guard) lifted the chin away from the collar and showed a long thin neck in every move (#262).
        t = max(t, (c - CHEST0) - (RELMAX_H if bone == 'Head' else RELMAX_N))   # both relative to the rest pose
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
