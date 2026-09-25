/* control.io service worker (static site only, registered by components/marketing/ServiceWorker.tsx).
 * GitHub Pages sends every file with a 10-minute cache lifetime, so repeat visits would re-download the
 * 3D models and bundles. This keeps them locally:
 *  - cache first:            /_next/static/* (hashed), versioned models (?v=), sky, fonts
 *  - stale-while-revalidate: /images, /samples (posters), image variants
 *  - network first:          pages and route payloads (fresh content, cached copy when offline)
 * Videos are left to the browser (range requests). Bump VERSION to drop everything. */
const VERSION = "cio-2026-09-25";
const ASSETS = `${VERSION}-assets`;
const PAGES = `${VERSION}-pages`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (!key.startsWith(VERSION)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

const immutable = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  (url.pathname.endsWith(".glb") && url.searchParams.has("v")) ||
  url.pathname.startsWith("/hdri/") ||
  /\.(woff2?|ttf)$/.test(url.pathname);
const images = (url) => url.pathname.startsWith("/images/") || url.pathname.startsWith("/samples/");

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(event.request);
  const refresh = fetch(event.request)
    .then((res) => {
      if (res.ok) cache.put(event.request, res.clone());
      return res;
    })
    .catch(() => hit);
  if (hit) {
    event.waitUntil(refresh);
    return hit;
  }
  return refresh;
}

async function networkFirst(request) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/videos/")) return;
  if (immutable(url)) event.respondWith(cacheFirst(req));
  else if (images(url)) event.respondWith(staleWhileRevalidate(event));
  else if (req.mode === "navigate" || url.searchParams.has("_rsc") || url.pathname.endsWith(".txt")) event.respondWith(networkFirst(req));
});
