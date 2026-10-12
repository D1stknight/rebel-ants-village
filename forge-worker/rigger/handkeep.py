# v2.23 own hands (FORGE_NPC_SPECIES ape / human: the NPC Forge's Chumpz and Saints). They keep the sculpt's hands instead of
# the Rebel gloves (handswap), and with them the sculpt's loose bits: nails, claws, knuckle pads and finger pieces cut free
# by seamfix are separate islands that kept the thigh's weights (the hand hangs by the thigh in the rest pose). When the
# arm moves they stay behind and float where the hand was. Each loose island that lies on a hand (nearer that hand's
# bones than any other bone, past the wrist) rides the Hand bone; so does every vertex of the hand's own surface (walked
# from the wrist) that another bone still holds. The body's skin is never walked into: seamfix already cut it apart.
# usage: python3.13 handkeep.py -- in.blend out.blend
import bpy, bmesh, sys, numpy as np
a = sys.argv[sys.argv.index('--') + 1:]; src, dst = a
bpy.ops.wm.open_mainfile(filepath=src)
arm = bpy.data.objects['Armature']; me = [o for o in bpy.data.objects if o.type == 'MESH'][0]; P = 'mixamorig_'
Aw = arm.matrix_world; Mw = np.array(me.matrix_world)
co = np.array([v.co[:] for v in me.data.vertices]) @ Mw[:3, :3].T + Mw[:3, 3]
H = float(np.ptp(co[:, 2])) or 1.0
gn = {g.index: g.name for g in me.vertex_groups}
dom = [gn[max(v.groups, key=lambda g: g.weight).group] if v.groups else '' for v in me.data.vertices]
bm = bmesh.new(); bm.from_mesh(me.data); bm.verts.ensure_lookup_table()
nbr = [[e.other_vert(bv).index for e in bv.link_edges] for bv in bm.verts]
bm.free()
comp = -np.ones(len(co), int); nc = 0
for s in range(len(co)):
    if comp[s] >= 0: continue
    st = [s]; comp[s] = nc
    while st:
        i = st.pop()
        for j in nbr[i]:
            if comp[j] < 0: comp[j] = nc; st.append(j)
    nc += 1
sizes = np.bincount(comp, minlength=nc); body = int(np.argmax(sizes))
def segd(p, a, b):
    ab = b - a; t = np.clip(((p - a) @ ab) / max(1e-12, ab @ ab), 0, 1); return np.linalg.norm(p - (a + np.outer(t, ab)), axis=1)
segs = {b.name: (np.array(Aw @ b.head_local), np.array(Aw @ b.tail_local)) for b in arm.data.bones if b.use_deform}
def hand_set(side):   # the hand, its fingers and the forearm it hangs from (by the wrist the forearm is the nearer bone)
    return {n for n in segs if n.startswith(P + side + 'Hand') or n == P + side + 'ForeArm'}
ARMK = ('Hand', 'ForeArm', 'Thumb', 'Index', 'Middle', 'Ring', 'Pinky')
total = {}
for side in ('Left', 'Right'):
    hn = P + side + 'Hand'; fb = arm.data.bones.get(P + side + 'ForeArm')
    if hn not in segs or fb is None: continue
    W = segs[hn][0]; E = np.array(Aw @ fb.head_local); u = (W - E) / max(1e-9, np.linalg.norm(W - E))
    t = (co - W) @ u; r = np.linalg.norm((co - W) - np.outer(t, u), axis=1)
    near = (t > .005 * H) & (t < .3 * H) & (r < .14 * H)
    hs = hand_set(side)
    def on_hand(idx):   # per vertex: nearer this arm's hand / forearm bones than any other bone
        p = co[idx]; dh = np.min([segd(p, *segs[n]) for n in hs], axis=0)
        do = np.min([segd(p, *segs[n]) for n in segs if n not in hs], axis=0)
        return dh < do
    def mine(i): d = dom[i]; return d.startswith(P + side) and any(k in d for k in ARMK)
    take = set()
    # loose islands on the hand
    cand = {}
    for i in np.nonzero(near)[0]:
        if comp[i] != body: cand.setdefault(int(comp[i]), []).append(int(i))
    islands = 0
    for k, idx in cand.items():
        mem = np.nonzero(comp == k)[0]
        if len(idx) < .6 * len(mem): continue   # mostly elsewhere (a sleeve shell, a held prop)
        if on_hand(mem).mean() < .6: continue
        islands += 1; take.update(int(i) for i in mem if not mine(i))
    # the hand's own surface, walked from the wrist
    seeds = [int(i) for i in np.nonzero(near & (t < .05 * H))[0] if mine(i)]
    seen = set(seeds); stack = list(seeds)
    while stack:
        i = stack.pop()
        for j in nbr[i]:
            if j not in seen and near[j]: seen.add(j); stack.append(j)
    walk = [i for i in seen if not mine(i) and t[i] > .01 * H]
    if walk:
        ok = on_hand(np.array(walk)); take.update(i for i, o in zip(walk, ok) if o)
    hand = me.vertex_groups.get(hn) or me.vertex_groups.new(name=hn)
    for i in take:
        v = me.data.vertices[i]
        for g in list(v.groups): me.vertex_groups[g.group].remove([i])
        hand.add([i], 1.0, 'REPLACE')
    total[side] = len(take)
    print(f'handkeep {side}: {islands} loose pieces on the hand, hand surface {len(seen)} verts from {len(seeds)} at the wrist; {len(take)} verts moved onto the hand')
print('handkeep moved', total)
bpy.ops.wm.save_as_mainfile(filepath=dst)
