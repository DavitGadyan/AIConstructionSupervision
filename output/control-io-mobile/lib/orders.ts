/**
 * Order domain helpers for the app: labels, the step list, and the
 * "what are we waiting for next" countdown maths. Pure functions of an
 * `Order` and `now` (ms) - no fetching, no React.
 *
 * Durations mirror the dispatch simulator (API.md "Status progresses
 * automatically"): confirm +5 min, dispatch +15 min, arrival inside
 * etaArrivalFrom..To, setup 10 min, flight 45 min, report by reportDueAt.
 * Every duration is divided by the order's frozen `timeScale`, so the demo
 * (scale 240) counts down as fast as the server moves.
 */
import {
  ACTIVE_STATUSES,
  ETA_HOURS,
  MIN_SCHEDULE_LEAD_HOURS,
  REPORT_HOURS,
  STATUS_ORDER,
  isActiveStatus,
  statusIndex,
  type Finding,
  type Order,
  type OrderEvent,
  type OrderEventStatus,
  type OrderKind,
  type OrderPriority,
  type OrderStatus,
} from "./api";
import { clockRange, countdown, dayLabel, fromYerevan, hoursLabel, time, titleCase, yerevanDayStart, yerevanParts } from "./format";
import { theme } from "./theme";

export { ACTIVE_STATUSES, ETA_HOURS, MIN_SCHEDULE_LEAD_HOURS, REPORT_HOURS, STATUS_ORDER, isActiveStatus, statusIndex };

const MIN = 60_000;
const HOUR = 60 * MIN;

/** Simulator step durations at timeScale 1 (ms). */
export const STEP_DURATIONS = {
  confirm: 5 * MIN,
  dispatch: 15 * MIN,
  setup: 10 * MIN,
  flight: 45 * MIN,
} as const;

/* ------------------------------------------------------------------ labels */

export const KIND_LABELS: Record<OrderKind, string> = {
  full: "Full inspection",
  revision: "Revision",
  targeted: "Targeted check",
};

export const KIND_BLURBS: Record<OrderKind, string> = {
  full: "Whole building: every facade, nadir and a fresh 3D model, compared with the schedule.",
  revision: "Re-inspect the open findings after the developer reports them fixed.",
  targeted: "Only the floors or issues you pick, for a quick answer.",
};

export const PRIORITY_LABELS: Record<OrderPriority, string> = {
  asap: "As soon as possible",
  scheduled: "Schedule a slot",
};

export const PRIORITY_BLURBS: Record<OrderPriority, string> = {
  asap: `Car + drone on site in ${hoursLabel(ETA_HOURS)}.`,
  scheduled: `Pick a daylight slot at least ${MIN_SCHEDULE_LEAD_HOURS} h ahead.`,
};

export const STATUS_LABELS: Record<OrderEventStatus, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  dispatched: "On the way",
  on_site: "On site",
  flying: "Drone in the air",
  processing: "Processing",
  delivered: "Report ready",
  cancelled: "Cancelled",
  delayed: "Delayed",
};

export function kindLabel(k: OrderKind | string) {
  return KIND_LABELS[k as OrderKind] ?? titleCase(k);
}

export function priorityLabel(p: OrderPriority | string) {
  return p === "asap" ? "ASAP" : p === "scheduled" ? "Scheduled" : titleCase(p);
}

export function statusLabel(s: OrderEventStatus | string) {
  return STATUS_LABELS[s as OrderEventStatus] ?? titleCase(s);
}

/** "Full inspection · INS-2026-0007" */
export function orderTitle(o: Pick<Order, "kind" | "number">) {
  return `${kindLabel(o.kind)} · ${o.number}`;
}

/* ------------------------------------------------------------------ steps */

export interface StatusStep {
  status: (typeof STATUS_ORDER)[number];
  /** Stepper row title */
  label: string;
  /** What happens in this step, for the stepper body and screen readers */
  description: string;
}

/** The happy path as the tracking screen shows it. */
export const STATUS_STEPS: readonly StatusStep[] = [
  { status: "requested", label: "Order placed", description: "We book a crew and an arrival window." },
  { status: "confirmed", label: "Confirmed", description: "Slot and crew confirmed, arrival window set." },
  { status: "dispatched", label: "On the way", description: "Car + drone crew driving to the site." },
  { status: "on_site", label: "On site", description: "Crew arrives and sets up the drone." },
  { status: "flying", label: "Flying", description: "Drone captures every facade and the roof." },
  { status: "processing", label: "Processing", description: "3D model, schedule comparison and PDF." },
  { status: "delivered", label: "Report ready", description: "Independent PDF report, sent to you." },
];

export type StepState = "done" | "current" | "upcoming" | "skipped";

export interface StepTime {
  status: StatusStep["status"];
  label: string;
  description: string;
  state: StepState;
  /** ISO time: actual when reached, estimate otherwise (null if unknown) */
  at: string | null;
  /** true when `at` is an estimate */
  estimate: boolean;
  /** arrival window end, only on the on_site step while it is an estimate */
  windowTo: string | null;
}

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

const iso = (t: number | null) => (t === null ? null : new Date(t).toISOString());

function scaleOf(o: Pick<Order, "timeScale">) {
  return o.timeScale && o.timeScale > 0 ? o.timeScale : 1;
}

/** The event row for a status, if the order reached it. */
export function eventFor(o: Pick<Order, "events">, status: OrderEventStatus): OrderEvent | undefined {
  return o.events?.find((e) => e.status === status);
}

/** Newest event (the one notifications and toasts show). */
export function latestEvent(o: Pick<Order, "events">): OrderEvent | undefined {
  const ev = o.events ?? [];
  return ev.length ? ev[ev.length - 1] : undefined;
}

/** True when the single "delayed" notice was emitted and the report is still pending. */
export function isDelayed(o: Pick<Order, "events" | "status">) {
  return o.status === "processing" && !!eventFor(o, "delayed");
}

/** When the order actually reached a status (event time, or the dedicated field). */
export function reachedAt(o: Order, status: OrderStatus): number | null {
  const ev = ms(eventFor(o, status)?.at);
  if (ev !== null) return ev;
  switch (status) {
    case "requested":
      return ms(o.createdAt);
    case "on_site":
      return ms(o.arrivedAt);
    case "flying":
      return ms(o.flightStartedAt);
    case "processing":
      return ms(o.flightEndedAt);
    case "delivered":
      return ms(o.deliveredAt);
    default:
      return null;
  }
}

/**
 * Actual-or-estimated time for every step, in order. Estimates chain from the
 * latest known actual time, so a late crew pushes the later estimates too.
 */
export function stepTimes(o: Order): StepTime[] {
  const scale = scaleOf(o);
  const idx = statusIndex(o.status);
  const cancelled = o.status === "cancelled";
  // for cancelled orders: the furthest step actually reached
  const reachedIdx = cancelled
    ? STATUS_ORDER.reduce((acc, s, i) => (reachedAt(o, s) !== null ? i : acc), 0)
    : idx;

  const created = ms(o.createdAt) ?? Date.now();
  const confirmed = reachedAt(o, "confirmed") ?? created + STEP_DURATIONS.confirm / scale;
  const dispatched = reachedAt(o, "dispatched") ?? confirmed + STEP_DURATIONS.dispatch / scale;
  const etaFrom = ms(o.etaArrivalFrom);
  const etaTo = ms(o.etaArrivalTo);
  const arrived =
    reachedAt(o, "on_site") ??
    etaFrom ??
    (o.priority === "scheduled" ? ms(o.scheduledFor) : null) ??
    confirmed + ETA_HOURS[0] * (HOUR / scale);
  const flying = reachedAt(o, "flying") ?? arrived + STEP_DURATIONS.setup / scale;
  const processing = reachedAt(o, "processing") ?? flying + STEP_DURATIONS.flight / scale;
  const delivered = reachedAt(o, "delivered") ?? ms(o.reportDueAt) ?? processing + REPORT_HOURS * (HOUR / scale);
  const times: Record<StatusStep["status"], number> = {
    requested: created,
    confirmed,
    dispatched,
    on_site: arrived,
    flying,
    processing,
    delivered,
  };

  return STATUS_STEPS.map((step, i) => {
    const actual = reachedAt(o, step.status);
    let state: StepState;
    if (cancelled) state = i <= reachedIdx && actual !== null ? "done" : "skipped";
    else if (i < idx) state = "done";
    else if (i === idx) state = o.status === "delivered" ? "done" : "current";
    else state = "upcoming";
    // the current step's own time is when it was reached
    const isEstimate = actual === null;
    return {
      status: step.status,
      label: step.label,
      description: step.description,
      state,
      at: state === "skipped" ? null : iso(actual ?? times[step.status]),
      estimate: state !== "skipped" && isEstimate,
      windowTo: step.status === "on_site" && isEstimate ? iso(etaTo) : null,
    };
  });
}

/* ------------------------------------------------------------------ countdown */

export interface Milestone {
  /** the status we are waiting for */
  status: OrderStatus;
  /** "Crew arrival", "Take-off", ... */
  label: string;
  /** ring caption, upper case, reads after a unit: "UNTIL ARRIVAL" -> "HRS UNTIL ARRIVAL" */
  caption: string;
  /** target time (ms) - null when unknown */
  at: number | null;
  /** start of the current phase (ms), for the ring's progress */
  from: number | null;
  /** arrival window end (ms) while waiting for the crew */
  windowTo: number | null;
  /** at - now, never negative; null when `at` is unknown */
  remainingMs: number | null;
  /** 0..1 of the current phase elapsed */
  progress: number;
  /** past the target (or past the arrival window end) */
  overdue: boolean;
}

/**
 * What the order is waiting for right now and how long until it: drives the
 * Home ring and the tracking headline. Null for delivered / cancelled.
 */
export function nextMilestone(o: Order, now: number): Milestone | null {
  const scale = scaleOf(o);
  const make = (
    status: OrderStatus,
    label: string,
    caption: string,
    from: number | null,
    at: number | null,
    windowTo: number | null = null,
  ): Milestone => {
    const span = from !== null && at !== null ? at - from : 0;
    const progress = span > 0 ? Math.min(1, Math.max(0, (now - from!) / span)) : at !== null && now >= at ? 1 : 0;
    const deadline = windowTo ?? at;
    return {
      status,
      label,
      caption,
      at,
      from,
      windowTo,
      remainingMs: at === null ? null : Math.max(0, at - now),
      progress,
      overdue: deadline !== null && now > deadline,
    };
  };

  switch (o.status) {
    case "requested": {
      const created = ms(o.createdAt);
      return make(
        "confirmed",
        "Confirmation",
        "UNTIL CONFIRMED",
        created,
        created === null ? null : created + STEP_DURATIONS.confirm / scale,
      );
    }
    case "confirmed":
    case "dispatched": {
      const from = reachedAt(o, "confirmed") ?? ms(o.createdAt);
      const etaFrom = ms(o.etaArrivalFrom);
      const etaTo = ms(o.etaArrivalTo);
      // inside the window: count to its end ("arriving any minute")
      if (etaFrom !== null && now >= etaFrom && etaTo !== null) {
        return make("on_site", "Crew arriving", "LEFT IN WINDOW", etaFrom, etaTo, etaTo);
      }
      return make("on_site", "Crew arrival", "UNTIL ARRIVAL", from, etaFrom, etaTo);
    }
    case "on_site": {
      const arrived = reachedAt(o, "on_site");
      return make(
        "flying",
        "Take-off",
        "UNTIL TAKE-OFF",
        arrived,
        arrived === null ? null : arrived + STEP_DURATIONS.setup / scale,
      );
    }
    case "flying": {
      const started = reachedAt(o, "flying");
      return make(
        "processing",
        "Flight complete",
        "OF FLIGHT LEFT",
        started,
        started === null ? null : started + STEP_DURATIONS.flight / scale,
      );
    }
    case "processing": {
      const ended = reachedAt(o, "processing");
      const due = ms(o.reportDueAt) ?? (ended === null ? null : ended + REPORT_HOURS * (HOUR / scale));
      return make("delivered", "Report due", "UNTIL REPORT", ended, due);
    }
    default:
      return null;
  }
}

/**
 * One-line status headline for cards and the tracking screen, e.g.
 * "Crew arrives 14:10–15:10" or "Report due by 03:55".
 */
export function statusHeadline(o: Order, now: number): string {
  switch (o.status) {
    case "requested":
      return "Order received";
    case "confirmed":
      return o.etaArrivalFrom ? `Crew arrives ${clockRange(o.etaArrivalFrom, o.etaArrivalTo, now)}` : "Confirmed";
    case "dispatched":
      return o.crew ? `${o.crew.pilot} is on the way` : "Crew on the way";
    case "on_site":
      return "Crew on site";
    case "flying":
      return "Drone in the air";
    case "processing":
      return isDelayed(o)
        ? "Report taking longer than usual"
        : o.reportDueAt
          ? `Report due by ${sameDay(o.reportDueAt, now) ? time(o.reportDueAt) : `${dayLabel(o.reportDueAt, now)} ${time(o.reportDueAt)}`}`
          : "Processing the flight";
    case "delivered":
      return "Report ready";
    case "cancelled":
      return "Order cancelled";
    default:
      return statusLabel(o.status);
  }
}

function sameDay(isoA: string, now: number) {
  return yerevanParts(isoA)?.dayKey === yerevanParts(now)?.dayKey;
}

/** Screen-reader summary of an order, e.g. for a card's accessibilityLabel. */
export function orderSummary(o: Order, now: number): string {
  const m = nextMilestone(o, now);
  const parts = [`${kindLabel(o.kind)} ${o.number}`, statusHeadline(o, now)];
  if (m && m.remainingMs !== null && !m.overdue) parts.push(`${m.label} in ${countdown(m.remainingMs)}`);
  return parts.join(". ");
}

/* ------------------------------------------------------------------ status look */

export type OrderTone = "accent" | "ok" | "warn" | "danger" | "soft" | "dark";

/** Pill tone for a status (see Pill in components/ui). */
export function statusTone(s: OrderEventStatus | string): OrderTone {
  switch (s) {
    case "delivered":
      return "ok";
    case "cancelled":
      return "soft";
    case "delayed":
      return "warn";
    case "requested":
      return "dark";
    default:
      return "accent";
  }
}

/** Solid colour for dots/lines. */
export function statusColorFor(s: OrderEventStatus | string): string {
  switch (s) {
    case "delivered":
      return theme.colors.ok;
    case "cancelled":
      return theme.colors.faint;
    case "delayed":
      return theme.colors.warn;
    default:
      return theme.colors.accent;
  }
}

/* ------------------------------------------------------------------ lists */

/** Newest first. */
export function sortOrders<T extends Pick<Order, "createdAt">>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

/** The project's running order (at most one exists; newest wins if the cache briefly holds two). */
export function activeOrderOf<T extends Pick<Order, "status" | "createdAt">>(list: readonly T[] | undefined): T | null {
  if (!list?.length) return null;
  return sortOrders(list).find((o) => isActiveStatus(o.status)) ?? null;
}

/** Targeted-check focus chips from the latest findings: "Floor 13 structure". */
export function focusFromFindings(findings: readonly Pick<Finding, "floor" | "phase" | "daysBehind">[], limit = 8) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of [...findings].sort((a, b) => b.daysBehind - a.daysBehind)) {
    const label = `Floor ${f.floor} ${f.phase.replace(/[-_]/g, " ")}`;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push(label);
    if (out.length >= limit) break;
  }
  return out;
}

/* ------------------------------------------------------------------ scheduling */

/** Daylight flying slots (Yerevan wall time). */
export const SLOT_FIRST_HOUR = 9;
export const SLOT_LAST_HOUR = 17;

/**
 * ASAP promise for the order form: confirmation (~5 min) then 3-4 h.
 * Uses real time - the demo time scale is only known once the order exists.
 */
export function asapWindow(now: number): { from: string; to: string } {
  const confirmed = now + STEP_DURATIONS.confirm;
  return { from: new Date(confirmed + ETA_HOURS[0] * HOUR).toISOString(), to: new Date(confirmed + ETA_HOURS[1] * HOUR).toISOString() };
}

/** Earliest instant a scheduled order may start (server: >= 3 h ahead). */
export function earliestSchedule(now: number) {
  return now + MIN_SCHEDULE_LEAD_HOURS * HOUR;
}

export interface ScheduleDay {
  /** Yerevan day key (see yerevanParts) */
  dayKey: number;
  /** "Today", "Tomorrow", "Fri 26 Sep" */
  label: string;
  /** any slot on this day is still bookable */
  available: boolean;
}

export interface ScheduleSlot {
  iso: string;
  /** "09:00" */
  label: string;
  /** earlier than now + 3 h (show disabled) */
  disabled: boolean;
}

/** The next `count` Yerevan calendar days for the date chips. */
export function scheduleDays(now: number, count = 6): ScheduleDay[] {
  const today = yerevanParts(now)!.dayKey;
  return Array.from({ length: count }, (_, i) => {
    const dayKey = today + i;
    return {
      dayKey,
      label: dayLabel(yerevanDayStart(dayKey).getTime() + 12 * HOUR, now),
      available: scheduleSlots(dayKey, now).some((s) => !s.disabled),
    };
  });
}

/** Hourly daylight slots for one day; slots under the 3 h lead are disabled. */
export function scheduleSlots(dayKey: number, now: number): ScheduleSlot[] {
  const start = yerevanParts(yerevanDayStart(dayKey))!;
  const min = earliestSchedule(now);
  const out: ScheduleSlot[] = [];
  for (let h = SLOT_FIRST_HOUR; h <= SLOT_LAST_HOUR; h++) {
    const at = fromYerevan(start.year, start.month, start.day, h, 0);
    out.push({ iso: at.toISOString(), label: time(at), disabled: at.getTime() < min });
  }
  return out;
}
