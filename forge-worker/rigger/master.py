import numpy as np, sys
import os as _os, sys as _sys; _sys.path.insert(0,_os.path.dirname(_os.path.abspath(__file__))); OUT=_os.environ.get('FORGE_OUT','.'); CLIPS_DIR=_os.environ.get('FORGE_CLIPS','assets/character')
from glbio import *
from scipy.spatial.transform import Rotation as Rot
def trs(t,r,s): M=np.eye(4); M[:3,:3]=Rot.from_quat(r).as_matrix()*np.array(s); M[:3,3]=t; return M
class Master:
    def __init__(s,path):
        j,b=glb(path); s.j,s.b=j,b; s.N=j['nodes']; s.names=[n.get('name','') for n in s.N]
        s.par={}
        for i,n in enumerate(s.N):
            for c in n.get('children',[]): s.par[c]=i
        sk=j['skins'][0]; s.joints=sk['joints']; s.ibm=acc(j,b,sk['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
        s.bind={s.names[jn]:np.linalg.inv(s.ibm[k]) for k,jn in enumerate(s.joints)}
        a=j['animations'][0]; s.ch={}
        for c in a['channels']:
            sm=a['samplers'][c['sampler']]; s.ch[(c['target']['node'],c['target']['path'])]=(acc(j,b,sm['input']),acc(j,b,sm['output']))
        s.dur=max(v[0][-1] for v in s.ch.values())
    def local(s,i,t):
        n=s.N[i]; T=np.array(n.get('translation',[0,0,0]),float); R=np.array(n.get('rotation',[0,0,0,1]),float); S=np.array(n.get('scale',[1,1,1]),float)
        out=[]
        for path,dflt in (('translation',T),('rotation',R),('scale',S)):
            k=(i,path)
            if k not in s.ch: out.append(dflt); continue
            tt,vv=s.ch[k]
            if t<=tt[0]: out.append(vv[0]); continue
            if t>=tt[-1]: out.append(vv[-1]); continue
            q=np.searchsorted(tt,t)-1; u=(t-tt[q])/(tt[q+1]-tt[q])
            if path=='rotation':
                a,b_=vv[q],vv[q+1]
                if np.dot(a,b_)<0: b_=-b_
                v=a*(1-u)+b_*u; out.append(v/np.linalg.norm(v))
            else: out.append(vv[q]*(1-u)+vv[q+1]*u)
        return trs(*out)
    def world(s,t):
        G={}
        def g(i):
            if i in G: return G[i]
            M=s.local(i,t); G[i]=g(s.par[i])@M if i in s.par else M; return G[i]
        return {s.names[i]:g(i) for i in range(len(s.N))}
