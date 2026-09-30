import bpy, sys, numpy as np
import os as _os, sys as _sys; _sys.path.insert(0,_os.path.dirname(_os.path.abspath(__file__))); OUT=_os.environ.get('FORGE_OUT','.'); CLIPS_DIR=_os.environ.get('FORGE_CLIPS','assets/character')
from render import *
args=sys.argv[sys.argv.index('--')+1:]; blend,out=args[0],args[1]; clips=args[2].split(','); n=int(args[3]); yaw=float(args[4]) if len(args)>4 else 30
bpy.ops.wm.open_mainfile(filepath=blend)
arm=bpy.data.objects['Armature']
for t in arm.animation_data.nla_tracks: t.mute=True
sc=setup((300,380),10)
from PIL import Image
rows=[]
for c in clips:
    act=bpy.data.actions[c]; arm.animation_data.action=act; arm.animation_data.action_slot=act.slots[0]
    f0,f1=act.frame_range; fr=np.linspace(f0,f1-1,n).round().astype(int)
    ims=[]
    for f in fr:
        sc.frame_set(int(f)); shoot(OUT+'/_f.png',yaw,target=(0,0,0.85),ortho=2.3); ims.append(Image.open(OUT+'/_f.png').copy())
    row=Image.new('RGB',(300*n,380)); [row.paste(im,(300*i,0)) for i,im in enumerate(ims)]; rows.append(row)
W=Image.new('RGB',(300*n,380*len(rows))); [W.paste(r,(0,380*i)) for i,r in enumerate(rows)]; W.save(out)
