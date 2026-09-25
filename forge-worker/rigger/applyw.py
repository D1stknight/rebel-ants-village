# apply per-vertex weights from npz (PV,W,names) to real mesh by nearest position; limit 4; normalize; bind
import bpy, sys, numpy as np, mathutils as mu
import os as _os, sys as _sys; _sys.path.insert(0,_os.path.dirname(_os.path.abspath(__file__))); OUT=_os.environ.get('FORGE_OUT','.'); CLIPS_DIR=_os.environ.get('FORGE_CLIPS','assets/character')
src_blend,wnpz,out=sys.argv[-3],sys.argv[-2],sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=src_blend)
arm=bpy.data.objects['Armature']; mesh=[o for o in bpy.data.objects if o.type=='MESH' and o.name!='proxy'][0]
for o in [o for o in bpy.data.objects if o.name=='proxy']: bpy.data.objects.remove(o)
mesh.parent=None
for m in list(mesh.modifiers): mesh.modifiers.remove(m)
mesh.vertex_groups.clear()
d=np.load(wnpz); PV,W,names=d['PV'],d['W'],list(d['names'])
from scipy.spatial import cKDTree
V=np.array([v.co[:] for v in mesh.data.vertices]); dist,idx=cKDTree(PV).query(V)
print('max map dist',dist.max())
MW=W[idx]
# limit 4 + normalize
o=np.argsort(-MW,1); keep=np.zeros_like(MW,bool); np.put_along_axis(keep,o[:,:4],True,1); MW=np.where(keep,MW,0); MW[MW<0.01]=0
MW/=MW.sum(1,keepdims=True)
vg=[mesh.vertex_groups.new(name=b.name) for b in arm.data.bones]; gi={n:i for i,n in enumerate([b.name for b in arm.data.bones])}
for j,n in enumerate(names):
    nz=np.nonzero(MW[:,j])[0]
    for i in nz: vg[gi[n]].add([int(i)],float(MW[i,j]),'REPLACE')
print('unweighted',int((MW.sum(1)<0.99).sum()))
# delete faces bridging incompatible chains (fused finger/pants etc.)
from chains import chain_of,bad; import bmesh
dom=[chain_of(names[i]) for i in MW.argmax(1)]
from collections import Counter
Fv0=[p.vertices[:] for p in mesh.data.polygons]
kill=set(fi for fi,f in enumerate(Fv0) if any(bad(dom[f[i]],dom[f[(i+1)%len(f)]]) for i in range(len(f))))
print('bridge faces',len(kill), Counter(tuple(sorted(set(dom[v] for v in Fv0[fi]))) for fi in kill).most_common(6))
am=mesh.modifiers.new('Armature','ARMATURE'); am.object=arm; mesh.parent=arm
# TEAR: fused cloth seams (sleeve glued to torso). Pose arms up/forward, delete arm<->core faces that stretch > 4x
import math
pb=arm.pose.bones
def world_rot(b,axis,deg):
    p=pb['mixamorig_'+b]; p.rotation_mode='QUATERNION'; R=mu.Quaternion(axis,math.radians(deg)); bm_=p.bone.matrix_local.to_quaternion()
    p.rotation_quaternion=bm_.inverted()@R@bm_@p.rotation_quaternion
def reset():
    for p in pb: p.rotation_mode='QUATERNION'; p.rotation_quaternion=(1,0,0,0); p.location=(0,0,0)
R0=np.array([v.co[:] for v in mesh.data.vertices]); worst=np.zeros(len(mesh.data.polygons))
Fv=[p.vertices[:] for p in mesh.data.polygons]
for pose in ([('LeftArm',(0,1,0),-80),('RightArm',(0,1,0),80)],[('LeftArm',(1,0,0),-80),('RightArm',(1,0,0),-80)],[('LeftArm',(1,0,0),60),('RightArm',(1,0,0),60)]):
    reset()
    for b,a,d in pose: world_rot(b,a,d)
    bpy.context.view_layer.update(); dg=bpy.context.evaluated_depsgraph_get(); em=mesh.evaluated_get(dg).to_mesh()
    D=np.array([v.co[:] for v in em.vertices]); mesh.evaluated_get(dg).to_mesh_clear()
    for fi,f in enumerate(Fv):
        for i in range(len(f)):
            a,b=f[i],f[(i+1)%len(f)]; l0=np.linalg.norm(R0[a]-R0[b]); l1=np.linalg.norm(D[a]-D[b])
            if l1>0.015: worst[fi]=max(worst[fi],l1/max(l0,1e-5))
reset(); bpy.context.view_layer.update()
dom=[chain_of(names[i]) for i in MW.argmax(1)]
armc=lambda c: c.endswith('Arm') or c.endswith('Hand')
ARMW=MW[:,[i for i,n in enumerate(names) if armc(chain_of(n))]].sum(1)
tear=[fi for fi,f in enumerate(Fv) if worst[fi]>5 and max(ARMW[v] for v in f)>0.2]
print('tear faces',len(tear))
kill|=set(tear)
bm=bmesh.new(); bm.from_mesh(mesh.data); bm.faces.ensure_lookup_table()
bmesh.ops.delete(bm,geom=[bm.faces[i] for i in sorted(kill)],context='FACES'); bm.to_mesh(mesh.data); bm.free()
print('removed faces total',len(kill),'verts now',len(mesh.data.vertices))
bpy.ops.wm.save_as_mainfile(filepath=out)
