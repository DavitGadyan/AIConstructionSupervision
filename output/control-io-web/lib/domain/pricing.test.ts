import { describe, expect, it } from "vitest";
import { ASAP_SURCHARGE, FROM_PRICE_AMD, INCLUDES, PRICES_AMD, formatAmd, priceAmd, quote } from "./pricing";
import { ETA_HOURS, ORDER_KINDS, ORDER_PRIORITIES, REPORT_HOURS } from "./orderTypes";

describe("pricing", () => {
  it("has the placeholder table from the plan", () => {
    expect(PRICES_AMD).toEqual({ full: 180_000, revision: 90_000, targeted: 120_000 });
    expect(ASAP_SURCHARGE).toBe(0.25);
    expect(FROM_PRICE_AMD).toBe(90_000);
  });

  it("adds 25 % for ASAP", () => {
    expect(priceAmd("full", "scheduled")).toBe(180_000);
    expect(priceAmd("full", "asap")).toBe(225_000);
    expect(priceAmd("revision", "asap")).toBe(112_500);
    expect(priceAmd("targeted", "asap")).toBe(150_000);
  });

  it("quotes every kind and priority with the promise", () => {
    for (const kind of ORDER_KINDS) {
      for (const priority of ORDER_PRIORITIES) {
        const q = quote(kind, priority);
        expect(q).toMatchObject({ kind, priority, currency: "AMD", priceAmd: priceAmd(kind, priority), reportHours: REPORT_HOURS });
        expect(q.etaHours).toEqual(ETA_HOURS);
        expect(q.includes).toEqual(INCLUDES[kind]);
        expect(Number.isInteger(q.priceAmd)).toBe(true);
      }
    }
  });

  it("matches the API.md quote example", () => {
    expect(quote("full", "asap")).toEqual({
      kind: "full",
      priority: "asap",
      priceAmd: 225000,
      currency: "AMD",
      includes: ["Car + drone crew on site", "All facades, nadir and 3D model", "Progress vs. schedule", "Independent PDF report"],
      etaHours: [3, 4],
      reportHours: 12,
    });
  });

  it("returns copies, so callers cannot change the table", () => {
    const q = quote("full", "asap");
    q.includes.push("x");
    q.etaHours[0] = 99;
    expect(quote("full", "asap").includes).toHaveLength(4);
    expect(ETA_HOURS[0]).toBe(3);
  });

  it("formats AMD with space-separated thousands", () => {
    expect(formatAmd(225000)).toBe("225 000 AMD");
    expect(formatAmd(1_250_000, false)).toBe("1 250 000");
    expect(formatAmd(900)).toBe("900 AMD");
  });
});
