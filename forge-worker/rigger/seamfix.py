# v1.9d hand/thigh seam cut. When the sculpt keeps the reference pose (arms hanging at the sides), the generator fuses
# the fingertips into the robe / thigh: one mesh, joined by a row of tiny faces. Bone heat correctly gives the hand side
# Hand weights and the thigh side UpLeg weights, so as soon as the arm lifts those joining faces stretch into long
# "sticks" from the hand to the hip. Faces that join a hand/forearm-driven vertex to a leg/hips-driven vertex are cut
# (a few faces at the contact point, invisible in play), so the hand comes away clean.
# usage: python3.13 seamfix.py -- in.blend out.blend
import bpy, bmesh, sys, os, numpy as np
a = sys.argv[sys.argv.index('--') + 1:]; src, dst = a
TH = float(os.environ.get('FORGE_SEAM_TH', '0.5'))
bpy.ops.wm.open_mainfile(filepath=src)
me = [o for o in bpy.data.objects if o.type == 'MESH'][0]; P = 'mixamorig_'
names = [g.name[len(P):] if g.name.startswith(P) else g.name for g in me.vertex_groups]
isarm = [('Hand' in n or 'ForeArm' in n) for n in names]
isleg = [(n.endswith('UpLeg') or n.endswith('Leg') or 'Foot' in n or 'Toe' in n or n == 'Hips') for n in names]
bm = bmesh.new(); bm.from_mesh(me.data)
# the generator mesh is split along UV seams; weld those (loop UVs are kept) so the openings we make are closed loops
nv0 = len(bm.verts); bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6); print('seamfix welded', nv0 - len(bm.verts))
dl = bm.verts.layers.deform.active
H, Lg = {}, {}
for v in bm.verts:
    d = v[dl] if dl is not None else {}; t = sum(d.values()) or 1e-9
    H[v] = sum(w for k, w in d.items() if k < len(isarm) and isarm[k]) / t
    Lg[v] = sum(w for k, w in d.items() if k < len(isleg) and isleg[k]) / t
handv = lambda v: H.get(v, 0) > TH; legv = lambda v: Lg.get(v, 0) > TH
cut = [f for f in bm.faces if any(handv(v) for v in f.verts) and any(legv(v) for v in f.verts)]
if cut:
    ring = {e for f in cut for e in f.edges}                     # edges around the cut faces (verts / edges are kept)
    bmesh.ops.delete(bm, geom=cut, context='FACES_ONLY')
    # close the small openings left on the hand and on the thigh (the fist should not show a hole): the generator mesh is
    # split along UV seams, so the openings are not closed loops; fan-fill each chain of new boundary edges from its
    # centre, with the neighbouring face's material, UVs and bone weights.
    edge = [e for e in ring if e.is_valid and e.is_boundary]
    uvl = bm.loops.layers.uv.active
    seen, filled, NEW = set(), 0, []
    for e0 in edge:
        if e0 in seen: continue
        comp, stack = [], [e0]; seen.add(e0)
        while stack:
            e = stack.pop(); comp.append(e)
            for v in e.verts:
                for e2 in v.link_edges:
                    if e2 in ring and e2 not in seen and e2.is_valid and e2.is_boundary: seen.add(e2); stack.append(e2)
        vs = list({v for e in comp for v in e.verts})
        c = sum((v.co for v in vs), vs[0].co * 0) / len(vs)
        nv = bm.verts.new(c)
        if dl is not None:
            src = max(vs, key=lambda v: max(H.get(v, 0), Lg.get(v, 0)))
            for k, w in src[dl].items(): nv[dl][k] = w
        uvs = []
        for e in comp:
            l = e.link_loops[0]; f0 = l.face; a0, b0 = l.link_loop_next.vert, l.vert
            try: f = bm.faces.new((a0, b0, nv))
            except ValueError: continue
            f.material_index = f0.material_index; f.smooth = f0.smooth
            if uvl is not None:
                ua, ub = l.link_loop_next[uvl].uv.copy(), l[uvl].uv.copy(); uvs += [ua, ub]
                f.loops[0][uvl].uv = ua; f.loops[1][uvl].uv = ub
            filled += 1; NEW.append(f)
        if uvl is not None and uvs:
            # per patch face: the centre takes the UV of that face's own edge (averaging across UV islands can land on
            # an unrelated, dark part of the texture atlas)
            for f in nv.link_faces:
                own = [lp[uvl].uv for lp in f.loops if lp.vert is not nv]
                for lp in f.loops:
                    if lp.vert is nv and own: lp[uvl].uv = (own[0] + own[-1]) / 2
    # orient the patches like the surface around them (a flipped patch renders as a dark hole)
    if NEW:
        near = {g for f in NEW for e in f.edges for g in e.link_faces}
        bmesh.ops.recalc_face_normals(bm, faces=list(near))
    print('seamfix openings closed with faces', filled)
    loose = [e for e in ring if e.is_valid and not e.link_faces]
    if loose: bmesh.ops.delete(bm, geom=loose, context='EDGES')
    bm.to_mesh(me.data); me.data.update()
bm.free()
print('seamfix hand/leg joining faces cut', len(cut))
bpy.ops.wm.save_as_mainfile(filepath=dst)
