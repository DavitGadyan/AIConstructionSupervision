import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { measureGlb } from "./glb";
import { floorsFromMeshHeight } from "../domain/schedule";

// Regression: the shipped sample GLBs are meshopt-quantized; storeys must still be counted from slab height.
describe("measureGlb on the compressed sample towers", () => {
  it.each([["m4", 5], ["m6", 9], ["m8", 12]])("tower-%s has %i structural storeys", (key, floors) => {
    const m = measureGlb(readFileSync(`public/samples/tower-${key}.glb`));
    expect(m.slabTopM).not.toBeNull();
    expect(floorsFromMeshHeight(m.slabTopM!, 3.2)).toBe(floors);
  });
});
