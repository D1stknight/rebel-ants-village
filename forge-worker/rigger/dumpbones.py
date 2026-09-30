import bpy, sys, json
bpy.ops.wm.open_mainfile(filepath=sys.argv[-2])
a=bpy.data.objects['Armature']
json.dump({b.name:[list(b.head_local),list(b.tail_local),b.parent.name if b.parent else None] for b in a.data.bones},open(sys.argv[-1],'w'))
