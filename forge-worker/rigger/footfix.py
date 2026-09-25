# v1.3 feet: straighten splayed feet and shrink oversized footwear on an animated rig.
# - splay: measured per side from the rest mesh (foot vertices' long axis vs forward); a constant twist in the Foot
#   bone's rest frame turns it to TARGET_SPLAY degrees, carried through every clip.
# - size: Foot bones get a constant scale (footwear shrinks toward the ankle); hips drop by the sole lift so feet stay grounded.
# usage: python3.13 footfix.py -- in.blend out.blend [scale=0.85] [target_splay_deg=6]
import bpy, sys, numpy as np, mathutils as mu
a = sys.argv[sys.argv.index('--') + 1:]; src, dst = a[0], a[1]
S = float(a[2]) if len(a) > 2 else 0.85; TARGET = float(a[3]) if len(a) > 3 else 6.0
bpy.ops.wm.open_mainfile(filepath=src)
arm = bpy.data.objects['Armature']; me = [o for o in bpy.data.objects if o.type == 'MESH'][0]; P = 'mixamorig_'
V = np.array([(me.matrix_world @ v.co)[:] for v in me.data.vertices]); zmin = V[:, 2].min(); H = V[:, 2].max() - zmin
fix = {}
for side, sg in (('Left', 1), ('Right', -1)):
    f = V[(V[:, 2] < zmin + 0.035 * H) & (np.sign(V[:, 0]) == sg)]
    xy = f[:, :2] - f[:, :2].mean(0); w, e = np.linalg.eigh(np.cov(xy.T)); d = e[:, -1]
    if d[1] > 0: d = -d                                   # forward is -Y
    splay = np.degrees(np.arctan2(d[0] * sg, -d[1]))       # + = toes outward
    corr = -(splay - TARGET) * sg                          # rotate about +Z (Left: negative turns toes in)
    b = arm.data.bones[P + side + 'Foot']; R = b.matrix_local.to_3x3()
    Qc = (R.inverted() @ mu.Matrix.Rotation(np.radians(corr), 3, 'Z') @ R).to_quaternion()
    fix[side] = dict(splay=round(float(splay), 1), corr=round(float(corr), 1), q=Qc)
ank = np.mean([arm.data.bones[P + s + 'Foot'].head_local.z for s in ('Left', 'Right')])
drop = (1 - S) * ank
Rh = arm.data.bones[P + 'Hips'].matrix_local.to_3x3().inverted()
dl = Rh @ mu.Vector((0, 0, -drop))
for act in bpy.data.actions:
    if not act.layers: continue
    cb = act.layers[0].strips[0].channelbag(act.slots[0])
    for side in ('Left', 'Right'):
        n = P + side + 'Foot'
        fcs = [cb.fcurves.find(f'pose.bones["{n}"].rotation_quaternion', index=i) for i in range(4)]
        if not all(fcs): continue
        nk = len(fcs[0].keyframe_points); co = [np.zeros(nk * 2) for _ in range(4)]
        for i in range(4): fcs[i].keyframe_points.foreach_get('co', co[i])
        Q = np.stack([c.reshape(-1, 2)[:, 1] for c in co], 1)
        qc = fix[side]['q']
        for k in range(nk):
            q = mu.Quaternion(Q[k]) @ qc; Q[k] = [q.w, q.x, q.y, q.z]
        for i in range(4):
            c = co[i].reshape(-1, 2); c[:, 1] = Q[:, i]; fcs[i].keyframe_points.foreach_set('co', c.ravel()); fcs[i].update()
        frames = [kp.co[0] for kp in fcs[0].keyframe_points]
        for i in range(3):
            fc = cb.fcurves.find(f'pose.bones["{n}"].scale', index=i) or cb.fcurves.new(f'pose.bones["{n}"].scale', index=i, group_name=n)
            fc.keyframe_points.clear(); fc.keyframe_points.add(len(frames))
            fc.keyframe_points.foreach_set('co', np.c_[frames, np.full(len(frames), S)].ravel())
            for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
    for i in range(3):
        fc = cb.fcurves.find(f'pose.bones["{P}Hips"].location', index=i)
        if not fc: continue
        c = np.zeros(len(fc.keyframe_points) * 2); fc.keyframe_points.foreach_get('co', c); c = c.reshape(-1, 2); c[:, 1] += dl[i]
        fc.keyframe_points.foreach_set('co', c.ravel()); fc.update()
print('footfix', {k: (v['splay'], v['corr']) for k, v in fix.items()}, 'scale', S, 'hips drop', round(drop, 4))
bpy.ops.wm.save_as_mainfile(filepath=dst)
