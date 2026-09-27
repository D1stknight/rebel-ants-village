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
    col = np.array([0.05, 0.05, 0.06])
    if IMG is not None and uvl is not None:
        idx = set(np.nonzero(own)[0].tolist()); samp = []
        for p in me.polygons:
            for li in p.loop_indices:
                if me.loops[li].vertex_index in idx:
                    u, v = uvl.data[li].uv; hh, ww = IMG.shape[:2]
                    samp.append(IMG[int(np.clip(v, 0, 0.9999) * hh), int(np.clip(u, 0, 0.9999) * ww)])
        if samp: col = np.median(np.array(samp), 0)
    cut |= rm
    plan[side] = dict(W=W, x=x, y=y, z=z, L=L, girth=girth, col=col, mirror=(side == 'Left'))
    print(f'handswap {side}: hand length {L:.3f} (reach {reach:.3f}, forearm {fore:.3f}) wrist girth {girth:.3f} '
          f'verts removed {int(rm.sum())} glove colour {np.round(col, 3).tolist()}')

# ---- remove the generated hands ----
bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
bmesh.ops.delete(bm, geom=[bm.verts[i] for i in np.nonzero(cut)[0]], context='VERTS')
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
            if rad > 1e-6: p[1:] *= (1 - k) + k * (tgt / rad)
        nvv = bm.verts.new(Bi @ mu.Vector(pl['world'](p).tolist())); vmap[v.index] = nvv
    bm.verts.index_update()
    for f in gb.faces:
        try: nf = bm.faces.new([vmap[v.index] for v in f.verts]); nf.material_index = gmi; nf.smooth = True
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
