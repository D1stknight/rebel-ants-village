# Part-by-part character, v2: armour groups placed by 2D anchors.
# Each armour group's footprint in the armour-only reference (A) is mapped to where that piece sits in the original
# production reference (O, armour worn on the body) with a per-piece 2D anchor (centre in A, centre in O, x/z scale).
# A-px <-> armour 3D comes from the armour model's normalisation; O-px <-> body 3D from the body model (same framing
# as O). Depth: each piece is centred on the body's cross-section at its height, then pushed out until it no longer
# cuts into the cloth.
# usage (worker: job.sh with FORGE_ARMOR_URL + FORGE_ANCHORS_URL): python3.13 armorfit.py -- body.glb armor.glb anchors.json out.glb
import bpy, sys, os, json, numpy as np
from mathutils import Matrix
from scipy.spatial import cKDTree
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
a = sys.argv[sys.argv.index('--') + 1:]; BODY, ARMOR, ANCH, DST = a
AN = json.load(open(ANCH))


def load(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    ms = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
    for o in bpy.data.objects: o.select_set(False)
    for o in ms: o.select_set(True)
    bpy.context.view_layer.objects.active = ms[0]
    if len(ms) > 1: bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.data.transform(o.matrix_world); o.parent = None; o.matrix_world = Matrix.Identity(4)
    return o


bpy.ops.wm.read_factory_settings(use_empty=True)
body = load(BODY); armor = load(ARMOR)
for o in list(bpy.data.objects):
    if o.type != 'MESH': bpy.data.objects.remove(o)
VB = np.array([v.co[:] for v in body.data.vertices]); NB = np.array([v.normal[:] for v in body.data.vertices])
VA = np.array([v.co[:] for v in armor.data.vertices])
tb = cKDTree(VB)
# pixel frames
A_img, O_img = AN['A_bbox'], AN['O_bbox']            # [x0, x1, y0, y1] of the whole figure / whole armour set
ka = (VA[:, 2].max() - VA[:, 2].min()) / (A_img[3] - A_img[2]); acx = 0.5 * (A_img[0] + A_img[1]); az1 = VA[:, 2].max()
kb = (VB[:, 2].max() - VB[:, 2].min()) / (O_img[3] - O_img[2]); ocx = 0.5 * (O_img[0] + O_img[1]); bz1 = VB[:, 2].max()
A2px = lambda P: np.stack([acx + P[:, 0] / ka, A_img[2] + (az1 - P[:, 2]) / ka], 1)
px2B = lambda q: np.array([(q[0] - ocx) * kb, (bz1 - (q[1] - O_img[2]) * kb)])

# groups
EA = np.array([e.vertices[:] for e in armor.data.edges])
n, lab = connected_components(coo_matrix((np.ones(len(EA)), (EA[:, 0], EA[:, 1])), shape=(len(VA),) * 2), directed=False)
pr = cKDTree(VA).query_pairs(0.02, output_type='ndarray'); pr = pr[lab[pr[:, 0]] != lab[pr[:, 1]]]
_, cl = connected_components(coo_matrix((np.ones(len(pr)), (lab[pr[:, 0]], lab[pr[:, 1]])), shape=(n, n)), directed=False)
grp = cl[lab]; cnt = np.bincount(grp); big = [g for g in np.argsort(-cnt) if cnt[g] > 300]
newV = VA.copy(); roles = {}
for g in big:
    m = grp == g; P = VA[m]; pc = A2px(P).mean(0)
    an = min(AN['anchors'], key=lambda q: np.hypot(*(np.array(q.get('pick', q['A'])) - pc)))
    sx, sz = an['sx'], an['sz']
    # armour 3D -> body 3D: about the anchor point
    Ac = np.array(an['A'], float); Oc = np.array(an['O'], float)
    Pa = np.array([(Ac[0] - acx) * ka, 0, az1 - (Ac[1] - A_img[2]) * ka])      # anchor in armour 3D (y: group centre)
    Pa[1] = 0.5 * (P[:, 1].min() + P[:, 1].max())
    tx, tz = px2B(Oc)
    fx, fz = sx * kb / ka, sz * kb / ka; fy = fx
    Q = (P - Pa) * np.array([fx, fy, fz])
    # depth centre: body cross-section at this height and x
    zc = tz + Q[:, 2].mean(); xc = tx + Q[:, 0].mean()
    near = VB[(np.abs(VB[:, 2] - zc) < 0.05) & (np.abs(VB[:, 0] - xc) < 0.5 * (Q[:, 0].max() - Q[:, 0].min()) + 0.03)]
    yc = 0.5 * (near[:, 1].min() + near[:, 1].max()) if len(near) > 20 else 0.0
    Q += np.array([tx, yc, tz])
    # push out (xy about the piece's own centre line) until it no longer cuts into the cloth
    cx_, cy_ = Q[:, 0].mean(), yc
    for it in range(int(AN.get('max_push', 12))):
        dd, ii = tb.query(Q, k=1)
        inside = (((Q - VB[ii]) * NB[ii]).sum(1) < -AN.get('pen', 0.008)) & (dd < 0.06)
        frac = inside.mean()
        if frac < AN.get('inside_ok', 0.03): break
        Q[:, 0] = cx_ + (Q[:, 0] - cx_) * 1.015; Q[:, 1] = cy_ + (Q[:, 1] - cy_) * 1.015
    print(f"group {g} ({cnt[g]}) -> {an['name']}: scale {fx:.3f}/{fz:.3f} inside {frac:.3f} pushes {it}")
    newV[m] = Q
    roles[g] = an['name'].split()[0] + ('' if an['name'].startswith('torso') else ('_Left' if Q[:, 0].mean() > 0 else '_Right'))
keep = np.isin(grp, big)
for i, v in enumerate(armor.data.vertices): v.co = newV[i]
# one material per armour piece (same textures): ARMOR_<role> tells the rigger which bone the piece rides on
fpoly = np.array([p.vertices[0] for p in armor.data.polygons])
src = armor.data.materials[0]; mats = {}; src.name = 'ARMOR_misc'
for g, r in roles.items():
    if r in mats: continue
    mm = src.copy(); mm.name = 'ARMOR_' + r; armor.data.materials.append(mm); mats[r] = len(armor.data.materials) - 1
for p in armor.data.polygons:
    g = grp[p.vertices[0]]
    if g in roles: p.material_index = mats[roles[g]]
import bmesh
bm = bmesh.new(); bm.from_mesh(armor.data); bm.verts.ensure_lookup_table()
bmesh.ops.delete(bm, geom=[bm.verts[i] for i in np.nonzero(~keep)[0]], context='VERTS'); bm.to_mesh(armor.data); bm.free()
for o in bpy.data.objects: o.select_set(False)
armor.select_set(True); body.select_set(True); bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
bpy.ops.export_scene.gltf(filepath=DST, export_format='GLB', export_image_format='AUTO')
print('wrote', DST)
