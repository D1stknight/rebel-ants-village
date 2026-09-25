# import GLB -> join meshes, normalize: 1.8 tall, feet z=0, centered xy, faces -Y. saves npz + blend
import bpy, sys, numpy as np, mathutils as mu
src, out = sys.argv[-2], sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
ms=[o for o in bpy.data.objects if o.type=='MESH']
for o in bpy.data.objects:
    if o.type!='MESH': pass
bpy.ops.object.select_all(action='DESELECT')
for o in ms: o.select_set(True)
bpy.context.view_layer.objects.active=ms[0]
if len(ms)>1: bpy.ops.object.join()
m=bpy.context.view_layer.objects.active
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
for o in list(bpy.data.objects):
    if o!=m: bpy.data.objects.remove(o)
V=np.array([v.co[:] for v in m.data.vertices])
h=V[:,2].max()-V[:,2].min(); s=1.8/h
c=np.array([(V[:,0].max()+V[:,0].min())/2,(V[:,1].max()+V[:,1].min())/2,V[:,2].min()])
M=mu.Matrix.Diagonal((s,s,s,1))@mu.Matrix.Translation(-mu.Vector(c))
m.data.transform(M); m.data.update(); m.name='Body'
V=np.array([v.co[:] for v in m.data.vertices]); F=np.array([p.vertices[:] for p in m.data.polygons if len(p.vertices)==3])
print('verts',len(V),'tris',len(F),'bbox',V.min(0),V.max(0))
np.savez(out+'.npz',V=V,F=F)
bpy.ops.wm.save_as_mainfile(filepath=out+'.blend')
