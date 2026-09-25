# weld-proxy auto weights: weld UV-seam duplicates -> near-watertight surface -> bone heat -> copy back by vertex position
import bpy, sys, numpy as np, bmesh
import os as _os, sys as _sys; _sys.path.insert(0,_os.path.dirname(_os.path.abspath(__file__))); OUT=_os.environ.get('FORGE_OUT','.'); CLIPS_DIR=_os.environ.get('FORGE_CLIPS','assets/character')
bpy.ops.wm.open_mainfile(filepath=OUT+'/rigged.blend')
arm=bpy.data.objects['Armature']; mesh=[o for o in bpy.data.objects if o.type=='MESH'][0]
mesh.parent=None
for m in list(mesh.modifiers): mesh.modifiers.remove(m)
mesh.vertex_groups.clear()
proxy=mesh.copy(); proxy.data=mesh.data.copy(); proxy.name='proxy'; bpy.context.scene.collection.objects.link(proxy)
bm=bmesh.new(); bm.from_mesh(proxy.data); bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-5); bm.to_mesh(proxy.data); bm.free()
_dec=float(_os.environ.get('FORGE_PROXY_DECIMATE','0') or 0)
if _dec>0:   # dense generator meshes (TRELLIS ~260k verts): bone heat fails; solve on a collapsed proxy, weights copy back by position
    bpy.context.view_layer.objects.active=proxy; md=proxy.modifiers.new('dec','DECIMATE'); md.ratio=_dec
    bpy.ops.object.select_all(action='DESELECT'); proxy.select_set(True); bpy.ops.object.modifier_apply(modifier='dec')
_vox=float(_os.environ.get('FORGE_PROXY_VOXEL','0') or 0)
if _vox>0:   # optional voxel remesh proxy (closes holes / removes internal faces)
    bpy.context.view_layer.objects.active=proxy; md=proxy.modifiers.new('rm','REMESH'); md.mode='VOXEL'; md.voxel_size=_vox
    bpy.ops.object.select_all(action='DESELECT'); proxy.select_set(True); bpy.ops.object.modifier_apply(modifier='rm')
_minc=float(_os.environ.get('FORGE_PROXY_MINCOMP','0') or 0)
if _minc>0:  # drop floating bits (TRELLIS robe tails/tassels as separate shells): bone heat fails for the whole mesh if any shell can't see a bone
    bm=bmesh.new(); bm.from_mesh(proxy.data); bm.verts.ensure_lookup_table(); seen=set(); kill=[]; nv=len(bm.verts)
    for v in bm.verts:
        if v.index in seen: continue
        st=[v]; c=[]; seen.add(v.index)
        while st:
            x=st.pop(); c.append(x)
            for e in x.link_edges:
                o=e.other_vert(x)
                if o.index not in seen: seen.add(o.index); st.append(o)
        if len(c) < _minc*nv: kill+=c
    bmesh.ops.delete(bm,geom=kill,context='VERTS'); bm.to_mesh(proxy.data); bm.free(); print('proxy dropped verts',len(kill))
print('proxy verts',len(proxy.data.vertices))
bpy.ops.object.select_all(action='DESELECT'); proxy.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active=arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
PV=np.array([v.co[:] for v in proxy.data.vertices]); nb=len(arm.data.bones)
names=[g.name for g in proxy.vertex_groups]; W=np.zeros((len(PV),len(names)))
for v in proxy.data.vertices:
    for g in v.groups: W[v.index,g.group]=g.weight
print('proxy unweighted',int((W.sum(1)<1e-4).sum()))
PN=np.array([v.normal[:] for v in proxy.data.vertices]); np.savez(OUT+'/proxyW.npz',PV=PV,PN=PN,W=W,names=np.array(names))
