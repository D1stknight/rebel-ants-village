# Forge Rigger v2.21 NPC cuff bones (made by handswap): each <side>ForeArmCuff sits where the hand turns, under the
# forearm, along the sleeve, and follows only the hand's twist about the sleeve's axis (a round cuff spinning in place
# shows nothing), never its bend, so the cuff stays in the sleeve while the hand gestures. Keys at the hand's own keys.
# Run after the last step that changes the hands (end of the NPC block); handswap bakes a first set for the steps between.
# usage: python3.13 cufftwist.py -- in.blend out.blend
import bpy, sys, math, mathutils as mu
P = 'mixamorig_'


def bags(act):
    for L in act.layers:
        for st in L.strips:
            for cb in st.channelbags: yield cb


def bake(arm):
    n = 0
    for act in bpy.data.actions:
        for side in ('Left', 'Right'):
            hn, cn = P + side + 'Hand', P + side + 'ForeArmCuff'
            if cn not in arm.pose.bones: continue
            B = arm.data.bones; Fr = B[P + side + 'ForeArm'].matrix_local
            Qh = (Fr.inverted() @ B[hn].matrix_local).to_quaternion()                                   # the hand's rest in the forearm
            ax = (Fr.to_3x3().inverted() @ (B[cn].matrix_local.to_3x3() @ mu.Vector((0, 1, 0)))).normalized()   # the sleeve axis there
            for cb in bags(act):
                for fc in list(cb.fcurves):
                    if f'pose.bones["{cn}"]' in fc.data_path: cb.fcurves.remove(fc)
                fcs = [cb.fcurves.find(f'pose.bones["{hn}"].rotation_quaternion', index=i) for i in range(4)]
                if not all(fcs): continue
                frames = sorted({round(kp.co[0], 4) for fc in fcs for kp in fc.keyframe_points})
                vals = []
                for fr in frames:
                    D = Qh @ mu.Quaternion([fc.evaluate(fr) for fc in fcs]).normalized() @ Qh.inverted()   # the hand's turn, in the forearm
                    th = 2 * math.atan2(mu.Vector((D.x, D.y, D.z)).dot(ax), D.w)                             # its twist about the sleeve
                    t = mu.Quaternion((0, 1, 0), th)
                    if vals and vals[-1].dot(t) < 0: t.negate()
                    vals.append(t)
                for i in range(4):
                    fc = cb.fcurves.new(f'pose.bones["{cn}"].rotation_quaternion', index=i, group_name=cn)
                    fc.keyframe_points.add(len(frames))
                    fc.keyframe_points.foreach_set('co', [x for fr, q in zip(frames, vals) for x in (fr, q[i])])
                    for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
                    fc.update()
                n += 1
    for side in ('Left', 'Right'):
        pb = arm.pose.bones.get(P + side + 'ForeArmCuff')
        if pb: pb.rotation_mode = 'QUATERNION'
    return n


if __name__ == '__main__' and '--' in sys.argv:
    a = sys.argv[sys.argv.index('--') + 1:]
    bpy.ops.wm.open_mainfile(filepath=a[0])
    arm = bpy.data.objects['Armature']
    print('cufftwist: twist keys for', bake(arm), 'clip sides')
    bpy.ops.wm.save_as_mainfile(filepath=a[1])
