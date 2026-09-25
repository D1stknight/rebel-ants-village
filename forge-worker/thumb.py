# Render a lobby/hub portrait of a rigged Forge GLB: idle pose, 3/4 front, transparent film, then composite on a gradient.
# usage: python3.13 thumb.py -- in.glb out.jpg [size]
import bpy, sys, math, mathutils as mu, numpy as np
a = sys.argv[sys.argv.index('--') + 1:]; src, out = a[0], a[1]; S = int(a[2]) if len(a) > 2 else 512
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
arm = next((o for o in bpy.data.objects if o.type == 'ARMATURE'), None)
if arm and arm.animation_data:
    act = bpy.data.actions.get('idle') or (bpy.data.actions[0] if bpy.data.actions else None)
    for t in arm.animation_data.nla_tracks: t.mute = True
    if act:
        arm.animation_data.action = act
        try: arm.animation_data.action_slot = act.slots[0]
        except Exception: pass
        bpy.context.scene.frame_set(int(act.frame_range[0]) + 10)
dg = bpy.context.evaluated_depsgraph_get()
pts = []
for o in bpy.data.objects:
    if o.type != 'MESH': continue
    ev = o.evaluated_get(dg); m = ev.to_mesh()
    C = np.zeros(len(m.vertices) * 3); m.vertices.foreach_get('co', C); C = C.reshape(-1, 3)[::7]; ev.to_mesh_clear()
    M = np.array(ev.matrix_world); pts.append(C @ M[:3, :3].T + M[:3, 3])
P = np.concatenate(pts); lo, hi = np.percentile(P, 0.5, axis=0), np.percentile(P, 99.5, axis=0); print("bbox", lo.round(3), hi.round(3), [o.name for o in bpy.data.objects if o.type=="MESH"]); H = hi[2] - lo[2]; cx, cy = (lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 32; sc.cycles.use_denoising = True
sc.render.resolution_x = sc.render.resolution_y = S; sc.render.film_transparent = True
sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Punchy'; sc.view_settings.exposure = 0.25
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.55, 0.57, 0.62, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.6
cd = bpy.data.cameras.new('cam'); cd.lens = 70; cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
yaw = math.radians(-22)
top = hi[2]; zc = top - 0.26 * H          # head to about mid-thigh
d = (0.36 * H) / math.tan(math.atan(18 / 70))
tgt = mu.Vector((cx, cy, zc))
cam.location = tgt + mu.Vector((math.sin(yaw) * d, -math.cos(yaw) * d, 0.06 * H))
cam.rotation_euler = (tgt - cam.location).to_track_quat('-Z', 'Y').to_euler()
def light(name, loc, energy, size, color=(1, 1, 1)):
    ld = bpy.data.lights.new(name, 'AREA'); ld.energy = energy; ld.size = size; ld.color = color
    l = bpy.data.objects.new(name, ld); sc.collection.objects.link(l); l.location = tgt + mu.Vector(loc)
    l.rotation_euler = (tgt - l.location).to_track_quat('-Z', 'Y').to_euler()
light('key', (-1.6, -2.2, 1.4), 300, 1.6, (1, 0.93, 0.84))
light('fill', (2.0, -1.6, 0.4), 110, 2.0, (0.8, 0.88, 1))
light('rim', (0.6, 2.4, 1.6), 380, 1.2, (0.55, 0.95, 0.95))
sc.render.filepath = '/tmp/_thumb.png'; bpy.ops.render.render(write_still=True)
from PIL import Image, ImageDraw, ImageFilter
fg = Image.open('/tmp/_thumb.png').convert('RGBA')
bg = Image.new('RGBA', (S, S)); px = bg.load()
for y in range(S):
    for x in range(S):
        r = math.hypot((x - S * 0.5) / S, (y - S * 0.42) / S) / 0.75
        t = min(1, r)
        px[x, y] = (int(40 + (12 - 40) * t), int(58 + (16 - 58) * t), int(66 + (20 - 66) * t), 255)
glow = fg.split()[3].filter(ImageFilter.GaussianBlur(S / 40)).point(lambda v: int(v * 0.35))
bg.paste((94, 207, 202, 255), (0, 0), glow)
bg.alpha_composite(fg)
bg.convert('RGB').save(out, quality=86)
print('thumb', out)
