"""Orthographic "projector" views of a tower stage for photo-projection texturing.

    blender -b -P scripts/blender/render_projectors.py -- --glb data/plates/tower-m8.raw.glb --out data/projectors/m8 \
        [--samples 24] [--tiles 1] [--views south,east,north,west,top,site]

For every view it writes render/<view>.png (RGBA, transparent background), <view>.json (the camera
frame: position, right/up/forward, width/height in metres) and an index projectors.json.
scripts/imagery/projectors.ts turns the renders into photographs; scripts/blender/project_photos.py maps
those photographs back onto the faces using the JSON, so nothing here may change without re-running both.

Lighting is deliberately uniform (grey world + a near-vertical sun) so all four facades reach the image
model with the same exposure; the photographs are re-lit in the web viewer anyway.
"""
import argparse
import json
import math
import os
import re
import sys

import bpy
from mathutils import Vector

ap = argparse.ArgumentParser()
ap.add_argument("--glb", required=True)
ap.add_argument("--out", required=True)
ap.add_argument("--samples", type=int, default=24)
ap.add_argument("--tiles", type=int, default=1, help="split each elevation into N vertical tiles (drift fallback)")
ap.add_argument("--views", default="south,east,north,west,top,site")
ap.add_argument("--margin", type=float, default=2.0, help="metres of frame around the building")
a = ap.parse_args(sys.argv[sys.argv.index("--") + 1:])

SITE = re.compile(r"^(Ground|SitePad|GravelYard|Road|Neighbour|Fence|Container|Rebar\d|Formstack|Crane|Jib|CounterWeight|Cab|Hoist|HookLoad)")
# What the empty-site orthophoto shows: the flat ground only (build_tower_pbr.py names).
SITE_VIEW = {"Ground", "SitePad", "GravelYard", "Ground_AsphaltPBR"}
SITE_FRAME = ((4.0, 0.0), 72.0, 54.0)  # centre, width, height in metres: the 60x46 m pad plus a grass margin
ELEV = (1024, 1536)
PORTRAIT = ELEV[1] / ELEV[0]


def world_bbox(objs):
    lo = Vector((1e9, 1e9, 1e9)); hi = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    return lo, hi


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.glb)
bpy.context.view_layer.update()
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
tower = [o for o in meshes if not SITE.match(o.name)]
lo, hi = world_bbox(tower)
print("tower bbox", tuple(round(v, 2) for v in lo), tuple(round(v, 2) for v in hi))
stage = os.path.basename(a.out.rstrip("/"))

sc = bpy.context.scene
w = bpy.data.worlds.new("W"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.82, 0.84, 0.87, 1)
w.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
bpy.ops.object.light_add(type="SUN")
sun = bpy.context.active_object
sun.data.energy = 1.2
sun.data.angle = math.radians(6)
sun.rotation_euler = (math.radians(12), 0, math.radians(45))  # 12 deg off vertical, on the diagonal
sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = a.samples
sc.cycles.use_denoising = True
sc.render.film_transparent = True
sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = "PNG"
sc.render.image_settings.color_mode = "RGBA"
sc.view_settings.view_transform = "Standard"
sc.view_settings.exposure = 0

cd = bpy.data.cameras.new("Proj")
cd.type = "ORTHO"
cd.sensor_fit = "HORIZONTAL"  # ortho_scale is then exactly the horizontal extent
cd.clip_start = 1
cd.clip_end = 1000
cam = bpy.data.objects.new("Proj", cd)
sc.collection.objects.link(cam)
sc.camera = cam

m = a.margin
cx, cy, cz = (lo.x + hi.x) / 2, (lo.y + hi.y) / 2, (lo.z + hi.z) / 2
ext_x, ext_y, ext_z = hi.x - lo.x, hi.y - lo.y, hi.z - lo.z
# name -> (camera location for the full frame, rotation_euler, horizontal extent of the building)
ELEVATIONS = {
    "south": ((cx, -300, cz), (90, 0, 0), ext_x),
    "east": ((300, cy, cz), (90, 0, 90), ext_y),
    "north": ((cx, 300, cz), (90, 0, 180), ext_x),
    "west": ((-300, cy, cz), (90, 0, -90), ext_y),
}


def frame_for(ext_h, ext_v):
    """Frame (width, height, resolution) that contains ext_h x ext_v metres plus the margin."""
    if ext_v + m <= ext_h + m:  # wider than tall (m4): square frame
        wd = ext_h + m
        return wd, wd, (1024, 1024)
    wd = max(ext_h + m, (ext_v + m) / PORTRAIT)
    return wd, wd * PORTRAIT, ELEV


views = []
for name in a.views.split(","):
    if name in ELEVATIONS:
        loc, rot, ext_h = ELEVATIONS[name]
        if a.tiles <= 1:
            wd, ht, res = frame_for(ext_h, ext_z)
            views.append(dict(name=name, kind="elevation", loc=loc, rot=rot, w=wd, h=ht, res=res, tile=0, z_range=(lo.z, hi.z)))
        else:
            span = ext_z + m
            ht = span / a.tiles + m  # tiles overlap by one margin
            wd = max(ext_h + m, ht / PORTRAIT)
            ht = wd * PORTRAIT
            for t in range(a.tiles):
                z0 = lo.z - m / 2 + t * (span / a.tiles)
                zc = min(max(z0 + ht / 2 - m / 2, lo.z - m / 2 + ht / 2), hi.z + m / 2 - ht / 2)
                views.append(dict(name=f"{name}_{t}", kind="elevation", loc=(loc[0], loc[1], zc), rot=rot, w=wd, h=ht, res=ELEV,
                                  tile=t, z_range=(zc - ht / 2, zc + ht / 2)))
    elif name == "top":
        wd = max(ext_x, ext_y) + m
        views.append(dict(name="top", kind="top", loc=(cx, cy, 400), rot=(0, 0, 0), w=wd, h=wd, res=(1024, 1024), tile=0, z_range=(lo.z, hi.z)))
    elif name == "site":
        (sx, sy), sw, sh = SITE_FRAME
        views.append(dict(name="site", kind="site", loc=(sx, sy, 400), rot=(0, 0, 0), w=sw, h=sh, res=(1024, 768), tile=0, z_range=(-1, 1)))
    else:
        raise SystemExit(f"unknown view {name}")

os.makedirs(os.path.join(a.out, "render"), exist_ok=True)
index = []
for v in views:
    site_view = v["kind"] == "site"
    for o in meshes:
        o.hide_render = (o.name not in SITE_VIEW) if site_view else bool(SITE.match(o.name))
    cam.location = v["loc"]
    cam.rotation_euler = tuple(math.radians(r) for r in v["rot"])
    cd.ortho_scale = v["w"]
    sc.render.resolution_x, sc.render.resolution_y = v["res"]
    bpy.context.view_layer.update()
    m3 = cam.matrix_world.to_3x3()
    right, up, fwd = m3 @ Vector((1, 0, 0)), m3 @ Vector((0, 1, 0)), -(m3 @ Vector((0, 0, 1)))
    png = f"render/{v['name']}.png"
    sc.render.filepath = os.path.join(a.out, png)
    bpy.ops.render.render(write_still=True)
    meta = dict(
        name=v["name"], stage=stage, kind=v["kind"], res=list(v["res"]), width_m=round(v["w"], 4), height_m=round(v["h"], 4),
        cam=[round(c, 4) for c in cam.matrix_world.translation], right=[round(c, 6) for c in right], up=[round(c, 6) for c in up],
        forward=[round(c, 6) for c in fwd], ortho_scale=round(cd.ortho_scale, 4), sensor_fit="HORIZONTAL", space="blender_zup",
        png=png, tile=v["tile"], z_range=[round(z, 3) for z in v["z_range"]],
    )
    with open(os.path.join(a.out, f"{v['name']}.json"), "w") as f:
        json.dump(meta, f, indent=1)
    index.append(meta)
    print("rendered", v["name"], v["res"], f"{v['w']:.1f}x{v['h']:.1f} m")

# The index lists every view rendered into this folder, not only this run's, so
# `--views top,site` can complete an interrupted run.
seen = {v["name"] for v in index}
for fn in sorted(os.listdir(a.out)):
    if fn.endswith(".json") and fn != "projectors.json":
        meta = json.load(open(os.path.join(a.out, fn)))
        if meta.get("name") not in seen and os.path.exists(os.path.join(a.out, meta.get("png", ""))):
            index.append(meta)
with open(os.path.join(a.out, "projectors.json"), "w") as f:
    json.dump(dict(stage=stage, glb=a.glb, bbox=[list(lo), list(hi)], views=index), f, indent=1)
print("DONE", a.out, [v["name"] for v in index])
