# Forge Rigger job QA: skin-stretch test on key clips + GLB sanity. Writes a JSON verdict ("pass" or "review").
# usage: python qa_job.py -- final.blend rig.glb qa.json job.log
import bpy, sys, json, struct, re, numpy as np
a = sys.argv[sys.argv.index('--') + 1:]; blend, glb, out, logf = a[0], a[1], a[2], a[3]
CLIPS = ['idle', 'walk', 'run', 'punch_combo', 'roundhouse_kick', 'backflip']
bpy.ops.wm.open_mainfile(filepath=blend)
arm = bpy.data.objects['Armature']; me = [o for o in bpy.data.objects if o.type == 'MESH'][0]
for t in arm.animation_data.nla_tracks: t.mute = True
E = np.zeros(len(me.data.edges) * 2, np.int64); me.data.edges.foreach_get('vertices', E); E = E.reshape(-1, 2)
V0 = np.zeros(len(me.data.vertices) * 3); me.data.vertices.foreach_get('co', V0); V0 = V0.reshape(-1, 3)
L0 = np.linalg.norm(V0[E[:, 0]] - V0[E[:, 1]], axis=1); ok = L0 > 1e-4
sc = bpy.context.scene
stretch = {}
for c in CLIPS:
    act = bpy.data.actions.get(c)
    if not act: continue
    arm.animation_data.action = act; arm.animation_data.action_slot = act.slots[0]
    f0, f1 = [int(x) for x in act.frame_range]; worst = []
    for f in range(f0, f1, 4):
        sc.frame_set(f); dg = bpy.context.evaluated_depsgraph_get(); ev = me.evaluated_get(dg); m = ev.to_mesh()
        V = np.zeros(len(m.vertices) * 3); m.vertices.foreach_get('co', V); V = V.reshape(-1, 3); ev.to_mesh_clear()
        r = np.linalg.norm(V[E[:, 0]] - V[E[:, 1]], axis=1)[ok] / L0[ok]
        worst.append((float(np.percentile(r, 99.9)), int((r > 2).sum())))
    w = np.array(worst)
    stretch[c] = {'p999': round(float(w[:, 0].max()), 2), 'edges2x': int(w[:, 1].max())}
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
if glbinfo['animations'] < 20: reasons.append('missing clips')
for c, s in stretch.items():
    if s['p999'] > 8: reasons.append(f'{c}: heavy stretch (p99.9 {s["p999"]}x)')
    if s['edges2x'] > 12000: reasons.append(f'{c}: {s["edges2x"]} edges stretched >2x')
if (rig['bridgeFaces'] or 0) > 3000: reasons.append('many bridge faces (hands/arms touching body)')
res = {'verdict': 'review' if reasons else 'pass', 'reasons': reasons, 'stretch': stretch, 'glb': glbinfo, 'rig': rig}
json.dump(res, open(out, 'w'), indent=1)
print('qa', res['verdict'], reasons)
