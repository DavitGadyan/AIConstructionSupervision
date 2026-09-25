"""
Synthetic solar-farm drone shots for the Solar inspection service:
an RGB view and a false-colour thermal view with typical defect classes
(single hot cell, hot substring / bypass diode, disconnected string, soiling).

    blender -b -P scripts/blender/build_solar.py -- --out public/samples/solar
"""
import argparse
import math
import os
import random
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--samples", type=int, default=24)
ap.add_argument("--res", default="1600x1000")
args = ap.parse_args(argv)
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def principled(name, color, rough=0.5, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    return m


def emissive(name, color, strength=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*color, 1)
    em.inputs["Strength"].default_value = strength
    nt.links.new(em.outputs[0], out.inputs[0])
    return m


def box(name, size, loc, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return o


# RGB materials
RGB = {
    "ground": principled("Ground", (0.23, 0.26, 0.14), 1.0),
    "track": principled("Track", (0.36, 0.30, 0.22), 1.0),
    "panel": principled("Panel", (0.02, 0.04, 0.09), 0.15, 0.2),
    "panel_dirty": principled("PanelDirty", (0.16, 0.14, 0.11), 0.7),
    "frame": principled("Frame", (0.7, 0.72, 0.74), 0.3, 0.9),
    "inverter": principled("Inverter", (0.85, 0.86, 0.86), 0.4),
}
# Thermal palette (ironbow-ish): cool module, warm cell, hot cell
TH = {
    "ground": emissive("ThGround", (0.30, 0.06, 0.30), 1.0),
    "track": emissive("ThTrack", (0.45, 0.08, 0.28), 1.0),
    "panel": emissive("ThPanel", (0.10, 0.02, 0.22), 1.0),
    "frame": emissive("ThFrame", (0.20, 0.03, 0.30), 1.0),
    "warm": emissive("ThWarm", (0.95, 0.35, 0.05), 1.0),
    "hot": emissive("ThHot", (1.0, 0.95, 0.55), 1.6),
    "string_off": emissive("ThStringOff", (0.70, 0.18, 0.10), 1.0),
    "inverter": emissive("ThInverter", (0.98, 0.60, 0.10), 1.2),
}

objs = []  # (object, rgb material key, thermal material key)


def add(o, rgb_key, th_key):
    o.data.materials.append(RGB[rgb_key])
    objs.append((o, rgb_key, th_key))


add(box("Ground", (160, 120, 0.2), (0, 0, -0.1)), "ground", "ground")
for i in range(3):
    add(box(f"Track{i}", (160, 3, 0.22), (0, -40 + i * 40, -0.08)), "track", "track")

ROWS, MODS = 12, 24
tilt = math.radians(25)
defects = {(2, 5): "hot", (4, 17): "hot", (7, 9): "warm", (9, 20): "hot", (5, 3): "warm"}
off_string = (6, range(12, 24))  # row 6, modules 12..23 disconnected
soiled_row = 10
for r in range(ROWS):
    y = -44 + r * 8
    for m in range(MODS):
        x = -52 + m * 2.2 + (4 if m >= 12 else 0)
        o = box(f"Mod_{r}_{m}", (2.0, 1.1, 0.04), (x, y, 1.3), (tilt, 0, 0))
        th = "panel"
        if (r, m) in defects:
            th = defects[(r, m)]
        if r == off_string[0] and m in off_string[1]:
            th = "string_off"
        rgb = "panel_dirty" if (r == soiled_row and m < 7) else "panel"
        if rgb == "panel_dirty":
            th = "warm"
        add(o, rgb, th)
        if th == "hot":
            # hot cell: small bright square on the module
            c = box(f"HotCell_{r}_{m}", (0.32, 0.22, 0.05), (x + random.uniform(-0.6, 0.6), y + 0.05, 1.33), (tilt, 0, 0))
            add(c, "panel", "hot")
    add(box(f"Rail_{r}", (57, 0.08, 0.08), (-0, y - 0.5, 0.9)), "frame", "frame")
for i, x in enumerate((-60, 60)):
    add(box(f"Inverter{i}", (2.5, 1.2, 2.2), (x, 0, 1.1)), "inverter", "inverter")

# world + light + camera
world = bpy.data.worlds.new("Sky")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.55, 0.66, 0.8, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8
bpy.ops.object.light_add(type="SUN")
sun = bpy.context.active_object
sun.data.energy = 3.0
sun.rotation_euler = (math.radians(40), 0, math.radians(200))

scene.render.engine = "CYCLES"
scene.cycles.samples = args.samples
scene.cycles.use_denoising = True
rx, ry = (int(v) for v in args.res.split("x"))
scene.render.resolution_x, scene.render.resolution_y = rx, ry
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 88
scene.view_settings.exposure = -0.4

cam_data = bpy.data.cameras.new("Cam")
cam_data.lens = 28
cam = bpy.data.objects.new("Cam", cam_data)
scene.collection.objects.link(cam)
cam.location = (-38, -78, 46)
cam.rotation_euler = (Vector((4, 0, 0)) - cam.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = cam

os.makedirs(args.out, exist_ok=True)
scene.render.filepath = os.path.join(args.out, "rgb.jpg")
bpy.ops.render.render(write_still=True)

# thermal pass: swap to emissive palette, kill lights, standard view
for o, _, th in objs:
    o.data.materials[0] = TH[th]
sun.data.energy = 0
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.05, 0.0, 0.08, 1)
scene.view_settings.view_transform = "Standard"
scene.view_settings.exposure = 0
scene.render.filepath = os.path.join(args.out, "thermal.jpg")
bpy.ops.render.render(write_still=True)
print("DONE", args.out)
