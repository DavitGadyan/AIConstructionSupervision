import { describe, expect, it } from "vitest";
import { inPolygon, inServiceArea, SERVICE_AREA } from "./serviceArea";
import { DEMO } from "./demo";

describe("service area (Yerevan & Kotayk)", () => {
  const inside: [string, number, number][] = [
    ["Yerevan, Republic Square", 40.1777, 44.5126],
    ["Sample project (Kotayk plot)", DEMO.project.lat, DEMO.project.lng],
    ["Yerevan, Nor Nork", 40.2, 44.58],
    ["Yerevan, Malatia", 40.17, 44.44],
    ["Abovyan", 40.2739, 44.6256],
    ["Tsaghkadzor", 40.5326, 44.7203],
    ["Hrazdan", 40.4974, 44.7665],
    ["Charentsavan", 40.4026, 44.6417],
    ["Yeghvard", 40.3219, 44.4816],
    ["Garni", 40.1197, 44.7303],
  ];
  const outside: [string, number, number][] = [
    ["Gyumri", 40.7894, 43.8475],
    ["Vanadzor", 40.8128, 44.4883],
    ["Vagharshapat (Echmiadzin)", 40.1653, 44.2925],
    ["Ashtarak", 40.2991, 44.3622],
    ["Sevan", 40.5547, 44.9536],
    ["Artashat", 39.9539, 44.5506],
    ["Dilijan", 40.7406, 44.8631],
    ["Tbilisi", 41.7151, 44.8271],
  ];

  it.each(inside)("%s is inside", (_name, lat, lng) => {
    expect(inServiceArea(lat, lng)).toBe(true);
  });

  it.each(outside)("%s is outside", (_name, lat, lng) => {
    expect(inServiceArea(lat, lng)).toBe(false);
  });

  it("rejects missing or invalid coordinates", () => {
    expect(inServiceArea(Number.NaN, 44.5)).toBe(false);
    expect(inServiceArea(40.18, Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("is a closed polygon with enough vertices", () => {
    expect(SERVICE_AREA.length).toBeGreaterThanOrEqual(3);
    expect(inPolygon(0.5, 0.5, [[0, 0], [0, 1], [1, 1], [1, 0]])).toBe(true);
    expect(inPolygon(1.5, 0.5, [[0, 0], [0, 1], [1, 1], [1, 0]])).toBe(false);
  });
});
