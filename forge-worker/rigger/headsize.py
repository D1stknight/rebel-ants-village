# v2.9 head size. #262 is the standard Rebel. Plain and hair heads whose skull came out clearly bigger than #262's are
# brought back part of the way; Rebels with a helmet, hood, space helmet or full mask are never touched (the Forge only
# sets FORGE_HEAD_AUTO=1 for plain / hair heads). FORGE_HEAD_SCALE (admin) sets the scale directly for one Rebel.
# The head shrinks toward the ring where it meets the neck, so the neck and collar do not change.
# usage: python3.13 headsize.py -- in.blend out.blend
import bpy, sys, os, numpy as np
from mathutils import Vector
a = sys.argv[sys.argv.index('--') + 1:]; src, dst = a
bpy.ops.wm.open_mainfile(filepath=src)
arm = bpy.data.objects['Armature']; me = [o for o in bpy.data.objects if o.type == 'MESH'][0]; P = 'mixamorig_'
Aw = arm.matrix_world; Mw = np.array(me.matrix_world)
co = np.array([v.co[:] for v in me.data.vertices]) @ Mw[:3, :3].T + Mw[:3, 3]
sub = {P + 'Head', P + 'HeadTop_End'}
gi = {g.index for g in me.vertex_groups if g.name in sub}
w = np.zeros(len(co)); tot = np.zeros(len(co))
for v in me.data.vertices:
    for g in v.groups:
        tot[v.index] += g.weight
        if g.group in gi: w[v.index] += g.weight
w = w / np.maximum(tot, 1e-9)
z0 = co[:, 2].min(); Hn = np.array((Aw @ arm.data.bones[P + 'Head'].head_local)[:])
hd = co[w > 0.7]
size = None
if len(hd) > 100:
    ext = [np.percentile(hd[:, i], 97) - np.percentile(hd[:, i], 3) for i in range(3)]
    size = float(np.prod(ext) ** (1 / 3) / max(1e-6, Hn[2] - z0))     # skull size per body height below the head
REF = float(os.environ.get('FORGE_HEAD_REF', '0.264'))   # #262 at this stage (bench: #4 0.263, #1555 0.248, #469 0.238, #4998 0.224)
s = 1.0
if os.environ.get('FORGE_HEAD_SCALE'):
    s = float(np.clip(float(os.environ['FORGE_HEAD_SCALE']), 0.8, 1.1)); why = 'set by admin'
elif os.environ.get('FORGE_HEAD_AUTO') == '1' and size:
    if size > 1.15 * REF: s = float(np.clip(1.08 * REF / size, 0.85, 1.0)); why = 'plain / hair head %.0f%% over #262' % (100 * (size / REF - 1))
    else: why = 'within the standard'
else: why = 'not checked (head gear or no traits)'
print('headsize: size %s ref %.3f -> scale %.3f (%s)' % ('%.3f' % size if size else '?', REF, s, why))
if abs(s - 1) > 1e-3:
    ring = co[(w > 0.35) & (w < 0.65)]
    piv = ring.mean(0) if len(ring) > 20 else Hn
    k = (1 - (1 - s) * np.clip(w, 0, 1))[:, None]
    new = piv + (co - piv) * k
    Mi = np.linalg.inv(Mw); loc = new @ Mi[:3, :3].T + Mi[:3, 3]
    me.data.vertices.foreach_set('co', loc.ravel().astype(np.float32)); me.data.update()
    bpy.context.view_layer.objects.active = arm; arm.select_set(True); bpy.ops.object.mode_set(mode='EDIT')
    Ai = Aw.inverted(); pv = Vector(piv.tolist())
    for n in sub:
        eb = arm.data.edit_bones.get(n)
        if eb is None: continue
        hw = Aw @ eb.head; tw = Aw @ eb.tail
        f = s if n != P + 'Head' else 1 - (1 - s) * 0.5
        eb.head = Ai @ (pv + (hw - pv) * f); eb.tail = Ai @ (pv + (tw - pv) * s)
    bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.wm.save_as_mainfile(filepath=dst)
