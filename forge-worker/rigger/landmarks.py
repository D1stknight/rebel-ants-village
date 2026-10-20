import os, numpy as np
from sil import silhouette
# v2.22 NPC villagers (FORGE_NPC): torn skirt strips, knee pads and tall boots around the legs threw off the ankle, knee
# and hip landmarks (Wokou: ankle in the boot sole, knee 13 cm behind the leg, hips 5.5 cm lopsided -> rubbery legs)
NPCM = bool(os.environ.get('FORGE_NPC') or os.environ.get('FORGE_NPC_BODY'))   # v2.36 + Chumpz / Saints players
# v2.23 NPC species (FORGE_NPC_SPECIES ape / human: Chumpz, Saints): sculpted hands come out of a sleeve, and the narrowest
# arm cross-section is the sleeve cuff, 4-6 % of the height up the forearm, so the hands came out long and turned from
# mid-forearm. Their wrist sits one hand length (of the body height) back from the fingertip along the arm's own centre line.
SPECIES = os.environ.get('FORGE_NPC_SPECIES', '') if NPCM else ''
HAND_LEN = {'human': 0.11, 'ape': 0.12}
# v2.28 bare arms (Chumpz in shorts): a sculpted hand can be far longer than that, so the wrist landed on the knuckles and
# the palm stayed on the arm beside the glove. With the vertex colours (normalize, species only) the wrist moves up to
# where the arm's colour (skin, fur, sleeve) turns into the hand's, when that is further up the arm.
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
def colour_wrist(C,x,z,qs,S,u,L,rows,cols,ar,zr,side):
    # v2.28 species: where the arm's colour turns into the hand's, as a fraction of shoulder -> fingertip (None: no clear edge).
    # The arm's own silhouette runs (one per row, apart from the body), their vertices placed along that axis
    rv=np.rint((zr-z)/zr*(rows-1)).astype(int); cv=(x+ar)*(cols-1)/(2*ar)
    lo=np.full(rows,np.inf); hi=np.full(rows,-np.inf)
    for r_,a_,b_ in qs: lo[r_]=a_-1; hi[r_]=b_+1
    ok=(rv>=0)&(rv<rows); ok[ok]&=(cv[ok]>=lo[rv[ok]])&(cv[ok]<=hi[rv[ok]])
    if ok.sum()<200: return None
    t=((np.c_[rv[ok],cv[ok]]-S)@u)/L; c=C[ok]
    fm=(t>=0.52)&(t<=0.64); hm=(t>=0.88)&(t<=0.97)
    if fm.sum()<20 or hm.sum()<20: return None
    fc=np.median(c[fm],0); hc=np.median(c[hm],0)
    if np.linalg.norm(hc-fc)<0.12: return None          # the arm and the hand look alike: no colour edge to go by
    ed=np.arange(0.52,0.97,0.02); near=[]
    for t0 in ed:
        m_=(t>=t0)&(t<t0+0.02)
        if m_.sum()<8: near.append(None); continue
        k=np.median(c[m_],0); dh=np.linalg.norm(k-hc); near.append(bool(dh<np.linalg.norm(k-fc) and dh<0.5*np.linalg.norm(hc-fc)))   # the hand's own colour, not just nearer to it (cuff bands)
    if DEBUG: print(side,'colours arm',np.round(fc,2),'hand',np.round(hc,2),''.join('h' if n else ('.' if n is False else '?') for n in near))
    # the hand = the last run of hand-coloured slices (slices without points don't break it) reaching the hand's own colour
    # window: a cuff band or a bracelet further up the arm that happens to match is not the wrist
    rn=[]; a_=None
    for i,n in enumerate(near):
        if n is False:
            if a_ is not None: rn.append((a_,b_,h_)); a_=None
        elif n:
            if a_ is None: a_,h_=i,0
            b_=i; h_+=1
    if a_ is not None: rn.append((a_,b_,h_))
    for a_,b_,h_ in reversed(rn):
        if h_>=3 and ed[b_]>=0.88-1e-6: return float(ed[a_]) if ed[a_]>=0.66-1e-6 else None
    return None
# v2.35 species without a colour edge (Pengu in shorts: his hands are his arms' colour): the hand-length wrist sat 5-6 cm
# down the sculpted hand, and the hand's flare between the real wrist and that cut stayed on the arm as a fur ruffle round
# the glove (Big Chain's white hand fur, the Racer's fur out of his jacket cuff, the bare-armed Saints' stumps through the
# cuff). The mesh cut across the forearm (elbow -> that wrist): per angle the first surface from the limb's centre (things
# behind it, the thigh or the body, don't count). Where the cut at the wrist is >= 15 % fatter than the narrowest one
# above it, the wrist goes to the hand's end of that narrow part (within 5 % of it), on the section's own centre.
def section_area(V,F,E,W,t,n,u,v,R,NB=32):
    fl=np.linalg.norm(W-E); p=E+n*fl*t
    tri=F[(np.linalg.norm(V-p,axis=1)<R)[F].any(1)]; s=(V[tri]-p)@n; sg=s>0; cr=sg.any(1)&~sg.all(1); tri,s,sg=tri[cr],s[cr],sg[cr]
    P=[]
    for a_,b_ in ((0,1),(1,2),(2,0)):
        m=sg[:,a_]!=sg[:,b_]; f=s[m,a_]/(s[m,a_]-s[m,b_]); P.append(V[tri[m,a_]]+f[:,None]*(V[tri[m,b_]]-V[tri[m,a_]]))
    P=np.concatenate(P)
    if len(P)<20: return None
    c=p.copy()
    for it in range(3):
        q=P-c; x_,y_=q@u,q@v; r=np.hypot(x_,y_); b=((np.arctan2(y_,x_)+np.pi)/(2*np.pi)*NB).astype(int)%NB
        rb=np.full(NB,np.nan); pts=[]
        for k in range(NB):
            m=b==k
            if m.any(): i=np.argmin(np.where(m,r,np.inf)); rb[k]=r[i]; pts.append(P[i])
        if len(pts)<0.6*NB: return None
        c=np.mean(pts,0); c=c-((c-p)@n)*n
    ok=~np.isnan(rb); ix=np.arange(NB)
    rb=np.interp(ix,np.concatenate([ix[ok]-NB,ix[ok],ix[ok]+NB]),np.tile(rb[ok],3))
    return 0.5*float(np.sum(rb**2))*2*np.pi/NB, c
def section_wrist(V,F,E,W,H,side):
    fl=np.linalg.norm(W-E); n=(W-E)/fl; a=np.array([0,0,1.0]) if abs(n[2])<0.9 else np.array([1.0,0,0])
    u=np.cross(n,a); u/=np.linalg.norm(u); v=np.cross(n,u); R=0.14*H/1.8
    ts=np.round(np.arange(0.66,1.0001,0.01),2); S_=[section_area(V,F,E,W,t,n,u,v,R) for t in ts]
    if sum(s_ is not None for s_ in S_)<0.8*len(ts) or S_[-1] is None: return None
    A=np.array([s_[0] if s_ is not None else np.nan for s_ in S_]); i0=int(np.nanargmin(A))
    if i0==0 or A[-1]<1.15*A[i0]:
        if DEBUG: print(side,'section wrist: kept (narrowest t',ts[i0],'wrist x',round(float(A[-1]/A[i0]),2),')')
        return None
    i1=i0
    while i1+1<len(ts) and S_[i1+1] is not None and A[i1+1]<=1.05*A[i0]: i1+=1
    if ts[i1]>0.985: return None
    print(f'landmarks {side}: section wrist t {ts[i1]:.2f} (narrowest {ts[i0]:.2f}, the hand-length wrist x{A[-1]/A[i0]:.2f} as wide) {fl*(1-ts[i1])*100:.1f} cm up the arm')
    return S_[i1][1]
def detect(V,F,VC=None):
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
        pts=[];wid=[];qs=[]
        for r in range(gtop,rows):
            rr=runs(M[r])
            need=4 if r>crotch else 3          # below the crotch: 2 legs + 2 arms
            if len(rr)<need: continue
            q=pick(rr); c_=(q[0]+q[1])/2
            # v1.2: follow the arm continuously; stop at the first break (torn cloth / leg slivers are not arms)
            if pts and (r-pts[-1][0]>0.08*rows or abs(c_-pts[-1][1])>0.15*cols): break
            pts.append((r,c_)); wid.append(q[1]-q[0]); qs.append((r,q[0],q[1]))
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
        if SPECIES in HAND_LEN and len(pts) > 8:
            C=np.array([[Z(r_),X(c_)] for r_,c_ in pts]); k_=max(1,int(0.006*rows))
            C=np.array([C[max(0,i-k_):i+k_+1].mean(0) for i in range(len(C))])   # arm centre line (z, x), armpit -> fingertip
            back=np.concatenate([np.cumsum(np.linalg.norm(np.diff(C,axis=0),axis=1)[::-1])[::-1],[0.0]])   # arc length to the tip
            i_=int(np.argmin(np.abs(back-HAND_LEN[SPECIES]*Hb*zr/(rows-1))))
            Wp=np.array([(zr-C[i_][0])/zr*(rows-1),(C[i_][1]+ar)*(cols-1)/(2*ar)])
            if DEBUG: print(s,'own hand: wrist t',round(float((Wp-S)@u/L),3),'was',round(tw,3))
            # v2.28: the colour edge (colour_wrist) instead, when it is further up the arm
            E_=S+(Wp-S)*0.53; byColour=False
            if VC is not None:
                tc_=colour_wrist(VC,x,z,qs,S,u,L,rows,cols,ar,zr,s)
                tp_=float((Wp-S)@u/L)
                if tc_ is not None and tc_ < tp_ - 0.01:
                    # bare arms: the sculpted palm's heel widens the arm before its colour shows (Banana Band: the silhouette
                    # grows 63 -> 87 px over the last 6 % before the colour edge, a skin frill round the glove) -> back to where
                    # that widening starts (within 12 % of the narrowest forearm above it), at most 7 % of the arm
                    j_=int(np.argmin(np.abs(ts-tc_)))
                    if not np.isnan(ws[j_]):
                        win=(ts>=tc_-0.15)&(ts<=tc_+1e-6)&~np.isnan(ws)
                        wmin=float(ws[win].min()) if win.any() else ws[j_]
                        while j_>0 and ts[j_-1]>=tc_-0.07-1e-6 and not np.isnan(ws[j_-1]) and ws[j_]>1.12*wmin: j_-=1
                        if DEBUG and ts[j_]<tc_-1e-6: print(s,'colour wrist',round(tc_,3),'-> where the hand starts widening',round(float(ts[j_]),3))
                        tc_=min(tc_,float(ts[j_]))
                    # on the arm's own centre line there, not the shoulder -> fingertip chord (up to 8 cm inside a bent arm)
                    Cp=np.c_[(zr-C[:,0])/zr*(rows-1),(C[:,1]+ar)*(cols-1)/(2*ar)]
                    Wp=Cp[int(np.argmin(np.abs(((Cp-S)@u)/L-tc_)))]; byColour=True
                    if DEBUG: print(s,'colour wrist t',round(tc_,3),'(hand length rule',round(tp_,3),')')
            if not byColour:   # v2.35 no colour edge: the narrowest cross-section above the hand's flare
                Wc=section_wrist(V,F,P(X(E_[1]),Z(E_[0])),P(X(Wp[1]),Z(Wp[0])),zr,s)
                if Wc is not None: Wp=np.array([(zr-Wc[2])/zr*(rows-1),(Wc[0]+ar)*(cols-1)/(2*ar)])
            # the elbow stays where the hand-length wrist puts it (moved up with the colour wrist, Big Chain's inner elbow took
            # jacket weights and tore 0.44 of the height in waving / rallying / pick_up)
            W_=Wp; HC=W_+(T-W_)*0.45
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
        if NPCM and not len(foot):   # skirt strips hanging past the knees widen the median shin: use the boot shaft
            shin=np.percentile(ext[(zz>0.25*zc)&(zz<0.6*zc)],25); foot=zz[(ext>1.3*shin)&(zz<0.35*zc)]
        zank=(foot.max() if len(foot) else (0.15 if NPCM else 0.07)*zc)
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
        if NPCM:   # knees sit on the hip-ankle line (a hair forward); strips hanging behind the knee pulled it back
            hy, ay, hz_ = J[s+'UpLeg'][1], yank, J[s+'UpLeg'][2]; t_ = (hz_-J[s+'Leg'][2])/max(1e-6, hz_-zank); ly = hy+(ay-hy)*t_
            if abs(J[s+'Leg'][1]-ly) > 0.03: J[s+'Leg'][1] = ly-0.01
        fm=lm&(z<zank); ymin=y[fm].min()
        J[s+'ToeBase']=np.array([ax,J[s+'Foot'][1]*0.4+ymin*0.6,0.035]); J[s+'Toe_End']=np.array([ax,ymin,0.03])
    if NPCM:   # hips: one side read a skirt strip or the joined legs (0.055 / 0.11 clamps) -> both at the mean
        l_, r_ = abs(J['LeftUpLeg'][0]), abs(J['RightUpLeg'][0])
        if abs(l_-r_) > 0.02:
            hx = float(np.clip((l_+r_)/2, 0.08, 0.11)); J['LeftUpLeg'][0] = hx; J['RightUpLeg'][0] = -hx
            for s_ in ('Left', 'Right'): J[s_+'Leg'][0] = (J[s_+'UpLeg'][0]+J[s_+'Foot'][0])/2
    return J,dbg
def draw(J,dbg,path):
    from PIL import Image,ImageDraw
    M=dbg['M'];g=dbg['g']; im=Image.fromarray((M*90).astype('uint8')).convert('RGB'); d=ImageDraw.Draw(im)
    for k,v in J.items():
        c=int((v[0]+g['ar'])/(2*g['ar'])*(g['cols']-1)); r=int((g['zr']-v[2])/g['zr']*(g['rows']-1))
        col=(255,60,60) if 'Left' in k else ((70,140,255) if 'Right' in k else (60,255,90))
        d.ellipse([c-4,r-4,c+4,r+4],fill=col)
    im.save(path)
