#!/usr/bin/env bash
# Photo-textured demo stages (the "real scan" look), credit-free: Blender projector renders ->
# gpt-image-2 photographs -> photos projected back onto the exact geometry -> web GLB + hero poster.
# Needs Blender 4.x, OPENAI_API_KEY in .env and the PBR raw stages from scripts/render-samples.sh.
#   scripts/render-photo-samples.sh            # all stages
#   scripts/render-photo-samples.sh m8         # one stage
set -euo pipefail
cd "$(dirname "$0")/.."
stages=("$@"); [ ${#stages[@]} -eq 0 ] && stages=(m4 m6 m8)
mkdir -p data/projectors public/samples
npx tsx scripts/imagery/projectors.ts --neighbours
for st in "${stages[@]}"; do
  blender -b -P scripts/blender/render_projectors.py -- --glb "data/plates/tower-$st.raw.glb" --out "data/projectors/$st" --samples 24
  npx tsx scripts/imagery/projectors.ts "$st"
  blender -b -P scripts/blender/project_photos.py -- --glb "data/plates/tower-$st.raw.glb" --proj "data/projectors/$st" \
    --common data/projectors/common --out "data/plates/tower-$st.photo.raw.glb"
  npx --yes @gltf-transform/cli optimize "data/plates/tower-$st.photo.raw.glb" "public/samples/tower-$st.glb" \
    --compress meshopt --texture-compress webp --texture-size 2048 \
    --join false --flatten false --palette false --instance false --simplify false  # keep Slab_* nodes for lib/server/glb.ts
done
if printf '%s\n' "${stages[@]}" | grep -qx m8; then
  blender -b -P scripts/blender/render_poster.py -- --glb data/plates/tower-m8.photo.raw.glb --out data/plates/poster-m8.png --samples 48
  python3 scripts/blender/trim_poster.py data/plates/poster-m8.png public/samples/tower-m8-poster.png ../control-io-mobile/assets/images/tower-poster.png
fi
npx vitest run lib/server/glb.test.ts
