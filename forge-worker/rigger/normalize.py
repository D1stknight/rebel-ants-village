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
# v1.9 part-built characters: landmarks come from the body alone (pauldrons / arm guards in the silhouette moved a hand
# to chest height); the npz keeps only non-armour triangles, reindexed
import os as _os
_skip=[s for s in _os.environ.get('FORGE_PROXY_SKIP_MAT','ARMOR_').split(',') if s]
_mi={i for i,mt in enumerate(m.data.materials) if mt and any(mt.name.startswith(s) for s in _skip)}
# v2.28 NPC species (Chumpz, Saints): each vertex's base colour (the texture under its UVs, loop average) goes into the npz
# too; landmarks finds the wrist where the arm's colour turns into the sculpted hand's. Rebels and Rebel villagers: no C.
_C=None
if _os.environ.get('FORGE_NPC') and _os.environ.get('FORGE_NPC_SPECIES') and m.data.uv_layers.active is not None:
    me=m.data; nl=len(me.loops); npo=len(me.polygons)
    lv=np.zeros(nl,np.int64); me.loops.foreach_get('vertex_index',lv)
    uv=np.zeros(nl*2,np.float32); me.uv_layers.active.data.foreach_get('uv',uv); uv=uv.reshape(-1,2)
    pm=np.zeros(npo,np.int64); me.polygons.foreach_get('material_index',pm)
    ps=np.zeros(npo,np.int64); me.polygons.foreach_get('loop_start',ps); pt=np.zeros(npo,np.int64); me.polygons.foreach_get('loop_total',pt)
    lm=np.zeros(nl,np.int64); lm[np.repeat(ps,pt)+np.arange(nl)-np.repeat(np.cumsum(pt)-pt,pt)]=np.repeat(pm,pt)
    col=np.zeros((len(V),3)); cnt=np.zeros(len(V))
    for mi,mt in enumerate(me.materials):
        img=None
        if mt and mt.use_nodes:
            for nd in mt.node_tree.nodes:
                if nd.type=='TEX_IMAGE' and nd.image and any('Base Color' in l.to_socket.name for l in nd.outputs[0].links): img=nd.image
        sel=lm==mi
        if img is None or not sel.any() or not img.size[0]: continue
        w_,h_=img.size; px=np.zeros(w_*h_*4,np.float32); img.pixels.foreach_get(px); I=px.reshape(h_,w_,4)[:,:,:3]
        u_=np.clip((uv[sel,0]%1.0)*w_,0,w_-1).astype(int); v_=np.clip((uv[sel,1]%1.0)*h_,0,h_-1).astype(int)
        np.add.at(col,lv[sel],I[v_,u_]); np.add.at(cnt,lv[sel],1)
    if (cnt>0).any():
        _C=(col/np.maximum(cnt,1)[:,None]).astype(np.float32); print('vertex colours (wrist): textured',int((cnt>0).sum()),'of',len(V))
if _mi:
    keepF=np.array([p.vertices[:] for p in m.data.polygons if len(p.vertices)==3 and p.material_index not in _mi])
    used=np.unique(keepF); remap=-np.ones(len(V),int); remap[used]=np.arange(len(used))
    print('landmarks from body only: tris',len(keepF),'of',len(F))
    np.savez(out+'.npz',V=V[used],F=remap[keepF],**({'C':_C[used]} if _C is not None else {}))
else:
    np.savez(out+'.npz',V=V,F=F,**({'C':_C} if _C is not None else {}))
bpy.ops.wm.save_as_mainfile(filepath=out+'.blend')
