import sys
import os as _os, sys as _sys; _sys.path.insert(0,_os.path.dirname(_os.path.abspath(__file__))); OUT=_os.environ.get('FORGE_OUT','.'); CLIPS_DIR=_os.environ.get('FORGE_CLIPS','assets/character')
import bpy, json, numpy as np, mathutils as mu, math
bpy.ops.wm.open_mainfile(filepath=OUT+'/norm.blend')
mesh=[o for o in bpy.data.objects if o.type=='MESH'][0]
J={k:mu.Vector(v) for k,v in json.load(open(OUT+'/joints.json')).items()}
P='mixamorig_'
arm_d=bpy.data.armatures.new('Rebel'); arm=bpy.data.objects.new('Armature',arm_d); bpy.context.scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active=arm; bpy.ops.object.mode_set(mode='EDIT'); eb=arm_d.edit_bones
def bone(name,head,tail,parent=None):
    b=eb.new(P+name); b.head=head; b.tail=tail if (tail-head).length>1e-4 else head+mu.Vector((0,0,0.03))
    if parent: b.parent=eb[P+parent]
    return b
bone('Hips',J['Hips'],J['Spine'])
bone('Spine',J['Spine'],J['Spine1'],'Hips'); bone('Spine1',J['Spine1'],J['Spine2'],'Spine'); bone('Spine2',J['Spine2'],J['Neck'],'Spine1')
bone('Neck',J['Neck'],J['Head'],'Spine2'); bone('Head',J['Head'],J['HeadTop_End'],'Neck')
bone('HeadTop_End',J['HeadTop_End'],J['HeadTop_End']+mu.Vector((0,0,0.08)),'Head')
fingers=['Thumb','Index','Middle','Ring','Pinky']
for s in ('Left','Right'):
    bone(s+'Shoulder',J[s+'Shoulder'],J[s+'Arm'],'Spine2'); bone(s+'Arm',J[s+'Arm'],J[s+'ForeArm'],s+'Shoulder')
    bone(s+'ForeArm',J[s+'ForeArm'],J[s+'Hand'],s+'Arm'); bone(s+'Hand',J[s+'Hand'],J[s+'_handC'],s+'ForeArm')
    hc,tip=J[s+'_handC'],J[s+'_tip']; d=(tip-hc); L=d.length
    for i,f in enumerate(fingers):
        off=mu.Vector((0,(i-2)*0.018,0))
        if f=='Thumb': base=J[s+'Hand'].lerp(hc,0.6)+mu.Vector((0,-0.03,0)); dd=(tip-base)*0.8
        else: base=hc+off; dd=d*1.0
        pts=[base+dd*t for t in (0,0.35,0.65,0.9,1.05)]
        for k in range(4):
            bone(f'{s}Hand{f}{k+1}',pts[k],pts[k+1], s+'Hand' if k==0 else f'{s}Hand{f}{k}')
    bone(s+'UpLeg',J[s+'UpLeg'],J[s+'Leg'],'Hips'); bone(s+'Leg',J[s+'Leg'],J[s+'Foot'],s+'UpLeg')
    bone(s+'Foot',J[s+'Foot'],J[s+'ToeBase'],s+'Leg'); bone(s+'ToeBase',J[s+'ToeBase'],J[s+'Toe_End'],s+'Foot')
    bone(s+'Toe_End',J[s+'Toe_End'],J[s+'Toe_End']+mu.Vector((0,-0.04,0)),s+'ToeBase')
# consistent rolls
bpy.ops.armature.select_all(action='SELECT'); bpy.ops.armature.calculate_roll(type='GLOBAL_NEG_Y')
bpy.ops.object.mode_set(mode='OBJECT')
print('bones',len(arm_d.bones))
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/rigged.blend')
