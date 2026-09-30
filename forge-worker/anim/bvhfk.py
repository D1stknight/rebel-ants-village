import numpy as np
from scipy.spatial.transform import Rotation as Rot
class BVH:
    def __init__(s, path):
        txt=open(path).read().split('MOTION')
        toks=txt[0].split(); s.names=[]; s.parent=[]; s.offset=[]; s.chans=[]
        stack=[]; i=0; last=None
        while i<len(toks):
            t=toks[i]
            if t in ('ROOT','JOINT'):
                s.names.append(toks[i+1]); s.parent.append(stack[-1] if stack else -1); last=len(s.names)-1; i+=2
            elif t=='End':
                s.names.append(s.names[last]+'_End'); s.parent.append(stack[-1]); last=len(s.names)-1; s.chans.append([]) if len(s.chans)<len(s.names) else None; i+=2
            elif t=='{': stack.append(last); i+=1
            elif t=='}': stack.pop(); i+=1
            elif t=='OFFSET': s.offset.append([float(x) for x in toks[i+1:i+4]]); i+=4
            elif t=='CHANNELS':
                n=int(toks[i+1]); 
                while len(s.chans)<len(s.names)-1: s.chans.append([])
                s.chans.append(toks[i+2:i+2+n]); i+=2+n
            else: i+=1
        while len(s.chans)<len(s.names): s.chans.append([])
        s.offset=np.array(s.offset); 
        m=txt[1].split('\n'); nf=int(m[1].split()[1]); s.dt=float(m[2].split()[2])
        data=np.array([[float(x) for x in l.split()] for l in m[3:3+nf] if l.strip()]); s.data=data; s.nf=len(data)
        # per joint slices
        s.sl=[]; c=0
        for ch in s.chans: s.sl.append((c,c+len(ch))); c+=len(ch)
    def local_rot(s, j, frames):
        a,b=s.sl[j]; ch=s.chans[j]; rc=[k for k in ch if 'rotation' in k]
        if not rc: return Rot.identity(len(frames))
        idx=[a+ch.index(k) for k in rc]; order=''.join(k[0].upper() for k in rc)
        return Rot.from_euler(order, s.data[frames][:,idx], degrees=True)
    def fk(s, frames=None):
        if frames is None: frames=np.arange(s.nf)
        n=len(s.names); F=len(frames)
        Rw=[None]*n; P=np.zeros((F,n,3))
        for j in range(n):
            lr=s.local_rot(j,frames); off=np.tile(s.offset[j],(F,1))
            if s.parent[j]<0:
                a,b=s.sl[j]; ch=s.chans[j]; pos=np.stack([s.data[frames][:,a+ch.index(k)] for k in ('Xposition','Yposition','Zposition')],1)
                Rw[j]=lr; P[:,j]=pos+off
            else:
                p=s.parent[j]; Rw[j]=Rw[p]*lr; P[:,j]=P[:,p]+Rw[p].apply(off)
        return P,Rw
