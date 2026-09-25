import bpy, sys, os
args=sys.argv[sys.argv.index('--')+1:]; blend,out=args[0],args[1]
bpy.ops.wm.open_mainfile(filepath=blend)
arm=bpy.data.objects['Armature']; mesh=[o for o in bpy.data.objects if o.type=='MESH'][0]
mesh.name=os.environ.get('FORGE_NAME','Rebel'); arm.name='Armature'; bpy.context.scene.render.fps=30; bpy.context.scene.render.fps_base=1
# v1.2 optional village budget: FORGE_DECIMATE=0.35 collapses the skinned mesh before export (weights are interpolated)
dec=float(os.environ.get('FORGE_DECIMATE','0') or 0)
if 0<dec<1:
    bpy.context.view_layer.objects.active=mesh
    m=mesh.modifiers.new('Dec','DECIMATE'); m.decimate_type='COLLAPSE'; m.ratio=dec; m.use_collapse_triangulate=True
    bpy.ops.object.modifier_move_to_index(modifier='Dec',index=0); bpy.ops.object.modifier_apply(modifier='Dec')
    # keep max 4 influences, renormalised
    bpy.ops.object.mode_set(mode='OBJECT')
    print('decimated verts',len(mesh.data.vertices),'tris',sum(len(p.vertices)-2 for p in mesh.data.polygons))
TEX_BASE=int(os.environ.get('FORGE_TEX_BASE','2048')); TEX_OTHER=int(os.environ.get('FORGE_TEX_OTHER','1024'))
# shrink textures: base color TEX_BASE (2048), others TEX_OTHER (1024)
mat=mesh.data.materials[0]; mat.use_backface_culling=False
for n in mat.node_tree.nodes:
    if n.type=='TEX_IMAGE' and n.image:
        links=[l.to_socket.name for l in n.outputs[0].links]+[l.to_socket.name for l in n.outputs[1].links]
        is_base=any('Base Color' in s for s in links)
        size=TEX_BASE if is_base else TEX_OTHER
        if n.image.size[0]>size: n.image.scale(size,size)
        print(n.image.name,links,tuple(n.image.size))
for o in bpy.data.objects: o.select_set(o in (arm,mesh))
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,export_animations=True,
    export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_step=1,export_skins=True,
    export_all_influences=False,export_image_format='JPEG',export_jpeg_quality=88,export_def_bones=False,
    export_optimize_animation_size=True,export_yup=True,export_apply=False,export_morph=False)
