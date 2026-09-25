"""Download the CC0 Poly Haven textures + HDRI used by build_tower_pbr.py.
    python3 scripts/blender/fetch_polyhaven.py
"""
import json, os, urllib.request

OUT = "data/polyhaven"
TEXTURES = {
    "concrete": "concrete_slab_wall",
    "concrete_fresh": "concrete_floor_02",
    "facade": "preconcrete_wall_001",
    "neighbour": "concrete_tile_facade",
    "plywood": "plywood",
    "rust": "rusty_metal_02",
    "paint_metal": "metal_plate",
    "container": "container_side",
    "mud": "brown_mud_02",
    "gravel": "gravel_floor",
    "asphalt": "asphalt_02",
    "grass": "aerial_grass_rock",
    "net": "hessian_230",
}
HDRI = "kloofendal_48d_partly_cloudy_puresky"

def get(url, tries=5):
    import time
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "control.io-demo"}), timeout=120) as r:
                return r.read()
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(2 * (i + 1))

def main():
    os.makedirs(OUT, exist_ok=True)
    for key, asset in TEXTURES.items():
        try:
            files = json.loads(get(f"https://api.polyhaven.com/files/{asset}"))
        except Exception as e:
            print("skip", asset, e); continue
        for m, fname in (("Diffuse", "diff"), ("nor_gl", "nor"), ("Rough", "rough")):
            if m not in files: continue
            dest = f"{OUT}/{key}_{fname}.jpg"
            if os.path.exists(dest): continue
            open(dest, "wb").write(get(files[m]["1k"]["jpg"]["url"]))
        print("ok", key, asset)
    h = json.loads(get(f"https://api.polyhaven.com/files/{HDRI}"))
    for res in ("2k", "1k"):
        dest = f"{OUT}/sky_{res}.hdr"
        if not os.path.exists(dest):
            open(dest, "wb").write(get(h["hdri"][res]["hdr"]["url"]))
    print("ok hdri")

main()
