#!/usr/bin/env bash
# Photoreal (PBR) demo stages: GLB for the web viewer + Cycles drone plates for photorealisation.
set -euo pipefail
cd "$(dirname "$0")/.."
python3 scripts/blender/fetch_polyhaven.py >/dev/null
mkdir -p public/samples public/hdri data/plates
cp data/polyhaven/sky_1k.hdr public/hdri/sky.hdr
for st in "m4 5 1 0 4" "m6 9 4 2 6" "m8 12 7 4 8"; do
  set -- $st
  blender -b -P scripts/blender/build_tower_pbr.py -- --structure "$2" --envelope "$3" --glazing "$4" \
    --glb "data/plates/tower-$1.raw.glb" --shots "data/plates/$1" --seed "$5" --samples 20 --res 1152x768
  npx --yes @gltf-transform/cli optimize "data/plates/tower-$1.raw.glb" "public/samples/tower-$1.glb" \
    --compress meshopt --texture-compress webp --texture-size 1024 \
    --join false --flatten false --palette false --instance false --simplify false  # keep Slab_* nodes for lib/server/glb.ts
done
blender -b -P scripts/blender/build_solar.py -- --out public/samples/solar
# Next: scripts/render-photo-samples.sh projects AI photographs onto these exact stages (the "real scan" look)
# and overwrites public/samples/tower-m{4,6,8}.glb and the poster.
