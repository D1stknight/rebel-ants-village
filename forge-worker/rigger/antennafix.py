# Forge Rigger v2.1 antennae: jointed antennae with a little follow-through, baked into every clip.
# The antennae are found from the geometry, so headgear is handled by itself: whatever sticks out of the head as a thin
# stalk from its upper half gets a 3-joint chain (antenna_<L|R>_1..3); a helmet or hood that covers them simply leaves
# nothing to rig. Each clip is then played through a small spring simulation (the stalk trails the head, overshoots and
# settles) and the result is keyed on the antenna bones, so the motion works in the Forge, the village or any viewer.
# usage: python3.13 antennafix.py -- in.blend out.blend
import bpy, bmesh, sys, os, heapq, numpy as np, mathutils as mu
a = sys.argv[sys.argv.index('--') + 1:]; src, dst = a
bpy.ops.wm.open_mainfile(filepath=src)
arm = bpy.data.objects['Armature']; me = [o for o in bpy.data.objects if o.type == 'MESH'][0]; P = 'mixamorig_'
Mw = np.array(me.matrix_world); Aw = arm.matrix_world; Ai = Aw.inverted()
hgrp = me.vertex_groups.get(P + 'Head')
if hgrp is None: print('antennafix: no head group, skipped'); bpy.ops.wm.save_as_mainfile(filepath=dst); sys.exit(0)
co = np.array([v.co[:] for v in me.data.vertices]) @ Mw[:3, :3].T + Mw[:3, 3]
hw = np.zeros(len(co))
for v in me.data.vertices:
    for g in v.groups:
        if g.group == hgrp.index: hw[v.index] = g.weight
bm = bmesh.new(); bm.from_mesh(me.data); bm.verts.ensure_lookup_table()
adj = [[(e.other_vert(v).index, e.calc_length()) for e in v.link_edges] for v in bm.verts]


def grow(seeds, allowed):
    seen = set(); comps = []
    for s in seeds:
        if s in seen or not allowed[s]: continue
        st = [s]; seen.add(s); cc = []
        while st:
            u = st.pop(); cc.append(u)
            for w, _ in adj[u]:
                if allowed[w] and w not in seen: seen.add(w); st.append(w)
        comps.append(cc)
    return comps


hv = np.nonzero(hw > 0.5)[0]
c0 = np.median(co[hv], 0); d0 = np.linalg.norm(co[hv] - c0, axis=1)
far = np.zeros(len(co), bool); far[hv[d0 > 1.25 * np.percentile(d0, 80)]] = True
seeds = grow(np.nonzero(far)[0], far)
# the head itself as an ellipsoid (without the stalks), then everything outside it that connects to a seed
core = np.setdiff1d(hv, np.concatenate(seeds) if seeds else [])
cc0 = co[core].mean(0); _, _, Vt = np.linalg.svd(co[core] - cc0, full_matrices=False)
rad = np.percentile(np.abs((co[core] - cc0) @ Vt.T), 97, axis=0)
dn = np.linalg.norm(((co - cc0) @ Vt.T) / rad, axis=1)
hz = float(np.percentile(np.abs(co[core][:, 2] - cc0[2]), 97))
outside = (dn > 1.03) & (hw > 0.3)
stalks = []
for s in seeds:
    for cc in grow(s, outside):
        if len(cc) < 60: continue
        cc = np.array(cc)
        base = cc[np.argsort(dn[cc])[:max(8, len(cc) // 40)]]          # where the stalk leaves the head
        # geodesic distance from the base across the stalk (Dijkstra over mesh edges)
        inset = set(cc.tolist()); dist = {int(b): 0.0 for b in base}; pq = [(0.0, int(b)) for b in base]
        while pq:
            dcur, u = heapq.heappop(pq)
            if dcur > dist.get(u, 9e9): continue
            for w, l in adj[u]:
                if w in inset and dcur + l < dist.get(w, 9e9): dist[w] = dcur + l; heapq.heappush(pq, (dcur + l, w))
        g = np.array([dist.get(int(i), np.nan) for i in cc]); ok = ~np.isnan(g); cc, g = cc[ok], g[ok]
        G = float(g.max()); bctr = co[base].mean(0)
        width = float(np.median(np.linalg.norm(co[cc[g < 0.25 * G]] - co[cc[g < 0.25 * G]].mean(0), axis=1))) + 1e-6
        # v2.6 measure the stalk's thickness half way up as well: where the base melts into a head wrap (#469 V2) the base
        # looks wide and the antenna was skipped
        mid = (g > 0.4 * G) & (g < 0.6 * G)
        if mid.sum() > 8: width = min(width, float(np.median(np.linalg.norm(co[cc[mid]] - co[cc[mid]].mean(0), axis=1))) + 1e-6)
        # base on the upper half of the head, measured on world Z (v2.5: a tall head wrap turned the head's main axis
        # sideways and the test threw away #469's long antenna)
        up = bctr[2] - cc0[2]
        if G < 3.0 * width or up < -0.2 * hz:
            print(f'antennafix: skipped a piece ({len(cc)} verts, length {G:.3f}, width {width:.3f})'); continue
        # joints: centroids of thin bands at 0, 1/3, 2/3 and the tip
        J = []
        for f in (0.0, 1 / 3, 2 / 3, 1.0):
            band = np.abs(g - f * G) < 0.06 * G
            J.append(co[cc[band]].mean(0) if band.any() else co[cc[np.argmin(np.abs(g - f * G))]])
        stalks.append(dict(verts=cc, g=g, G=G, J=np.array(J)))
if not stalks:
    print('antennafix: no antennae found (covered or none), skipped'); bm.free(); bpy.ops.wm.save_as_mainfile(filepath=dst); sys.exit(0)
stalks.sort(key=lambda s: -s['J'][0][0])                 # +X is the character's left
names_side = ['L', 'R'] if len(stalks) == 2 else [str(i) for i in range(len(stalks))]
print('antennafix: antennae', len(stalks), [f"{s['G']:.3f} m" for s in stalks])

# ---- bones ----
bpy.context.view_layer.objects.active = arm; bpy.ops.object.mode_set(mode='EDIT')
eb = arm.data.edit_bones; headb = eb[P + 'Head']
for sd, s in zip(names_side, stalks):
    prev = headb; s['bones'] = []
    for i in range(3):
        n = f'antenna_{sd}_{i + 1}'; b = eb.get(n) or eb.new(n)
        b.head = Ai @ mu.Vector(s['J'][i].tolist()); b.tail = Ai @ mu.Vector(s['J'][i + 1].tolist())
        b.parent = prev; b.use_connect = i > 0; b.use_deform = True; prev = b; s['bones'].append(n)
bpy.ops.object.mode_set(mode='OBJECT')

# ---- weights: along the stalk, blended between the joints; the root blends into the head ----
for s in stalks:
    gs = [me.vertex_groups.get(n) or me.vertex_groups.new(name=n) for n in s['bones']]
    t = s['g'] / s['G'] * 3.0                              # 0..3 along the stalk
    for vi, x in zip(s['verts'], t):
        vi = int(vi); w = np.zeros(3)
        k = int(np.clip(np.floor(x - 0.5), 0, 1)); f = np.clip(x - 0.5 - k, 0, 1)
        if x < 0.5: w[0] = 1.0
        elif x > 2.5: w[2] = 1.0
        else: w[k] = 1 - f; w[k + 1] = f
        root = float(np.clip(x / 0.35, 0, 1))              # the first few mm stay with the head
        for g in me.vertex_groups:
            if g.index not in [q.index for q in gs]:
                try: g.remove([vi])
                except RuntimeError: pass
        hgrp.add([vi], 1.0 - root, 'REPLACE')
        for q, wq in zip(gs, w):
            if wq * root > 1e-4: q.add([vi], float(wq * root), 'REPLACE')

# ---- bake a spring follow-through into every clip ----
K, C, GRAV = float(os.environ.get('ANT_K', 190)), float(os.environ.get('ANT_C', 15)), float(os.environ.get('ANT_G', 0.3))
MAXA_R = np.radians(float(os.environ.get('ANT_MAXA', 20))); MAXC = float(np.cos(MAXA_R))
for m in me.modifiers: m.show_viewport = False        # evaluate the skeleton only
sc = bpy.context.scene; fps = sc.render.fps / sc.render.fps_base or 30.0; dt = 1.0 / fps
hpb = arm.pose.bones[P + 'Head']
rest_head = np.array(arm.data.bones[P + 'Head'].matrix_local)
chains = []
for s in stalks:
    Jh = [np.linalg.inv(rest_head) @ np.append(Ai @ mu.Vector(j.tolist()), 1.0) for j in s['J']]   # joints in head space
    chains.append(dict(s=s, Jh=[np.array(j[:3]) for j in Jh], L=[float(np.linalg.norm(s['J'][i + 1] - s['J'][i])) for i in range(3)]))
for pb in arm.pose.bones:
    if pb.name.startswith('antenna_'): pb.rotation_mode = 'QUATERNION'


def bags(act):
    for Ly in act.layers:
        for st in Ly.strips:
            for cb in st.channelbags: yield cb


tracks = [t for t in arm.animation_data.nla_tracks]
muted = {t.name: t.mute for t in tracks}
for t in tracks: t.mute = True
n_clips = 0
for t in tracks:
    if not t.strips: continue
    act = t.strips[0].action; arm.animation_data.action = act
    try: arm.animation_data.action_slot = act.slots[0]
    except Exception: pass
    f0, f1 = [int(round(x)) for x in act.frame_range]; frames = list(range(f0, f1 + 1))
    loop = act.name in ('idle', 'walk', 'run', 'fight_idle')
    # head pose (armature space) per frame
    HM = []
    for fr in frames:
        sc.frame_set(fr); HM.append(np.array(hpb.matrix))
    keys = {n: [] for c in chains for n in c['s']['bones']}
    for c in chains:
        pos = [HM[0][:3, :3] @ j + HM[0][:3, 3] for j in c['Jh']]; vel = [np.zeros(3) for _ in pos]
        passes = 2 if loop else 1
        for ps in range(passes):
            for fi, M in enumerate(HM):
                tgt0 = [M[:3, :3] @ j + M[:3, 3] for j in c['Jh']]
                pos[0] = tgt0[0]
                for i in range(1, 4):
                    # the target keeps the rest shape relative to the (simulated) previous joint
                    tgt = pos[i - 1] + (tgt0[i] - tgt0[i - 1])
                    acc = K * (tgt - pos[i]) - C * vel[i] + np.array([0, 0, -GRAV])
                    vel[i] = vel[i] + acc * dt; pos[i] = pos[i] + vel[i] * dt
                    dv = pos[i] - pos[i - 1]; dv /= max(1e-9, np.linalg.norm(dv))
                    rd = tgt - pos[i - 1]; rd /= max(1e-9, np.linalg.norm(rd))
                    ca = float(np.clip(dv @ rd, -1, 1))
                    if ca < MAXC:            # a joint bends at most MAXA degrees away from its rest shape
                        ax = np.cross(rd, dv); sn = np.linalg.norm(ax)
                        if sn > 1e-9: dv = np.array(mu.Quaternion(mu.Vector((ax / sn).tolist()), MAXA_R) @ mu.Vector(rd.tolist()))
                        else: dv = rd
                        vel[i] *= 0.5
                    pos[i] = pos[i - 1] + dv * c['L'][i - 1]
                if ps == passes - 1:
                    # bone rotations: parent (animated) frame -> desired direction
                    parentM = M
                    for i, n in enumerate(c['s']['bones']):
                        bone = arm.data.bones[n]
                        restL = np.array(bone.parent.matrix_local)
                        rel = np.linalg.inv(restL) @ np.array(bone.matrix_local)     # rest pose relative to the parent
                        Mrest_now = parentM @ rel                                    # where the bone is without rotation
                        want = pos[i + 1] - Mrest_now[:3, 3]
                        cur = Mrest_now[:3, 1]
                        wl = np.linalg.inv(Mrest_now[:3, :3]) @ want; cl = np.linalg.inv(Mrest_now[:3, :3]) @ cur
                        q = mu.Vector(cl.tolist()).rotation_difference(mu.Vector(wl.tolist()))
                        keys[n].append(q)
                        R = np.array(q.to_matrix()); Mnew = Mrest_now.copy(); Mnew[:3, :3] = Mrest_now[:3, :3] @ R
                        parentM = Mnew
    for cb in bags(act):
        for fc in list(cb.fcurves):
            if 'antenna_' in fc.data_path: cb.fcurves.remove(fc)
        for n, qs in keys.items():
            arr = np.array([[q.w, q.x, q.y, q.z] for q in qs])
            for i in range(1, len(arr)):
                if np.dot(arr[i], arr[i - 1]) < 0: arr[i] = -arr[i]
            for ci in range(4):
                fc = cb.fcurves.new(f'pose.bones["{n}"].rotation_quaternion', index=ci, group_name=n)
                fc.keyframe_points.add(len(frames)); fc.keyframe_points.foreach_set('co', np.c_[np.array(frames, float), arr[:, ci]].ravel())
                for kp in fc.keyframe_points: kp.interpolation = 'LINEAR'
        break
    n_clips += 1
arm.animation_data.action = None
for t in tracks: t.mute = muted[t.name]
for m in me.modifiers: m.show_viewport = True
bm.free()
print('antennafix: follow-through baked into clips', n_clips)
bpy.ops.wm.save_as_mainfile(filepath=dst)
