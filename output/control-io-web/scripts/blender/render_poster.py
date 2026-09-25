"""Transparent cut-out render of a sample tower GLB (hero poster / mobile onboarding).
    blender -b -P scripts/blender/render_poster.py -- --glb data/plates/tower-m8.photo.raw.glb --out data/plates/poster-m8.png
Then scripts/blender/trim_poster.py crops it to the 514x826 frame the pages expect.
Photo-textured stages already carry soft daylight in their textures, so the light here is gentler
(--sun 1.5, exposure 0) than it was for the PBR stages (3, -0.3).
"""
import argparse, math, re, sys
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
ap = argparse.ArgumentParser(); ap.add_argument("--glb"); ap.add_argument("--out")
ap.add_argument("--samples", type=int, default=48); ap.add_argument("--sun", type=float, default=1.5)
ap.add_argument("--exposure", type=float, default=0.0)
a = ap.parse_args(argv)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.glb)
site = re.compile(r"^(Ground|SitePad|GravelYard|Road|Neighbour|Fence|Container|Rebar\d|Formstack|Crane|Jib|CounterWeight|Cab|Hoist|HookLoad)")
for o in list(bpy.data.objects):
    if site.match(o.name):
        bpy.data.objects.remove(o, do_unlink=True)
sc = bpy.context.scene
w = bpy.data.worlds.new("W"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.85, 0.88, 0.9, 1)
w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.9
bpy.ops.object.light_add(type="SUN"); s = bpy.context.active_object; s.data.energy = a.sun; s.rotation_euler = (math.radians(30), 0, math.radians(35))
sc.render.engine = "CYCLES"; sc.cycles.samples = a.samples; sc.cycles.use_denoising = True
sc.render.film_transparent = True
sc.render.resolution_x, sc.render.resolution_y = 900, 1300
sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
sc.view_settings.view_transform = "Standard"
sc.view_settings.exposure = a.exposure
cd = bpy.data.cameras.new("C"); cd.lens = 60; cam = bpy.data.objects.new("C", cd); sc.collection.objects.link(cam)
cam.location = (95, -95, 70)  # blender Z-up
cam.rotation_euler = (Vector((0, 0, 21)) - cam.location).to_track_quat("-Z", "Y").to_euler()
sc.camera = cam
sc.render.filepath = a.out
bpy.ops.render.render(write_still=True)
print("DONE")
