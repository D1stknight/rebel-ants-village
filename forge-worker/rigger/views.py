# fixed-pose turnaround: python3.13 views.py -- in.blend out.png clip:frame,... yaw1,yaw2,...
import bpy, sys, numpy as np
import os as _os, sys as _sys; _sys.path.insert(0,_os.path.dirname(_os.path.abspath(__file__))); OUT=_os.environ.get('FORGE_OUT','.')
from render import *
from PIL import Image
a=sys.argv[sys.argv.index('--')+1:]; blend,out=a[0],a[1]; poses=a[2].split(','); yaws=[float(x) for x in a[3].split(',')]
bpy.ops.wm.open_mainfile(filepath=blend); arm=bpy.data.objects['Armature']
for t in arm.animation_data.nla_tracks: t.mute=True
sc=setup((360,460),16); ims=[]
for p in poses:
    c,f=p.split(':'); act=bpy.data.actions[c]; arm.animation_data.action=act; arm.animation_data.action_slot=act.slots[0]
    f0,f1=act.frame_range; fr=int(round(f0+float(f)*(f1-f0))); sc.frame_set(fr)
    for y in yaws: shoot(OUT+'/_v.png',y,target=(0,0,0.9),ortho=2.1); ims.append(Image.open(OUT+'/_v.png').copy())
n=len(ims); W=Image.new('RGB',(360*n,460)); [W.paste(im,(360*i,0)) for i,im in enumerate(ims)]; W.save(out)
