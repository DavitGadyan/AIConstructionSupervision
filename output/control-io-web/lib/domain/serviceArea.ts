/**
 * Where a car + drone crew can be on site in 3-4 h: Yerevan and Kotayk
 * province. A deliberately generous hand-drawn polygon (lat, lng), good
 * enough for a yes/no at order time; POST /api/orders answers 422 outside it.
 */

export const SERVICE_AREA_NAME = "Yerevan & Kotayk";

/** [lat, lng] vertices, clockwise from the south-west of Yerevan. */
export const SERVICE_AREA: readonly (readonly [number, number])[] = [
  [40.07, 44.36], // Yerevan south-west (Shengavit / airport side, Armavir border to the west)
  [40.16, 44.35], // Yerevan west (Malatia-Sebastia), Echmiadzin stays outside
  [40.33, 44.4], // Yeghvard, Ashtarak (Aragatsotn) stays outside
  [40.5, 44.52], // Kotayk north-west (Bjni)
  [40.66, 44.6], // Meghradzor
  [40.62, 44.85], // above Tsaghkadzor / Hrazdan
  [40.45, 44.98], // Kotayk east, Sevan (Gegharkunik) stays outside
  [40.08, 44.92], // Garni / Geghard
  [40.03, 44.58], // Yerevan south (Nubarashen)
];

/** Ray-casting point-in-polygon test. */
export function inPolygon(lat: number, lng: number, poly: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i];
    const [yj, xj] = poly[j];
    const crosses = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** True when a site at (lat, lng) is inside the Yerevan & Kotayk service area. */
export function inServiceArea(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return inPolygon(lat, lng, SERVICE_AREA);
}
