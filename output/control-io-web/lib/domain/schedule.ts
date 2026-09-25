/**
 * Schedule-variance maths. Pure functions, no I/O - this is the part of the
 * product a court or a lender will ask to see, so it stays small and tested.
 *
 * Method: Earned Schedule (Lipke, 2003), the schedule-side extension of
 * Earned Value Management. Each milestone contributes planned value in
 * proportion to its planned duration; earned value is the same weighting
 * applied to observed completion. The earned-schedule date is the date on
 * which the plan expected today's earned value. Days behind = today - ES.
 */

export const PHASES = ["structure", "envelope", "glazing", "finishes"] as const;
export type Phase = (typeof PHASES)[number];

export const PHASE_LABEL: Record<Phase, string> = {
  structure: "Structure",
  envelope: "Envelope",
  glazing: "Glazing",
  finishes: "Finishes",
};

export interface PlannedMilestone {
  id: string;
  floor: number | null; // null = whole building
  phase: Phase;
  plannedStart: Date;
  plannedEnd: Date;
  sourceDocumentId?: string | null;
  sourcePage?: number | null;
  sourceQuote?: string | null;
}

export interface Observation {
  floor: number;
  phase: Phase;
  pct: number; // 0..100 observed completion
  confidence: number; // 0..1
  shotIds: string[];
}

const DAY = 86_400_000;

export function clamp(n: number, lo = 0, hi = 100) {
  return Math.min(hi, Math.max(lo, n));
}

/** Planned completion % of a milestone at date `at`, linear inside its window. */
export function plannedPctAt(m: PlannedMilestone, at: Date): number {
  const s = m.plannedStart.getTime();
  const e = m.plannedEnd.getTime();
  if (at.getTime() <= s) return 0;
  if (at.getTime() >= e) return 100;
  return ((at.getTime() - s) / (e - s)) * 100;
}

/** The date by which the plan expected `pct` of this milestone. */
export function dateForPlannedPct(m: PlannedMilestone, pct: number): Date {
  const s = m.plannedStart.getTime();
  const e = m.plannedEnd.getTime();
  return new Date(s + (clamp(pct) / 100) * (e - s));
}

function weight(m: PlannedMilestone) {
  return Math.max(1, (m.plannedEnd.getTime() - m.plannedStart.getTime()) / DAY);
}

export function observedPctFor(m: PlannedMilestone, obs: Observation[]): number | null {
  if (m.floor == null) {
    const same = obs.filter((o) => o.phase === m.phase);
    if (!same.length) return null;
    return same.reduce((a, o) => a + o.pct, 0) / same.length;
  }
  const o = obs.find((x) => x.floor === m.floor && x.phase === m.phase);
  return o ? o.pct : null;
}

export interface MilestoneVariance {
  milestone: PlannedMilestone;
  plannedPct: number;
  observedPct: number;
  /** Positive = behind plan, negative = ahead. Whole days. */
  daysBehind: number;
  severity: "on-track" | "watch" | "late" | "critical";
  confidence: number;
  shotIds: string[];
}

export function severityFor(daysBehind: number): MilestoneVariance["severity"] {
  if (daysBehind <= 2) return "on-track";
  if (daysBehind <= 7) return "watch";
  if (daysBehind <= 21) return "late";
  return "critical";
}

export function milestoneVariance(
  m: PlannedMilestone,
  obs: Observation[],
  at: Date,
): MilestoneVariance | null {
  const observed = observedPctFor(m, obs);
  if (observed == null) return null;
  const planned = plannedPctAt(m, at);
  let daysBehind: number;
  if (observed >= 100 && planned >= 100) daysBehind = 0;
  else if (observed >= 100) {
    // finished early: ahead by the time left in the planned window
    daysBehind = -Math.round((m.plannedEnd.getTime() - at.getTime()) / DAY);
  } else {
    daysBehind = Math.round((at.getTime() - dateForPlannedPct(m, observed).getTime()) / DAY);
  }
  const o = m.floor == null ? null : obs.find((x) => x.floor === m.floor && x.phase === m.phase);
  return {
    milestone: m,
    plannedPct: Math.round(planned),
    observedPct: Math.round(observed),
    daysBehind,
    severity: severityFor(daysBehind),
    confidence: o?.confidence ?? 0.8,
    shotIds: o?.shotIds ?? [],
  };
}

export interface ScheduleVariance {
  at: Date;
  plannedPct: number; // PV share, 0..100
  earnedPct: number; // EV share, 0..100
  earnedScheduleDate: Date;
  daysBehind: number; // at - ES, whole days
  spi: number; // schedule performance index (time-based) ES/AT
  byPhase: { phase: Phase; plannedPct: number; earnedPct: number }[];
  milestones: MilestoneVariance[];
}

/** Planned value share (0..100) of the whole plan at date t. */
export function plannedValueAt(ms: PlannedMilestone[], t: Date): number {
  const total = ms.reduce((a, m) => a + weight(m), 0);
  if (!total) return 0;
  return (ms.reduce((a, m) => a + weight(m) * plannedPctAt(m, t), 0) / total);
}

export function scheduleVariance(
  allMs: PlannedMilestone[],
  obs: Observation[],
  at: Date,
): ScheduleVariance {
  // Only milestones the flight could observe take part: interior finishes are
  // invisible from the air and must not count as "0% done".
  const observed = allMs.filter((m) => observedPctFor(m, obs) != null);
  const ms = observed.length ? observed : allMs;
  const total = ms.reduce((a, m) => a + weight(m), 0) || 1;
  const earned =
    ms.reduce((a, m) => a + weight(m) * (observedPctFor(m, obs) ?? 0), 0) / total;
  const planned = plannedValueAt(ms, at);

  // Earned schedule: find t where PV(t) = EV. PV is monotone, so bisect.
  const start = Math.min(...ms.map((m) => m.plannedStart.getTime()));
  const end = Math.max(...ms.map((m) => m.plannedEnd.getTime()));
  let lo = start;
  let hi = Math.max(end, at.getTime());
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (plannedValueAt(ms, new Date(mid)) < earned) lo = mid;
    else hi = mid;
  }
  const es = new Date(hi);
  const daysBehind = Math.round((at.getTime() - es.getTime()) / DAY) || 0;
  const elapsed = Math.max(1, (at.getTime() - start) / DAY);
  const esElapsed = Math.max(0, (es.getTime() - start) / DAY);

  const byPhase = PHASES.map((phase) => {
    const sub = ms.filter((m) => m.phase === phase);
    const w = sub.reduce((a, m) => a + weight(m), 0) || 1;
    return {
      phase,
      plannedPct: Math.round(sub.reduce((a, m) => a + weight(m) * plannedPctAt(m, at), 0) / w),
      earnedPct: Math.round(sub.reduce((a, m) => a + weight(m) * (observedPctFor(m, obs) ?? 0), 0) / w),
    };
  });

  const milestones = ms
    .map((m) => milestoneVariance(m, obs, at))
    .filter((v): v is MilestoneVariance => v != null);

  return {
    at,
    plannedPct: Math.round(planned * 10) / 10,
    earnedPct: Math.round(earned * 10) / 10,
    earnedScheduleDate: es,
    daysBehind,
    spi: Math.round((esElapsed / elapsed) * 100) / 100,
    byPhase,
    milestones,
  };
}

/** Floors whose structure the mesh proves: bounding-box height over storey height. */
export function floorsFromMeshHeight(heightM: number, floorHeightM: number, baseOffsetM = 0.8) {
  return Math.max(0, Math.floor((heightM - baseOffsetM + 0.2) / floorHeightM));
}
