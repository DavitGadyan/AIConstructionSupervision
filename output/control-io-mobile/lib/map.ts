/**
 * Site maps without a native map dependency: a tiny Leaflet 1.9.4 page with
 * OpenStreetMap tiles, rendered in react-native-webview (iOS/Android) or an
 * iframe `srcDoc` (web export). Taps on the preview open the platform's own
 * Maps app instead (mapsUrl / openInMaps).
 *
 * Tiles: EXPO_PUBLIC_MAP_TILES overrides the OSM template (production needs a
 * paid provider - OSM's public tiles are for light use only), and
 * EXPO_PUBLIC_MAP_ATTRIBUTION its credit line.
 */
import { Linking, Platform } from "react-native";
import { API_URL } from "./api";
import { theme } from "./theme";

export interface LatLng {
  lat: number;
  lng: number;
}

export const MAP_TILES = process.env.EXPO_PUBLIC_MAP_TILES || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const MAP_ATTRIBUTION =
  process.env.EXPO_PUBLIC_MAP_ATTRIBUTION ||
  (process.env.EXPO_PUBLIC_MAP_TILES ? "Map data © OpenStreetMap contributors" : "© OpenStreetMap contributors");

/** Origin the WebView page claims (OSM wants a real Referer on tile requests). */
export const MAP_BASE_URL = `${API_URL}/`;

const LEAFLET_CSS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css";
const LEAFLET_JS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js";
const LEAFLET_CSS_SRI = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
const LEAFLET_JS_SRI = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";

export function isValidLatLng(p: Partial<LatLng> | null | undefined): p is LatLng {
  return (
    !!p &&
    typeof p.lat === "number" &&
    typeof p.lng === "number" &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    Math.abs(p.lat) <= 90 &&
    Math.abs(p.lng) <= 180 &&
    !(p.lat === 0 && p.lng === 0)
  );
}

/** Escape text for an HTML attribute or element body. */
function html(v: string) {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** JSON for inline <script>: no "</script>" breakout, no HTML comments. */
function js(v: unknown) {
  return JSON.stringify(v).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

export interface MapHtmlOptions extends LatLng {
  zoom?: number;
  /** marker tooltip / title text */
  label?: string;
  /** false (default) = static preview: no drag, zoom, keyboard or tap handlers */
  interactive?: boolean;
  /** draw a soft circle of this radius (m) around the pin, e.g. the site footprint */
  radiusM?: number;
}

/**
 * Self-contained HTML page for WebView `source={{ html, baseUrl: MAP_BASE_URL }}`
 * or iframe `srcDoc`. Posts "ready" when the map is set up and "error" when
 * Leaflet cannot load (offline), via ReactNativeWebView or parent.postMessage.
 */
export function leafletHtml(o: MapHtmlOptions): string {
  const zoom = o.zoom ?? 16;
  const interactive = !!o.interactive;
  const c = theme.colors;
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="${LEAFLET_CSS}" integrity="${LEAFLET_CSS_SRI}" crossorigin="anonymous">
<style>
  html,body,#map{margin:0;padding:0;width:100%;height:100%;background:${c.mapPlaceholder};}
  body{-webkit-tap-highlight-color:transparent;-webkit-user-select:none;user-select:none;}
  .leaflet-container{font:12px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:${c.mapPlaceholder};}
  .leaflet-control-attribution{background:rgba(255,255,255,.78)!important;color:${c.muted};font-size:10px;border-radius:6px 0 0 0;}
  .leaflet-control-attribution a{color:${c.muted};}
  .pin{position:relative;width:22px;height:22px;}
  .pin .dot{position:absolute;inset:0;border-radius:50%;background:${c.accent};border:3px solid #fff;box-shadow:0 2px 8px rgba(28,34,38,.35);box-sizing:border-box;}
  .pin .pulse{position:absolute;left:50%;top:50%;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:${c.accent};opacity:.35;animation:pulse 2.4s ease-out infinite;}
  @keyframes pulse{0%{transform:scale(1);opacity:.35}100%{transform:scale(3.2);opacity:0}}
  @media (prefers-reduced-motion: reduce){.pin .pulse{animation:none;opacity:.18;transform:scale(2)}}
  .fallback{position:absolute;inset:0;display:none;align-items:center;justify-content:center;color:${c.muted};font:13px -apple-system,BlinkMacSystemFont,sans-serif;text-align:center;padding:12px;}
</style>
</head><body>
<div id="map" role="img" aria-label="${html(`Map of ${o.label ?? "the site"}`)}"></div>
<div class="fallback" id="fallback">Map unavailable offline<br>${o.lat.toFixed(5)}, ${o.lng.toFixed(5)}</div>
<script>
  function post(m){try{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(m);else if(window.parent&&window.parent!==window)window.parent.postMessage({source:"cio-map",type:m},"*");}catch(e){}}
  function fail(){document.getElementById("fallback").style.display="flex";post("error");}
</script>
<script src="${LEAFLET_JS}" integrity="${LEAFLET_JS_SRI}" crossorigin="anonymous" onerror="fail()"></script>
<script>
  (function(){
    if(!window.L){fail();return;}
    var center=[${js(o.lat)},${js(o.lng)}];
    var interactive=${interactive ? "true" : "false"};
    var map=L.map("map",{
      center:center, zoom:${js(zoom)},
      zoomControl:interactive, attributionControl:true,
      dragging:interactive, touchZoom:interactive, scrollWheelZoom:interactive,
      doubleClickZoom:interactive, boxZoom:interactive, keyboard:interactive, tap:false,
      zoomSnap:0.5, fadeAnimation:!window.matchMedia("(prefers-reduced-motion: reduce)").matches
    });
    map.attributionControl.setPrefix(false);
    L.tileLayer(${js(MAP_TILES)},{maxZoom:19, attribution:${js(MAP_ATTRIBUTION)}, referrerPolicy:"strict-origin-when-cross-origin"}).addTo(map);
    ${o.radiusM ? `L.circle(center,{radius:${js(o.radiusM)},color:${js(c.accent)},weight:1.5,fillColor:${js(c.accent)},fillOpacity:.12}).addTo(map);` : ""}
    var icon=L.divIcon({className:"",html:'<div class="pin"><div class="pulse"></div><div class="dot"></div></div>',iconSize:[22,22],iconAnchor:[11,11]});
    L.marker(center,{icon:icon,keyboard:false,title:${js(o.label ?? "")},alt:${js(o.label ?? "Site")}}).addTo(map);
    // the frame can be laid out after Leaflet measured it (lazy iframe, WebView mount): re-measure and re-centre
    function fit(){map.invalidateSize(false);map.setView(center,map.getZoom(),{animate:false});}
    window.addEventListener("resize",fit);
    setTimeout(fit,60);
    post("ready");
  })();
</script>
</body></html>`;
}

/** Deep link into the platform's Maps app (web: OpenStreetMap / Google directions). */
export function mapsUrl(
  p: LatLng & { label?: string },
  opts: { directions?: boolean; platform?: typeof Platform.OS } = {},
): string {
  const os = opts.platform ?? Platform.OS;
  const ll = `${p.lat},${p.lng}`;
  const q = encodeURIComponent(p.label ?? "Site");
  if (os === "ios") {
    return opts.directions
      ? `https://maps.apple.com/?daddr=${ll}&dirflg=d`
      : `https://maps.apple.com/?ll=${ll}&q=${q}`;
  }
  if (os === "android") {
    return opts.directions ? `google.navigation:q=${ll}` : `geo:${ll}?q=${ll}(${q})`;
  }
  return opts.directions
    ? `https://www.google.com/maps/dir/?api=1&destination=${ll}`
    : `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`;
}

/** Browser URL that works everywhere: the fallback when no Maps app handles the deep link. */
export function mapsWebUrl(p: LatLng, directions = false) {
  return directions
    ? `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
}

/** Open the site in Maps (or directions to it), falling back to the browser. */
export async function openInMaps(p: LatLng & { label?: string }, opts: { directions?: boolean } = {}) {
  const url = mapsUrl(p, opts);
  try {
    await Linking.openURL(url);
  } catch {
    await Linking.openURL(mapsWebUrl(p, opts.directions));
  }
}
