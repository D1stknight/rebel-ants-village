# Forge Rigger v1.5: rigid hands. Generator hands (fists / gloves) rarely line up with our placeholder finger bones,
# and curling those bones bent fingers into claws. Fold every finger weight into its Hand bone so the modelled fist
# moves as one piece with the wrist.
# usage: python3.13 handfix.py -- in.blend out.blend
import bpy, sys
a = sys.argv[sys.argv.index('--') + 1:]; src, dst = a[0], a[1]
bpy.ops.wm.open_mainfile(filepath=src)
me = [o for o in bpy.data.objects if o.type == 'MESH'][0]; P = 'mixamorig_'
FING = ('Thumb', 'Index', 'Middle', 'Ring', 'Pinky')
moved = 0
for side in ('Left', 'Right'):
    hand = me.vertex_groups.get(P + side + 'Hand') or me.vertex_groups.new(name=P + side + 'Hand')
    fg = [g for g in me.vertex_groups if g.name.startswith(P + side + 'Hand') and any(f in g.name for f in FING)]
    idx = {g.index for g in fg}
    for v in me.data.vertices:
        w = sum(g.weight for g in v.groups if g.group in idx)
        if w > 0:
            cur = next((g.weight for g in v.groups if g.group == hand.index), 0.0)
            hand.add([v.index], cur + w, 'REPLACE'); moved += 1
    for g in fg: g.remove([v.index for v in me.data.vertices])
print('handfix verts folded into Hand', moved)
# v1.9: no hand weight above the wrist. Bone heat on some generator bodies leaks finger weights up into the sleeve
# (fused cuffs / wraps), which tore the elbow when the hand moved. Hand weight on verts more than 2 cm up the forearm
# from the wrist moves to the ForeArm bone.
import numpy as np
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]; mw = me.matrix_world; aw = arm.matrix_world
leak = 0
for side in ('Left', 'Right'):
    hb = arm.data.bones.get(P + side + 'Hand'); fb = arm.data.bones.get(P + side + 'ForeArm')
    hand = me.vertex_groups.get(P + side + 'Hand'); fore = me.vertex_groups.get(P + side + 'ForeArm')
    if not (hb and fb and hand and fore): continue
    wrist = np.array((aw @ hb.head_local)[:]); elbow = np.array((aw @ fb.head_local)[:]); d = wrist - elbow; L = np.linalg.norm(d); d /= L
    for v in me.data.vertices:
        g = next((g for g in v.groups if g.group == hand.index), None)
        if g is None or g.weight <= 0: continue
        p = np.array((mw @ v.co)[:]); tt = (p - wrist) @ d          # < 0: up the forearm
        if tt < -0.02:
            k = min(1.0, (-tt - 0.02) / 0.03)                          # fade out over 3 cm
            mv = g.weight * k; cur = next((x.weight for x in v.groups if x.group == fore.index), 0.0)
            hand.add([v.index], g.weight - mv, 'REPLACE'); fore.add([v.index], cur + mv, 'REPLACE'); leak += 1
print('handfix hand weight moved off the forearm/sleeve', leak)
bpy.ops.wm.save_as_mainfile(filepath=dst)
