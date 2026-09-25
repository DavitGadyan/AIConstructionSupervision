"""
Procedural sample site for control.io demos.

Builds a 16-storey residential tower at a given construction stage, exports it
as GLB (the "3D reconstruction" for that flight) and renders drone-style shots.

    blender -b -P scripts/blender/build_tower.py -- \
        --structure 10 --envelope 6 --glazing 3 \
        --glb public/samples/tower-m6.glb --shots public/samples/m6 --seed 6

Everything here is synthetic and labelled as sample data in the product.
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
ap.add_argument("--floors", type=int, default=16)
ap.add_argument("--structure", type=int, required=True, help="floors with slab + columns complete")
ap.add_argument("--envelope", type=int, required=True, help="floors with facade walls")
ap.add_argument("--glazing", type=int, required=True, help="floors with windows installed")
ap.add_argument("--glb", required=True)
ap.add_argument("--shots", required=True)
ap.add_argument("--seed", type=int, default=1)
ap.add_argument("--samples", type=int, default=32)
ap.add_argument("--res", default="1600x1000")
args = ap.parse_args(argv)
random.seed(args.seed)

FLOOR_H = 3.2
W, D = 24.0, 16.0  # footprint, metres
COLS_X, COLS_Y = 6, 4

# ---------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def mat(name, color, rough=0.8, metal=0.0, alpha=1.0, transmission=0.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        m.blend_method = "BLEND" if hasattr(m, "blend_method") else None
    if transmission:
        bsdf.inputs["Transmission Weight"].default_value = transmission
    return m


M = {
    "concrete": mat("Concrete", (0.42, 0.42, 0.41), 0.9),
    "concrete_fresh": mat("ConcreteFresh", (0.30, 0.30, 0.30), 0.95),
    "facade": mat("FacadePanel", (0.60, 0.58, 0.54), 0.7),
    "glass": mat("Glass", (0.05, 0.12, 0.16), 0.08, 0.6),
    "frame": mat("Frame", (0.22, 0.24, 0.26), 0.4, 0.8),
    "formwork": mat("Formwork", (0.50, 0.28, 0.07), 0.8),
    "rebar": mat("Rebar", (0.35, 0.22, 0.14), 0.6, 0.6),
    "dirt": mat("Dirt", (0.22, 0.16, 0.10), 1.0),
    "gravel": mat("Gravel", (0.50, 0.48, 0.44), 1.0),
    "crane": mat("CraneYellow", (0.80, 0.50, 0.02), 0.5, 0.3),
    "container": mat("Container", (0.05, 0.45, 0.55), 0.6, 0.3),
    "container2": mat("ContainerGrey", (0.42, 0.45, 0.48), 0.6, 0.3),
    "fence": mat("Fence", (0.85, 0.87, 0.88), 0.5, 0.2),
    "asphalt": mat("Asphalt", (0.05, 0.05, 0.055), 0.9),
    "grass": mat("Grass", (0.10, 0.16, 0.06), 1.0),
    "scaffold": mat("Scaffold", (0.72, 0.74, 0.76), 0.5, 0.7),
    "net": mat("SafetyNet", (0.02, 0.16, 0.22), 0.9),
}


def box(name, size, loc, material, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(material)
    if parent:
        o.parent = parent
    return o


def empty(name):
    o = bpy.data.objects.new(name, None)
    scene.collection.objects.link(o)
    return o


tower = empty("Tower")
site = empty("Site")

# ---------------------------------------------------------------- ground
box("Ground", (140, 140, 0.2), (0, 0, -0.1), M["grass"], site)
box("SitePad", (60, 46, 0.22), (4, 0, -0.08), M["dirt"], site)
box("GravelYard", (18, 12, 0.24), (22, -14, -0.06), M["gravel"], site)
box("Road", (140, 9, 0.23), (0, -32, -0.07), M["asphalt"], site)
box("Road2", (9, 140, 0.23), (-40, 0, -0.07), M["asphalt"], site)

# neighbouring existing buildings for context
for i, (x, y, h, w, d) in enumerate([(-58, 30, 22, 20, 14), (-58, -8, 14, 18, 16), (40, 42, 18, 26, 12), (52, 8, 28, 14, 16)]):
    box(f"Neighbour{i}", (w, d, h), (x, y, h / 2), M["facade"], site)
    for f in range(int(h // 3.2)):
        box(f"NeighbourGlass{i}_{f}", (w + 0.05, d + 0.05, 1.3), (x, y, f * 3.2 + 1.9), M["glass"], site)

# fence around the pad
for sx in (-26, 34):
    box(f"FenceX{sx}", (0.1, 46, 2.0), (sx, 0, 1.0), M["fence"], site)
for sy in (-23, 23):
    box(f"FenceY{sy}", (60, 0.1, 2.0), (4, sy, 1.0), M["fence"], site)

# containers + material stacks
for i, (x, y, rot, m) in enumerate([(24, 18, 0, "container"), (24, 15, 0, "container2"), (29, 18, 0, "container")]):
    c = box(f"Container{i}", (6, 2.4, 2.6), (x, y, 1.3), M[m], site)
for i in range(5):
    box(f"Rebar{i}", (8, 0.3, 0.3), (18 + random.uniform(-1, 1), -14 + i * 0.6, 0.15), M["rebar"], site)
for i in range(4):
    box(f"Formstack{i}", (2.4, 1.2, 0.8), (26 + (i % 2) * 3, -12 - (i // 2) * 2, 0.4), M["formwork"], site)

# ---------------------------------------------------------------- tower
ox, oy = -W / 2, -D / 2
xs = [ox + i * W / (COLS_X - 1) for i in range(COLS_X)]
ys = [oy + j * D / (COLS_Y - 1) for j in range(COLS_Y)]

# foundation raft
box("Raft", (W + 2, D + 2, 1.0), (0, 0, 0.3), M["concrete"], tower)

top_struct = args.structure
for f in range(args.floors):
    z0 = f * FLOOR_H + 0.8
    fl = empty(f"Floor_{f + 1:02d}")
    fl.parent = tower
    if f < top_struct:
        # columns + slab
        for x in xs:
            for y in ys:
                box(f"Col_{f}_{x:.0f}_{y:.0f}", (0.5, 0.5, FLOOR_H - 0.3), (x, y, z0 + (FLOOR_H - 0.3) / 2), M["concrete"], fl)
        box(f"Slab_{f}", (W + 0.6, D + 0.6, 0.3), (0, 0, z0 + FLOOR_H - 0.15), M["concrete"], fl)
        # core (lift + stair) walls
        box(f"Core_{f}", (6, 5, FLOOR_H), (2, 0, z0 + FLOOR_H / 2), M["concrete"], fl)
    elif f == top_struct:
        # floor under construction: columns rising, formwork, rebar mats
        for x in xs:
            for y in ys:
                if random.random() < 0.7:
                    box(f"Col_{f}_{x:.0f}_{y:.0f}", (0.5, 0.5, FLOOR_H - 0.3), (x, y, z0 + (FLOOR_H - 0.3) / 2), M["concrete_fresh"], fl)
                else:
                    box(f"ColForm_{f}_{x:.0f}_{y:.0f}", (0.7, 0.7, FLOOR_H - 0.3), (x, y, z0 + (FLOOR_H - 0.3) / 2), M["formwork"], fl)
        box(f"Formdeck_{f}", (W * 0.55, D + 0.6, 0.12), (-W * 0.22, 0, z0 + FLOOR_H - 0.2), M["formwork"], fl)
        for k in range(10):
            box(f"RebarMat_{f}_{k}", (W * 0.5, 0.05, 0.05), (-W * 0.22, oy + 1 + k * 1.5, z0 + FLOOR_H - 0.1), M["rebar"], fl)
        box(f"Core_{f}", (6, 5, FLOOR_H), (2, 0, z0 + FLOOR_H / 2), M["concrete_fresh"], fl)
    elif f == top_struct + 1:
        # core jump-form leads by one storey
        box(f"CoreForm_{f}", (6.4, 5.4, FLOOR_H), (2, 0, z0 + FLOOR_H / 2), M["formwork"], fl)

    # envelope: facade spandrel panels
    if f < min(args.envelope, top_struct):
        for side, (sx, sy, lx, ly) in {"S": (0, oy - 0.3, W + 0.6, 0.2), "N": (0, -oy + 0.3, W + 0.6, 0.2),
                                      "W": (ox - 0.3, 0, 0.2, D + 0.6), "E": (-ox + 0.3, 0, 0.2, D + 0.6)}.items():
            box(f"Spandrel_{f}_{side}", (lx, ly, 1.0), (sx, sy, z0 + 0.5), M["facade"], fl)
            # piers between windows
            n = 8 if lx > ly else 5
            for k in range(n + 1):
                t = -0.5 + k / n
                px = sx + (t * lx if lx > ly else 0)
                py = sy + (t * ly if ly > lx else 0)
                box(f"Pier_{f}_{side}_{k}", (0.6 if lx > ly else 0.22, 0.22 if lx > ly else 0.6, FLOOR_H - 1.0),
                    (px, py, z0 + 1.0 + (FLOOR_H - 1.0) / 2), M["facade"], fl)
            if f < args.glazing:
                box(f"Glazing_{f}_{side}", (lx * 0.98 if lx > ly else 0.08, ly * 0.98 if ly > lx else 0.08, FLOOR_H - 1.1),
                    (sx, sy, z0 + 1.0 + (FLOOR_H - 1.1) / 2), M["glass"], fl)
    # safety net + scaffold on the 2 floors below the working deck
    if top_struct - 2 <= f < top_struct and f >= args.envelope:
        box(f"Net_{f}_S", (W + 1.4, 0.05, FLOOR_H), (0, oy - 0.9, z0 + FLOOR_H / 2), M["net"], fl)
        box(f"Net_{f}_E", (0.05, D + 1.4, FLOOR_H), (-ox + 0.9, 0, z0 + FLOOR_H / 2), M["net"], fl)

# roof plant when topped out
if top_struct >= args.floors:
    box("RoofPlant", (8, 6, 2.5), (2, 0, args.floors * FLOOR_H + 0.8 + 1.25), M["frame"], tower)

# ---------------------------------------------------------------- tower crane
crane = empty("Crane")
mast_h = max(args.floors, top_struct + 4) * FLOOR_H + 8
cx, cy = -W / 2 - 5, D / 2 + 4
box("CraneBase", (4, 4, 1.2), (cx, cy, 0.6), M["concrete"], crane)
for i in range(4):
    dx, dy = (i % 2) * 1.6 - 0.8, (i // 2) * 1.6 - 0.8
    box(f"CraneLeg{i}", (0.18, 0.18, mast_h), (cx + dx, cy + dy, mast_h / 2), M["crane"], crane)
for k in range(int(mast_h // 2)):
    box(f"CraneBrace{k}", (1.8, 1.8, 0.12), (cx, cy, k * 2 + 1), M["crane"], crane)
jib_ang = math.radians(20 + args.seed * 17)
jib_len, cjib = 45, 12
jx, jy = math.cos(jib_ang), math.sin(jib_ang)
jib = box("Jib", (jib_len + cjib, 1.2, 1.2), (cx + jx * (jib_len - cjib) / 2, cy + jy * (jib_len - cjib) / 2, mast_h + 1), M["crane"], crane)
jib.rotation_euler[2] = jib_ang
cw = box("CounterWeight", (3, 2, 2), (cx - jx * cjib, cy - jy * cjib, mast_h), M["concrete"], crane)
cw.rotation_euler[2] = jib_ang
box("Cab", (2.2, 2.2, 2.2), (cx, cy, mast_h - 0.6), M["frame"], crane)
hook_d = 22
box("Hoist", (0.05, 0.05, mast_h - 12), (cx + jx * hook_d, cy + jy * hook_d, (mast_h + 12) / 2), M["frame"], crane)
box("HookLoad", (2.4, 1.2, 1.0), (cx + jx * hook_d, cy + jy * hook_d, 12), M["rebar"], crane)

# build_tower_pbr.py reuses the geometry above and does its own export/render.
if not os.environ.get("CIO_GEOMETRY_ONLY"):
    # ---------------------------------------------------------------- export GLB
    os.makedirs(os.path.dirname(os.path.abspath(args.glb)), exist_ok=True)
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=args.glb, export_format="GLB", use_selection=False,
                              export_apply=True, export_yup=True, export_extras=True)

    # ---------------------------------------------------------------- render drone shots
    world = bpy.data.worlds.new("Sky")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    # soft overcast-to-blue gradient: reads as daylight without blowing out the concrete
    grad = nt.nodes.new("ShaderNodeTexGradient")
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (0.78, 0.82, 0.86, 1)
    ramp.color_ramp.elements[1].color = (0.36, 0.55, 0.78, 1)
    nt.links.new(coord.outputs["Generated"], sep.inputs[0])
    nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], nt.nodes["Background"].inputs["Color"])
    nt.nodes["Background"].inputs["Strength"].default_value = 0.9

    bpy.ops.object.light_add(type="SUN", location=(0, 0, 50))
    sun = bpy.context.active_object
    sun.data.energy = 3.2
    sun.data.angle = math.radians(2)
    sun.rotation_euler = (math.radians(52), 0, math.radians(140 + args.seed * 4))

    scene.render.engine = "CYCLES"
    scene.cycles.samples = args.samples
    scene.cycles.use_denoising = True
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        scene.cycles.device = "GPU"
    except Exception:
        pass
    rx, ry = (int(v) for v in args.res.split("x"))
    scene.render.resolution_x, scene.render.resolution_y = rx, ry
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 88
    scene.view_settings.view_transform = "AgX" if "AgX" in [i.identifier for i in scene.view_settings.bl_rna.properties["view_transform"].enum_items] else "Filmic"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = -0.6

    tower_h = top_struct * FLOOR_H


    def shoot(name, loc, target, lens=24):
        cam_data = bpy.data.cameras.new(name)
        cam_data.lens = lens
        cam = bpy.data.objects.new(name, cam_data)
        scene.collection.objects.link(cam)
        cam.location = loc
        direction = Vector(target) - Vector(loc)
        cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        scene.camera = cam
        scene.render.filepath = os.path.join(args.shots, f"{name}.jpg")
        bpy.ops.render.render(write_still=True)


    os.makedirs(args.shots, exist_ok=True)
    mid = (0, 0, tower_h * 0.45)
    shoot("orbit-sw", (-62, -70, tower_h + 30), mid, 26)
    shoot("orbit-se", (72, -58, tower_h + 22), mid, 26)
    shoot("orbit-ne", (60, 66, tower_h + 34), mid, 26)
    shoot("facade-s", (0, -44, tower_h * 0.55), (0, 0, tower_h * 0.5), 20)
    shoot("nadir", (0.01, 0.01, tower_h + 95), (0, 0, 0), 22)
    shoot("deck", (-20, -26, tower_h + 12), (0, 0, tower_h), 22)
    print("DONE", args.glb, args.shots)
