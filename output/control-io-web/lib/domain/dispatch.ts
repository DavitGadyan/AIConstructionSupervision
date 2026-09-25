/**
 * Dispatch simulator: the pure state machine behind on-demand inspections.
 *
 *   requested -> confirmed (+5 min) -> dispatched (+15 min) -> on_site (a
 *   deterministic point in the arrival window) -> flying (+10 min setup) ->
 *   processing (+45 min flight) -> delivered (report built by the server)
 *
 * All durations are divided by the order's frozen time scale (240 in demos:
 * 1 h ~= 15 s). Every transition is stamped at the time it was *due*, not at
 * the time it was noticed, so advancing is idempotent and a server that was
 * down catches up with correct times. `advanceOrder` never applies
 * "delivered" itself: it returns `deliveryDue` and the server builds the
 * flight + PDF, then marks the order delivered.
 *
 * No I/O here - unit-tested in dispatch.test.ts.
 */
import {
  CANCELLABLE_STATUSES,
  ETA_HOURS,
  MIN_SCHEDULE_LEAD_HOURS,
  REPORT_HOURS,
  SLOT_FIRST_HOUR,
  SLOT_LAST_HOUR,
  type Crew,
  type OrderEventStatus,
  type OrderPriority,
  type OrderStatus,
  type ProjectAccess,
  type UserRole,
} from "./orderTypes";
import { crewFor, hash01 } from "./crews";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

/** Real-time durations (before dividing by the time scale). */
export const DURATIONS = {
  /** requested -> confirmed */
  confirmMs: 5 * MINUTE,
  /** confirmed -> dispatched (ASAP) */
  dispatchMs: 15 * MINUTE,
  /** ASAP arrival window after confirmation: [+3 h, +4 h] */
  etaFromMs: ETA_HOURS[0] * HOUR,
  etaToMs: ETA_HOURS[1] * HOUR,
  /** Scheduled: window = [scheduledFor, scheduledFor + 1 h]; the crew leaves base 1 h before it opens. */
  scheduledWindowMs: 1 * HOUR,
  scheduledDispatchLeadMs: 1 * HOUR,
  /** The crew never arrives sooner than this after leaving base. */
  minTravelMs: 5 * MINUTE,
  /** on_site -> flying */
  setupMs: 10 * MINUTE,
  /** flying -> processing */
  flightMs: 45 * MINUTE,
  /** Promise: independent PDF within 12 h of the flight. */
  reportMs: REPORT_HOURS * HOUR,
} as const;

/** Default simulated processing time (DISPATCH_PROCESSING_HOURS). Always capped at the 12 h promise. */
export const DEFAULT_PROCESSING_HOURS = 6;

export const MAX_TIME_SCALE = 100_000;

/** The order fields the simulator reads and writes (DB rows map onto this 1:1, crew parsed). */
export interface DispatchState {
  /** Stable per order; seeds the arrival point and the crew. */
  number: string;
  priority: OrderPriority;
  status: OrderStatus;
  createdAt: Date;
  scheduledFor: Date | null;
  confirmedAt: Date | null;
  dispatchedAt: Date | null;
  etaArrivalFrom: Date | null;
  etaArrivalTo: Date | null;
  arrivedAt: Date | null;
  flightStartedAt: Date | null;
  flightEndedAt: Date | null;
  reportDueAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  crew: Crew | null;
  timeScale: number;
}

export interface DispatchOptions {
  /** Simulated processing time after the flight, in real hours (default 6, capped at 12). */
  processingHours?: number;
}

export interface Transition {
  status: OrderStatus;
  /** When the status was due (the stamp written to the order and the event). */
  at: Date;
  message: string;
}

export type DispatchPatch = Partial<Omit<DispatchState, "number" | "priority" | "createdAt" | "scheduledFor" | "timeScale">>;

export interface AdvanceResult {
  /** The order after all due transitions (a copy; the input is not mutated). */
  order: DispatchState;
  /** Transitions applied by this call, oldest first. */
  transitions: Transition[];
  /** Only the fields that changed, ready for a DB update. */
  patch: DispatchPatch;
  changed: boolean;
  /** Status "processing": when the report is due to be delivered (the server builds it). Otherwise null. */
  deliveryDue: Date | null;
  /** Status "processing" and `now >= deliveryDue`. */
  deliveryReady: boolean;
  /** When the next automatic transition is due (null when processing or terminal). */
  nextDueAt: Date | null;
}

/** Projected (or actual, once reached) time of every milestone. */
export interface Timeline {
  confirmedAt: Date;
  etaArrivalFrom: Date;
  etaArrivalTo: Date;
  dispatchedAt: Date;
  arrivedAt: Date;
  flightStartedAt: Date;
  flightEndedAt: Date;
  reportDueAt: Date;
  deliveryDue: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function safeScale(scale: number | null | undefined): number {
  const n = Number(scale);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, MAX_TIME_SCALE);
}

export function processingMs(opts: DispatchOptions = {}): number {
  const h = Number(opts.processingHours ?? DEFAULT_PROCESSING_HOURS);
  const hours = Number.isFinite(h) && h > 0 ? h : DEFAULT_PROCESSING_HOURS;
  return Math.min(hours * HOUR, DURATIONS.reportMs);
}

const at = (base: Date, ms: number) => new Date(base.getTime() + ms);
const maxDate = (a: Date, b: Date) => (a.getTime() >= b.getTime() ? a : b);
const minDate = (a: Date, b: Date) => (a.getTime() <= b.getTime() ? a : b);

/** Where in the arrival window the crew pulls up: 10-90 % of the way, stable per order. */
export function arrivalFraction(seed: string): number {
  return 0.1 + 0.8 * hash01(`arrival:${seed}`);
}

/** Offset of the arrival point into a window of `widthMs`, in whole seconds (so stamps stay tidy). */
export function arrivalOffsetMs(seed: string, widthMs: number): number {
  return Math.min(widthMs, Math.round((arrivalFraction(seed) * widthMs) / 1000) * 1000);
}

/**
 * Projected timeline for an order at a given scale. Milestones already
 * reached use their stamps; the rest are derived from the previous one, so
 * the projection of a later step never changes when an earlier step is
 * applied at its due time.
 */
export function timeline(o: DispatchState, scale: number = o.timeScale, opts: DispatchOptions = {}): Timeline {
  const k = safeScale(scale);
  const d = (ms: number) => ms / k;
  const scheduled = o.priority === "scheduled" && o.scheduledFor != null;

  const confirmedAt = o.confirmedAt ?? at(o.createdAt, d(DURATIONS.confirmMs));
  const etaArrivalFrom = scheduled ? new Date(o.scheduledFor!.getTime()) : at(confirmedAt, d(DURATIONS.etaFromMs));
  const etaArrivalTo = scheduled ? at(o.scheduledFor!, d(DURATIONS.scheduledWindowMs)) : at(confirmedAt, d(DURATIONS.etaToMs));
  const dispatchedAt =
    o.dispatchedAt ??
    (scheduled
      ? maxDate(at(confirmedAt, d(DURATIONS.dispatchMs)), at(etaArrivalFrom, -d(DURATIONS.scheduledDispatchLeadMs)))
      : at(confirmedAt, d(DURATIONS.dispatchMs)));
  const point = at(etaArrivalFrom, arrivalOffsetMs(o.number, etaArrivalTo.getTime() - etaArrivalFrom.getTime()));
  const arrivedAt = o.arrivedAt ?? maxDate(point, at(dispatchedAt, d(DURATIONS.minTravelMs)));
  const flightStartedAt = o.flightStartedAt ?? at(arrivedAt, d(DURATIONS.setupMs));
  const flightEndedAt = o.flightEndedAt ?? at(flightStartedAt, d(DURATIONS.flightMs));
  const reportDueAt = at(flightEndedAt, d(DURATIONS.reportMs));
  const deliveryDue = minDate(at(flightEndedAt, d(processingMs(opts))), reportDueAt);
  return { confirmedAt, etaArrivalFrom, etaArrivalTo, dispatchedAt, arrivedAt, flightStartedAt, flightEndedAt, reportDueAt, deliveryDue };
}

/** Estimates stored on a new order (arrival window + report due), so clients can show them before confirmation. */
export function initialEstimates(o: DispatchState, scale: number = o.timeScale, opts: DispatchOptions = {}) {
  const t = timeline(o, scale, opts);
  return { etaArrivalFrom: t.etaArrivalFrom, etaArrivalTo: t.etaArrivalTo, reportDueAt: t.reportDueAt };
}

const NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  requested: "confirmed",
  confirmed: "dispatched",
  dispatched: "on_site",
  on_site: "flying",
  flying: "processing",
};

function dueOf(status: OrderStatus, t: Timeline): Date | null {
  switch (status) {
    case "confirmed":
      return t.confirmedAt;
    case "dispatched":
      return t.dispatchedAt;
    case "on_site":
      return t.arrivedAt;
    case "flying":
      return t.flightStartedAt;
    case "processing":
      return t.flightEndedAt;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Messages (events[].message, also used for notifications). Times in Yerevan.
// ---------------------------------------------------------------------------

/** Armenia has had no DST since 2012: Asia/Yerevan = UTC+4 all year. */
const YEREVAN_OFFSET_MS = 4 * HOUR;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const yerevan = (d: Date) => new Date(d.getTime() + YEREVAN_OFFSET_MS);
const dayKey = (d: Date) => {
  const y = yerevan(d);
  return `${y.getUTCFullYear()}-${y.getUTCMonth()}-${y.getUTCDate()}`;
};

/** "14:10" in Asia/Yerevan. */
export function hhmm(d: Date): string {
  const y = yerevan(d);
  return `${String(y.getUTCHours()).padStart(2, "0")}:${String(y.getUTCMinutes()).padStart(2, "0")}`;
}

/** "14:10", "tomorrow 03:55" or "25 Sep 10:00", relative to `ref` (Yerevan days). */
export function whenText(d: Date, ref: Date): string {
  if (dayKey(d) === dayKey(ref)) return hhmm(d);
  if (dayKey(d) === dayKey(at(ref, 24 * HOUR))) return `tomorrow ${hhmm(d)}`;
  const y = yerevan(d);
  return `${y.getUTCDate()} ${MONTHS[y.getUTCMonth()]} ${hhmm(d)}`;
}

export const DELAYED_MESSAGE = "Report is taking longer than usual. Our team is on it.";

/** Message for a status reached at `ref` with the order in its post-transition state. */
export function statusMessage(status: OrderEventStatus, o: Pick<DispatchState, "number" | "etaArrivalFrom" | "etaArrivalTo" | "crew" | "reportDueAt">, ref: Date = new Date()): string {
  switch (status) {
    case "requested":
      return `Order ${o.number} received.`;
    case "confirmed":
      if (!o.etaArrivalFrom || !o.etaArrivalTo) return "Confirmed.";
      // Demo time scales squeeze the 1 h window into seconds: say "around" rather than "between 14:10 and 14:10".
      if (hhmm(o.etaArrivalFrom) === hhmm(o.etaArrivalTo) && dayKey(o.etaArrivalFrom) === dayKey(o.etaArrivalTo))
        return `Confirmed. Crew arrives around ${whenText(o.etaArrivalFrom, ref)}.`;
      if (dayKey(o.etaArrivalFrom) === dayKey(o.etaArrivalTo) && dayKey(o.etaArrivalFrom) !== dayKey(ref))
        return `Confirmed. Crew arrives ${whenText(o.etaArrivalFrom, ref)}-${hhmm(o.etaArrivalTo)}.`;
      return `Confirmed. Crew arrives between ${whenText(o.etaArrivalFrom, ref)} and ${whenText(o.etaArrivalTo, ref)}.`;
    case "dispatched":
      return o.crew ? `${o.crew.pilot} is on the way (${o.crew.plate}).` : "Crew is on the way.";
    case "on_site":
      return "Crew on site.";
    case "flying":
      return "Drone in the air.";
    case "processing":
      return o.reportDueAt ? `Flight done. Report due by ${whenText(o.reportDueAt, ref)}.` : "Flight done.";
    case "delivered":
      return "Report ready.";
    case "cancelled":
      return "Order cancelled.";
    case "delayed":
      return DELAYED_MESSAGE;
  }
}

// ---------------------------------------------------------------------------
// The state machine
// ---------------------------------------------------------------------------

const PATCH_FIELDS = [
  "status",
  "confirmedAt",
  "dispatchedAt",
  "etaArrivalFrom",
  "etaArrivalTo",
  "arrivedAt",
  "flightStartedAt",
  "flightEndedAt",
  "reportDueAt",
  "crew",
] as const satisfies readonly (keyof DispatchPatch)[];

function same(a: unknown, b: unknown): boolean {
  if (a instanceof Date || b instanceof Date) return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  if (a && b && typeof a === "object") return JSON.stringify(a) === JSON.stringify(b);
  return a === b;
}

/**
 * Applies every transition that is due at `now`, each stamped at its due
 * time. Pure, idempotent (advancing twice to the same `now` changes nothing)
 * and split-safe (advance(t1) then advance(t2) == advance(t2)).
 * Never moves "cancelled" or "delivered", and never applies "delivered".
 */
export function advanceOrder(o: DispatchState, now: Date, scale: number = o.timeScale, opts: DispatchOptions = {}): AdvanceResult {
  const cur: DispatchState = { ...o, crew: o.crew ? { ...o.crew } : null };
  const transitions: Transition[] = [];

  if (o.status === "cancelled" || o.status === "delivered") {
    return { order: cur, transitions, patch: {}, changed: false, deliveryDue: null, deliveryReady: false, nextDueAt: null };
  }

  for (let guard = 0; guard < 10; guard++) {
    const next = NEXT[cur.status];
    if (!next) break;
    const t = timeline(cur, scale, opts);
    const due = dueOf(next, t)!;
    if (due.getTime() > now.getTime()) break;

    switch (next) {
      case "confirmed":
        cur.confirmedAt = due;
        cur.etaArrivalFrom = t.etaArrivalFrom;
        cur.etaArrivalTo = t.etaArrivalTo;
        break;
      case "dispatched":
        cur.dispatchedAt = due;
        cur.crew = cur.crew ?? crewFor(cur.number);
        break;
      case "on_site":
        cur.arrivedAt = due;
        break;
      case "flying":
        cur.flightStartedAt = due;
        break;
      case "processing":
        cur.flightEndedAt = due;
        break;
    }
    cur.status = next;
    // Refresh the report estimate from the updated stamps (actual once the flight is done).
    cur.reportDueAt = timeline(cur, scale, opts).reportDueAt;
    transitions.push({ status: next, at: due, message: statusMessage(next, cur, due) });
  }

  // Keep the stored estimates in sync even when no transition was due (e.g. a brand-new order).
  const t = timeline(cur, scale, opts);
  if (cur.status === "requested") {
    cur.etaArrivalFrom = t.etaArrivalFrom;
    cur.etaArrivalTo = t.etaArrivalTo;
  }
  cur.reportDueAt = t.reportDueAt;

  const patch: DispatchPatch = {};
  for (const f of PATCH_FIELDS) {
    if (!same(o[f], cur[f])) (patch as Record<string, unknown>)[f] = cur[f];
  }

  const processing = cur.status === "processing";
  const next = NEXT[cur.status];
  return {
    order: cur,
    transitions,
    patch,
    changed: Object.keys(patch).length > 0,
    deliveryDue: processing ? t.deliveryDue : null,
    deliveryReady: processing && t.deliveryDue.getTime() <= now.getTime(),
    nextDueAt: next ? dueOf(next, t) : null,
  };
}

// ---------------------------------------------------------------------------
// Rules shared by the API and the apps
// ---------------------------------------------------------------------------

export interface CancelContext {
  /** The caller's role in their own org. */
  role: UserRole | string;
  /** The caller's effective access to the order's project. */
  access: ProjectAccess | null;
  /** The order was placed by the caller's org. */
  orderedByCallerOrg: boolean;
}

/** Whether the caller may cancel an order in `status` (API.md roles matrix). */
export function canCancel(status: OrderStatus, ctx: CancelContext): boolean {
  if (!(CANCELLABLE_STATUSES as readonly string[]).includes(status)) return false;
  return cancelAllowedByRole(ctx);
}

/** The role/share half of canCancel (403 when false), independent of the status (409). */
export function cancelAllowedByRole(ctx: CancelContext): boolean {
  if (ctx.role === "viewer") return false;
  if (ctx.access === "write") return true; // own-org owner/supervisor: any order on the project
  if (ctx.access === "order") return ctx.orderedByCallerOrg; // shared org: its own orders only
  return false;
}

export const MIN_SCHEDULE_LEAD_MS = MIN_SCHEDULE_LEAD_HOURS * HOUR;

/** Earliest allowed `scheduledFor` for an order placed at `now` (real time, never scaled). */
export function earliestScheduledFor(now: Date): Date {
  return at(now, MIN_SCHEDULE_LEAD_MS);
}

/** `scheduledFor` is at least 3 h after `now`. */
export function scheduleLeadOk(scheduledFor: Date, now: Date): boolean {
  return scheduledFor.getTime() >= earliestScheduledFor(now).getTime();
}

/**
 * Daylight flying only: `scheduledFor` starts between SLOT_FIRST_HOUR:00 and
 * SLOT_LAST_HOUR:00 Asia/Yerevan time, both inclusive (the mobile wizard's
 * hourly slots are exactly these starts).
 */
export function scheduleInDaylight(scheduledFor: Date): boolean {
  const y = yerevan(scheduledFor);
  const msOfDay = y.getUTCHours() * HOUR + y.getUTCMinutes() * MINUTE + y.getUTCSeconds() * 1000 + y.getUTCMilliseconds();
  return msOfDay >= SLOT_FIRST_HOUR * HOUR && msOfDay <= SLOT_LAST_HOUR * HOUR;
}

/** "09:00 and 17:00": the daylight slot bounds, for messages. */
export function daylightWindowText(): string {
  const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
  return `${hh(SLOT_FIRST_HOUR)} and ${hh(SLOT_LAST_HOUR)}`;
}
