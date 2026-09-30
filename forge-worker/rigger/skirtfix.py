# Robe / skirt cleanup for generator meshes with open cloth sheets (TRELLIS): v1.3
# 1) skirt verts outside the leg capsules blend toward Hips (cloth hangs from the waist instead of stretching between legs)
# 2) small separate shells (tassels, rope ends, robe tails) move rigidly with their average weights
# usage: python3.13 skirtfix.py -- in.blend out.blend [leg_radius=0.075] [blend_width=0.08] [max_alpha=0.85]
import bpy, sys, numpy as np, bmesh
a = sys.argv[sys.argv.index('--') + 1:]; src, dst = a[0], a[1]
R = float(a[2]) if len(a) > 2 else 0.075; BW = float(a[3]) if len(a) > 3 else 0.08; AMAX = float(a[4]) if len(a) > 4 else 0.85
bpy.ops.wm.open_mainfile(filepath=src)
arm = bpy.data.objects['Armature']; me = [o for o in bpy.data.objects if o.type == 'MESH'][0]
P = 'mixamorig_'; B = arm.data.bones
def H(n): return np.array(B[P + n].head_local)
V = np.array([v.co[:] for v in me.data.vertices]); nv = len(V)
gi = {g.name: g.index for g in me.vertex_groups}; ng = len(me.vertex_groups)
W = np.zeros((nv, ng), np.float32)
for v in me.data.vertices:
    for g in v.groups: W[v.index, g.group] = g.weight
def seg_d(p, a_, b_):
    ab = b_ - a_; t = np.clip(((p - a_) @ ab) / (ab @ ab), 0, 1); return np.linalg.norm(p - (a_ + t[:, None] * ab), axis=1)
zc = min(H('LeftUpLeg')[2], H('RightUpLeg')[2]); zank = max(H('LeftFoot')[2], H('RightFoot')[2])
d = np.full(nv, 9.0)
for s in ('Left', 'Right'):
    d = np.minimum(d, seg_d(V, H(s + 'UpLeg'), H(s + 'Leg'))); d = np.minimum(d, seg_d(V, H(s + 'Leg'), H(s + 'Foot')))
# 0) v1.8 arm leak: TRELLIS fuses the hanging hands with the armour skirt, so bone heat gives skirt plates hand/arm
# weight and they tear up into big sheets on every punch. Below the wrist a vert is either the fist (mostly arm weight,
# near the hand bone: pure arm chain) or body (no arm weight), and the faces joining the two are cut.
RH = float(__import__('os').environ.get('FORGE_HAND_RADIUS', '0.12'))
leak = 0; split = 0; handv = np.zeros(nv, bool); bodyv = np.zeros(nv, bool)
for s_ in ('Left', 'Right'):
    grp = [gi[n] for n in gi if n.startswith(P + s_ + 'Hand') or n in (P + s_ + 'ForeArm', P + s_ + 'Arm')]
    hh = H(s_ + 'Hand'); ht = np.array(B[P + s_ + 'Hand'].tail_local); ht = ht + (ht - hh) * 1.2
    zone = V[:, 2] < hh[2] + 0.03
    a = W[:, grp].sum(1); near = seg_d(V, hh, ht) <= RH
    hand = zone & near & (a >= 0.5)                     # the fist itself: pure arm chain
    body = zone & ~hand & (a > 1e-4)                    # skirt that picked up some arm weight: none at all
    keep = np.zeros(W.shape[1], bool); keep[grp] = True
    W[np.ix_(hand, ~keep)] = 0; W[np.ix_(body, grp)] = 0
    leak += int(body.sum()); split += int(hand.sum())
    handv |= hand; bodyv |= zone
bodyv &= ~handv
rest = W.sum(1); empty = rest < 1e-6
W[empty, gi[P + 'Hips']] = 1; W /= np.maximum(W.sum(1, keepdims=True), 1e-6)
# cut the webbing faces that join hand verts to skirt verts
import bmesh
bm = bmesh.new(); bm.from_mesh(me.data)
cut = [f for f in bm.faces if any(handv[v.index] for v in f.verts) and any(bodyv[v.index] for v in f.verts)]
bmesh.ops.delete(bm, geom=cut, context='FACES_ONLY'); bm.to_mesh(me.data); bm.free()
print('skirtfix hand verts', split, 'arm weight removed from', leak, 'webbing faces cut', len(cut))
skirt = (V[:, 2] < zc + 0.06) & (V[:, 2] > zank + 0.04) & (d > R)
alpha = np.clip((d - R) / BW, 0, 1) * AMAX
# fade in near the waist so the belt line stays continuous
alpha *= np.clip((zc + 0.06 - V[:, 2]) / 0.08, 0, 1)
alpha[~skirt] = 0
alpha[handv] = 0                                   # v1.8: the hands hang at skirt height; never blend them to Hips
hips = np.zeros(ng, np.float32); hips[gi[P + 'Hips']] = 1
W2 = W * (1 - alpha[:, None]) + alpha[:, None] * hips
print('skirtfix skirt verts', int(skirt.sum()), 'mean alpha', round(float(alpha[skirt].mean()) if skirt.any() else 0, 3))
# 2) small shells -> rigid
# components over the WELDED surface (UV seams split the raw mesh into thousands of islands)
E = np.zeros(len(me.data.edges) * 2, np.int64); me.data.edges.foreach_get('vertices', E); E = E.reshape(-1, 2)
par_ = np.arange(nv)
def find(x):
    r = x
    while par_[r] != r: r = par_[r]
    while par_[x] != r: par_[x], x = r, par_[x]
    return r
key = np.round(V / 1e-5).astype(np.int64); _, inv = np.unique(key, axis=0, return_inverse=True); inv = inv.ravel()
first = {}
for i, k in enumerate(inv):
    if k in first: E = np.vstack([E, [[first[k], i]]]) if False else E
    else: first[k] = i
pairs = np.c_[np.array([first[k] for k in inv]), np.arange(nv)]
for a_, b_ in np.vstack([E, pairs]):
    ra, rb = find(a_), find(b_)
    if ra != rb: par_[ra] = rb
comp = np.array([find(i) for i in range(nv)]); _, comp = np.unique(comp, return_inverse=True); nc = comp.max() + 1
sizes = np.bincount(comp); small = sizes < 0.01 * nv; nr = 0
for c in np.nonzero(small)[0]:
    idx = np.nonzero(comp == c)[0]; w = W2[idx].mean(0)
    top = np.argsort(w)[::-1][:4]; ww = np.zeros_like(w); ww[top] = w[top]; ww /= max(ww.sum(), 1e-6)
    W2[idx] = ww; nr += len(idx)
print('skirtfix shells', nc, 'rigid small shells', int(small.sum()), 'verts', nr)
# write back (limit 4, normalise)
for g in me.vertex_groups: g.remove(list(range(nv)))
top = np.argsort(W2, 1)[:, ::-1][:, :4]
for i in range(nv):
    ws = W2[i, top[i]]; s_ = ws.sum()
    if s_ <= 1e-6: continue
    for k in range(4):
        if ws[k] > 1e-4: me.vertex_groups[int(top[i, k])].add([i], float(ws[k] / s_), 'REPLACE')
bpy.ops.wm.save_as_mainfile(filepath=dst)
