"""Map the photographs from scripts/imagery/projectors.ts back onto the exact tower geometry.

    blender -b -P scripts/blender/project_photos.py -- --glb data/plates/tower-m8.raw.glb \
        --proj data/projectors/m8 --common data/projectors/common --out data/plates/tower-m8.photo.raw.glb

Every tower face picks the projector (south/east/north/west/top) that looks at it most directly and, if
nothing in the tower blocks the view to that camera, gets that photograph as its texture with UVs computed
from the orthographic camera frame in <view>.json. Faces no camera sees (undersides, interiors, anything
behind glazing or netting) keep their PBR material and box UVs, which is also what the floor slicer reveals.
Thin geometry (scaffold tubes, rebar, boards) keeps PBR too: painted onto the facade it would read as a
shadow. The site pad gets the empty-site orthophoto, the neighbour blocks get tileable photo textures,
the grass is tinted to the orthophoto's margin. Object names, in particular Slab_<n>, are untouched, so
lib/server/glb.ts keeps measuring storeys on the exported file.
"""
import argparse
import json
import os
import re
import sys

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ap = argparse.ArgumentParser()
ap.add_argument("--glb", required=True)
ap.add_argument("--proj", required=True, help="data/projectors/<stage> (render_projectors.py + projectors.ts output)")
ap.add_argument("--common", default="data/projectors/common", help="neighbour_wall.jpg / neighbour_roof.jpg")
ap.add_argument("--out", required=True)
ap.add_argument("--min-dot", type=float, default=0.35, help="a face needs at least this alignment with a camera")
ap.add_argument("--roughness", type=float, default=0.85)
a = ap.parse_args(sys.argv[sys.argv.index("--") + 1:])

SITE = re.compile(r"^(Ground|SitePad|GravelYard|Road|Neighbour|Fence|Container|Rebar\d|Formstack|Crane|Jib|CounterWeight|Cab|Hoist|HookLoad)")
THIN = re.compile(r"^(F\d\d_(ScaffoldPBR|RebarPBR)|ScafBoard_)")
# Window glass keeps its reflective PBR material: the image model paints glazed storeys as solid wall,
# and real glass on a drone scan reflects the sky anyway.
GLASS = re.compile(r"^F\d\d_GlassPBR")
GROUND_TOP = {"SitePad", "GravelYard"}


class Projector:
    def __init__(self, meta, image):
        self.name = meta["name"]
        self.kind = meta["kind"]
        self.cam = Vector(meta["cam"])
        self.right = Vector(meta["right"])
        self.up = Vector(meta["up"])
        self.fwd = Vector(meta["forward"])
        self.w = meta["width_m"]
        self.h = meta["height_m"]
        self.z0, self.z1 = meta["z_range"]
        self.image = image
        self.mats = {}
        self.faces = 0

    def uv(self, p):
        d = p - self.cam
        return (d.dot(self.right) / self.w + 0.5, d.dot(self.up) / self.h + 0.5)

    def material(self, glass):
        key = "glass" if glass else "flat"
        if key not in self.mats:
            m = bpy.data.materials.new(f"Proj_{self.name}" + ("_glass" if glass else ""))
            m.use_nodes = True
            nt = m.node_tree
            b = nt.nodes["Principled BSDF"]
            t = nt.nodes.new("ShaderNodeTexImage")
            t.image = self.image
            t.extension = "EXTEND"
            nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
            b.inputs["Roughness"].default_value = 0.25 if glass else a.roughness
            b.inputs["Metallic"].default_value = 0.3 if glass else 0.0
            self.mats[key] = m
        return self.mats[key]


def tile_material(name, path, rough=0.9):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = bpy.data.images.load(path, check_existing=True)
    nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = rough
    return m


def slot_index(me, mat):
    for i, m in enumerate(me.materials):
        if m == mat:
            return i
    me.materials.append(mat)
    return len(me.materials) - 1


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=a.glb)
bpy.context.view_layer.update()
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
tower = [o for o in meshes if not SITE.match(o.name)]
slabs_before = sorted(o.name for o in bpy.data.objects if o.name.startswith("Slab_"))

# ---- projectors: only the views that were photographed
index = json.load(open(os.path.join(a.proj, "projectors.json")))
projectors = []
for meta in index["views"]:
    jpg = os.path.join(a.proj, "photo", f"{meta['name']}.jpg")
    if not os.path.exists(jpg):
        print("no photo for", meta["name"], "- skipped")
        continue
    im = bpy.data.images.load(jpg, check_existing=True)
    im.colorspace_settings.name = "sRGB"
    projectors.append(Projector(meta, im))
elevations = [p for p in projectors if p.kind != "site"]
site_proj = next((p for p in projectors if p.kind == "site"), None)
print("projectors:", [p.name for p in projectors])

# ---- occluders: every tower mesh except thin geometry, one BVH in world space
verts, polys, off = [], [], 0
for o in tower:
    if THIN.match(o.name):
        continue
    mw = o.matrix_world
    me = o.data
    verts.extend(mw @ v.co for v in me.vertices)
    polys.extend([off + i for i in p.vertices] for p in me.polygons)
    off += len(me.vertices)
bvh = BVHTree.FromPolygons(verts, polys, all_triangles=False)


def pick(n, c):
    """Best projector for a face with world normal n and centre c, or None if none sees it."""
    best, bd = None, a.min_dot
    for p in elevations:
        d = n.dot(-p.fwd)
        if d <= bd:
            continue
        if p.kind == "elevation" and not (p.z0 - 0.5 <= c.z <= p.z1 + 0.5):
            continue  # tiled elevations: only the tile whose band contains the face
        best, bd = p, d
    if best is None:
        return None
    hit = bvh.ray_cast(c + n * 0.02, -best.fwd, 1000.0)
    return None if hit[0] is not None else best


# ---- tower faces
counts = {"pbr": 0}
for o in tower:
    if THIN.match(o.name) or GLASS.match(o.name):
        continue
    me = o.data
    glass = False
    mw = o.matrix_world
    nm = mw.to_3x3().inverted_safe().transposed()
    bm = bmesh.new(); bm.from_mesh(me); bm.normal_update()
    uv = bm.loops.layers.uv.verify()
    slots = {}
    for f in bm.faces:
        n = (nm @ f.normal).normalized()
        c = mw @ f.calc_center_median()
        p = pick(n, c)
        if p is None:
            counts["pbr"] += 1
            continue
        key = (p.name, glass)
        if key not in slots:
            slots[key] = slot_index(me, p.material(glass))
        f.material_index = slots[key]
        for l in f.loops:
            l[uv].uv = p.uv(mw @ l.vert.co)
        p.faces += 1
        counts[p.name] = counts.get(p.name, 0) + 1
    bm.to_mesh(me); bm.free()
print("faces per projector:", counts)

# ---- faces no camera saw that use the beige facade-panel scan (panel ends, backs seen through openings):
# the photographs show the panels as grey precast concrete, so the fallback follows them
facade, concrete = bpy.data.materials.get("FacadePBR"), bpy.data.materials.get("ConcretePBR")
if facade and concrete:
    def base_tex(mat):
        for n in mat.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image and "diff" in n.image.name.lower() or (n.type == "TEX_IMAGE" and n.image and n.image.colorspace_settings.name == "sRGB"):
                return n
        return None
    ft, ct = base_tex(facade), base_tex(concrete)
    if ft and ct:
        ft.image = ct.image
        for n in facade.node_tree.nodes:
            if n.type == "MIX" and n.blend_type == "MULTIPLY":
                n.inputs[7].default_value = (0.92, 0.92, 0.92, 1)
        print("facade fallback -> concrete")

# ---- ground: the empty-site orthophoto on the pad and gravel yard (top faces only)
if site_proj is not None:
    for o in meshes:
        if o.name not in GROUND_TOP:
            continue
        me = o.data
        mw = o.matrix_world
        bm = bmesh.new(); bm.from_mesh(me); bm.normal_update()
        uv = bm.loops.layers.uv.verify()
        slot = None
        for f in bm.faces:
            if f.normal.z < 0.9:
                continue
            if slot is None:
                slot = slot_index(me, site_proj.material(False))
            f.material_index = slot
            for l in f.loops:
                l[uv].uv = site_proj.uv(mw @ l.vert.co)
        bm.to_mesh(me); bm.free()

# ---- grass: the CC0 scan re-coloured to the orthophoto's margin (projectors.ts writes photo/grass.jpg)
grass_path = os.path.join(a.proj, "photo", "grass.jpg")
grass = bpy.data.materials.get("GrassPBR")
if grass and os.path.exists(grass_path):
    nt = grass.node_tree
    b = nt.nodes.get("Principled BSDF")
    link = next((l for l in nt.links if l.to_node == b and l.to_socket.name == "Base Color"), None)
    node = link.from_node if link else None
    if node is not None and node.type == "TEX_IMAGE":
        im = bpy.data.images.load(grass_path, check_existing=True)
        im.colorspace_settings.name = "sRGB"
        node.image = im
        print("grass texture", grass_path)

# ---- neighbour blocks: tileable photo wall + roof, 6 m per repeat
wall_path, roof_path = os.path.join(a.common, "neighbour_wall.jpg"), os.path.join(a.common, "neighbour_roof.jpg")
nb = bpy.data.objects.get("Ground_NeighbourPBR")
if nb is not None and os.path.exists(wall_path) and os.path.exists(roof_path):
    wall, roof = tile_material("NeighbourWall", wall_path), tile_material("NeighbourRoof", roof_path)
    me = nb.data
    bm = bmesh.new(); bm.from_mesh(me); bm.normal_update()
    uv = bm.loops.layers.uv.verify()
    iw, ir = slot_index(me, wall), slot_index(me, roof)
    for f in bm.faces:
        f.material_index = ir if f.normal.z > 0.9 else iw
        for l in f.loops:
            l[uv].uv = (l[uv].uv[0] * 0.5, l[uv].uv[1] * 0.5)
    bm.to_mesh(me); bm.free()
    print("neighbours textured")

slabs_after = sorted(o.name for o in bpy.data.objects if o.name.startswith("Slab_"))
assert slabs_before == slabs_after and slabs_after, (slabs_before, slabs_after)
os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=a.out, export_format="GLB", export_apply=True, export_yup=True,
                          export_image_format="JPEG", export_jpeg_quality=85)
print("DONE", a.out, "slabs", len(slabs_after))
