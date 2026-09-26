# Source prep (run by hand, before rigging): replace a generator's fused head+mask with a clean ant head — a smooth tan
# oval skull, a neck tube, rebuilt antennae, and the mask as its own curved plate on the face, textured straight from
# the concept art (big lens eyes, crack, holes). Head parts use HEAD_* materials; headfix binds them rigidly to Head.
# usage: MASK_CHIN=-0.015 python3.13 newhead.py -- in.glb ref.png maskseg.npz out.glb
#   maskseg.npz: {m: mask pixels, dome: head+mask pixels, X0, Y0: crop origin} segmented from the front concept art
import bpy, bmesh, sys, os, math, numpy as np
from PIL import Image
a = sys.argv[sys.argv.index('--') + 1:]; SRC, REF, SEG, DST = a
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
body = [o for o in bpy.data.objects if o.type == 'MESH'][0]
bpy.context.view_layer.objects.active = body
me = body.data
V = np.array([(body.matrix_world @ v.co)[:] for v in me.vertices]); z0 = V[:, 2].min()
Z = lambda z: z0 + z                                        # heights below are measured from the feet

# ---------- head geometry (measured on #4998: skull x ±0.128, y -0.17..0.08, z 1.57..1.83) ----------
RX, RY, RZ = float(os.environ.get('HEAD_RX', 0.125)), float(os.environ.get('HEAD_RY', 0.125)), float(os.environ.get('HEAD_RZ', 0.135))
CY, CZ = float(os.environ.get('HEAD_CY', -0.045)), Z(float(os.environ.get('HEAD_CZ', 1.70)))
CX = 0.0

# ---------- classify body verts by texture colour ----------
img = None
for m in me.materials:
    for n in m.node_tree.nodes:
        if n.type == 'TEX_IMAGE' and any(l.to_socket.name == 'Base Color' for l in n.outputs[0].links): img = n.image
w_, h_ = img.size
px = np.empty(w_ * h_ * 4, np.float32); img.pixels.foreach_get(px); px = px.reshape(h_, w_, 4)
uv = np.empty(len(me.loops) * 2, np.float32); me.uv_layers.active.data.foreach_get('uv', uv); uv = uv.reshape(-1, 2)
lv = np.empty(len(me.loops), np.int64); me.loops.foreach_get('vertex_index', lv)
xi = np.clip((uv[:, 0] % 1) * w_, 0, w_ - 1).astype(int); yi = np.clip((uv[:, 1] % 1) * h_, 0, h_ - 1).astype(int)
col = np.zeros((len(V), 3)); cnt = np.zeros(len(V)); np.add.at(col, lv, px[yi, xi, :3]); np.add.at(cnt, lv, 1); col /= np.maximum(cnt, 1)[:, None]
r, g, b = col.T; sat = col.max(1) - col.min(1); val = col.max(1)
greyv = (sat < 0.09) & (val > 0.18)                          # the grey mask plate + white lenses
tanv = (r > g * 1.1) & (r > b * 1.35) & (val > 0.2)          # skin / head / antennae
e = ((V[:, 0] - CX) / (RX + 0.03)) ** 2 + ((V[:, 1] - CY) / (RY + 0.035)) ** 2 + ((V[:, 2] - CZ) / (RZ + 0.03)) ** 2
inhead = e < 1.0
antenna = (~inhead) & (V[:, 2] > CZ + 0.03)                  # nothing else is up there: old antennae (rebuilt below)
NR = float(os.environ.get('NECK_R', 0.05))
neckzone = (V[:, 2] > Z(float(os.environ.get('NECK_CUT', 1.545)))) & (np.hypot(V[:, 0] - CX, V[:, 1] - CY) < 0.10)
kill = neckzone | (V[:, 2] > CZ - RZ + 0.045) | (inhead & (V[:, 2] > CZ - RZ + 0.02))   # nothing of the old mesh survives above the neck (old mask, jaw, antennae)
bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
bmesh.ops.delete(bm, geom=[bm.verts[i] for i in np.nonzero(kill)[0]], context='VERTS'); bm.to_mesh(me); bm.free()
print('removed old head verts', int(kill.sum()), 'kept antenna verts', int(antenna.sum()))

# ---------- materials ----------
refim = Image.open(REF).convert('RGB'); R = np.asarray(refim).astype(np.float32) / 255
S = np.load(SEG); msk, X0, Y0 = S['m'], int(S['X0']), int(S['Y0'])
from scipy import ndimage as ndi
msk = ndi.gaussian_filter(msk.astype(float), 2.0) > 0.5          # smooth outline
H_, W_ = msk.shape
dome = S['dome']
tanpx = R[Y0:Y0 + H_, X0:X0 + W_][dome & ~msk]
tanpx = tanpx[(tanpx[:, 0] - tanpx[:, 2]) > 0.15]
tan = np.median(tanpx, 0); print('tan colour', (tan * 255).round())
def srgb2lin(c): return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
mt = bpy.data.materials.new('HEAD_Skin'); mt.use_nodes = True; bs = mt.node_tree.nodes['Principled BSDF']
bs.inputs['Base Color'].default_value = tuple(srgb2lin(tan)) + (1,); bs.inputs['Roughness'].default_value = 0.42
# mask texture: the art crop, with outside-the-mask pixels filled by the mask grey so edges don't bleed background
crop = R[Y0:Y0 + H_, X0:X0 + W_].copy()
grey = np.median(crop[msk & ((crop.max(2) - crop.min(2)) < 0.06) & (crop.max(2) < 0.8)], 0)
from scipy import ndimage as ndi
far = ~ndi.binary_dilation(msk, iterations=3); crop[far] = grey
Image.fromarray((crop * 255).astype(np.uint8)).resize((W_ * 2, H_ * 2), Image.LANCZOS).save('/tmp/claude-0/mask_tex.png')
mimg = bpy.data.images.load('/tmp/claude-0/mask_tex.png')
mm = bpy.data.materials.new('HEAD_Mask'); mm.use_nodes = True; nt = mm.node_tree; bs2 = nt.nodes['Principled BSDF']
tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = mimg; nt.links.new(tx.outputs['Color'], bs2.inputs['Base Color'])
bs2.inputs['Roughness'].default_value = 0.55

# ---------- new head: smooth oval ----------
bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=40, radius=1, location=(CX, CY, CZ))
head = bpy.context.active_object; head.scale = (RX, RY, RZ); bpy.ops.object.transform_apply(scale=True)
bpy.ops.object.shade_smooth(); head.data.materials.append(mt)

# ---------- new neck: a tan tube from inside the collar up into the skull (bends with the Neck bone) ----------
mn = bpy.data.materials.new('NECK_Skin'); mn.use_nodes = True; bn = mn.node_tree.nodes['Principled BSDF']
bn.inputs['Base Color'].default_value = tuple(srgb2lin(tan * 0.92)) + (1,); bn.inputs['Roughness'].default_value = 0.5
z_lo, z_hi = Z(float(os.environ.get('NECK_LO', 1.47))), CZ - 0.55 * RZ
bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=NR, depth=z_hi - z_lo, location=(CX, CY + 0.012, 0.5 * (z_lo + z_hi)), end_fill_type='NOTHING')
neck = bpy.context.active_object
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.subdivide(number_cuts=8); bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.shade_smooth(); neck.data.materials.append(mn)

# ---------- mask plate from the art (pixel grid -> curved plate hugging the head) ----------
# image -> model: the mask's outer width (the strap-to-strap span) maps to the head width
ys, xs = np.nonzero(msk)
cols = [xs[ys == y] for y in range(H_)]
wid = max((c.max() - c.min()) for c in cols if len(c))
sc = (2 * RX * 1.02) / wid
cxp = 0.5 * (xs.min() + xs.max())
topp = S['dome'].nonzero()[0].min()                         # top of the tan dome in the crop
OFF = 0.006
def to_model(pxx, pyy):
    x = (pxx - cxp) * sc
    z = (CZ + RZ) - (pyy - topp) * sc
    zc = np.maximum(z, CZ - 0.8 * (RZ + OFF))               # below the skull the plate falls straight (the chin)
    arg = 1 - (x / (RX + OFF)) ** 2 - ((zc - CZ) / (RZ + OFF)) ** 2
    y = CY - (RY + OFF) * np.sqrt(np.clip(arg, 0.0, 1))
    return x, y, z
STEP = 2
gy, gx = np.mgrid[0:H_:STEP, 0:W_:STEP]
inside = msk[gy, gx]
_, _, gz = to_model(gx.astype(float), gy.astype(float))
inside &= gz > CZ - RZ - float(os.environ.get('MASK_CHIN', 0.012))   # chin stops just under the skull (no grey rim seen from behind)
idmap = -np.ones(gy.shape, int); idx = np.nonzero(inside); idmap[idx] = np.arange(len(idx[0]))
mx, my, mz = to_model(gx[idx].astype(float), gy[idx].astype(float))
verts = np.c_[mx, my, mz]
faces = []
for i in range(gy.shape[0] - 1):
    for j in range(gy.shape[1] - 1):
        q = [idmap[i, j], idmap[i, j + 1], idmap[i + 1, j + 1], idmap[i + 1, j]]
        if min(q) >= 0: faces.append(q)
pm = bpy.data.meshes.new('mask'); pm.from_pydata(verts.tolist(), [], faces); pm.update()
uvl = pm.uv_layers.new(name='UVMap')
u = gx[idx] / (W_ - 1); v = 1 - gy[idx] / (H_ - 1)
for poly in pm.polygons:
    for li in poly.loop_indices:
        vi = pm.loops[li].vertex_index; uvl.data[li].uv = (u[vi], v[vi])
plate = bpy.data.objects.new('mask', pm); bpy.context.collection.objects.link(plate); pm.materials.append(mm)
# faces must point forward (-Y)
bm = bmesh.new(); bm.from_mesh(pm); bm.normal_update()
if np.mean([f.normal.y for f in bm.faces]) > 0: bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
bm.to_mesh(pm); bm.free()
sol = plate.modifiers.new('sol', 'SOLIDIFY'); sol.thickness = 0.004; sol.offset = -1
bpy.context.view_layer.objects.active = plate; bpy.ops.object.modifier_apply(modifier='sol')
bpy.ops.object.shade_smooth()
print('mask plate verts', len(pm.vertices), 'scale m/px', round(sc, 5))

# ---------- antennae: rebuilt so they grow out of the new head (copper tubes, elbow joint, ball tip) ----------
ma = bpy.data.materials.new('HEAD_Antenna'); ma.use_nodes = True; ba = ma.node_tree.nodes['Principled BSDF']
ba.inputs['Base Color'].default_value = tuple(srgb2lin(tan * np.array([0.93, 0.82, 0.78]))) + (1,); ba.inputs['Roughness'].default_value = 0.38
parts = []
def surf(dx, dy, dz):
    d = np.array([dx / RX, dy / RY, dz / RZ]); d /= np.linalg.norm(d)
    return np.array([CX + RX * d[0], CY + RY * d[1], CZ + RZ * d[2]])
for sgn in (-1, 1):
    p0 = surf(sgn * 0.36, -0.22, 0.90) - np.array([0, 0, 0.004])
    p1 = p0 + np.array([sgn * 0.075, -0.015, 0.115])        # up and out
    p2 = p1 + np.array([sgn * 0.085, -0.01, -0.03])         # elbow, then out and a little down
    cu = bpy.data.curves.new('ant', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 0.0085; cu.bevel_resolution = 4; cu.use_fill_caps = True
    sp = cu.splines.new('POLY'); sp.points.add(2)
    for i, p in enumerate((p0, p1, p2)): sp.points[i].co = (*p, 1)
    ob = bpy.data.objects.new('ant', cu); bpy.context.collection.objects.link(ob); parts.append(ob)
    for c, rr in ((p0, 0.017), (p1, 0.0115), (p2 + (p2 - p1) / np.linalg.norm(p2 - p1) * 0.012, 0.021)):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=rr, location=tuple(c)); parts.append(bpy.context.active_object)
for ob in parts:
    for o in bpy.data.objects: o.select_set(False)
    ob.select_set(True); bpy.context.view_layer.objects.active = ob
    if ob.type == 'CURVE': bpy.ops.object.convert(target='MESH')
    bpy.ops.object.shade_smooth(); ob.data.materials.clear(); ob.data.materials.append(ma)

# ---------- join ----------
for o in bpy.data.objects: o.select_set(False)
for o in [body, head, plate, neck] + [p for p in parts if p.name in bpy.data.objects]: o.select_set(True)
bpy.context.view_layer.objects.active = body; bpy.ops.object.join()
bpy.ops.export_scene.gltf(filepath=DST, export_format='GLB', export_image_format='AUTO')
print('wrote', DST)
