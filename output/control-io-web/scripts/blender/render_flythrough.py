"""Drone point-of-view fly-through of a photo-textured stage: take-off at the site cabins, a rising orbit
through the capture positions of the sample flight (build_tower_pbr.py shoot()), a south-facade pass and a
nadir over the working deck. Frames go to --out; scripts/render-flythrough.sh encodes them.

    blender -b -P scripts/blender/render_flythrough.py -- --glb data/plates/tower-m8.photo.raw.glb \
        --hdri data/polyhaven/sky_2k.hdr --out data/flythrough/frames [--frames 192] [--res 1280x720] [--engine EEVEE]
"""
import argparse
import math
import os
import sys

import bpy
from mathutils import Vector

ap = argparse.ArgumentParser()
ap.add_argument("--glb", required=True)
ap.add_argument("--hdri", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--frames", type=int, default=192)
ap.add_argument("--res", default="1280x720")
ap.add_argument("--engine", default="EEVEE", choices=["EEVEE", "CYCLES"])
ap.add_argument("--samples", type=int, default=12)
a = ap.parse_args(sys.argv[sys.argv.index("--") + 1:])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.glb)
sc = bpy.context.scene

# sky + sun matching the HDRI's sun direction roughly (soft, high)
w = bpy.data.worlds.new("Sky"); sc.world = w; w.use_nodes = True
nt = w.node_tree
env = nt.nodes.new("ShaderNodeTexEnvironment"); env.image = bpy.data.images.load(a.hdri)
nt.links.new(env.outputs["Color"], nt.nodes["Background"].inputs["Color"])
nt.nodes["Background"].inputs["Strength"].default_value = 1.0
bpy.ops.object.light_add(type="SUN"); sun = bpy.context.active_object
sun.data.energy = 2.2; sun.data.angle = math.radians(3); sun.rotation_euler = (math.radians(40), 0, math.radians(35))

if a.engine == "EEVEE":
    sc.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items] else "BLENDER_EEVEE"
    ee = sc.eevee
    for attr, val in (("taa_render_samples", 16), ("use_shadows", True), ("use_raytracing", False)):
        if hasattr(ee, attr):
            setattr(ee, attr, val)
else:
    sc.render.engine = "CYCLES"; sc.cycles.samples = a.samples; sc.cycles.use_denoising = True
rx, ry = (int(v) for v in a.res.split("x"))
sc.render.resolution_x, sc.render.resolution_y = rx, ry
sc.render.image_settings.file_format = "JPEG"; sc.render.image_settings.quality = 92
sc.view_settings.view_transform = "AgX"
sc.view_settings.exposure = -0.2
sc.frame_start, sc.frame_end = 1, a.frames

tower = [o for o in bpy.data.objects if o.type == "MESH" and o.name.startswith(("F", "Slab_", "Raft", "CoreForm"))]
top = max((o.matrix_world @ Vector(c)).z for o in tower for c in o.bound_box)
H = top
mid = (0, 0, H * 0.45)

# (time 0..1, camera position, look-at target) in Blender Z-up metres
KEYS = [
    (0.00, (-24, 20, 2.5), (-10, 4, 6)),              # on the ground by the site cabins
    (0.12, (-40, -30, 22), mid),                       # take-off, turning towards the tower
    (0.30, (-62, -70, H + 30), mid),                   # capture: orbit south-west
    (0.48, (0, -92, H + 26), mid),                     # orbit south
    (0.62, (72, -58, H + 22), mid),                    # capture: orbit south-east
    (0.76, (18, -44, H * 0.55), (0, 0, H * 0.5)),      # capture: south facade pass
    (0.88, (4, -14, H + 40), (0, 0, H)),               # climb over the deck
    (1.00, (0.01, 0.01, H + 95), (0, 0, 0)),           # capture: nadir
]


def catmull(p0, p1, p2, p3, t):
    t2, t3 = t * t, t * t * t
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)


def sample(u, idx):
    pts = [Vector(k[idx]) for k in KEYS]
    ts = [k[0] for k in KEYS]
    i = max(0, min(len(ts) - 2, next((j for j in range(len(ts) - 1) if ts[j] <= u <= ts[j + 1]), len(ts) - 2)))
    t = (u - ts[i]) / (ts[i + 1] - ts[i])
    t = t * t * (3 - 2 * t)  # ease each leg
    p0, p3 = pts[max(0, i - 1)], pts[min(len(pts) - 1, i + 2)]
    return catmull(p0, pts[i], pts[i + 1], p3, t)


cd = bpy.data.cameras.new("Drone"); cd.lens = 24; cd.clip_end = 3000
cam = bpy.data.objects.new("Drone", cd); sc.collection.objects.link(cam); sc.camera = cam
os.makedirs(a.out, exist_ok=True)
for f in range(1, a.frames + 1):
    u = (f - 1) / (a.frames - 1)
    pos, tgt = sample(u, 1), sample(u, 2)
    cam.location = pos
    cam.rotation_euler = (tgt - pos).to_track_quat("-Z", "Y").to_euler()
    sc.frame_set(f)
    sc.render.filepath = os.path.join(a.out, f"{f:04d}.jpg")
    bpy.ops.render.render(write_still=True)
    if f % 24 == 0:
        print("frame", f, flush=True)
print("DONE", a.out)
