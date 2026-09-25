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
bpy.ops.wm.save_as_mainfile(filepath=dst)
