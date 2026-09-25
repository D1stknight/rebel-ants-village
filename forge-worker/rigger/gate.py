# geometric chain gating of heat weights: move (not renormalize) misplaced limb weight to the winning chain
import numpy as np
from chains import chain_of
def segdist(P,a,b):
    ab=b-a; t=np.clip(((P-a)@ab)/max(ab@ab,1e-12),0,1); return np.linalg.norm(P-(a+t[:,None]*ab),axis=1)
def ss(e0,e1,x): t=np.clip((x-e0)/(e1-e0),0,1); return t*t*(3-2*t)
def gate(PV,W,names,bones):
    names=[str(n) for n in names]; ch=np.array([chain_of(n) for n in names]); short=[n.replace('mixamorig_','') for n in names]
    BD=np.stack([segdist(PV,np.array(bones[n][0]),np.array(bones[n][1])) for n in names],1)
    idx=lambda cond: np.array([i for i in range(len(names)) if cond(i)])
    spine=idx(lambda i: short[i] in ('Hips','Spine','Spine1','Spine2','Neck','Head'))
    torso_recv={s:idx(lambda i: short[i] in (s+'Shoulder','Spine','Spine1','Spine2','Neck')) for s in ('Left','Right')}
    arm={s:idx(lambda i: ch[i] in (s+'Arm',s+'Hand')) for s in ('Left','Right')}
    leg={s:idx(lambda i: ch[i]==s+'Leg') for s in ('Left','Right')}
    D=lambda I: BD[:,I].min(1)
    W=W.copy(); moved=np.zeros(len(PV))
    def move(src,dst,g):
        # remove (1-g) of weight on src bones, give to nearest dst bone
        rem=(W[:,src]*(1-g[:,None])); m=rem.sum(1); W[:,src]-=rem
        tgt=dst[BD[:,dst].argmin(1)]; np.add.at(W,(np.arange(len(PV)),tgt),m); moved[:]+=m
    for s,o in (('Left','Right'),('Right','Left')):
        # arm chain vs spine axis -> torso
        move(arm[s],torso_recv[s],ss(1.15,0.85,D(arm[s])/np.maximum(D(spine),1e-6)))
        # arm chain vs legs -> nearest leg
        # leg chain vs arms -> nearest arm bone
    W/=W.sum(1,keepdims=True)
    return W,0,float((moved>0.05).mean())
def exclusive(W,names):
    # per vertex: incompatible chains (bad()) can't coexist -> keep the heavier chain only
    from chains import bad
    ch=np.array([chain_of(str(n)) for n in names]); C=sorted(set(ch)); W=W.copy()
    T=np.stack([W[:,ch==c].sum(1) for c in C],1); fixed=0
    for i,a in enumerate(C):
        for k,b in enumerate(C):
            if k<=i or not bad(a,b): continue
            m=(T[:,i]>1e-3)&(T[:,k]>1e-3); lose_a=m&(T[:,i]<T[:,k]); lose_b=m&~lose_a
            W[np.ix_(lose_a,ch==a)]=0; W[np.ix_(lose_b,ch==b)]=0; T[lose_a,i]=0; T[lose_b,k]=0; fixed+=m.sum()
    W/=W.sum(1,keepdims=True); return W,int(fixed)
def facing(PV,PN,W,names,bones,thr=0.35):
    # limb skin normals point AWAY from the limb bone; a vertex facing toward an arm bone is torso/other surface
    names=[str(n) for n in names]; ch=np.array([chain_of(n) for n in names]); short=[n.replace('mixamorig_','') for n in names]
    W=W.copy(); moved=0
    def cp(P,a,b):
        ab=b-a; t=np.clip(((P-a)@ab)/max(ab@ab,1e-12),0,1); return a+t[:,None]*ab
    for s in ('Left','Right'):
        I=[i for i in range(len(names)) if short[i] in (s+'Arm',s+'ForeArm')]
        recv=[i for i in range(len(names)) if short[i] in (s+'Shoulder','Spine','Spine1','Spine2','Hips')]
        # per vertex closest point over the chain
        best=np.full(len(PV),1e9); P=np.zeros_like(PV)
        for i in I:
            q=cp(PV,np.array(bones[names[i]][0]),np.array(bones[names[i]][1])); d=np.linalg.norm(q-PV,axis=1); m=d<best; best[m]=d[m]; P[m]=q[m]
        dirv=(P-PV)/np.maximum(best[:,None],1e-6); f=(PN*dirv).sum(1)
        g=np.clip((f-thr)/0.25,0,1)            # 0 below thr, 1 when clearly facing the bone
        wa=W[:,I].sum(1); take=g*wa; sel=take>1e-4
        W[:,I]*=(1-g)[:,None]
        BD=np.stack([np.linalg.norm(cp(PV,np.array(bones[names[i]][0]),np.array(bones[names[i]][1]))-PV,axis=1) for i in recv],1)
        tgt=np.array(recv)[BD.argmin(1)]; np.add.at(W,(np.arange(len(PV)),tgt),take); moved+=int((take>0.05).sum())
    W/=W.sum(1,keepdims=True); return W,moved
