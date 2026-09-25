# Forge Rigger v1.4 — cloth spring bones for robes / armour skirts.
# Adds N radial skirt chains (cloth_skirt_<panel>_<seg>) under Hips and moves skirt vertices onto them.
# The clips never key these bones; the village drives them with a spring solver at runtime (swing, settle, legs push through).
# usage: python3.13 clothbones.py -- in.blend out.blend [panels=8] [segs=3]
import bpy, sys, numpy as np
a = sys.argv[sys.argv.index('--') + 1:]; src, dst = a[0], a[1]
NP = int(a[2]) if len(a) > 2 else 8; NS = int(a[3]) if len(a) > 3 else 3
import os
LEG_R = float(os.environ.get('CLOTH_LEG_R', 0.12)); BLEND_W = float(os.environ.get('CLOTH_BLEND_W', 0.05)); KNEE_FADE = os.environ.get('CLOTH_KNEE_FADE', '1') == '1'; AMAX = float(os.environ.get('CLOTH_AMAX', 0.45))
bpy.ops.wm.open_mainfile(filepath=src)
arm = bpy.data.objects['Armature']; me = [o for o in bpy.data.objects if o.type == 'MESH'][0]
P = 'mixamorig_'; B = arm.data.bones
def H(n): return np.array(B[P + n].head_local)
V = np.array([v.co[:] for v in me.data.vertices]); nv = len(V)
hip = H('Hips'); zc = min(H('LeftUpLeg')[2], H('RightUpLeg')[2]); zank = max(H('LeftFoot')[2], H('RightFoot')[2])
zw = zc + 0.05                                                  # waist ring height (top of the skirt chains)
def seg_d(p, a_, b_):
    ab = b_ - a_; t = np.clip(((p - a_) @ ab) / (ab @ ab), 0, 1); return np.linalg.norm(p - (a_ + t[:, None] * ab), axis=1)
dleg = np.full(nv, 9.0)
for s in ('Left', 'Right'):
    dleg = np.minimum(dleg, seg_d(V, H(s + 'UpLeg'), H(s + 'Leg'))); dleg = np.minimum(dleg, seg_d(V, H(s + 'Leg'), H(s + 'Foot')))
rel = V[:, :2] - hip[:2]
ang = np.arctan2(rel[:, 0], -rel[:, 1]) % (2 * np.pi)          # 0 = front (-Y), increasing toward +X (character's left)
rad = np.linalg.norm(rel, axis=1)
cloth = (V[:, 2] < zw) & (V[:, 2] > zank + 0.03) & (dleg > LEG_R)
# v1.4.1: hands hang at skirt height beside the robe; never turn arm/hand verts into cloth
_arm = [g.index for g in me.vertex_groups if any(k in g.name for k in ('Arm', 'Hand', 'Shoulder', 'Thumb', 'Index', 'Middle', 'Ring', 'Pinky'))]
_aw = np.zeros(nv)
for v in me.data.vertices:
    for g in v.groups:
        if g.group in _arm: _aw[v.index] += g.weight
dhand = np.full(nv, 9.0)
for s_ in ('Left', 'Right'):
    dhand = np.minimum(dhand, seg_d(V, H(s_ + 'ForeArm'), H(s_ + 'Hand') + (H(s_ + 'Hand') - H(s_ + 'ForeArm')) * 0.6))
cloth &= (_aw < 0.15) & (dhand > 0.07)
if cloth.sum() < 200:
    print('clothbones: no skirt found, skipped'); bpy.ops.wm.save_as_mainfile(filepath=dst); sys.exit(0)
# per panel: hem height and radius profile from the cloth verts in its sector
pw = 2 * np.pi / NP; chains = []
for k in range(NP):
    th = k * pw; da = np.abs((ang - th + np.pi) % (2 * np.pi) - np.pi); sec = cloth & (da < pw * 0.75)
    if sec.sum() < 30: chains.append(None); continue
    zh = max(np.percentile(V[sec, 2], 3), zank + 0.05)
    zs = np.linspace(zw, zh, NS + 1); pts = []
    for z in zs:
        near = sec & (np.abs(V[:, 2] - z) < 0.06)
        r = np.percentile(rad[near], 60) if near.sum() > 5 else np.percentile(rad[sec], 60)
        pts.append(np.array([hip[0] + r * np.sin(th), hip[1] - r * np.cos(th), z]))
    chains.append(pts)
# build bones
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='EDIT'); eb = arm.data.edit_bones
for k, pts in enumerate(chains):
    if pts is None: continue
    par = eb[P + 'Hips']
    for s in range(NS):
        b = eb.new(f'cloth_skirt_{k}_{s}'); b.head = pts[s].tolist(); b.tail = pts[s + 1].tolist(); b.parent = par
        b.use_connect = s > 0; b.roll = 0; par = b
    e = eb.new(f'cloth_skirt_{k}_end'); e.head = pts[NS].tolist(); e.tail = (pts[NS] + (pts[NS] - pts[NS - 1]) * 0.25).tolist(); e.parent = par; e.use_connect = True
bpy.ops.object.mode_set(mode='OBJECT')
# weights
names = [g.name for g in me.vertex_groups]
W = np.zeros((nv, len(names)), np.float32)
for v in me.data.vertices:
    for g in v.groups: W[v.index, g.group] = g.weight
C = np.zeros_like(W[:, :0]); cl_names = []
for k, pts in enumerate(chains):
    if pts is None: continue
    for s in range(NS): cl_names.append(f'cloth_skirt_{k}_{s}')
for n in cl_names:
    if n not in me.vertex_groups: me.vertex_groups.new(name=n)
names = [g.name for g in me.vertex_groups]; W = np.c_[W, np.zeros((nv, len(names) - W.shape[1]), np.float32)]
gi = {n: i for i, n in enumerate(names)}
valid = [k for k in range(NP) if chains[k] is not None]
idx = np.nonzero(cloth)[0]; Cw = np.zeros((len(idx), len(names)), np.float32)
for j, vi in enumerate(idx):
    # two nearest panels by angle
    d = np.array([abs((ang[vi] - k * pw + np.pi) % (2 * np.pi) - np.pi) for k in valid]); o = np.argsort(d)[:2]
    wa = np.clip(1 - d[o] / pw, 0, 1); wa = wa / max(wa.sum(), 1e-6)
    for kk, w in zip(o, wa):
        k = valid[kk]; pts = chains[k]; z = V[vi, 2]
        t = np.clip((pts[0][2] - z) / max(pts[0][2] - pts[-1][2], 1e-3), 0, 0.999) * NS; s0 = int(t); f = t - s0
        # vertex near a joint blends the two segments
        Cw[j, gi[f'cloth_skirt_{k}_{s0}']] += w * (1 - 0.5 * max(0, 0.5 - f) * 0 - (max(0, f - 0.7) / 0.3) * 0.5)
        if f > 0.7 and s0 + 1 < NS: Cw[j, gi[f'cloth_skirt_{k}_{s0 + 1}']] += w * (max(0, f - 0.7) / 0.3) * 0.5
Cw /= np.maximum(Cw.sum(1, keepdims=True), 1e-6)
alpha = np.clip((dleg[idx] - LEG_R) / BLEND_W, 0, 1) * np.clip((zw - V[idx, 2]) / 0.06, 0, 1)
if KNEE_FADE:   # v1.5.1: below the knees it is trousers / shins, not free cloth -> follow the legs (kicks stretched baggy pants)
    zknee = min(H('LeftLeg')[2], H('RightLeg')[2])
    alpha *= np.clip((V[idx, 2] - (zknee - 0.02)) / 0.10, 0, 1)
alpha *= AMAX   # v1.5.1: keep part of the leg weight so a kicking leg carries the cloth with it (no stretched trousers)
W[idx] = W[idx] * (1 - alpha[:, None]) + Cw * alpha[:, None]
print('clothbones panels', len(valid), 'segs', NS, 'cloth verts', len(idx), 'mean alpha', round(float(alpha.mean()), 3))
for g in me.vertex_groups: g.remove(list(range(nv)))
top = np.argsort(W, 1)[:, ::-1][:, :4]
for i in range(nv):
    ws = W[i, top[i]]; s_ = ws.sum()
    if s_ <= 1e-6: continue
    for k in range(4):
        if ws[k] > 1e-4: me.vertex_groups[int(top[i, k])].add([i], float(ws[k] / s_), 'REPLACE')
bpy.ops.wm.save_as_mainfile(filepath=dst)
