# v2.11 weapon moves pack: the skeleton + the weapon clips only (no mesh), loaded by the Forge / village on demand and
# played on the Rebel's own rig (same bone names and rest pose as its rig.glb).
# usage: exp_moves.py -- in.blend clips_weapons.json out.glb
import bpy, sys, json
a = sys.argv[sys.argv.index('--') + 1:]; blend, clips, out = a
bpy.ops.wm.open_mainfile(filepath=blend)
arm = bpy.data.objects['Armature']; bpy.context.scene.render.fps = 30; bpy.context.scene.render.fps_base = 1
names = {c['name'] for c in json.load(open(clips))}
for o in list(bpy.data.objects):
    if o is not arm: bpy.data.objects.remove(o, do_unlink=True)
kept = 0
for t in list(arm.animation_data.nla_tracks):
    if t.name in names: t.mute = False; kept += 1
    else: arm.animation_data.nla_tracks.remove(t)
arm.animation_data.action = None
print('weapon moves', kept)
for o in bpy.data.objects: o.select_set(o is arm)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_animations=True,
    export_animation_mode='NLA_TRACKS', export_force_sampling=True, export_frame_step=1, export_skins=False,
    export_def_bones=False, export_optimize_animation_size=True, export_yup=True, export_apply=False, export_morph=False)
