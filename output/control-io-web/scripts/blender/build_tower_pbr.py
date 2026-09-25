"""
Photoreal (PBR) version of the demo tower.

Reuses build_tower.py's geometry (same stages, same node names, so the mesh
measurement in lib/server/glb.ts still finds the slabs), then:
  - swaps flat colours for CC0 Poly Haven materials (data/polyhaven, see
    fetch_polyhaven.py) with metre-scaled box UVs,
  - bevels the concrete so edges catch light,
  - adds site detail (scaffold, props, pallets, cabins, puddle, crack decal),
  - joins meshes per storey+material (few draw calls on the web),
  - exports GLB and renders drone plates in Cycles under a real HDRI sky.

    blender -b -P scripts/blender/build_tower_pbr.py -- --structure 12 --envelope 7 --glazing 4 \
        --glb public/samples/tower-m8.glb --shots data/plates/m8 --seed 8
"""
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.abspath(os.path.join(HERE, "..", "..", "data", "polyhaven"))

# ------------------------------------------------------------------ geometry
os.environ["CIO_GEOMETRY_ONLY"] = "1"
src = open(os.path.join(HERE, "build_tower.py")).read()
g = {"__name__": "__cio_geometry__", "__file__": os.path.join(HERE, "build_tower.py")}
exec(compile(src, "build_tower.py", "exec"), g)
args, scene, FLOOR_H, W, D = g["args"], g["scene"], g["FLOOR_H"], g["W"], g["D"]
extra = sys.argv[sys.argv.index("--") + 1:]
SAMPLES = int(extra[extra.index("--samples") + 1]) if "--samples" in extra else 96
RES = (extra[extra.index("--res") + 1] if "--res" in extra else "1536x1024").split("x")
random.seed(args.seed + 100)


# ------------------------------------------------------------------ materials
def img(name, colorspace="sRGB"):
    path = os.path.join(TEX, name)
    if not os.path.exists(path):
        return None
    im = bpy.data.images.load(path, check_existing=True)
    im.colorspace_settings.name = colorspace
    return im


def pbr(name, key, tint=None, rough=None, metal=0.0, normal_strength=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    b.inputs["Metallic"].default_value = metal
    diff, nor, rgh = img(f"{key}_diff.jpg"), img(f"{key}_nor.jpg", "Non-Color"), img(f"{key}_rough.jpg", "Non-Color")
    if diff:
        t = nt.nodes.new("ShaderNodeTexImage"); t.image = diff
        if tint:
            mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"
            mix.inputs["Factor"].default_value = 1.0
            mix.inputs[7].default_value = (*tint, 1)
            nt.links.new(t.outputs["Color"], mix.inputs[6])
            nt.links.new(mix.outputs[2], b.inputs["Base Color"])
        else:
            nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    elif tint:
        b.inputs["Base Color"].default_value = (*tint, 1)
    if rgh and rough is None:
        t = nt.nodes.new("ShaderNodeTexImage"); t.image = rgh
        nt.links.new(t.outputs["Color"], b.inputs["Roughness"])
    else:
        b.inputs["Roughness"].default_value = rough if rough is not None else 0.8
    if nor:
        t = nt.nodes.new("ShaderNodeTexImage"); t.image = nor
        nm = nt.nodes.new("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = normal_strength
        nt.links.new(t.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    return m


def glass():
    m = bpy.data.materials.new("GlassPBR")
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.04, 0.07, 0.09, 1)
    b.inputs["Metallic"].default_value = 0.35
    b.inputs["Roughness"].default_value = 0.04
    b.inputs["Specular IOR Level"].default_value = 0.9
    return m


# textures are ~2 m (walls) or ~4 m (ground) per tile
TILE = {"concrete": 2.0, "concrete_fresh": 2.0, "facade": 2.4, "neighbour": 3.0, "plywood": 1.2, "rust": 1.0,
        "paint_metal": 1.5, "container": 3.0, "mud": 5.0, "gravel": 3.0, "asphalt": 4.0, "grass": 8.0, "net": 1.0}

NEW = {
    "Concrete": ("concrete", pbr("ConcretePBR", "concrete")),
    "ConcreteFresh": ("concrete_fresh", pbr("ConcreteFreshPBR", "concrete_fresh", tint=(0.8, 0.8, 0.82))),
    "FacadePanel": ("facade", pbr("FacadePBR", "facade", tint=(1.05, 1.03, 1.0))),
    "Glass": (None, glass()),
    "Frame": ("paint_metal", pbr("FramePBR", "paint_metal", tint=(0.25, 0.27, 0.29), metal=0.6)),
    "Formwork": ("plywood", pbr("PlywoodPBR", "plywood")),
    "Rebar": ("rust", pbr("RebarPBR", "rust", metal=0.7)),
    "Dirt": ("mud", pbr("MudPBR", "mud")),
    "Gravel": ("gravel", pbr("GravelPBR", "gravel")),
    "CraneYellow": ("paint_metal", pbr("CranePBR", "paint_metal", tint=(0.95, 0.62, 0.04), metal=0.5)),
    "Container": ("container", pbr("ContainerPBR", "container", tint=(0.35, 0.75, 0.85), metal=0.4)),
    "ContainerGrey": ("container", pbr("ContainerGreyPBR", "container", metal=0.4)),
    "Fence": ("paint_metal", pbr("FencePBR", "paint_metal", tint=(0.9, 0.92, 0.93), metal=0.3)),
    "Asphalt": ("asphalt", pbr("AsphaltPBR", "asphalt")),
    "Grass": ("grass", pbr("GrassPBR", "grass")),
    "Scaffold": ("paint_metal", pbr("ScaffoldPBR", "paint_metal", tint=(0.8, 0.82, 0.84), metal=0.8)),
    "SafetyNet": ("net", pbr("NetPBR", "net", tint=(0.12, 0.45, 0.55))),
}
NEIGHBOUR = ("neighbour", pbr("NeighbourPBR", "neighbour"))


# ------------------------------------------------------------------ helpers
def box_uv(obj, tile):
    """Metre-scaled box projection UVs, so textures keep real-world size."""
    me = obj.data
    bm = bmesh.new(); bm.from_mesh(me)
    uv = bm.loops.layers.uv.verify()
    mw = obj.matrix_world
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            co = mw @ l.vert.co
            u, v = [(co.y, co.z), (co.x, co.z), (co.x, co.y)][ax]
            l[uv].uv = (u / tile, v / tile)
    bm.to_mesh(me); bm.free()


def add_box(name, size, loc, mat_key, parent):
    o = g["box"](name, size, loc, bpy.data.materials.get(mat_key) or bpy.data.materials["Concrete"], parent)
    return o


# ------------------------------------------------------------------ extra site detail
tower = bpy.data.objects["Tower"]
site = bpy.data.objects["Site"]
top = args.structure
ox, oy = -W / 2, -D / 2
# perimeter scaffold on the two storeys below the deck (south + east), with toe boards
for f in range(max(0, top - 2), top + 1):
    z0 = f * FLOOR_H + 0.8
    parent = bpy.data.objects.get(f"Floor_{f + 1:02d}") or tower
    for k in range(13):
        x = ox - 0.6 + k * (W + 1.2) / 12
        add_box(f"ScafPost_{f}_S{k}", (0.06, 0.06, FLOOR_H), (x, oy - 1.4, z0 + FLOOR_H / 2), "Scaffold", parent)
    for h in (0.1, 1.0, 2.0):
        add_box(f"ScafRail_{f}_S{h}", (W + 1.3, 0.05, 0.05), (0, oy - 1.4, z0 + h), "Scaffold", parent)
    add_box(f"ScafBoard_{f}_S", (W + 1.2, 0.9, 0.04), (0, oy - 1.0, z0 + 0.02), "Formwork", parent)
# props (back-props) under the freshest slab
if top > 0:
    z0 = (top - 1) * FLOOR_H + 0.8
    parent = bpy.data.objects.get(f"Floor_{top:02d}") or tower
    for i in range(8):
        for j in range(4):
            add_box(f"Prop_{i}_{j}", (0.08, 0.08, FLOOR_H - 0.35), (ox + 2 + i * 2.8, oy + 2 + j * 3.8, z0 + (FLOOR_H - 0.35) / 2), "Scaffold", parent)
# pallets, cabins, bags, puddle at the crane base
for i in range(6):
    add_box(f"Container_pallet{i}", (1.2, 1.0, 0.9), (14 + (i % 3) * 1.6, -18 + (i // 3) * 1.4, 0.45), "Formwork", site)
for i in range(3):
    add_box(f"Container_cabin{i}", (6, 2.5, 2.7), (-22 + i * 6.4, 18.5, 1.35), "ContainerGrey" if i % 2 else "Container", site)
cx, cy = -W / 2 - 5, D / 2 + 4
pud = add_box("Ground_puddle", (7.5, 5.5, 0.02), (cx + 1.5, cy - 0.5, 0.15), "Glass", site)

# a ground big enough that no camera sees its edge
gnd = bpy.data.objects["Ground"]
gnd.scale = (6, 6, 1)
bpy.context.view_layer.objects.active = gnd
bpy.ops.object.select_all(action="DESELECT"); gnd.select_set(True)
bpy.ops.object.transform_apply(scale=True)

# ------------------------------------------------------------------ materials, UVs, bevels
for o in list(bpy.data.objects):
    if o.type != "MESH" or not o.data.materials:
        continue
    old = o.data.materials[0].name
    key, mat = NEIGHBOUR if o.name.startswith("Neighbour") and old == "FacadePanel" else NEW.get(old, (None, None))
    if mat is None:
        continue
    o.data.materials[0] = mat
    box_uv(o, TILE.get(key, 2.0) if key else 2.0)
    dims = o.dimensions
    if old in ("Concrete", "ConcreteFresh", "FacadePanel") and min(dims) > 0.15 and not o.name.startswith(("Ground", "Neighbour")):
        bev = o.modifiers.new("bevel", "BEVEL"); bev.width = 0.025; bev.segments = 2; bev.limit_method = "ANGLE"

# ------------------------------------------------------------------ join per storey + material (draw calls)
def join_children(parent, prefix):
    by_mat = {}
    for c in list(parent.children):
        if c.type == "MESH" and not c.name.startswith("Slab_") and c.data.materials:
            by_mat.setdefault(c.data.materials[0].name, []).append(c)
    for mat_name, objs in by_mat.items():
        if len(objs) < 2:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for o in objs:
            for m in o.modifiers:
                bpy.context.view_layer.objects.active = o
                bpy.ops.object.modifier_apply(modifier=m.name)
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()
        objs[0].name = f"{prefix}_{mat_name}"


for f in range(args.floors + 1):
    fl = bpy.data.objects.get(f"Floor_{f + 1:02d}")
    if fl:
        join_children(fl, f"F{f + 1:02d}")
join_children(site, "Ground")  # site meshes keep a SITE-regex prefix so the web viewer can hide them
crane = bpy.data.objects.get("Crane")
if crane:
    join_children(crane, "Crane")
# neighbours were joined into Ground_*: split them back out by name for clarity is unnecessary for the viewer

# ------------------------------------------------------------------ export
os.makedirs(os.path.dirname(os.path.abspath(args.glb)), exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=args.glb, export_format="GLB", use_selection=False, export_apply=True,
                          export_yup=True, export_image_format="JPEG", export_jpeg_quality=82)

# ------------------------------------------------------------------ render drone plates (HDRI sky)
world = bpy.data.worlds.new("HDRI")
scene.world = world
world.use_nodes = True
nt = world.node_tree
env = nt.nodes.new("ShaderNodeTexEnvironment")
env.image = bpy.data.images.load(os.path.join(TEX, "sky_2k.hdr"))
nt.links.new(env.outputs["Color"], nt.nodes["Background"].inputs["Color"])
nt.nodes["Background"].inputs["Strength"].default_value = 1.0

bpy.ops.object.light_add(type="SUN")
sun = bpy.context.active_object
sun.data.energy = 3.5
sun.data.angle = math.radians(1.5)
sun.rotation_euler = (math.radians(50), 0, math.radians(140 + args.seed * 4))

scene.render.engine = "CYCLES"
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"; prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = "GPU"
except Exception:
    pass
scene.render.resolution_x, scene.render.resolution_y = int(RES[0]), int(RES[1])
scene.render.image_settings.file_format = "PNG"
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast" if "AgX - Medium High Contrast" in [i.identifier for i in scene.view_settings.bl_rna.properties["look"].enum_items] else "None"
scene.view_settings.exposure = -0.2
scene.render.use_motion_blur = False

tower_h = top * FLOOR_H


def shoot(name, loc, target, lens=24):
    cd = bpy.data.cameras.new(name); cd.lens = lens
    cam = bpy.data.objects.new(name, cd); scene.collection.objects.link(cam)
    cam.location = loc
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    scene.render.filepath = os.path.join(args.shots, f"{name}.png")
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
