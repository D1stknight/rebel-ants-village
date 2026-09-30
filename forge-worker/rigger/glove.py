# Forge Rigger v2.0 standard glove: a clean 5-finger cartoon glove built every run from primitives + voxel remesh (no binary asset).
# Canonical RIGHT hand, hand length 1: wrist joint at the origin, +X toward the fingertips, +Z the back of the hand,
# +Y the thumb side. The left hand is the mirror (y -> -y). Returns the mesh, the finger joints (for the bones) and
# per-vertex bone weights (capsule distance to each bone segment, blended over the two nearest).
import bpy, bmesh, numpy as np, mathutils as mu

FINGERS = {   # knuckle, direction, segment lengths, radius
    'Index':  ((0.47, 0.158, 0.030), (1.0, 0.16, -0.03), (0.17, 0.11, 0.09), 0.056),
    'Middle': ((0.49, 0.053, 0.034), (1.0, 0.04, -0.03), (0.185, 0.12, 0.10), 0.058),
    'Ring':   ((0.47, -0.052, 0.030), (1.0, -0.09, -0.03), (0.17, 0.11, 0.09), 0.055),
    'Pinky':  ((0.43, -0.152, 0.022), (1.0, -0.24, -0.03), (0.13, 0.09, 0.08), 0.049),
    'Thumb':  ((0.15, 0.150, -0.030), (0.85, 0.48, -0.40), (0.125, 0.10, 0.085), 0.064),
}
PALM = [((0.25, 0.0, 0.0), (0.27, 0.215, 0.115)), ((0.42, 0.0, 0.018), (0.10, 0.215, 0.095))]
CUFF = ((-0.10, 0.0, 0.0), (0.17, 0.17, 0.13))    # the glove's wrist, reaches back into the sleeve


def joints():
    J = {}
    for f, (k, d, ls, r) in FINGERS.items():
        d = np.array(d, float); d /= np.linalg.norm(d); p = [np.array(k, float)]
        # fingers arc slightly toward the palm, like a relaxed real hand at rest
        for i, l in enumerate(ls):
            bend = np.array([0, 0, -0.10 * i]) if f != 'Thumb' else np.zeros(3)
            dd = d + bend; dd /= np.linalg.norm(dd); p.append(p[-1] + dd * l)
        J[f] = (p, r)
    return J


def _ellipsoid(bm, c, r):
    g = bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=16, radius=1.0)
    for v in g['verts']: v.co = mu.Vector((c[0] + v.co.x * r[0], c[1] + v.co.y * r[1], c[2] + v.co.z * r[2]))


def _capsule(bm, a, b, r, sy=1.0):
    a, b = np.array(a, float), np.array(b, float); v = b - a; L = np.linalg.norm(v)
    q = mu.Vector((0, 0, 1)).rotation_difference(mu.Vector(tuple(v / L)))
    g = bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=12, radius=r)
    for w in g['verts']:
        z = w.co.z; w.co.z = z + (L if z > 0 else 0)            # stretch the sphere into a capsule from a to b
        w.co.x *= sy
        w.co = mu.Vector(tuple(a)) + q @ w.co


def build(voxel=0.011):
    bm = bmesh.new()
    for c, s in PALM: _ellipsoid(bm, c, s)
    cc, cr = CUFF      # the cuff: an oval tube reaching back into the sleeve
    _capsule(bm, (cc[0] - cr[0], 0, 0), (cc[0] + cr[0] * 0.5, 0, 0), cr[2], sy=cr[1] / cr[2])
    J = joints()
    for f, (p, r) in J.items():
        for i in range(3): _capsule(bm, p[i], p[i + 1], r * (1 - 0.08 * i))
    me = bpy.data.meshes.new('glove'); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new('glove', me); bpy.context.scene.collection.objects.link(ob)
    m = ob.modifiers.new('R', 'REMESH'); m.mode = 'VOXEL'; m.voxel_size = voxel; m.use_smooth_shade = True
    s = ob.modifiers.new('S', 'LAPLACIANSMOOTH'); s.iterations = 6; s.lambda_factor = 0.6; s.use_volume_preserve = True
    dg = bpy.context.evaluated_depsgraph_get(); out = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob); bpy.data.meshes.remove(me)
    bm = bmesh.new(); bm.from_mesh(out)
    back = [v for v in bm.verts if v.co.x < cc[0] - cr[0] + 0.03]     # open the cuff at the back (it tucks into the sleeve)
    bmesh.ops.delete(bm, geom=back, context='VERTS')
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(out); bm.free()
    for p in out.polygons: p.use_smooth = True
    return out, J


def seg_dist(P, a, b):
    ab = b - a; t = np.clip(((P - a) @ ab) / max(1e-12, ab @ ab), 0, 1); return np.linalg.norm(P - (a + np.outer(t, ab)), axis=1)


def weights(me, J):
    """bone name suffix (Hand, Index1..3, Thumb1..3, ...) -> weight array"""
    P = np.array([v.co[:] for v in me.vertices])
    segs = [('Hand', np.zeros(3), np.array([0.5, 0.0, 0.0]))]
    for f, (p, r) in J.items():
        for i in range(3): segs.append((f'{f}{i + 1}', np.array(p[i]), np.array(p[i + 1])))
    D = np.stack([seg_dist(P, a, b) for _, a, b in segs], 1)
    D[:, 0] *= 0.55                                   # the palm body belongs to the Hand unless clearly inside a finger
    order = np.argsort(D, 1)[:, :2]; d0 = np.take_along_axis(D, order[:, :1], 1)[:, 0]; d1 = np.take_along_axis(D, order[:, 1:], 1)[:, 0]
    w0 = 1 / (d0 ** 4 + 1e-12); w1 = 1 / (d1 ** 4 + 1e-12); s = w0 + w1; w0 /= s; w1 /= s
    W = {n: np.zeros(len(P)) for n, _, _ in segs}
    names = [n for n, _, _ in segs]
    for i in range(len(P)):
        W[names[order[i, 0]]][i] += w0[i]; W[names[order[i, 1]]][i] += w1[i]
    return W
