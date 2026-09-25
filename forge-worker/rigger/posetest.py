import bpy, sys, math, mathutils as mu
import os as _os, sys as _sys; _sys.path.insert(0,_os.path.dirname(_os.path.abspath(__file__))); OUT=_os.environ.get('FORGE_OUT','.'); CLIPS_DIR=_os.environ.get('FORGE_CLIPS','assets/character')
from render import *
blend,out=sys.argv[-2],sys.argv[-1]
bpy.ops.wm.open_mainfile(filepath=blend)
arm=bpy.data.objects['Armature']; P='mixamorig_'
pb=arm.pose.bones
def rot(b,axis,deg): pb[P+b].rotation_mode='XYZ'; e=list(pb[P+b].rotation_euler); e['XYZ'.index(axis)]+=math.radians(deg); pb[P+b].rotation_euler=e
# stress pose: arms raised sideways, elbow bends, knee up, spine twist, head turn
rot('LeftArm','Z',0); 
for s,sg in (('Left',1),('Right',-1)):
    pb[P+s+'Arm'].rotation_mode='QUATERNION'
# raise arms: rotate in armature space about Y axis
def world_rot(b,axis,deg):
    p=pb[P+b]; p.rotation_mode='QUATERNION'
    R=mu.Quaternion(axis,math.radians(deg)); bm=p.bone.matrix_local.to_quaternion()
    p.rotation_quaternion=bm.inverted()@R@bm@p.rotation_quaternion
POSE=sys.argv[-3] if len(sys.argv)>3 and sys.argv[-3] in ('A','B') else 'A'
if POSE=='B':
    world_rot('LeftArm',(1,0,0),-80); world_rot('RightArm',(1,0,0),45); world_rot('LeftForeArm',(1,0,0),-70)
    world_rot('RightUpLeg',(1,0,0),-35); world_rot('LeftUpLeg',(1,0,0),30); world_rot('Spine',(1,0,0),-15)
if POSE=='A':
  world_rot('LeftArm',(0,1,0),-70); world_rot('RightArm',(0,1,0),70)
  world_rot('LeftForeArm',(0,0,1),80); world_rot('RightForeArm',(0,0,1),-80)
  world_rot('LeftUpLeg',(1,0,0),70); world_rot('LeftLeg',(1,0,0),-90)
  world_rot('Spine1',(0,0,1),20); world_rot('Head',(0,0,1),-30)
bpy.context.view_layer.update()
setup((440,440),12)
import os
for i,y in enumerate((0,40,180)): shoot(f'{OUT}/_p{i}.png',y)
from PIL import Image
ims=[Image.open(f'{OUT}/_p{i}.png') for i in range(3)]; W=Image.new('RGB',(440*3,440))
for i,im in enumerate(ims): W.paste(im,(440*i,0))
W.save(out)
