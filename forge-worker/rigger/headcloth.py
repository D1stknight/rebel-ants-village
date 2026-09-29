# Forge Rigger 2.12 — spring chains for loose head cloth (skully-wrap knot flaps, bandana tails).
# Works on a finished rig GLB (so it can also upgrade rigs that are already live): finds thin sheets of the head wrap
# that hang below the skull, adds a chain of cloth_flap_<k>_<s> bones under Head for each, and moves those vertices
# onto the chain (weights fade from Head at the knot to the chain at the tip). Nothing else in the file changes: the
# JSON gets the new nodes / joints / inverse bind matrices, the binary buffer keeps every byte and only JOINTS_0 /
# WEIGHTS_0 of the flap vertices are rewritten in place. The clips never key these bones; the Forge and the village
# drive them with the cloth spring solver.
# usage: python3 headcloth.py in.glb out.glb [--report report.json] [--dry]
import json, struct, sys
import numpy as np
from scipy.spatial import cKDTree

SEGS = 3                 # bones per chain
THIN = 0.012             # sheet thickness (m, for a 1.8 m Rebel)
MIN_VERTS = 60           # smaller pieces (tiny bandana points, hair spikes) stay rigid
MIN_LEN = 0.035          # chain length (m)
GROW = 4                 # mesh rings added around the thin sheet (edges, frayed tips)


def q2m(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def local(n):
    if 'matrix' in n: return np.array(n['matrix'], dtype=float).reshape(4, 4).T
    M = np.eye(4)
    R = q2m(n.get('rotation', [0, 0, 0, 1])); S = np.diag(n.get('scale', [1, 1, 1]))
    M[:3, :3] = R @ S; M[:3, 3] = n.get('translation', [0, 0, 0])
    return M


CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


class Glb:
    def __init__(self, path):
        f = open(path, 'rb').read()
        L = struct.unpack('<I', f[12:16])[0]; self.j = json.loads(f[20:20 + L])
        o = 20 + L; BL = struct.unpack('<I', f[o:o + 4])[0]; self.bin = bytearray(f[o + 8:o + 8 + BL])

    def view(self, ai):
        a = self.j['accessors'][ai]; bv = self.j['bufferViews'][a['bufferView']]
        dt = CT[a['componentType']]; nc = NC[a['type']]; off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
        st = bv.get('byteStride', 0) or np.dtype(dt).itemsize * nc
        if st != np.dtype(dt).itemsize * nc: raise ValueError('strided accessor not supported')
        return np.frombuffer(bytes(self.bin[off:off + a['count'] * nc * np.dtype(dt).itemsize]), dtype=dt).reshape(a['count'], nc).copy(), off

    def write(self, ai, arr):
        _, off = self.view(ai); b = np.ascontiguousarray(arr).tobytes(); self.bin[off:off + len(b)] = b

    def append(self, arr, ctype, typ):
        while len(self.bin) % 4: self.bin.append(0)
        off = len(self.bin); b = np.ascontiguousarray(arr).tobytes(); self.bin += b
        self.j['bufferViews'].append({'buffer': 0, 'byteOffset': off, 'byteLength': len(b)})
        self.j['accessors'].append({'bufferView': len(self.j['bufferViews']) - 1, 'componentType': ctype, 'count': len(arr), 'type': typ})
        return len(self.j['accessors']) - 1

    def save(self, path):
        while len(self.bin) % 4: self.bin.append(0)
        self.j['buffers'][0]['byteLength'] = len(self.bin)
        js = json.dumps(self.j, separators=(',', ':')).encode()
        js += b' ' * ((4 - len(js) % 4) % 4)
        total = 12 + 8 + len(js) + 8 + len(self.bin)
        with open(path, 'wb') as fo:
            fo.write(struct.pack('<III', 0x46546C67, 2, total)); fo.write(struct.pack('<II', len(js), 0x4E4F534A)); fo.write(js)
            fo.write(struct.pack('<II', len(self.bin), 0x004E4942)); fo.write(self.bin)


def main(src, dst, report=None, dry=False):
    g = Glb(src); j = g.j; nodes = j['nodes']
    if any(n.get('name', '').startswith('cloth_flap_') for n in nodes):
        print('headcloth: already has flap chains'); rep = {'chains': 0, 'skipped': 'already'}
        if not dry: g.save(dst)
        return rep
    par = {c: i for i, n in enumerate(nodes) for c in n.get('children', [])}
    G = {}
    def glob(i):
        if i not in G: G[i] = (glob(par[i]) if i in par else np.eye(4)) @ local(nodes[i])
        return G[i]
    name = {n.get('name'): i for i, n in enumerate(nodes)}
    skin = j['skins'][0]; joints = skin['joints']; jidx = {nd: k for k, nd in enumerate(joints)}
    head = name.get('mixamorig_Head'); hips = name.get('mixamorig_Hips'); top = name.get('mixamorig_HeadTop_End')
    if head is None or head not in jidx: raise SystemExit('headcloth: no Head joint')
    headJ = [jidx[head]] + ([jidx[top]] if top in jidx else [])
    IBM, _ = g.view(skin['inverseBindMatrices']); IBM = IBM.reshape(-1, 4, 4).transpose(0, 2, 1)
    err = np.abs(glob(head) @ IBM[jidx[head]] - np.eye(4)).max()
    if err > 1e-3: print('headcloth: warning, rest pose != bind pose on Head', err)
    P = lambda i: glob(i)[:3, 3]
    pH = P(head); up = P(top) - pH if top is not None else P(head) - P(name['mixamorig_Neck']); skull = np.linalg.norm(up); up = up / skull
    Hgt = np.linalg.norm((P(top) if top is not None else pH) - P(hips)) / 0.52 if hips is not None else 1.8   # hips->head top ~ 0.52 H
    k = Hgt / 1.8
    # every skinned primitive, welded by position (UV seams split vertices)
    prims = [p for m in j['meshes'] for p in m['primitives'] if 'JOINTS_0' in p['attributes']]
    allV, allN, owner, tris = [], [], [], []
    base = 0
    for pi, p in enumerate(prims):
        V, _ = g.view(p['attributes']['POSITION']); Nn, _ = g.view(p['attributes']['NORMAL'])
        J, _ = g.view(p['attributes']['JOINTS_0']); W, _ = g.view(p['attributes']['WEIGHTS_0'])
        I, _ = g.view(p['indices']); I = I.reshape(-1, 3).astype(np.int64)
        allV.append(V.astype(float)); allN.append(Nn.astype(float)); owner += [(pi, v) for v in range(len(V))]; tris.append(I + base); base += len(V)
    V = np.concatenate(allV); Nn = np.concatenate(allN); T = np.concatenate(tris)
    Jall = np.concatenate([g.view(p['attributes']['JOINTS_0'])[0].astype(int) for p in prims])
    Wall = np.concatenate([g.view(p['attributes']['WEIGHTS_0'])[0].astype(float) for p in prims])
    if Wall.max() > 1.5: raise SystemExit('headcloth: normalized integer weights not supported')
    hw = sum((Wall * (Jall == hj)).sum(1) for hj in headJ)
    # weld
    key = np.round(V / 1e-5).astype(np.int64); _, weld = np.unique(key, axis=0, return_inverse=True); weld = weld.ravel()
    # thickness: nearest point behind the surface whose normal faces the other way
    hv = np.where(hw > 0.3)[0]
    tree = cKDTree(V[hv]); th = np.full(len(V), 9.0)
    for i in hv:
        for jj in tree.query_ball_point(V[i], THIN * k * 1.6):
            q = hv[jj]
            if Nn[q] @ Nn[i] < -0.3:
                d = V[q] - V[i]; t = -(d @ Nn[i])
                if t > 1e-4: th[i] = min(th[i], np.linalg.norm(d))
    thin = (hw > 0.3) & (th < THIN * k)
    # below the middle of the skull: flaps and tails hang, hair spikes and crests don't
    h = (V - pH) @ up
    thin &= h < skull * 0.55
    # components over welded vertices
    wid = weld; parent = np.arange(wid.max() + 1)
    def find(x):
        while parent[x] != x: parent[x] = parent[parent[x]]; x = parent[x]
        return x
    tw = wid[T]; ok = thin[T].all(1)
    for a_, b_, c_ in tw[ok]:
        for u, v in ((a_, b_), (b_, c_)):
            ru, rv = find(u), find(v)
            if ru != rv: parent[ru] = rv
    comp = {}
    for i in np.where(thin)[0]: comp.setdefault(find(wid[i]), []).append(i)
    # rest of the head (to find where each flap is tied on)
    solid = np.where((hw > 0.3) & ~thin)[0]; stree = cKDTree(V[solid]) if len(solid) else None
    # welded adjacency
    members = {}
    for i, w_ in enumerate(wid): members.setdefault(int(w_), []).append(i)
    members = {k_: np.array(v_) for k_, v_ in members.items()}
    adj = {}
    for a_, b_, c_ in tw:
        for u, v in ((a_, b_), (b_, c_), (c_, a_)):
            adj.setdefault(int(u), set()).add(int(v)); adj.setdefault(int(v), set()).add(int(u))
    chains = []
    for c in sorted(comp.values(), key=len, reverse=True):
        c = np.array(c); pts = V[c]
        if len(np.unique(wid[c])) < MIN_VERTS: continue
        # root: the part of the sheet touching the wrap; tip: the point farthest from it
        dS = stree.query(pts)[0] if stree is not None else np.zeros(len(pts))
        rootPts = pts[dS < np.percentile(dS, 15) + 1e-4]; root = rootPts.mean(0)
        far = np.linalg.norm(pts - root, axis=1); tip = pts[far > np.percentile(far, 90)].mean(0)
        ax = tip - root; Ln = np.linalg.norm(ax)
        if Ln < MIN_LEN * k: continue
        ax /= Ln
        if ax @ (-up) < 0.2: continue                                        # must hang down, not stick out / up
        # grow over the mesh a few rings: the sheet's edges and frayed tips (no surface behind them, so they never read as
        # thin) must ride with it, or they stay on the head and stretch into spikes. Only below the knot.
        have = set(wid[c].tolist()); ring = set(have)
        for _ in range(GROW):
            nxt = set()
            for w_ in ring:
                for nb in adj[w_]:
                    if nb in have: continue
                    vs = members[nb]
                    if hw[vs].max() <= 0.3 or ((V[vs[0]] - root) @ ax) / Ln < 0.12: continue
                    nxt.add(nb)
            have |= nxt; ring = nxt
            if not ring: break
        c = np.concatenate([members[w_] for w_ in have]); pts = V[c]
        t = np.clip((pts - root) @ ax / Ln, 0, 1)
        # centre line: mean of the sheet in each slice
        cps = [root]
        for s in range(1, SEGS + 1):
            m = np.abs(t - s / SEGS) < 0.5 / SEGS
            cps.append(pts[m].mean(0) if m.sum() > 3 else root + ax * Ln * s / SEGS)
        chains.append({'verts': c, 't': t, 'pts': np.array(cps), 'len': float(Ln), 'n': int(len(c))})
    rep = {'chains': len(chains), 'H': float(Hgt), 'thin': int(thin.sum()), 'flaps': [{'verts': ch['n'], 'len_m': round(ch['len'] / k, 3)} for ch in chains]}
    print('headcloth:', json.dumps(rep))
    if dry or not chains:
        if not dry: g.save(dst)
        return rep
    # new nodes + joints
    newJ = []
    ibm_new = []
    for ci, ch in enumerate(chains):
        prev = head; ids = []
        for s in range(SEGS + 1):
            nm = f'cloth_flap_{ci}_{s}' if s < SEGS else f'cloth_flap_{ci}_end'
            p = ch['pts'][s]; Lp = np.linalg.inv(glob(prev)) @ np.append(p, 1)
            nodes.append({'name': nm, 'translation': [float(x) for x in Lp[:3]]}); ni = len(nodes) - 1
            nodes[prev].setdefault('children', []).append(ni); par[ni] = prev; G.pop(ni, None)
            if s < SEGS:
                joints.append(ni); ids.append(len(joints) - 1); ibm_new.append(np.linalg.inv(glob(ni)))
            prev = ni
        ch['joints'] = ids
    if len(joints) > 255: raise SystemExit('headcloth: too many joints for ubyte JOINTS_0')
    IBMall = np.concatenate([IBM, np.array(ibm_new)]).transpose(0, 2, 1).reshape(-1, 16).astype(np.float32)
    skin['inverseBindMatrices'] = g.append(IBMall, 5126, 'MAT4')
    # weights: tent functions along the chain; Head keeps the knot end
    done = set()
    for ch in chains:
        u = ch['t'] * SEGS                                                  # 0..SEGS
        for vi, uu in zip(ch['verts'], u):
            if vi in done: continue
            w = {}
            wHead = max(0.0, 1 - uu / 0.6)                                  # knot end stays on the head
            for s in range(SEGS):
                c_ = s + 0.5
                ws = max(0.0, 1 - abs(uu - c_))
                if s == SEGS - 1 and uu > c_: ws = 1.0
                if s == 0 and uu < c_: ws = 1.0
                if ws > 0: w[ch['joints'][s]] = ws
            tot = sum(w.values()); w = {a: b / tot * (1 - wHead) for a, b in w.items()}
            if wHead > 0: w[jidx[head]] = w.get(jidx[head], 0) + wHead
            top4 = sorted(w.items(), key=lambda x: -x[1])[:4]; s4 = sum(b for _, b in top4)
            Jn = np.zeros(4, int); Wn = np.zeros(4)
            for q, (a, b) in enumerate(top4): Jn[q] = a; Wn[q] = b / s4
            # every copy of this welded vertex (UV seams) gets the same weights
            for dup in members[int(wid[vi])]:
                Jall[dup] = Jn; Wall[dup] = Wn; done.add(int(dup))
    o = 0
    for pi, p in enumerate(prims):
        n = g.view(p['attributes']['POSITION'])[0].shape[0]
        g.write(p['attributes']['JOINTS_0'], Jall[o:o + n].astype(np.uint8))
        g.write(p['attributes']['WEIGHTS_0'], Wall[o:o + n].astype(np.float32)); o += n
    g.save(dst)
    return rep


if __name__ == '__main__':
    a = sys.argv[1:]
    if '--' in a: a = a[a.index('--') + 1:]
    rp = a[a.index('--report') + 1] if '--report' in a else None
    rep = main(a[0], a[1], rp, '--dry' in a)
    if rp: json.dump(rep, open(rp, 'w'))
