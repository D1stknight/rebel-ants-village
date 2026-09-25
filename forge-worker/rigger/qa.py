# stretch QA: pose, evaluate deformed mesh, report edges stretched > 2.5x
import bpy, sys, numpy as np, math, mathutils as mu
blend,pose=sys.argv[-2],sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=blend)
arm=bpy.data.objects['Armature']; mesh=[o for o in bpy.data.objects if o.type=='MESH'][0]; pb=arm.pose.bones; P='mixamorig_'
def world_rot(b,axis,deg):
    p=pb[P+b]; p.rotation_mode='QUATERNION'; R=mu.Quaternion(axis,math.radians(deg)); bm=p.bone.matrix_local.to_quaternion()
    p.rotation_quaternion=bm.inverted()@R@bm@p.rotation_quaternion
if pose=='A':
  world_rot('LeftArm',(0,1,0),-70); world_rot('RightArm',(0,1,0),70); world_rot('LeftUpLeg',(1,0,0),70); world_rot('LeftLeg',(1,0,0),-90); world_rot('Spine1',(0,0,1),20); world_rot('Head',(0,0,1),-30)
else:
  world_rot('LeftArm',(1,0,0),-80); world_rot('RightArm',(1,0,0),45); world_rot('LeftForeArm',(1,0,0),-70); world_rot('RightUpLeg',(1,0,0),-35); world_rot('LeftUpLeg',(1,0,0),30); world_rot('Spine',(1,0,0),-15)
bpy.context.view_layer.update()
dg=bpy.context.evaluated_depsgraph_get(); em=mesh.evaluated_get(dg).to_mesh()
R=np.array([v.co[:] for v in mesh.data.vertices]); D=np.array([v.co[:] for v in em.vertices])
E=np.array([e.vertices[:] for e in mesh.data.edges if not e.is_loose])
l0=np.linalg.norm(R[E[:,0]]-R[E[:,1]],axis=1); l1=np.linalg.norm(D[E[:,0]]-D[E[:,1]],axis=1)
r=l1/np.maximum(l0,1e-5); bad=np.nonzero((r>2.5)&(l1>0.02))[0]
print('edges',len(E),'stretched',len(bad),'max',r.max())
names=[g.name.replace('mixamorig_','') for g in mesh.vertex_groups]
def wstr(i): return ' '.join(f'{names[g.group]}:{g.weight:.2f}' for g in sorted(mesh.data.vertices[i].groups,key=lambda g:-g.weight)[:3])
from collections import Counter
print('regions',Counter(tuple(np.round(R[E[k,0]]/0.1).astype(int)) for k in bad).most_common(10))
for k in bad[np.argsort(-r[bad])][:6]:
    a,b=E[k]; print(round(r[k],1), np.round(R[a],3), '|', wstr(a), '||', np.round(R[b],3),'|', wstr(b))
