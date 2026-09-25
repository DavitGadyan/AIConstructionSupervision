import { describe, expect, it } from "vitest";
import { dateForPlannedPct, floorsFromMeshHeight, milestoneVariance, plannedPctAt, scheduleVariance, severityFor, type PlannedMilestone } from "./schedule";
import { DEMO, demoMilestones, demoObservations } from "./demo";

const d = (s: string) => new Date(s + "T00:00:00Z");
const m: PlannedMilestone = { id: "a", floor: 3, phase: "structure", plannedStart: d("2026-03-01"), plannedEnd: d("2026-03-11") };

describe("milestone maths", () => {
  it("interpolates planned % linearly", () => {
    expect(plannedPctAt(m, d("2026-02-01"))).toBe(0);
    expect(plannedPctAt(m, d("2026-03-06"))).toBe(50);
    expect(plannedPctAt(m, d("2026-04-01"))).toBe(100);
    expect(dateForPlannedPct(m, 50).toISOString().slice(0, 10)).toBe("2026-03-06");
  });

  it("measures days behind from the date the plan expected the observed %", () => {
    const v = milestoneVariance(m, [{ floor: 3, phase: "structure", pct: 50, confidence: 1, shotIds: ["s1"] }], d("2026-03-26"));
    expect(v?.daysBehind).toBe(20);
    expect(v?.severity).toBe("late");
    expect(v?.shotIds).toEqual(["s1"]);
  });

  it("reports ahead-of-plan as negative days", () => {
    const v = milestoneVariance(m, [{ floor: 3, phase: "structure", pct: 100, confidence: 1, shotIds: [] }], d("2026-03-06"));
    expect(v?.daysBehind).toBe(-5);
    expect(v?.severity).toBe("on-track");
  });

  it("skips milestones with no observation", () => {
    expect(milestoneVariance(m, [], d("2026-03-06"))).toBeNull();
  });

  it("classifies severity", () => {
    expect([0, 5, 15, 40].map(severityFor)).toEqual(["on-track", "watch", "late", "critical"]);
  });

  it("counts storeys from mesh height", () => {
    expect(floorsFromMeshHeight(12 * 3.2 + 0.8, 3.2)).toBe(12);
    expect(floorsFromMeshHeight(0.5, 3.2)).toBe(0);
  });
});

describe("earned schedule on the demo project", () => {
  const ms = demoMilestones();
  it("a perfectly on-plan observation has ~0 days variance", () => {
    const at = d("2026-06-01");
    const onPlan = ms.map((x) => ({ floor: x.floor!, phase: x.phase, pct: plannedPctAt(x, at), confidence: 1, shotIds: [] }));
    const v = scheduleVariance(ms, onPlan, at);
    expect(Math.abs(v.daysBehind)).toBeLessThanOrEqual(1);
    expect(v.spi).toBeGreaterThan(0.98);
  });

  it("the three sample flights fall progressively further behind", () => {
    const res = DEMO.flights.map((f) => scheduleVariance(ms, demoObservations(f), f.capturedAt));
    console.log(res.map((r) => ({ at: r.at.toISOString().slice(0, 10), behind: r.daysBehind, pv: r.plannedPct, ev: r.earnedPct, spi: r.spi })));
    // first flight roughly on plan, then slipping: the story the demo tells
    expect(res[0].daysBehind).toBeLessThanOrEqual(3);
    expect(res[1].daysBehind).toBeGreaterThan(res[0].daysBehind);
    expect(res[2].daysBehind).toBeGreaterThan(14);
    expect(res[2].earnedPct).toBeLessThan(res[2].plannedPct);
  });
});
