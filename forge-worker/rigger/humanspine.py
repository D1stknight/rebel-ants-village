# v2.38 Saints players (job.sh: FORGE_FRIEND=human): the fight stance without the hunch. The Mixamo actor's guard rounds
# the upper back (fight_idle: Spine1 + Spine2 bend 27 deg forward of his rest) and tips the head back to see past it,
# which on a realistic person reads as a hunchback. A fighter leans from the waist with the back fairly straight: in the
# fight moves the forward bend of Spine1 / Spine2 (about the body's side axis, from the rest) keeps FORGE_HUMAN_BACK_K of
# itself, and the Spine joint (the waist) bends so the neck stays where it was over the hips (the same lean, a straighter
# back; FORGE_HUMAN_HINGE 1 = all of it). Twists, side bends and backward bends are kept; acrobatics, falls and the games /
# weapon moves are left as they are. Runs before headfix, which then carries the head for the straighter chest.
# usage: python3.13 humanspine.py -- in.blend out.blend
import bpy, sys, os, math, mathutils as mu
a = sys.argv[sys.argv.index('--') + 1:]; src, dst = a
K = float(os.environ.get('FORGE_HUMAN_BACK_K', '0.4')); HINGE = float(os.environ.get('FORGE_HUMAN_HINGE', '1'))
MOVES = set(os.environ.get('FORGE_HUMAN_SPINE_CLIPS', 'fight_idle,jab,cross_punch,hook_punch,punch_combo,elbow_punch,hit_reaction,'
                           'front_kick,side_kick,roundhouse_kick,crescent_kick').split(','))
bpy.ops.wm.open_mainfile(filepath=src)
arm = bpy.data.objects['Armature']; P = 'mixamorig_'; B = arm.data.bones
side = (arm.matrix_world.inverted().to_3x3() @ mu.Vector((1, 0, 0))).normalized()   # the body's side axis (faces -Y)
def axis(n):   # that axis in the bone's own rest frame: a turn about it bends the bone forward (+) / back (-)
    return (B[P + n].matrix_local.to_3x3().inverted() @ side).normalized()
def rel(n): return B[P + n].parent.matrix_local.inverted() @ B[P + n].matrix_local   # rest, in the parent's frame
R1, R2, TN = rel('Spine1'), rel('Spine2'), rel('Neck').translation
def neck(q1, q2):   # the neck joint in the Spine bone's posed frame (Spine1 / Spine2 turned by q1 / q2)
    return (R1 @ q1.to_matrix().to_4x4() @ R2 @ q2.to_matrix().to_4x4()) @ TN
def about(u, v, ax):   # signed angle u -> v about ax (both seen in the plane across ax)
    u = u - ax * u.dot(ax); v = v - ax * v.dot(ax)
    return math.atan2(ax.dot(u.cross(v)), u.dot(v))
def bags(act):
    for Ly in act.layers:
        for st in Ly.strips:
            for cb in st.channelbags: yield cb
def split(q, ax):   # q = swing @ bend(ax): the bend angle about ax and the swing left (q with w >= 0)
    v = mu.Vector((q.x, q.y, q.z)); th = 2 * math.atan2(v.dot(ax), q.w)
    return q @ mu.Quaternion(ax, th).inverted(), th
def get(f, k):
    q = mu.Quaternion([f[i].keyframe_points[k].co[1] for i in range(4)]).normalized(); s = -1 if q.w < 0 else 1
    return (q if s > 0 else -q), s
def put(f, k, q, s):   # keep the key's own sign, so neighbouring keys stay on one side
    for i in range(4): f[i].keyframe_points[k].co[1] = s * q[i]
BACK = ['Spine1', 'Spine2']; AX = {n: axis(n) for n in ['Spine'] + BACK}
done = []
for act in bpy.data.actions:
    if act.name not in MOVES: continue
    for cb in bags(act):
        fc = {n: [cb.fcurves.find(f'pose.bones["{P + n}"].rotation_quaternion', index=i) for i in range(4)] for n in ['Spine'] + BACK}
        if not all(all(v) for v in fc.values()): continue
        nk = len(fc['Spine'][0].keyframe_points)
        if any(len(fc[n][0].keyframe_points) != nk for n in BACK): print('humanspine: keys differ', act.name); continue
        gave_max = hinge_max = 0.0
        for k in range(nk):
            Q = {n: get(fc[n], k) for n in ['Spine'] + BACK}; new = {}
            gave = 0.0
            for n in BACK:
                q, sg = Q[n]; sw, th = split(q, AX[n])
                if th > 0: th2 = th * K; gave += th - th2; new[n] = sw @ mu.Quaternion(AX[n], th2)
                else: new[n] = q
            phi = HINGE * about(neck(new['Spine1'], new['Spine2']), neck(Q['Spine1'][0], Q['Spine2'][0]), AX['Spine'])
            q, sg = Q['Spine']; sw, th = split(q, AX['Spine'])
            put(fc['Spine'], k, sw @ mu.Quaternion(AX['Spine'], th + phi), sg)
            for n in BACK: put(fc[n], k, new[n], Q[n][1])
            gave_max = max(gave_max, gave); hinge_max = max(hinge_max, phi)
        for n in ['Spine'] + BACK:
            for f in fc[n]: f.update()
        done.append(f'{act.name} {math.degrees(gave_max):.0f}/{math.degrees(hinge_max):.0f}')
print('humanspine (upper-back bend given up / waist bend added, max deg):', ', '.join(done), '| K', K, 'hinge', HINGE)
bpy.ops.wm.save_as_mainfile(filepath=dst)
