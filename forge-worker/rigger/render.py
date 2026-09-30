import bpy, math, mathutils as mu
def setup(res=(440,440),samples=16):
    sc=bpy.context.scene; sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=samples
    sc.cycles.use_denoising=False; sc.render.resolution_x,sc.render.resolution_y=res; sc.render.film_transparent=False
    w=bpy.data.worlds.new('w') if not sc.world else sc.world; sc.world=w; w.use_nodes=True
    w.node_tree.nodes['Background'].inputs[0].default_value=(0.55,0.56,0.58,1); w.node_tree.nodes['Background'].inputs[1].default_value=1.0
    if 'Cam' not in bpy.data.objects:
        cd=bpy.data.cameras.new('Cam'); cd.type='ORTHO'; cd.ortho_scale=2.1; cam=bpy.data.objects.new('Cam',cd); sc.collection.objects.link(cam); sc.camera=cam
        ld=bpy.data.lights.new('Sun','SUN'); ld.energy=3; l=bpy.data.objects.new('Sun',ld); sc.collection.objects.link(l); l.rotation_euler=(math.radians(50),0,math.radians(-30))
    return sc
def shoot(path,yaw_deg=0,target=(0,0,0.9),dist=4,ortho=2.1):
    sc=bpy.context.scene; cam=bpy.data.objects['Cam']; cam.data.ortho_scale=ortho
    a=math.radians(yaw_deg); t=mu.Vector(target)
    cam.location=t+mu.Vector((math.sin(a)*dist,-math.cos(a)*dist,0.15))
    cam.rotation_euler=(t-cam.location).to_track_quat('-Z','Y').to_euler()
    sc.render.filepath=path; bpy.ops.render.render(write_still=True)
