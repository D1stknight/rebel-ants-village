# Forge Rigger v2.0 hands, the Unity way: a standard rigged hand on every Rebel.
# The generated hands are fused blobs (4 fingers, fingertips fused to the thigh, no joints), so they could never close.
# They are cut off at the wrist and replaced by the standard 5-finger glove (glove.py), sized to the Rebel's own hand,
# tinted with the colour of the Rebel's own glove, with real finger bones and weights. Every clip then gets a hand pose:
# fists for strikes, kicks and the guard, open hands for cartwheels and getting up, relaxed hands for the rest.
# usage: python3.13 handswap.py -- in.blend out.blend
import bpy, bmesh, sys, os, math, numpy as np, mathutils as mu
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import glove

a = sys.argv[sys.argv.index('--') + 1:]; src, dst = a
bpy.ops.wm.open_mainfile(filepath=src)
arm = bpy.data.objects['Armature']; body = [o for o in bpy.data.objects if o.type == 'MESH'][0]; P = 'mixamorig_'
FING = ('Thumb', 'Index', 'Middle', 'Ring', 'Pinky')
Aw = arm.matrix_world; Bw = body.matrix_world; Bi = Bw.inverted()
names = [g.name for g in body.vertex_groups]
isarm = np.array([('Hand' in n or 'ForeArm' in n) for n in names])
me = body.data
co = np.array([Bw @ v.co for v in me.vertices])
nv = len(me.vertices)
Wt = np.zeros((nv, len(names)), np.float32)
for v in me.vertices:
    for g in v.groups: Wt[v.index, g.group] = g.weight
Wsum = Wt.sum(1) + 1e-9
hips = np.array((Aw @ arm.data.bones[P + 'Hips'].head_local)[:])

# ---- the Rebel's own glove colour: the base-colour texture under the hand being removed ----
def base_image():
    m = me.materials[0]
    for n in m.node_tree.nodes:
        if n.type == 'TEX_IMAGE' and n.image and any('Base Color' in l.to_socket.name for l in n.outputs[0].links): return n.image
    return None
img = base_image(); IMG = None
if img is not None:
    w, h = img.size; IMG = np.array(img.pixels[:], np.float32).reshape(h, w, 4)[:, :, :3]
uvl = me.uv_layers.active

def srgb2lin(c): return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

plan, cut = {}, np.zeros(nv, bool)
for side in ('Left', 'Right'):
    hb = arm.data.bones[P + side + 'Hand']; fb = arm.data.bones[P + side + 'ForeArm']
    W = np.array((Aw @ hb.head_local)[:]); E = np.array((Aw @ fb.head_local)[:])
    x = (W - E) / np.linalg.norm(W - E)
    out = np.array([np.sign(W[0] - hips[0]) or (1 if side == 'Left' else -1), 0.0, 0.0])
    z = out - (out @ x) * x; z /= np.linalg.norm(z)          # the back of the hand faces away from the body
    y = np.cross(z, x)                                         # right hand: thumb side; the left glove is mirrored
    hg = names.index(P + side + 'Hand')
    rel = co - W; tt = rel @ x; rr = np.linalg.norm(rel - np.outer(tt, x), axis=1)
    handw = Wt[:, hg] / Wsum
    armw = (Wt[:, isarm].sum(1)) / Wsum
    own = (handw > 0.5) & (tt > 0.0)
    reach = np.percentile(tt[own], 98) if own.sum() > 20 else 0.75 * np.linalg.norm(W - E)
    fore = np.linalg.norm(W - E)
    L = float(np.clip(reach, 0.55 * fore, 1.05 * fore))
    rm = ((handw > 0.5) & (tt > -0.004)) | ((armw > 0.5) & (tt > 0.012) & (rr < 0.9 * L))
    # wrist girth: the glove cuff should fill the sleeve opening, not float inside it
    ring = (np.abs(tt) < 0.015) & (armw > 0.5)
    girth = float(np.percentile(rr[ring], 92)) if ring.sum() > 10 else 0.16 * L
    # v2.6 a wrist ring that picked up the body (arms hanging against the torso) made giant disc cuffs: keep the girth
    # within what a forearm can be for this hand
    girth_raw = girth; girth = float(np.clip(girth, 0.14 * L, 0.32 * L))
    # v2.6 where the sleeve / bracer really ends (along the forearm, from the wrist joint): the cuff only widens to the
    # sleeve's girth behind this point, so no wide ring of glove shows past the end of an arm guard (#1555)
    shell = (armw > 0.5) & ~(((handw > 0.5) & (tt > -0.004)) | ((armw > 0.5) & (tt > 0.012) & (rr < 0.9 * L))) & (rr > 0.5 * girth) & (tt > -0.08) & (tt < 0.03)
    bend = float(np.percentile(tt[shell], 98)) if shell.sum() > 10 else 0.0
    col = np.array([0.05, 0.05, 0.06])
    if IMG is not None and uvl is not None:
        idx = set(np.nonzero(own)[0].tolist()); samp = []
        for p in me.polygons:
            for li in p.loop_indices:
                if me.loops[li].vertex_index in idx:
                    u, v = uvl.data[li].uv; hh, ww = IMG.shape[:2]
                    samp.append(IMG[int(np.clip(v, 0, 0.9999) * hh), int(np.clip(u, 0, 0.9999) * ww)])
        if samp: col = np.median(np.array(samp), 0)
    # v2.6 the cuff takes the colour of the sleeve / arm guard it tucks into, the hand keeps the glove (or skin) colour.
    # A skin-coloured cuff as wide as an arm guard read as a fat wrist ring on bare-handed Rebels (#1555).
    ccol = col
    if IMG is not None and uvl is not None:
        ridx = set(np.nonzero(shell & (tt > -0.03))[0].tolist()); samp = []
        for p in me.polygons:
            for li in p.loop_indices:
                if me.loops[li].vertex_index in ridx:
                    u, v = uvl.data[li].uv; hh, ww = IMG.shape[:2]
                    samp.append(IMG[int(np.clip(v, 0, 0.9999) * hh), int(np.clip(u, 0, 0.9999) * ww)])
        if len(samp) > 10: ccol = np.median(np.array(samp), 0)
    # v2.7 the cuff follows the real cross-section of the sleeve / arm guard (per angle around the forearm), just inside
    # it, so the band that shows past the guard is exactly as wide as the guard (#1555: a round cuff stood proud)
    NB = 24; prof = np.full(NB, np.nan)
    pm = (armw > 0.5) & ~rm & (tt > -0.035) & (tt < 0.005) & (rr < 1.8 * girth) & (rr > 0.3 * girth)
    if pm.sum() > 40:
        th = np.arctan2(rel[pm] @ z, rel[pm] @ y); bi = ((th + np.pi) / (2 * np.pi) * NB).astype(int) % NB
        for b_ in range(NB):
            sel = rr[pm][bi == b_]
            if len(sel) >= 3: prof[b_] = np.percentile(sel, 70)
    if np.isnan(prof).all(): prof[:] = girth
    ok_ = ~np.isnan(prof); idx_ = np.arange(NB)
    prof = np.interp(idx_, np.concatenate([idx_[ok_] - NB, idx_[ok_], idx_[ok_] + NB]), np.tile(prof[ok_], 3))
    prof = np.clip((np.roll(prof, 1) + 2 * prof + np.roll(prof, -1)) / 4, 0.12 * L, 0.34 * L)
    cut |= rm
    plan[side] = dict(W=W, x=x, y=y, z=z, L=L, girth=girth, bend=bend, col=col, ccol=ccol, prof=prof, mirror=(side == 'Left'))
    print(f'handswap {side}: hand length {L:.3f} (reach {reach:.3f}, forearm {fore:.3f}) wrist girth {girth:.3f} (raw {girth_raw:.3f}) '
          f'sleeve end {bend:+.3f} verts removed {int(rm.sum())} glove colour {np.round(col, 3).tolist()}')

# ---- remove the generated hands ----
bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
bmesh.ops.delete(bm, geom=[bm.verts[i] for i in np.nonzero(cut)[0]], context='VERTS')
# v2.8 remove the crumbs of the old hand the cut leaves behind (fingertip shards floating next to the new glove, #4 V2):
# small loose pieces out past the wrist
bm.verts.ensure_lookup_table(); seen = set(); crumbs = []
for v0 in bm.verts:
    if v0.index in seen: continue
    comp = [v0]; stack = [v0]; seen.add(v0.index)
    while stack and len(comp) < 400:
        a_ = stack.pop()
        for e in a_.link_edges:
            b_ = e.other_vert(a_)
            if b_.index not in seen: seen.add(b_.index); comp.append(b_); stack.append(b_)
    if len(comp) >= 400 or stack: continue
    c = np.mean([np.array((Bw @ v.co)[:]) for v in comp], 0)
    for pl in plan.values():
        rel_ = c - pl['W']; t_ = rel_ @ pl['x']
        if -0.01 < t_ < 1.6 * pl['L'] and np.linalg.norm(rel_ - t_ * pl['x']) < 0.8 * pl['L']:
            crumbs += comp; break
if crumbs: bmesh.ops.delete(bm, geom=list(set(crumbs)), context='VERTS')
print('handswap hand crumbs removed', len(set(crumbs)))
# v2.6 close the openings the cut leaves at the end of the sleeve / arm guard: from outside, an open end showed the
# dark inside of the shell around a bare wrist (#1555). The caps take the rim's material and texture.
uvL = bm.loops.layers.uv.active
edges = []
for e in bm.edges:
    if not e.is_boundary: continue
    c = np.array((Bw @ e.verts[0].co)[:])
    if any(np.linalg.norm(c - pl['W']) < 0.9 * pl['L'] for pl in plan.values()): edges.append(e)
n0 = len(bm.faces)
res = bmesh.ops.holes_fill(bm, edges=edges, sides=64) if edges else {'faces': []}
for f in res['faces']:
    nb = [l.link_loop_radial_next.face for l in f.loops if l.link_loop_radial_next.face is not f]
    if nb: f.material_index = max(set(x.material_index for x in nb), key=[x.material_index for x in nb].count); f.smooth = True
    if uvL is not None:
        for l in f.loops:
            other = [ol for ol in l.vert.link_loops if ol.face is not f]
            if other: l[uvL].uv = other[0][uvL].uv
print('handswap sleeve-end caps', len(res['faces']), 'from boundary edges', len(edges))
bm.to_mesh(me); bm.free(); me.update()

# ---- one glove per side ----
gme, J = glove.build()
GW = glove.weights(gme, J)
G = np.array([v.co[:] for v in gme.vertices])
mat = bpy.data.materials.new('Glove'); mat.use_nodes = True
bsdf = mat.node_tree.nodes['Principled BSDF']
col = np.mean([plan[s]['col'] for s in plan], 0)            # both hands the same colour
lin = srgb2lin(col)
bsdf.inputs['Base Color'].default_value = (*lin.tolist(), 1.0); bsdf.inputs['Roughness'].default_value = 0.62
bsdf.inputs['Metallic'].default_value = 0.0
me.materials.append(mat); gmi = len(me.materials) - 1
cmat = bpy.data.materials.new('GloveCuff'); cmat.use_nodes = True
cb_ = cmat.node_tree.nodes['Principled BSDF']
ccol = np.mean([plan[s]['ccol'] for s in plan], 0)
cb_.inputs['Base Color'].default_value = (*srgb2lin(ccol).tolist(), 1.0); cb_.inputs['Roughness'].default_value = 0.7
me.materials.append(cmat); cmi = len(me.materials) - 1
print('handswap cuff colour', np.round(ccol, 3).tolist())

bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='EDIT')
eb = arm.data.edit_bones; Ai = Aw.inverted()
for side, pl in plan.items():
    s = pl['L'] / 0.95; M = np.stack([pl['x'], pl['y'], pl['z']], 1)
    def world(p, pl=pl, s=s, M=M):
        p = np.array(p, float).copy()
        if pl['mirror']: p[1] = -p[1]
        return pl['W'] + M @ (p * s)
    pl['world'] = world
    for f, (pts, r) in J.items():
        for i in range(1, 5):
            b = eb.get(P + side + 'Hand' + f + str(i))
            if b is None: continue
            b.use_connect = False
            hd = world(pts[i - 1]); tl = world(pts[i]) if i < 4 else world(pts[3]) + (world(pts[3]) - world(pts[2])) * 0.35
            b.head = Ai @ mu.Vector(hd.tolist()); b.tail = Ai @ mu.Vector(tl.tolist())
            b.align_roll(Ai.to_3x3() @ mu.Vector(pl['z'].tolist()))
bpy.ops.object.mode_set(mode='OBJECT')

bm = bmesh.new(); bm.from_mesh(me)
dl = bm.verts.layers.deform.verify()
for side, pl in plan.items():
    gb = bmesh.new(); gb.from_mesh(gme)
    if pl['mirror']: bmesh.ops.reverse_faces(gb, faces=list(gb.faces))
    base = len(bm.verts)
    vmap = {}
    s_ = pl['L'] / 0.95; tgt = 1.0 * pl['girth']
    for v in gb.verts:
        p = np.array(v.co[:], float)
        if p[0] < 0:   # the cuff: round, and as wide as the Rebel's own wrist, so no gap shows when the wrist bends
            rad = np.linalg.norm(p[1:]) * s_
            k = float(np.clip(-p[0] / 0.07, 0, 1))
            a1 = -p[1] if pl['mirror'] else p[1]
            b_ = int((np.arctan2(p[2], a1) + np.pi) / (2 * np.pi) * len(pl['prof'])) % len(pl['prof'])
            tg = 0.97 * pl['prof'][b_]
            if rad > 1e-6: p[1:] *= (1 - k) + k * (tg / rad)
        nvv = bm.verts.new(Bi @ mu.Vector(pl['world'](p).tolist())); vmap[v.index] = nvv
    bm.verts.index_update()
    for f in gb.faces:
        try: nf = bm.faces.new([vmap[v.index] for v in f.verts]); nf.material_index = cmi if np.mean([G[v.index, 0] for v in f.verts]) < -0.012 else gmi; nf.smooth = True
        except ValueError: pass
    gb.free()
    gid = {}
    for k in GW:
        n = P + side + ('Hand' if k == 'Hand' else 'Hand' + k)
        g = body.vertex_groups.get(n) or body.vertex_groups.new(name=n); gid[k] = g.index
    fore = (body.vertex_groups.get(P + side + 'ForeArm') or body.vertex_groups.new(name=P + side + 'ForeArm')).index
    for i, v in vmap.items():
        for k, w in GW.items():
            if w[i] > 0.01: v[dl][gid[k]] = float(w[i])
        gx = G[i, 0]
        if gx < 0:                      # the cuff blends into the forearm so it stays in the sleeve when the wrist bends
            t = float(np.clip(-gx / 0.14, 0, 0.85)); hw = v[dl].get(gid['Hand'], 0.0)
            if hw > 0: v[dl][gid['Hand']] = hw * (1 - t); v[dl][fore] = hw * t
bm.to_mesh(me); bm.free(); me.update()
print('handswap gloves added, verts', len(me.vertices))

# ---- hand poses in every clip ----
FIST = {'jab', 'cross_punch', 'hook_punch', 'elbow_punch', 'punch_combo', 'front_kick', 'side_kick', 'roundhouse_kick',
        'crescent_kick', 'hurricane_kick', 'flip_kick', 'spin_flip_kick', 'fight_idle', 'hit_reaction', 'jump_run'}
OPEN = {'cartwheel', 'get_up', 'knockdown', 'backflip', 'front_flip'}
POSE = {   # degrees about the finger's own X axis (negative closes toward the palm): [seg1, seg2, seg3]
    'fist':    {'Index': (-88, -95, -50), 'Middle': (-90, -95, -50), 'Ring': (-90, -95, -50), 'Pinky': (-90, -95, -50), 'Thumb': (None, -25, -30)},
    'relaxed': {'Index': (-14, -22, -14), 'Middle': (-18, -26, -16), 'Ring': (-22, -30, -18), 'Pinky': (-26, -34, -20), 'Thumb': (None, -10, -10)},
    'open':    {'Index': (-4, -6, -4), 'Middle': (-4, -6, -4), 'Ring': (-4, -6, -4), 'Pinky': (-4, -6, -4), 'Thumb': (None, -4, -4)},
}
# the thumb's base swings across the curled fingers (solved so the tip rests on the index/middle middle joints);
# right-hand XYZ euler degrees, the left hand mirrors Y and Z
THUMB1 = {'fist': (-8, -8, -37), 'relaxed': (-3, -2, -10), 'open': (0, 0, 0)}


def quat(pose, side, f, i):
    if f == 'Thumb' and i == 1:
        x, y, z = THUMB1[pose]
        if side == 'Left': y, z = -y, -z
        return mu.Euler((math.radians(x), math.radians(y), math.radians(z)), 'XYZ').to_quaternion()
    return mu.Quaternion((1, 0, 0), math.radians(POSE[pose][f][i - 1]))


def bags(act):
    for L in act.layers:
        for st in L.strips:
            for cb in st.channelbags: yield cb


n_act = 0
for act in bpy.data.actions:
    pose = 'fist' if act.name in FIST else 'open' if act.name in OPEN else 'relaxed'
    f0, f1 = act.frame_range
    for cb in bags(act):
        for fc in list(cb.fcurves):
            if any(('Hand' + f) in fc.data_path for f in FING): cb.fcurves.remove(fc)
        for side in ('Left', 'Right'):
            for f in FING:
                for i in range(1, 4):
                    bn = P + side + 'Hand' + f + str(i)
                    if bn not in arm.pose.bones: continue
                    q = quat(pose, side, f, i)
                    for ci in range(4):
                        fc = cb.fcurves.new(f'pose.bones["{bn}"].rotation_quaternion', index=ci, group_name=bn)
                        fc.keyframe_points.add(2); fc.keyframe_points.foreach_set('co', [f0, q[ci], f1, q[ci]])
        n_act += 1
for pb in arm.pose.bones:
    if any(('Hand' + f) in pb.name for f in FING): pb.rotation_mode = 'QUATERNION'
print('handswap hand poses written to clips', n_act)
bpy.ops.wm.save_as_mainfile(filepath=dst)
