# v1.6 shoulder pads: armour on top of the upper arm (pauldrons) follows the shoulder more than the arm, so it does
# not swing into the back plate / chest when the arms move from the reference pose. Moves a share of the upper-arm
# weight to the Shoulder bone for verts above the armpit, fading out down the arm.
# usage: python3.13 padfix.py -- in.blend out.blend
import bpy, sys, os, numpy as np
a = sys.argv[sys.argv.index('--') + 1:]; src, dst = a[0], a[1]
SHARE = float(os.environ.get('FORGE_PAD_SHARE', '0.5'))
bpy.ops.wm.open_mainfile(filepath=src)
arm = bpy.data.objects['Armature']; me = [o for o in bpy.data.objects if o.type == 'MESH'][0]
P = 'mixamorig_'; Mw = me.matrix_world; Aw = arm.matrix_world
V = np.array([(Mw @ v.co)[:] for v in me.data.vertices])
tot = {}
for side in ('Left', 'Right'):
    ga, gs = me.vertex_groups.get(P + side + 'Arm'), me.vertex_groups.get(P + side + 'Shoulder')
    if not ga or not gs: continue
    b = arm.data.bones[P + side + 'Arm']; head = np.array((Aw @ b.head_local)[:]); tail = np.array((Aw @ b.tail_local)[:])
    L = np.linalg.norm(tail - head)
    n = 0
    for v in me.data.vertices:
        w = next((g.weight for g in v.groups if g.group == ga.index), 0.0)
        if w < 0.05: continue
        p = V[v.index]; t = np.dot(p - head, tail - head) / (L * L)
        # full share near the shoulder joint, none from 45% down the upper arm; only the outer/top shell (above the joint line)
        f = np.clip((0.45 - t) / 0.35, 0, 1) * np.clip((p[2] - (head[2] - 0.10)) / 0.08, 0, 1)
        if f <= 0: continue
        mv = w * SHARE * f
        ga.add([v.index], w - mv, 'REPLACE')
        ws = next((g.weight for g in v.groups if g.group == gs.index), 0.0)
        gs.add([v.index], ws + mv, 'REPLACE'); n += 1
    tot[side] = n
    # back / chest straps medial of the shoulder joint: they belong to the torso, not the arm
    gsp = me.vertex_groups.get(P + 'Spine2')
    if gsp:
        R3 = Mw.to_3x3(); m = 0
        for v in me.data.vertices:
            w = next((g.weight for g in v.groups if g.group == ga.index), 0.0)
            if w < 0.02: continue
            p = V[v.index]
            med = abs(head[0]) - abs(p[0])                      # >0: closer to the spine than the shoulder joint
            if med < 0.015 or not (head[2] - 0.30 < p[2] < head[2] + 0.12): continue
            f = min(1.0, (med - 0.015) / 0.03)
            mv = w * f
            ga.add([v.index], w - mv, 'REPLACE')
            wsp = next((g.weight for g in v.groups if g.group == gsp.index), 0.0); gsp.add([v.index], wsp + 0.6 * mv, 'REPLACE')
            ws = next((g.weight for g in v.groups if g.group == gs.index), 0.0); gs.add([v.index], ws + 0.4 * mv, 'REPLACE')
            m += 1
        tot[side + 'Torso'] = m
print('padfix moved', tot)
bpy.ops.wm.save_as_mainfile(filepath=dst)
