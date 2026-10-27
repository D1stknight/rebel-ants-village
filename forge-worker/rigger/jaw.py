# Forge Rigger 2.41 — a jaw for a covered mouth (#001: the cloth mask over his mouth moves when the jaw opens).
# Works on a finished rig GLB, like headcloth.py: adds a mixamorig_Jaw joint under Head at the hinge and moves the lower
# front of the head (below the hinge, in front of the jaw's back edge) from Head onto it, with soft edges. Only Head's
# share moves, so the neck keeps its weights and the head / neck blend under the chin becomes the stretch zone. The jaw's
# rest pose is its bind pose and no clip keys it, so the rig looks and moves as before until something turns the jaw:
# rotation about its local +X opens the mouth (its axes are the world's: X across the face, Y up, Z out the front). A jaw
# vertex that already had four influences gives one up (glTF skins take four): the one that moves it least in the rig's
# own clips (#001: 1-2 mm in the walk, run and fights, 4 mm at most mid-cartwheel). Nothing else in the file changes: the
# JSON gets the node / joint / inverse bind matrices, the binary keeps every byte and only JOINTS_0 / WEIGHTS_0 of the
# jaw's vertices are rewritten in place.
# --clip adds a 'talk' animation (the jaw alone, a few seconds of speech-like openings) for viewers and voice tests.
# usage: python3 jaw.py in.glb out.glb [--report report.json] [--clip] [--dry]
import json, math, sys
import numpy as np
from headcloth import Glb, local

JAW = 'mixamorig_Jaw'
HINGE_UP = 0.20          # the hinge: over the Head joint, in skull lengths (Head -> HeadTop_End) ...
HINGE_BACK = 0.10        # ... and this far behind the middle of the head's depth, so the chin drops more than it swings back
TOPY = (0.30, 0.14)      # skull lengths over the Head joint: no jaw above the first (the upper lip under the cloth), all of it below the second
BACK = (95.0, 120.0)     # the jaw's back edge, degrees round the hinge from straight out the front (90 = straight down): all before, none past
NEAR = (0.056, 0.168)    # skull lengths from the hinge line: fades in (no sudden weights round the hinge itself)
FAR = (0.75, 0.93)       # skull lengths: nothing this far out (shoulders, collars)
HEADY = (0.40, 0.70)     # Head's share of the vertex: none below the first (the neck, the collar), all of it past the second
MIN_W = 0.004            # smaller jaw weights are left on Head ...
MIN_W4 = 0.03            # ... and below this on a vertex with four influences already (it would give one up for nothing)
TALK_DEG = [0, 9, 3, 14, 5, 11, 2, 0, 0, 7, 15, 6, 12, 4, 9, 1, 0, 0, 10, 4, 13, 3, 8, 0, 0]   # one value every 0.12 s


def ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def qx(deg):
    h = math.radians(deg) / 2
    return [math.sin(h), 0.0, 0.0, math.cos(h)]


def m2q(R):
    t = np.trace(R)
    if t > 0:
        s = math.sqrt(t + 1) * 2; return [(R[2, 1] - R[1, 2]) / s, (R[0, 2] - R[2, 0]) / s, (R[1, 0] - R[0, 1]) / s, s / 4]
    i = int(np.argmax(np.diag(R))); j_, k_ = (i + 1) % 3, (i + 2) % 3
    s = math.sqrt(1 + R[i, i] - R[j_, j_] - R[k_, k_]) * 2; q = [0.0, 0.0, 0.0, 0.0]
    q[i] = s / 4; q[j_] = (R[j_, i] + R[i, j_]) / s; q[k_] = (R[k_, i] + R[i, k_]) / s; q[3] = (R[k_, j_] - R[j_, k_]) / s
    return q


def add_clip(g, jaw):
    j = g.j
    if any(a.get('name') == 'talk' for a in j.get('animations', [])): return False
    t = np.arange(len(TALK_DEG), dtype=np.float32) * 0.12
    q = np.array([qx(d) for d in TALK_DEG], dtype=np.float32)
    ti = g.append(t, 5126, 'SCALAR'); j['accessors'][ti]['min'] = [float(t[0])]; j['accessors'][ti]['max'] = [float(t[-1])]
    qi = g.append(q, 5126, 'VEC4')
    j.setdefault('animations', []).append({'name': 'talk', 'samplers': [{'input': ti, 'output': qi, 'interpolation': 'LINEAR'}],
                                           'channels': [{'sampler': 0, 'target': {'node': jaw, 'path': 'rotation'}}]})
    return True


def sample_poses(g, per=16):
    """The skinning matrices (joint world x inverse bind) at `per` times of every clip in the file: [frames, joints, 4, 4]."""
    j = g.j; nodes = j['nodes']; par = {c: i for i, n in enumerate(nodes) for c in n.get('children', [])}
    skin = j['skins'][0]; joints = skin['joints']
    IBM = g.view(skin['inverseBindMatrices'])[0].reshape(-1, 4, 4).transpose(0, 2, 1).astype(float)
    rest = [(np.array(n.get('translation', [0, 0, 0]), float), np.array(n.get('rotation', [0, 0, 0, 1]), float), np.array(n.get('scale', [1, 1, 1]), float)) for n in nodes]
    PATH = {'translation': 0, 'rotation': 1, 'scale': 2}
    out = []
    for an in j.get('animations', []):
        ch = []
        for c in an['channels']:
            if c['target'].get('path') not in PATH or 'node' not in c['target']: continue
            sm = an['samplers'][c['sampler']]; t = g.view(sm['input'])[0][:, 0].astype(float); v = g.view(sm['output'])[0].astype(float)
            if sm.get('interpolation') == 'CUBICSPLINE': v = v[1::3]
            ch.append((c['target']['node'], PATH[c['target']['path']], t, v, sm.get('interpolation') == 'STEP'))
        T = max((c[2][-1] for c in ch), default=0.0)
        for tt in np.linspace(0.0, T, per):
            trs = [list(r) for r in rest]
            for nd, k, t, v, step in ch:
                i = int(np.clip(np.searchsorted(t, tt, 'right') - 1, 0, len(t) - 1)); i2 = min(i + 1, len(t) - 1)
                u = 0.0 if step or i2 == i else float(np.clip((tt - t[i]) / (t[i2] - t[i]), 0, 1))
                a, b = v[i], v[i2]
                if k == 1:
                    if a @ b < 0: b = -b
                    x = a * (1 - u) + b * u; x = x / np.linalg.norm(x)
                else: x = a * (1 - u) + b * u
                trs[nd][k] = x
            W = {}
            def world(i):
                if i not in W:
                    n = nodes[i]
                    if 'matrix' in n: L = local(n)
                    else: L = local({'translation': list(trs[i][0]), 'rotation': list(trs[i][1]), 'scale': list(trs[i][2])})
                    W[i] = (world(par[i]) if i in par else np.eye(4)) @ L
                return W[i]
            out.append(np.array([world(q) @ IBM[k_] for k_, q in enumerate(joints)]))
    return np.array(out) if out else np.eye(4)[None, None].repeat(len(joints), 1)


def main(src, dst, report=None, clip=False, dry=False):
    g = Glb(src); j = g.j; nodes = j['nodes']
    name = {n.get('name'): i for i, n in enumerate(nodes)}
    if JAW in name:
        rep = {'skipped': 'already', 'clip': bool(clip and not dry and add_clip(g, name[JAW]))}
        print('jaw: already has a jaw', json.dumps(rep))
        if not dry: g.save(dst)
        return rep
    par = {c: i for i, n in enumerate(nodes) for c in n.get('children', [])}
    G = {}
    def glob(i):
        if i not in G: G[i] = (glob(par[i]) if i in par else np.eye(4)) @ local(nodes[i])
        return G[i]
    skin = j['skins'][0]; joints = skin['joints']; jidx = {nd: k for k, nd in enumerate(joints)}
    head = name.get('mixamorig_Head'); top = name.get('mixamorig_HeadTop_End')
    if head is None or head not in jidx or top is None: raise SystemExit('jaw: no Head / HeadTop_End joint')
    IBM, _ = g.view(skin['inverseBindMatrices']); IBM = IBM.reshape(-1, 4, 4).transpose(0, 2, 1).astype(float)
    err = np.abs(glob(head) @ IBM[jidx[head]] - np.eye(4)).max()
    if err > 1e-3: raise SystemExit(f'jaw: rest pose != bind pose on Head ({err:.4f})')
    pH = glob(head)[:3, 3]; skull = float(np.linalg.norm(glob(top)[:3, 3] - pH))
    up, fwd = np.array([0.0, 1.0, 0.0]), np.array([0.0, 0.0, 1.0])     # glTF: Y up, the rigs face +Z
    tilt = math.degrees(math.acos(np.clip((glob(top)[:3, 3] - pH) @ up / skull, -1, 1)))
    if tilt > 25: raise SystemExit(f'jaw: the head is not upright in the rest pose ({tilt:.0f} deg)')
    prims = [p for m in j['meshes'] for p in m['primitives'] if 'JOINTS_0' in p['attributes']]
    V = np.concatenate([g.view(p['attributes']['POSITION'])[0].astype(float) for p in prims])
    Jall = np.concatenate([g.view(p['attributes']['JOINTS_0'])[0].astype(int) for p in prims])
    Wall = np.concatenate([g.view(p['attributes']['WEIGHTS_0'])[0].astype(float) for p in prims])
    if Wall.max() > 1.5: raise SystemExit('jaw: normalized integer weights not supported')
    hj = jidx[head]; hw = (Wall * (Jall == hj)).sum(1)
    # the hinge: HINGE_UP skulls over the Head joint, HINGE_BACK behind the middle between the face and the back of the head
    hy = pH[1] + HINGE_UP * skull
    band = (hw > 0.5) & (np.abs(V[:, 1] - hy) < 0.12 * skull) & (np.abs(V[:, 0] - pH[0]) < 0.6 * skull)
    if band.sum() < 50: raise SystemExit('jaw: no head surface at the hinge height')
    zf, zb = np.percentile(V[band, 2], 99.5), np.percentile(V[band, 2], 0.5)
    H = np.array([pH[0], hy, (zf + zb) / 2 - HINGE_BACK * skull])
    d = V - H; dz = d @ fwd; dy = d @ up; r = np.hypot(dz, dy)
    th = np.degrees(np.arctan2(-dy, dz))                               # 0 = straight out the front, 90 = straight down
    hgt = (V - pH) @ up / skull
    f = (1 - ss(TOPY[1], TOPY[0], hgt)) * (1 - ss(BACK[0], BACK[1], th)) * (th > -60) \
        * ss(NEAR[0] * skull, NEAR[1] * skull, r) * (1 - ss(FAR[0] * skull, FAR[1] * skull, r))
    f *= ss(HEADY[0], HEADY[1], hw)                                    # the rigger's head / neck blend under the chin = the stretch zone
    wj = f * hw
    on = wj > MIN_W
    full4 = on & ((Wall > 1e-7).sum(1) >= 4) & (wj >= MIN_W4)
    S = sample_poses(g) if full4.any() else None                     # (before the jaw joint is added)
    # the new joint: a child of Head at the hinge, its axes the world's (rotation = Head's inverse)
    Rh = glob(head)[:3, :3]; Rh = Rh / np.linalg.norm(Rh, axis=0)
    Lt = np.linalg.inv(glob(head)) @ np.append(H, 1)
    nodes.append({'name': JAW, 'translation': [float(x) for x in Lt[:3]], 'rotation': [float(x) for x in m2q(Rh.T)]}); jaw = len(nodes) - 1
    nodes[head].setdefault('children', []).append(jaw); par[jaw] = head
    if len(joints) + 1 > (255 if j['accessors'][prims[0]['attributes']['JOINTS_0']]['componentType'] == 5121 else 65535):
        raise SystemExit('jaw: too many joints for JOINTS_0')
    joints.append(jaw); jj = len(joints) - 1
    IBMall = np.concatenate([IBM, np.linalg.inv(glob(jaw))[None]]).transpose(0, 2, 1).reshape(-1, 16).astype(np.float32)
    # weights: the jaw takes f of Head's share. A vertex with four influences already gives one up to make room: the one
    # (and the joint its weight goes to) that moves the vertex least in the rig's own clips, so the moves look as before.
    dropped = []; moved = []; skipped = 0
    for vi in np.where(on)[0]:
        Jv, Wv = Jall[vi].copy(), Wall[vi].copy()
        k = int(np.where((Jv == hj) & (Wv > 0))[0][0])
        free = np.where(Wv <= 1e-7)[0]
        if not len(free) and wj[vi] < MIN_W4: skipped += 1; continue
        if not len(free):
            P = (S[:, Jv] @ np.append(V[vi], 1.0))[:, :, :3]                 # [frames, slot, xyz]: where each influence alone puts it
            best = None
            for q in range(4):
                if q == k: continue
                for p_ in range(4):
                    if p_ == q: continue
                    e = Wv[q] * np.linalg.norm(P[:, p_] - P[:, q], axis=1).max()
                    if best is None or e < best[0]: best = (e, q, p_)
            e, q, p_ = best
            dropped.append(float(Wv[q])); moved.append(float(e)); Wv[p_] += Wv[q]; Wv[q] = 0; free = [q]
        q = int(free[0]); share = hw[vi] * f[vi]
        Jv[q] = jj; Wv[q] = share; Wv[k] -= share
        Wv /= Wv.sum(); Jall[vi], Wall[vi] = Jv, Wv
    rep = {'verts': int(on.sum()) - skipped, 'skull_m': round(skull, 4), 'hinge': [round(float(x), 4) for x in H],
           'dropped': {'n': len(dropped), 'max': round(max(dropped), 4) if dropped else 0, 'mean': round(float(np.mean(dropped)), 4) if dropped else 0},
           'movesMm': round(max(moved) * 1000, 2) if moved else 0, 'poses': int(len(S)) if S is not None else 0, 'changed': not dry}
    print('jaw:', json.dumps(rep))
    if dry: return rep
    skin['inverseBindMatrices'] = g.append(IBMall, 5126, 'MAT4')
    o = 0
    for p in prims:
        a = p['attributes']; n = j['accessors'][a['POSITION']]['count']
        jt = np.uint8 if j['accessors'][a['JOINTS_0']]['componentType'] == 5121 else np.uint16
        g.write(a['JOINTS_0'], Jall[o:o + n].astype(jt)); g.write(a['WEIGHTS_0'], Wall[o:o + n].astype(np.float32)); o += n
    rep['clip'] = bool(clip and add_clip(g, jaw))
    j.setdefault('asset', {}).setdefault('extras', {})['jaw'] = {'joint': JAW, 'open': '+X', 'maxDeg': 18}
    g.save(dst)
    return rep


if __name__ == '__main__':
    a = sys.argv[1:]
    if '--' in a: a = a[a.index('--') + 1:]
    rp = a[a.index('--report') + 1] if '--report' in a else None
    rep = main(a[0], a[1], rp, '--clip' in a, '--dry' in a)
    if rp: json.dump(rep, open(rp, 'w'))
