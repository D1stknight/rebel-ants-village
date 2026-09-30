# Put a separately generated head (image-to-3D of just the head crop) on a generator body.
# The body's own head / mask / antennae are removed above the collar; the new head is scaled to the old skull width,
# its skull top put at the old skull top, and joined. Faces above the chin get material HEAD_Gen (rigid on Head in
# headfix), the neck stub below gets NECK_Gen (bends with the Neck bone).
# usage: python3.13 attachhead.py -- body.glb head.glb out.glb
# env: SKULL_W (0.256) SKULL_TOP (1.83, from the feet) SKULL_CY (-0.045) NECK_CUT (1.545) HEAD_YAW (deg) HEAD_DZ
import bpy, bmesh, sys, os, math, numpy as np
from mathutils import Matrix, Vector
a = sys.argv[sys.argv.index('--') + 1:]; BODY, HEAD, DST = a
E = lambda k, d: float(os.environ.get(k, d))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=BODY)
body = [o for o in bpy.data.objects if o.type == 'MESH'][0]
for o in list(bpy.data.objects):
    if o.type == 'MESH' and o != body: bpy.data.objects.remove(o)
me = body.data
body.data.transform(body.matrix_world); body.matrix_world = Matrix.Identity(4)
V = np.array([v.co[:] for v in me.vertices]); z0 = V[:, 2].min(); Z = lambda z: z0 + z
CX, CY = 0.0, E('SKULL_CY', -0.045)
# ---- remove the old head, mask, antennae: everything above the neck cut near the axis, and anything above the collar top
cut = Z(E('NECK_CUT', 1.545))
kill = ((V[:, 2] > cut) & (np.hypot(V[:, 0] - CX, V[:, 1] - CY) < E('NECK_KILL_R', 0.11))) | (V[:, 2] > Z(E('COLLAR_TOP', 1.60)))
# part-built characters: armour pieces (ARMOR_* materials) are never cut, only the body's own head
armv = np.zeros(len(V), bool); ami = {i for i, m in enumerate(me.materials) if m and m.name.startswith('ARMOR_')}
for p in me.polygons:
    if p.material_index in ami: armv[list(p.vertices)] = True
kill &= ~armv
bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
bmesh.ops.delete(bm, geom=[bm.verts[i] for i in np.nonzero(kill)[0]], context='VERTS'); bm.to_mesh(me); bm.free()
print('body verts removed', int(kill.sum()))

# ---- import the head
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=HEAD)
hs = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
for o in bpy.data.objects: o.select_set(False)
for o in hs: o.select_set(True)
bpy.context.view_layer.objects.active = hs[0]
if len(hs) > 1: bpy.ops.object.join()
head = bpy.context.view_layer.objects.active
head.data.transform(head.matrix_world); head.parent = None; head.matrix_world = Matrix.Identity(4)
for o in list(bpy.data.objects):
    if o.type != 'MESH' and o.name not in ('Armature',): bpy.data.objects.remove(o)
if E('HEAD_YAW', 0): head.data.transform(Matrix.Rotation(math.radians(E('HEAD_YAW', 0)), 4, 'Z'))
H = np.array([v.co[:] for v in head.data.vertices])
# skull width: widest contiguous occupied x-run through the centre (antennae are thin and apart from the skull)
zmin, zmax = H[:, 2].min(), H[:, 2].max(); cx = np.median(H[:, 0])
best = (0, 0, 0)
for zf in np.linspace(0.25, 0.75, 21):
    zz = zmin + zf * (zmax - zmin); sl = H[np.abs(H[:, 2] - zz) < 0.01 * (zmax - zmin)]
    if len(sl) < 20: continue
    bins = np.linspace(H[:, 0].min(), H[:, 0].max(), 201); occ = np.histogram(sl[:, 0], bins)[0] > 0
    c = int(np.clip(np.searchsorted(bins, cx) - 1, 0, 199)); L = R = c
    while L > 0 and occ[L - 1]: L -= 1
    while R < 199 and occ[R + 1]: R += 1
    w = bins[R + 1] - bins[L]
    if w > best[0]: best = (w, zz, 0.5 * (bins[R + 1] + bins[L]))
w, zw, xc = best
# skull top: highest point within the skull x-run (antennae excluded)
inx = np.abs(H[:, 0] - xc) < 0.3 * w
top = H[inx, 2].max()
s = E('SKULL_W', 0.256) / w
# skull centre in y: mid of the y-extent at the widest level
sl = H[np.abs(H[:, 2] - zw) < 0.02 * (zmax - zmin)]; sl = sl[np.abs(sl[:, 0] - xc) < 0.45 * w]
yc = 0.5 * (sl[:, 1].min() + sl[:, 1].max())
print('head skull width', round(w, 4), 'scale', round(s, 4), 'top', round(top, 4), 'widest z', round(zw, 4))
T = Matrix.Translation((CX, CY, Z(E('SKULL_TOP', 1.83)) + E('HEAD_DZ', 0))) @ Matrix.Scale(s, 4) @ Matrix.Translation((-xc, -yc, -top))
head.data.transform(T)
H = np.array([v.co[:] for v in head.data.vertices])
# chin level: lowest skull point = where the x-run narrows below 55% of the skull width, going down from the widest level
zw2 = (zw - top) * s + Z(E('SKULL_TOP', 1.83))
chin = zw2
for zz in np.arange(zw2, H[:, 2].min(), -0.004):
    sl = H[np.abs(H[:, 2] - zz) < 0.003]
    sl = sl[np.abs(sl[:, 0] - CX) < 0.2]
    if len(sl) < 10: break
    if sl[:, 0].max() - sl[:, 0].min() < 0.55 * E('SKULL_W', 0.256): chin = zz; break
print('chin z (from feet)', round(chin - z0, 4), 'neck bottom', round(H[:, 2].min() - z0, 4))
# drop the head's neck stub below the collar kill line (hidden inside the collar anyway)
hb = bmesh.new(); hb.from_mesh(head.data); hb.verts.ensure_lookup_table()
band = np.array([v.co[:] for v in hb.verts if chin - 0.035 < v.co.z < chin - 0.01])
nax = np.median(band[:, :2], 0) if len(band) > 20 else np.array([CX, CY])
NRK = E('NECK_R', 0.062)
print('neck axis', nax.round(3))
low = [v for v in hb.verts if v.co.z < cut - E('NECK_KEEP', 0.03) or (v.co.z < chin - 0.005 and math.hypot(v.co.x - nax[0], v.co.y - nax[1]) > NRK)]
bmesh.ops.delete(hb, geom=low, context='VERTS'); hb.to_mesh(head.data); hb.free()
# materials: HEAD_Gen above the chin, NECK_Gen below
src = head.data.materials[0]
mh = src.copy(); mh.name = 'HEAD_Gen'; mn = src.copy(); mn.name = 'NECK_Gen'
for m in (mh, mn):
    b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if b is None: continue
    for l in list(b.inputs['Metallic'].links): m.node_tree.links.remove(l)
    b.inputs['Metallic'].default_value = E('HEAD_METAL', 0.0)
head.data.materials.clear(); head.data.materials.append(mh); head.data.materials.append(mn)
for p in head.data.polygons:
    p.material_index = 1 if p.center.z < chin + 0.01 else 0
for o in bpy.data.objects: o.select_set(False)
head.select_set(True); body.select_set(True); bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
bpy.ops.export_scene.gltf(filepath=DST, export_format='GLB', export_image_format='AUTO')
print('wrote', DST)
