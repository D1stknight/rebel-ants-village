import numpy as np
from sil import silhouette
def runs(row,minw=2):
    r=[];i=0;n=len(row)
    while i<n:
        if row[i]:
            j=i
            while j<n and row[j]: j+=1
            if j-i>=minw: r.append((i,j-1))
            i=j
        else: i+=1
    return r
DEBUG=False
def detect(V,F):
    M,g=silhouette(V,F); rows,cols,ar,zr=g['rows'],g['cols'],g['ar'],g['zr']
    X=lambda c: c/(cols-1)*2*ar-ar; Z=lambda r: zr-r/(rows-1)*zr; cc=cols//2
    x,y,z=V.T
    center=lambda r: next((q for q in runs(M[r]) if q[0]<=cc<=q[1]),None)
    cw=np.array([ (lambda q:(q[1]-q[0]) if q else 0)(center(r)) for r in range(rows)])
    # crotch
    crotch=next(r for r in range(rows-1,0,-1) if M[r,cc-1:cc+2].all())
    # head top (ignore antennae): first row with center width > 22% cols
    # v1.4: threshold in metres, not a fraction of the silhouette width (a wide A-pose made the head look "too narrow")
    top=int(np.argmax(cw>min(cols*0.22, 0.14/(2*ar/(cols-1)))))
    Hb=rows-1-top   # body height in rows (no antennae)
    # v1.2: robes / hakama / armour skirts hide the real crotch. The silhouette split is only trusted when it sits
    # at a plausible height (Forge concepts follow the master clay: crotch ~0.44 of body height from the floor).
    CROTCH_PRIOR=0.44
    if (rows-1-crotch)/Hb < 0.40: crotch=int(round(rows-1-CROTCH_PRIOR*Hb))
    # v1.2: neck = narrowest centre run 8-30% down the body (head above, shoulders/armour below).
    # (v1.1 took the widest row first, which lands on the shoulders when the head is narrower than the sleeves)
    a_,b_=top+int(0.08*Hb),top+int(0.30*Hb)
    neck=a_+int(np.argmin(cw[a_:b_]))
    shoulder=neck+int(np.argmax(cw[neck:crotch]>2.1*cw[neck]))+int(rows*0.01)
    # v1.4: wide A-pose (Meshy pose_mode a-pose, #4998 v3): the arms leave the torso right at the shoulder, so the centre run
    # never gets wide until the skirt flare. Fall back to the full row extent (arm tip to arm tip).
    if shoulder > neck + 0.22 * Hb:
        ext = np.array([(lambda q: (q[-1][1] - q[0][0]) if q else 0)(runs(M[r])) for r in range(rows)])
        shoulder = neck + int(np.argmax(ext[neck:crotch] > 2.1 * cw[neck])) + int(rows * 0.01)
    # arm/torso gap rows (3+ runs) above crotch
    n3=np.array([len(runs(M[r]))>=3 for r in range(rows)])
    gtop=next(r for r in range(shoulder,crotch) if n3[r:r+4].all())   # armpit: 4 rows in a row with arm, torso, arm
    # v1.4: a narrow neck makes the chest pass the 2.1x test, which puts the "shoulder" at the armpit (#4998 v3).
    # When that happens, place the shoulder a fixed fraction below the neck instead.
    if gtop - shoulder < 0.05 * Hb:
        shoulder = neck + int(0.06 * Hb)
    J={}
    def depth(px,pz,rad=0.05):
        m=(np.abs(x-px)<rad)&(np.abs(z-pz)<rad)
        return float(y[m].mean()) if m.sum()>5 else 0.0
    P=lambda px,pz: np.array([float(px),depth(px,pz),float(pz)])
    zc,zn,zs,zt=Z(crotch),Z(neck),Z(shoulder),Z(top)
    J['Hips']=P(0,zc+0.35*(zs-zc)*0.25)
    for i,nm in enumerate(['Spine','Spine1','Spine2']): J[nm]=P(0,J['Hips'][2]+(zs-J['Hips'][2])*(0.25+0.3*i))
    J['Neck']=P(0,(zs+zn)/2); J['Head']=P(0,zn+0.02); J['HeadTop_End']=np.array([0,J['Head'][1],zt])
    dbg={'rows':dict(crotch=crotch,top=top,neck=neck,shoulder=shoulder,gtop=gtop),'M':M,'g':g}
    for s,sg in (('Left',1),('Right',-1)):
        # outer run on character side: Left = +x = image right
        pick=(lambda rr: rr[-1]) if sg>0 else (lambda rr: rr[0])
        pts=[];wid=[]
        for r in range(gtop,rows):
            rr=runs(M[r])
            need=4 if r>crotch else 3          # below the crotch: 2 legs + 2 arms
            if len(rr)<need: continue
            q=pick(rr); c_=(q[0]+q[1])/2
            # v1.2: follow the arm continuously; stop at the first break (torn cloth / leg slivers are not arms)
            if pts and (r-pts[-1][0]>0.08*rows or abs(c_-pts[-1][1])>0.15*cols): break
            pts.append((r,c_)); wid.append(q[1]-q[0])
        pts=np.array(pts); wid=np.array(wid)
        tip_r=pts[-1,0]; 
        # wrist: first row (downward) where outer width drops below 0.65 of max sleeve width
        # shoulder: extrapolate the upper sleeve centre line to the shoulder row
        up=pts[:max(3,len(pts)//2)]; k=np.polyfit(up[:,0],up[:,1],1); sc=np.polyval(k,shoulder+0.02*rows)
        shx=X(sc)*0.92; shz=zs-0.02
        # v1.4: diagonal A-pose arms extrapolate to the neck; the arm root is never inside the torso at armpit height
        _q=center(gtop); _th=((_q[1]-_q[0])/2)*(2*ar/(cols-1)) if _q else 0.0
        if abs(shx) < 0.95*_th: shx=sg*0.95*_th
        s_row, s_col = shoulder+0.02*rows, sc
        # v1.5: shallow A-pose arms (more horizontal than 45 deg, #4998): put the arm root ON the arm's centre line at
        # the shoulder x, not at the shoulder row (that row is the top surface of the arm -> robotic upper-arm pivot)
        if abs(k[0]) > 1.0:
            s_col = (shx+ar)*(cols-1)/(2*ar); s_row = (s_col-k[1])/k[0]; shz = Z(s_row)
        # wrist: narrowest cross-section measured PERPENDICULAR to the shoulder->fingertip axis
        # (row widths fail on diagonal A-pose arms and on armour plates)
        S=np.array([s_row, s_col]); T=np.array([tip_r, pts[-1,1]]); ax_=T-S; L=np.linalg.norm(ax_); u=ax_/L; nrm=np.array([-u[1],u[0]])
        def width_at(t):
            p=S+u*t*L; w=0
            for sgn in (1,-1):
                for d in range(1,int(0.25*L)):
                    q=p+sgn*nrm*d; r_,c_=int(round(q[0])),int(round(q[1]))
                    if r_<0 or r_>=rows or c_<0 or c_>=cols or not M[r_,c_]: break
                    w+=1
            return w if M[int(round(p[0])),int(round(p[1]))] else np.nan
        ts=np.linspace(0.5,0.97,48); ws=np.array([width_at(t) for t in ts],float)
        with np.errstate(all='ignore'):
            import warnings; warnings.simplefilter('ignore')
            ws=np.array([np.nanmedian(ws[max(0,i-1):i+2]) for i in range(len(ws))])   # kill single-sample spikes (limb touching thigh)
        # palm = widest point near the hand end; wrist = narrowest point between forearm and palm
        pm=(ts>=0.72)&(ts<=0.92)&~np.isnan(ws); ip=int(np.nonzero(pm)[0][np.argmax(ws[pm])]) if pm.any() else int(np.argmin(np.abs(ts-0.8)))
        wm=(ts>=0.55)&(ts<=ts[ip]-0.03)&~np.isnan(ws)
        tw=float(ts[np.nonzero(wm)[0][np.argmin(ws[wm])]]) if wm.any() else 0.74
        if DEBUG: print(s,'profile',np.nan_to_num(ws,nan=-1).astype(int).tolist(),'palm',round(float(ts[ip]),2),'wrist',round(tw,2))
        W_=S+u*tw*L; E_=S+u*tw*L*0.53; HC=W_+(T-W_)*0.45
        J[s+'Arm']=P(shx,shz); J[s+'Shoulder']=P(sg*abs(shx)*0.35,shz+0.01)
        J[s+'Hand']=P(X(W_[1]),Z(W_[0])); J[s+'ForeArm']=P(X(E_[1]),Z(E_[0]))
        J[s+'_handC']=P(X(HC[1]),Z(HC[0])); J[s+'_tip']=P(X(T[1]),Z(T[0]))
        # legs
        lp=[]
        for r in range(crotch+1,rows):
            rr=[q for q in runs(M[r])]
            legs=[q for q in rr if q[0]<cc<q[1] or True]
            # take the two runs nearest center
            if len(rr)<2: continue
            rr=sorted(rr,key=lambda q:abs((q[0]+q[1])/2-cc))[:2]; rr=sorted(rr)
            q=rr[1] if sg>0 else rr[0]; lp.append((r,(q[0]+q[1])/2))
        lp=np.array(lp)
        lm=(np.sign(x)==sg)&(z<zc)
        zz=np.linspace(0.005,zc,70); ext=np.array([np.ptp(y[lm&(np.abs(z-a)<0.012)]) if (lm&(np.abs(z-a)<0.012)).sum()>3 else 0 for a in zz])
        shin=np.median(ext[(zz>0.25*zc)&(zz<0.6*zc)]); foot=zz[(ext>1.3*shin)&(zz<0.35*zc)]
        zank=(foot.max() if len(foot) else 0.07*zc)
        ax=X(np.interp(zank,[Z(r) for r in lp[::-1,0]],lp[::-1,1]))
        hipx=X(lp[3,1])*0.85
        # v1.3: under a robe the rows just below the crotch can pick up a hand hanging beside the robe (TRELLIS #1555).
        # Hip joints are never wider than ~0.11 m on a 1.8 m body, nor wider than the ankle.
        if np.sign(hipx)!=sg or not (0.055<=abs(hipx)<=0.11): hipx=sg*float(np.clip(abs(hipx) if np.sign(hipx)==sg else 0.085,0.055,max(0.055,min(0.11,abs(ax)))))
        # ankle: just above the foot flare, centred in the shaft depth (not the flare-biased vert mean)
        zank=zank+0.02
        sh=lm&(np.abs(z-(zank+0.03))<0.01); yank=float((y[sh].min()+y[sh].max())/2) if sh.sum()>3 else depth(ax,zank)
        J[s+'UpLeg']=P(hipx,zc+0.03); J[s+'Foot']=np.array([float(ax),yank,float(zank)])
        J[s+'Leg']=P((hipx+ax)/2,(zc+0.03+zank)/2)
        fm=lm&(z<zank); ymin=y[fm].min()
        J[s+'ToeBase']=np.array([ax,J[s+'Foot'][1]*0.4+ymin*0.6,0.035]); J[s+'Toe_End']=np.array([ax,ymin,0.03])
    return J,dbg
def draw(J,dbg,path):
    from PIL import Image,ImageDraw
    M=dbg['M'];g=dbg['g']; im=Image.fromarray((M*90).astype('uint8')).convert('RGB'); d=ImageDraw.Draw(im)
    for k,v in J.items():
        c=int((v[0]+g['ar'])/(2*g['ar'])*(g['cols']-1)); r=int((g['zr']-v[2])/g['zr']*(g['rows']-1))
        col=(255,60,60) if 'Left' in k else ((70,140,255) if 'Right' in k else (60,255,90))
        d.ellipse([c-4,r-4,c+4,r+4],fill=col)
    im.save(path)
