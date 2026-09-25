/**
 * The seeded demo: a 16-storey residential tower with a published baseline
 * schedule and three drone flights. Used by the seed script and by the sample
 * PDF generator so the "official" schedule PDF and the database agree.
 * Everything here is a placeholder: no real project, developer, street,
 * permit or person. The site is an undeveloped plot inside the service area.
 */
import type { Observation, Phase, PlannedMilestone } from "./schedule";

export const DEMO = {
  project: {
    name: "Residential tower, 16 storeys",
    slug: "residential-tower-16",
    address: "Construction site · Kotayk, Armenia",
    // Open land near Kanakeravan (Kotayk), inside the service polygon; no
    // mapped building within 400 m (checked against OSM, 2026-09).
    lat: 40.255,
    lng: 44.555,
    developer: "Property developer",
    permitNo: "BP-0417",
    floorsTotal: 16,
    floorHeightM: 3.2,
    startDate: new Date("2026-01-05T00:00:00Z"),
    plannedCompletion: new Date("2027-03-15T00:00:00Z"),
  },
  // Structure cycle: 13 calendar days a storey after raft + podium works.
  structureStart: new Date("2026-03-02T00:00:00Z"),
  structureDays: 13,
  envelopeLagDays: 56, // envelope on floor n starts this long after its slab
  envelopeDays: 16,
  glazingLagDays: 40, // glazing follows the envelope start
  glazingDays: 15,
  finishesDays: 40,
  flights: [
    { key: "m4", capturedAt: new Date("2026-05-04T09:10:00Z"), structure: 5, partial: 0.4, envelope: 1, glazing: 0, pilot: "Drone unit 1", drone: "DJI Matrice 4E" },
    { key: "m6", capturedAt: new Date("2026-07-06T08:45:00Z"), structure: 9, partial: 0.4, envelope: 4, glazing: 2, pilot: "Drone unit 1", drone: "DJI Matrice 4E" },
    { key: "m8", capturedAt: new Date("2026-09-07T09:05:00Z"), structure: 12, partial: 0.4, envelope: 7, glazing: 4, pilot: "Drone unit 2", drone: "DJI Matrice 4E" },
  ],
  shotViews: [
    { name: "orbit-sw", view: "orbit", label: "Orbit, south-west", alt: 78 },
    { name: "orbit-se", view: "orbit", label: "Orbit, south-east", alt: 70 },
    { name: "orbit-ne", view: "orbit", label: "Orbit, north-east", alt: 82 },
    { name: "facade-s", view: "facade", label: "South facade", alt: 22 },
    { name: "nadir", view: "nadir", label: "Nadir (top-down)", alt: 120 },
    { name: "deck", view: "deck", label: "Working deck", alt: 50 },
  ] as const,
} as const;

const DAY = 86_400_000;
const add = (d: Date, days: number) => new Date(d.getTime() + days * DAY);

export function demoMilestones(): PlannedMilestone[] {
  const out: PlannedMilestone[] = [];
  const n = DEMO.project.floorsTotal;
  for (let f = 1; f <= n; f++) {
    const sStart = add(DEMO.structureStart, (f - 1) * DEMO.structureDays);
    const sEnd = add(sStart, DEMO.structureDays);
    const eStart = add(sEnd, DEMO.envelopeLagDays);
    const eEnd = add(eStart, DEMO.envelopeDays);
    const gStart = add(eStart, DEMO.glazingLagDays);
    const gEnd = add(gStart, DEMO.glazingDays);
    const fStart = gEnd;
    const fEnd = add(fStart, DEMO.finishesDays);
    const mk = (phase: Phase, s: Date, e: Date): PlannedMilestone => ({
      id: `f${f}-${phase}`,
      floor: f,
      phase,
      plannedStart: s,
      plannedEnd: e,
    });
    out.push(mk("structure", sStart, sEnd), mk("envelope", eStart, eEnd), mk("glazing", gStart, gEnd), mk("finishes", fStart, fEnd));
  }
  return out;
}

/** Ground truth for a sample flight - what the Blender scene physically contains. */
export function demoObservations(flight: (typeof DEMO.flights)[number], shotIds: string[] = []): Observation[] {
  const obs: Observation[] = [];
  for (let f = 1; f <= DEMO.project.floorsTotal; f++) {
    const structure = f <= flight.structure ? 100 : f === flight.structure + 1 ? flight.partial * 100 : 0;
    const envelope = f <= flight.envelope ? 100 : 0;
    const glazing = f <= flight.glazing ? 100 : 0;
    const push = (phase: Phase, pct: number, conf: number) => obs.push({ floor: f, phase, pct, confidence: conf, shotIds });
    push("structure", structure, structure > 0 && structure < 100 ? 0.8 : 0.95);
    push("envelope", envelope, 0.9);
    push("glazing", glazing, 0.85);
    // finishes: interior work is not visible from the air, so no observation
  }
  return obs;
}
