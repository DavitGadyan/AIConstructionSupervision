#!/usr/bin/env bash
# Web builds of the photo-textured stages, sized for a fast first load:
#  - projected drone photos (south/east/north/west/top/site) stay at 1024 px (they carry the look)
#  - tiling material scans (concrete, plywood, gravel, grass, neighbours, ...) drop to 512 px
#  - WebP quality 78, meshopt geometry, node names kept for lib/server/glb.ts (Slab_*)
#   scripts/optimize-glb.sh            (needs data/plates/tower-<stage>.photo.raw.glb)
set -euo pipefail
cd "$(dirname "$0")/.."
GT="npx --yes @gltf-transform/cli"
KEEP="--join false --flatten false --palette false --instance false --simplify false"
TILES="{*_nor,*_rough,*_diff,grass,neighbour_*,concrete*,plywood*,rust*,gravel*,asphalt*,mud*,container*,paint_metal*,net*,facade*}"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

slim() { # in out - textures first, meshopt last (a later rewrite would drop EXT_meshopt_compression)
  $GT resize "$1" "$TMP/a.glb" --width 1024 --height 1536 >/dev/null
  $GT resize "$TMP/a.glb" "$TMP/b.glb" --width 512 --height 512 --pattern "$TILES" >/dev/null
  $GT webp "$TMP/b.glb" "$TMP/c.glb" --quality 78 >/dev/null
  $GT optimize "$TMP/c.glb" "$2" --compress meshopt --texture-compress false $KEEP >/dev/null
  echo "$2 $(du -h "$2" | cut -f1)"
}

for st in m4 m6 m8; do
  slim "data/plates/tower-$st.photo.raw.glb" "public/samples/tower-$st.glb"
done
