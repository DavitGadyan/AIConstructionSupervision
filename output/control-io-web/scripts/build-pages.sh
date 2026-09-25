#!/usr/bin/env bash
# Static build of the marketing site (all pages in EN/HY/RU + the 3D explorer) for GitHub Pages.
# The server parts (API, dashboard, login, embed, middleware) cannot run on Pages, so the build runs on a
# temporary copy without them; the working tree is never modified. Output: ./out
#   PAGES_DOMAIN=control.s1mpleai.org scripts/build-pages.sh
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
DOMAIN=${PAGES_DOMAIN:-}
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

rsync -a --exclude node_modules --exclude '.next*' --exclude out --exclude storage --exclude data \
  --exclude '*.db' --exclude .env ./ "$TMP/"
ln -s "$ROOT/node_modules" "$TMP/node_modules"
rm -rf "$TMP/app/api" "$TMP/app/app" "$TMP/app/embed" "$TMP/app/login" "$TMP/app/logout" \
  "$TMP/app/(marketing)/[locale]/[...rest]" "$TMP/middleware.ts" "$TMP/instrumentation.ts"

export NEXT_PUBLIC_STATIC_SITE=1
export NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL:-${DOMAIN:+https://$DOMAIN}}
(cd "$TMP" && npx next build)

# English is served at unprefixed URLs (the server does this with a rewrite): lift /en/* to the root.
rm -rf out && cp -R "$TMP/out" out
cp -R out/en/. out/ && rm -rf out/en
# GitHub Pages serves 404.html for unknown paths; use the localized English 404 page if Next made one.
[ -f out/404/index.html ] && cp out/404/index.html out/404.html
node scripts/image-variants.mjs out
touch out/.nojekyll
[ -n "$DOMAIN" ] && echo "$DOMAIN" > out/CNAME
echo "static site in $ROOT/out ($(du -sh out | cut -f1))"
