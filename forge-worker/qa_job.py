# Forge Rigger job QA: skin-stretch test on key clips + GLB sanity. Writes a JSON verdict ("pass", "review" or "fail").
# usage: python qa_job.py -- final.blend rig.glb qa.json job.log
import bpy, sys, os, json, struct, re, math, numpy as np
a = sys.argv[sys.argv.index('--') + 1:]; blend, glb, out, logf = a[0], a[1], a[2], a[3]
NPC = bool(os.environ.get('FORGE_NPC'))   # v2.13 NPC villagers: their own clips and checks (tears, strays, lean, floor, head snaps)
CLIPS = ['idle', 'walk', 'run', 'talking', 'waving', 'wave_short', 'pick_up', 'bow', 'rallying', 'pointing', 'clapping', 'look_around', 'jump'] if NPC else ['idle', 'walk', 'run', 'punch_combo', 'roundhouse_kick', 'backflip']
ENDONLY = {'jump'} if NPC else set()   # the Rebels' own jump (deep landing crouch): only checked for landing on the floor and head snaps
bpy.ops.wm.open_mainfile(filepath=blend)
arm = bpy.data.objects['Armature']; me = [o for o in bpy.data.objects if o.type == 'MESH'][0]
for t in arm.animation_data.nla_tracks: t.mute = True
E = np.zeros(len(me.data.edges) * 2, np.int64); me.data.edges.foreach_get('vertices', E); E = E.reshape(-1, 2)
V0 = np.zeros(len(me.data.vertices) * 3); me.data.vertices.foreach_get('co', V0); V0 = V0.reshape(-1, 3)
L0 = np.linalg.norm(V0[E[:, 0]] - V0[E[:, 1]], axis=1); ok = L0 > 1e-4
sc = bpy.context.scene
Mw = np.array(me.matrix_world)
stretch = {}
npc = {}
if NPC:
    # dominant bone per vertex: head and feet centres give the mesh lean (feet -> head against vertical, + forward)
    gn = {g.index: g.name for g in me.vertex_groups}; dom = []
    for v in me.data.vertices:
        best = max(v.groups, key=lambda g: g.weight, default=None); dom.append(gn.get(best.group, '') if best else '')
    dom = np.array(dom); HEADV = np.isin(dom, ['mixamorig_Head', 'mixamorig_HeadTop_End'])
    FEETV = np.array([bool(re.match(r'mixamorig_(Left|Right)(Foot|ToeBase)$', d)) for d in dom])
    VW0 = V0 @ Mw[:3, :3].T + Mw[:3, 3]; Hn = float(np.ptp(VW0[:, 2])) or 1.0; floor0 = float(VW0[:, 2].min())
    def lean(VW):
        if not HEADV.any() or not FEETV.any(): return 0.0
        d = VW[HEADV].mean(0) - VW[FEETV].mean(0)
        return math.degrees(math.atan2(-d[1], d[2]))            # characters face -Y
    lean0 = lean(VW0)
    # strays: glove / cuff vertices not driven by the hand chain stay behind when the arm moves
    gm = {i for i, m in enumerate(me.data.materials) if m and m.name.startswith('Glove')}; hand = {i for i, n in gn.items() if re.search(r'(Hand|ForeArm)', n)}
    gv = set()
    for poly in me.data.polygons:
        if poly.material_index in gm: gv.update(poly.vertices)
    strays = 0
    for i in gv:
        v = me.data.vertices[i]; tot = sum(g.weight for g in v.groups) or 1.0
        if sum(g.weight for g in v.groups if g.group in hand) / tot < 0.5: strays += 1
    npc['strays'] = strays
    # v2.21 the cuff must stay in the sleeve: cuff vertices in their forearm's frame as (along the cuff's axis, distance
    # from it), so a round cuff spinning with the hand's twist doesn't count (it moved up to 10 cm in talking before)
    from mathutils import Vector as _V
    cmi_ = {i for i, m in enumerate(me.data.materials) if m and m.name == 'GloveCuff'}; CUFF = {}; cvs = {'Left': set(), 'Right': set()}
    for poly in me.data.polygons:
        if poly.material_index in cmi_:
            for vi in poly.vertices: cvs['Left' if 'Left' in dom[vi] else 'Right'].add(vi)
    for s_, idx in cvs.items():
        pf_, hb_ = arm.pose.bones.get(f'mixamorig_{s_}ForeArm'), arm.data.bones.get(f'mixamorig_{s_}Hand')
        if len(idx) < 20 or pf_ is None or hb_ is None: continue
        idx = np.array(sorted(idx)); Fi = np.linalg.inv(np.array(arm.matrix_world @ pf_.bone.matrix_local)); P0_ = VW0[idx] @ Fi[:3, :3].T + Fi[:3, 3]
        cbn_ = arm.data.bones.get(f'mixamorig_{s_}ForeArmCuff')   # the cuff's own axis (its bone, else elbow -> wrist)
        axw = (cbn_.matrix_local.to_3x3() @ _V((0, 1, 0))) if cbn_ else (hb_.head_local - pf_.bone.head_local)
        ax = Fi[:3, :3] @ np.array((arm.matrix_world.to_3x3() @ axw)[:]); ax /= np.linalg.norm(ax)
        def cyl(Pf, c0=P0_.mean(0), ax=ax): d = Pf - c0; a_ = d @ ax; return a_, np.linalg.norm(d - np.outer(a_, ax), axis=1)
        CUFF[s_] = (idx, pf_, cyl, cyl(P0_))


def head_pop(act):
    # largest one-frame turn of the head / neck (keys are per frame)
    f0_, f1_ = [int(x) for x in act.frame_range]; cb = act.layers[0].strips[0].channelbag(act.slots[0]); pop = 0.0
    for b in ('mixamorig_Head', 'mixamorig_Neck'):
        fc = [cb.fcurves.find(f'pose.bones["{b}"].rotation_quaternion', index=i) for i in range(4)]
        if not all(fc): continue
        q = np.array([[f_.evaluate(fr) for f_ in fc] for fr in range(f0_, f1_ + 1)]); q /= np.linalg.norm(q, axis=1, keepdims=True)
        d = np.abs((q[1:] * q[:-1]).sum(1)); pop = max(pop, float(np.degrees(2 * np.arccos(np.clip(d, 0, 1))).max()) if len(d) else 0.0)
    return pop


for c in CLIPS:
    act = bpy.data.actions.get(c)
    if not act: continue
    arm.animation_data.action = act; arm.animation_data.action_slot = act.slots[0]
    f0, f1 = [int(x) for x in act.frame_range]; worst = []; nq = {'tear': 0.0, 'lean': [99.0, -99.0], 'floor': 0.0}
    for f in range(f0, f1, 4):
        sc.frame_set(f); dg = bpy.context.evaluated_depsgraph_get(); ev = me.evaluated_get(dg); m = ev.to_mesh()
        V = np.zeros(len(m.vertices) * 3); m.vertices.foreach_get('co', V); V = V.reshape(-1, 3); ev.to_mesh_clear()
        r = np.linalg.norm(V[E[:, 0]] - V[E[:, 1]], axis=1)[ok] / L0[ok]
        worst.append((float(np.percentile(r, 99.9)), int((r > 2).sum())))
        if NPC:
            VW = V @ Mw[:3, :3].T + Mw[:3, 3]; L1 = np.linalg.norm(VW[E[:, 0]] - VW[E[:, 1]], axis=1)[ok]
            torn = L1[(r > 2.5)]; nq['tear'] = max(nq['tear'], float(torn.max()) / Hn if torn.size else 0.0)
            ln = lean(VW) - lean0; nq['lean'] = [min(nq['lean'][0], ln), max(nq['lean'][1], ln)]
            nq['floor'] = min(nq['floor'], float(VW[:, 2].min()) - floor0)
            for s_, (idx, pf_, cyl, (a0, r0)) in CUFF.items():
                Fi = np.linalg.inv(np.array(arm.matrix_world @ pf_.matrix)); a1, r1 = cyl(VW[idx] @ Fi[:3, :3].T + Fi[:3, 3])
                nq['cuff'] = max(nq.get('cuff', 0.0), float(np.max(np.maximum(np.abs(a1 - a0), np.abs(r1 - r0)))))
    w = np.array(worst)
    stretch[c] = {'p999': round(float(w[:, 0].max()), 2), 'edges2x': int(w[:, 1].max())}
    if NPC:
        # v2.14 a clip must end standing on the floor (the master jump alone ended 47 cm up in the air)
        sc.frame_set(f1); dg = bpy.context.evaluated_depsgraph_get(); ev = me.evaluated_get(dg); m = ev.to_mesh()
        V = np.zeros(len(m.vertices) * 3); m.vertices.foreach_get('co', V); ev.to_mesh_clear()
        nq['end'] = float((V.reshape(-1, 3) @ Mw[:3, :3].T + Mw[:3, 3])[:, 2].min()) - floor0
        pop = head_pop(act)
        npc[c] = {'tear': round(nq['tear'], 3), 'lean': [round(nq['lean'][0], 1), round(nq['lean'][1], 1)], 'floorCm': round(nq['floor'] * 100, 1), 'headPop': round(pop, 1), 'endCm': round(nq['end'] * 100, 1), **({'cuffCm': round(nq.get('cuff', 0.0) * 100, 1)} if CUFF else {})}
if NPC:
    # v2.21 head snaps in every other clip too (flip_kick turned the head round on rigs before 2.19)
    npc['headSnaps'] = {a_.name: round(p_, 1) for a_ in bpy.data.actions if a_.name not in CLIPS and a_.layers for p_ in [head_pop(a_)] if p_ > 30}
if NPC:
    # v2.17 arms fused to the body: when the renders show the arms against the sides, the sculpt joins the inner arm to
    # the chest (the Bushi) and every arm move pulls a web out of the chest. Tested on the exported GLB (what the village
    # shows; on the full mesh the web spreads over several thin rows): both upper arms raised 100 deg in the plane of
    # the arm and the vertical; faces joining the arm / forearm to the lower torso that then span more than 10 % of the
    # height are the web. Clean villagers 0-12 cm2 (armpit), fused 270-400 cm2.
    from mathutils import Vector, Quaternion
    try:
        before = set(bpy.data.objects); bpy.ops.import_scene.gltf(filepath=glb); new_ = [o for o in bpy.data.objects if o not in before]
        garm = next(o for o in new_ if o.type == 'ARMATURE')
        gme = max((o for o in new_ if o.type == 'MESH' and o.data.materials and o.vertex_groups), key=lambda o: len(o.data.vertices))
        if garm.animation_data:
            for t in garm.animation_data.nla_tracks: t.mute = True
            garm.animation_data.action = None
        for pb in garm.pose.bones: pb.matrix_basis.identity()
        bpy.context.view_layer.update()
        gn_ = {g.index: g.name for g in gme.vertex_groups}
        gdom = [gn_.get(max(v.groups, key=lambda g: g.weight).group, '') if v.groups else '' for v in gme.data.vertices]
        ARMV = np.array([bool(re.match(r'mixamorig_(Left|Right)(Arm|ForeArm)$', d)) for d in gdom])
        LOWV = np.array([bool(re.match(r'mixamorig_(Hips|Spine|Spine1)$', d)) for d in gdom])
        def gworld():
            dg = bpy.context.evaluated_depsgraph_get(); ev = gme.evaluated_get(dg); m = ev.to_mesh()
            V = np.zeros(len(m.vertices) * 3); m.vertices.foreach_get('co', V); ev.to_mesh_clear()
            Mg = np.array(gme.matrix_world); return V.reshape(-1, 3) @ Mg[:3, :3].T + Mg[:3, 3]
        GH = float(np.ptp(gworld()[:, 2])) or 1.0
        up = (garm.matrix_world.inverted().to_3x3() @ Vector((0, 0, 1))).normalized()
        for sd in ('Left', 'Right'):
            pb = garm.pose.bones.get(f'mixamorig_{sd}Arm')
            if not pb: continue
            M = pb.matrix.copy(); y = (M.to_3x3() @ Vector((0, 1, 0))).normalized(); ax = y.cross(up).normalized()
            R = Quaternion(ax, math.radians(100)).to_matrix()
            if (R @ y).dot(up) < y.dot(up): R = Quaternion(ax, -math.radians(100)).to_matrix()
            M2 = (R @ M.to_3x3()).to_4x4(); M2.translation = M.translation; pb.matrix = M2; bpy.context.view_layer.update()
        VR = gworld(); web = 0.0; webn = 0; longest = 0.0
        for poly in gme.data.polygons:
            f = list(poly.vertices)
            if not (ARMV[f].any() and LOWV[f].any()): continue
            p_ = VR[f]; span = max(float(np.linalg.norm(p_[k] - p_[(k + 1) % len(f)])) for k in range(len(f)))
            longest = max(longest, span)
            if span > 0.10 * GH:
                web += sum(float(np.linalg.norm(np.cross(p_[k] - p_[0], p_[k + 1] - p_[0]))) for k in range(1, len(f) - 1)) / 2; webn += 1
        k2 = (1.8 / GH) ** 2                                         # the sculpts are normalised to ~1.8 m
        npc['armsFused'] = {'webCm2': round(web * 1e4 * k2, 1), 'faces': webn, 'longestCm': round(longest * 100 * 1.8 / GH, 1)}
    except Exception as e_:
        npc['armsFused'] = {'error': str(e_)[:200]}
# GLB sanity
b = open(glb, 'rb').read(); jl = struct.unpack('<I', b[12:16])[0]; g = json.loads(b[20:20 + jl])
names = [x.get('name') for x in g.get('animations', [])]
nodes = [n.get('name', '') for n in g.get('nodes', [])]
glbinfo = {'bytes': len(b), 'animations': len(names), 'clips': names,
           'bones': sum(1 for n in nodes if n.startswith('mixamorig_')), 'clothBones': sum(1 for n in nodes if n.startswith('cloth_')),
           'tris': sum(p.get('count', 0) for p in [g['accessors'][pr['indices']] for m in g.get('meshes', []) for pr in m['primitives'] if 'indices' in pr]) // 3}
log = open(logf, errors='ignore').read()
def grab(pat):
    m = re.search(pat, log); return float(m.group(1)) if m else None
rig = {'bridgeFaces': grab(r'bridge faces (\d+)'), 'tearFaces': grab(r'tear faces (\d+)'), 'joints': grab(r'joints (\d+)'), 'bones': grab(r'bones (\d+)')}
reasons = []
if glbinfo['bones'] < 65: reasons.append('missing bones')
if glbinfo['animations'] < (17 if NPC else 20): reasons.append('missing clips')
for c, s in stretch.items():
    if c in ENDONLY: continue
    if s['p999'] > 8: reasons.append(f'{c}: heavy stretch (p99.9 {s["p999"]}x)')
    if s['edges2x'] > 12000: reasons.append(f'{c}: {s["edges2x"]} edges stretched >2x')
if (rig['bridgeFaces'] or 0) > 3000: reasons.append('many bridge faces (hands/arms touching body)')
# v2.6 gross failures -> "fail": the Forge then rigs the player's next version instead of handing this one over.
# (calm clips must not tear; the rest pose must not have pieces flying out; hands must match the forearm)
fails = []
for c, lim in (('idle', 6.0), ('walk', 8.0), ('run', 10.0), ('roundhouse_kick', 20.0)):
    if c in stretch and stretch[c]['p999'] > lim: fails.append(f'{c}: torn ({stretch[c]["p999"]}x)')
VW = V0 @ Mw[:3, :3].T
H = float(np.ptp(VW[:, 2])) or 1.0; Wd = float(np.percentile(VW[:, 0], 99.9) - np.percentile(VW[:, 0], 0.1)); Dp = float(np.percentile(VW[:, 1], 99.9) - np.percentile(VW[:, 1], 0.1))
if Wd > 1.2 * H or Dp > 0.7 * H: fails.append(f'rest pose too wide ({Wd / H:.2f} x {Dp / H:.2f} of height)')
for m_ in re.finditer(r'hand length ([\d.]+) .*?wrist girth [\d.]+ \(raw ([\d.]+)\)', log):
    if float(m_.group(2)) > 0.6 * float(m_.group(1)): fails.append('hands: the wrist ring picked up the body'); break
if NPC:
    # villagers stand, talk and gesture: pieces torn free, leftover glove parts, a sitting / leaning body, sinking into
    # the floor or a head that snaps are what a player notices (each one was seen on the old villagers)
    if npc.get('strays'): fails.append(f"{npc['strays']} glove vertices are not driven by the hand (pieces stay behind)")
    af = npc.get('armsFused', {}).get('webCm2', 0) or 0
    if af > 120: fails.append(f"arms fused to the body: {af:.0f} cm² of web pulls out of the chest when the arms lift (re-sculpt from renders with a gap between the arms and the body)")
    elif af > 50: reasons.append(f"arms partly fused to the body: {af:.0f} cm² of web under the arms when they lift")
    for c, v in (npc.get('headSnaps') or {}).items(): reasons.append(f"{c}: head snaps {v} deg in one frame")
    for c in CLIPS:
        q = npc.get(c)
        if not q: continue
        if q['endCm'] > 5: reasons.append(f"{c}: ends {q['endCm']} cm off the floor")
        if q['headPop'] > 30: reasons.append(f"{c}: head snaps {q['headPop']} deg in one frame")   # v2.19 the jump too (head turned round)
        if q.get('cuffCm', 0) > 1.5: reasons.append(f"{c}: the cuff moves {q['cuffCm']} cm in the sleeve")
        if c in ENDONLY: continue
        if q['tear'] > 0.30: fails.append(f"{c}: a piece tears {q['tear']:.2f} of the height long")
        elif q['tear'] > 0.15: reasons.append(f"{c}: stretched faces {q['tear']:.2f} of the height long")
        lim = {'idle': 6, 'talking': 6, 'walk': 9}.get(c)                    # the master walk leans ~6 deg on every Rebel
        if lim and max(abs(q['lean'][0]), abs(q['lean'][1])) > lim: reasons.append(f"{c}: body leans {q['lean']} deg from its rest pose")
        if q['floorCm'] < -3: reasons.append(f"{c}: sinks {-q['floorCm']} cm into the floor")
reasons = fails + reasons
res = {'verdict': 'fail' if fails else ('review' if reasons else 'pass'), 'reasons': reasons, 'stretch': stretch, 'glb': glbinfo, 'rig': rig, 'rest': {'width': round(Wd / H, 3), 'depth': round(Dp / H, 3)}, **({'npc': npc} if NPC else {})}
json.dump(res, open(out, 'w'), indent=1)
print('qa', res['verdict'], reasons)
