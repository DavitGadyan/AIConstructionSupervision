/**
 * Pure helpers for the web order screens (no React, safe on server and client).
 * Every time shown to a customer is Asia/Yerevan: Armenia has had no DST since
 * 2012, so it is a fixed UTC+4 and formatting by hand keeps server and client
 * output identical (no Intl/ICU differences, no hydration mismatches).
 */
import { STATUS_ORDER, statusIndex, type OrderDto, type OrderEventStatus, type OrderStatus } from "@/lib/domain/orderTypes";

const OFFSET_MS = 4 * 3_600_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");
const ms = (d: Date | string | number) => (d instanceof Date ? d.getTime() : typeof d === "number" ? d : Date.parse(d));
const yv = (d: Date | string | number) => new Date(ms(d) + OFFSET_MS);
const dayKey = (d: Date | string | number) => {
  const y = yv(d);
  return `${y.getUTCFullYear()}-${y.getUTCMonth()}-${y.getUTCDate()}`;
};

/** "14:10" */
export function yTime(d: Date | string | number): string {
  const y = yv(d);
  return `${pad(y.getUTCHours())}:${pad(y.getUTCMinutes())}`;
}

/** "14:10:05" */
export function yClock(d: Date | string | number): string {
  const y = yv(d);
  return `${yTime(d)}:${pad(y.getUTCSeconds())}`;
}

/** "23 Sep" */
export function yDate(d: Date | string | number): string {
  const y = yv(d);
  return `${y.getUTCDate()} ${MONTHS[y.getUTCMonth()]}`;
}

/** "23 Sep 2026, 14:10" */
export function yDateTime(d: Date | string | number): string {
  return `${yDate(d)} ${yv(d).getUTCFullYear()}, ${yTime(d)}`;
}

/** "14:10", "tomorrow 03:55", "yesterday 22:10" or "25 Sep 10:00", relative to `ref` (Yerevan days). */
export function yWhen(d: Date | string | number, ref: Date | string | number): string {
  const k = dayKey(d);
  if (k === dayKey(ref)) return yTime(d);
  if (k === dayKey(ms(ref) + 86_400_000)) return `tomorrow ${yTime(d)}`;
  if (k === dayKey(ms(ref) - 86_400_000)) return `yesterday ${yTime(d)}`;
  return `${yDate(d)} ${yTime(d)}`;
}

/** Yerevan hour of day (0-23), for the daylight hint. */
export function yHour(d: Date | string | number): number {
  return yv(d).getUTCHours();
}

/** Value for <input type="datetime-local"> showing `d` as Yerevan wall time: "2026-09-23T17:40". */
export function toYerevanInput(d: Date | number): string {
  const y = yv(d);
  return `${y.getUTCFullYear()}-${pad(y.getUTCMonth() + 1)}-${pad(y.getUTCDate())}T${pad(y.getUTCHours())}:${pad(y.getUTCMinutes())}`;
}

/** Reads a datetime-local value as Yerevan wall time. Invalid -> null. */
export function fromYerevanInput(v: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return null;
  const d = new Date(`${v.slice(0, 16)}:00+04:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "2 h 41 min", "12 min", "40 s" (never negative). */
export function fmtLeft(msLeft: number): string {
  const s = Math.max(0, Math.round(msLeft / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** Ring-gauge clock: "2:41" hours, or "41:05" minutes under an hour. */
export function clock(msLeft: number): { value: string; unit: "hours" | "min" } {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  if (s >= 3600) return { value: `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}`, unit: "hours" };
  return { value: `${pad(Math.floor(s / 60))}:${pad(s % 60)}`, unit: "min" };
}

// ---------------------------------------------------------------------------
// Status copy
// ---------------------------------------------------------------------------

/** Short label (pills, feed). */
export const STATUS_LABEL: Record<OrderEventStatus, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  dispatched: "On the way",
  on_site: "On site",
  flying: "In the air",
  processing: "Processing",
  delivered: "Delivered",
  cancelled: "Cancelled",
  delayed: "Delayed",
};

/** Big headline per status (two lines on the detail page). */
export const STATUS_TITLE: Record<OrderStatus, [string, string]> = {
  requested: ["Order", "received"],
  confirmed: ["Crew", "confirmed"],
  dispatched: ["Crew on", "the way"],
  on_site: ["Crew", "on site"],
  flying: ["Drone in", "the air"],
  processing: ["Building", "the report"],
  delivered: ["Report", "ready"],
  cancelled: ["Order", "cancelled"],
};

/** Stepper row labels, in order. */
export const STEP_LABEL: Record<(typeof STATUS_ORDER)[number], string> = {
  requested: "Order received",
  confirmed: "Confirmed",
  dispatched: "Crew dispatched",
  on_site: "Crew on site",
  flying: "Drone in the air",
  processing: "Processing imagery",
  delivered: "Report delivered",
};

export type PillTone = "accent" | "grey" | "dark" | "light" | "danger" | "warn" | "ok";

export function statusTone(s: OrderEventStatus): PillTone {
  if (s === "delivered") return "dark";
  if (s === "cancelled") return "light";
  if (s === "delayed") return "warn";
  if (s === "processing") return "grey";
  return "accent";
}

export const isTerminal = (s: OrderStatus) => s === "delivered" || s === "cancelled";

// ---------------------------------------------------------------------------
// Timeline estimates (actual stamp when reached, else an estimate)
// ---------------------------------------------------------------------------

const MIN = 60_000;
const HOUR = 60 * MIN;

export interface StepView {
  status: (typeof STATUS_ORDER)[number];
  label: string;
  state: "done" | "current" | "next" | "skipped";
  /** Reached: the stamp. Not reached: the estimate (or the window start). */
  at: number | null;
  /** Not reached, arrival only: the window end. */
  until: number | null;
  estimate: boolean;
  /** "by" (deadline) rather than "~" (estimate). */
  deadline: boolean;
  message: string | null;
}

export function stepViews(o: OrderDto): StepView[] {
  const sc = Math.max(1, o.timeScale || 1);
  const t = (iso: string | null | undefined) => (iso ? Date.parse(iso) : null);
  const ev = (s: OrderEventStatus) => o.events.find((e) => e.status === s);
  const created = Date.parse(o.createdAt);
  const confirmed = t(ev("confirmed")?.at) ?? created + (5 * MIN) / sc;
  const winFrom = t(o.etaArrivalFrom);
  const winTo = t(o.etaArrivalTo);
  const dispatched = t(ev("dispatched")?.at) ?? (o.priority === "asap" || !winFrom ? confirmed + (15 * MIN) / sc : winFrom - HOUR / sc);
  const arrived = t(o.arrivedAt);
  const flying = t(o.flightStartedAt) ?? ((arrived ?? winFrom ?? dispatched) + (10 * MIN) / sc);
  const landed = t(o.flightEndedAt) ?? flying + (45 * MIN) / sc;
  const idx = o.status === "cancelled" ? -1 : statusIndex(o.status);
  const reached = new Set(o.events.map((e) => e.status));
  const est: Record<StepView["status"], number | null> = {
    requested: created,
    confirmed,
    dispatched,
    on_site: arrived ?? winFrom,
    flying,
    processing: landed,
    delivered: t(o.deliveredAt) ?? t(o.reportDueAt),
  };
  return STATUS_ORDER.map((s, i) => {
    const done = o.status === "cancelled" ? reached.has(s) : i <= idx;
    const state: StepView["state"] =
      o.status === "cancelled" ? (done ? "done" : "skipped") : done ? (i === idx && s !== "delivered" ? "current" : "done") : "next";
    const e = ev(s);
    return {
      status: s,
      label: STEP_LABEL[s],
      state,
      at: done ? (t(e?.at) ?? est[s]) : est[s],
      until: !done && s === "on_site" && !arrived ? winTo : null,
      estimate: !done,
      deadline: !done && s === "delivered",
      message: e?.message ?? null,
    };
  });
}

/** What the countdown ring counts down to right now. */
export interface Countdown {
  /** null = nothing to count (terminal). */
  target: number | null;
  /** Start of the current phase, for the ring's progress. */
  from: number;
  caption: string;
  /** One sentence under the headline. */
  sentence: string;
  overdue: boolean;
}

export function countdown(o: OrderDto, now: number): Countdown {
  const sc = Math.max(1, o.timeScale || 1);
  const t = (iso: string | null | undefined) => (iso ? Date.parse(iso) : null);
  const created = Date.parse(o.createdAt);
  const winFrom = t(o.etaArrivalFrom);
  const winTo = t(o.etaArrivalTo);
  const win = winFrom && winTo ? (yTime(winFrom) === yTime(winTo) ? `around ${yWhen(winFrom, now)}` : `between ${yWhen(winFrom, now)} and ${yWhen(winTo, now)}`) : null;
  switch (o.status) {
    case "requested":
    case "confirmed":
    case "dispatched": {
      if (winFrom && now < winFrom) {
        return { target: winFrom, from: created, caption: "to arrival", sentence: `Car + drone crew arrives ${win}.`, overdue: false };
      }
      return { target: winTo ?? winFrom, from: winFrom ?? created, caption: "arriving now", sentence: `The crew is arriving: window ends ${winTo ? yWhen(winTo, now) : "soon"}.`, overdue: !!winTo && now > winTo };
    }
    case "on_site": {
      const from = t(o.arrivedAt) ?? now;
      return { target: from + (10 * MIN) / sc, from, caption: "to take-off", sentence: "The crew is setting up the drone on site.", overdue: false };
    }
    case "flying": {
      const from = t(o.flightStartedAt) ?? now;
      return { target: from + (45 * MIN) / sc, from, caption: "to landing", sentence: "All facades, nadir and orbit shots are being captured.", overdue: false };
    }
    case "processing": {
      const from = t(o.flightEndedAt) ?? now;
      const due = t(o.reportDueAt);
      const delayed = o.events.some((e) => e.status === "delayed");
      return {
        target: due,
        from,
        caption: "to report",
        sentence: delayed ? "The report is taking longer than usual. Our team is on it." : `Independent PDF report due by ${due ? yWhen(due, now) : "12 h after the flight"}.`,
        overdue: !!due && now > due,
      };
    }
    case "delivered":
      return { target: null, from: created, caption: "Report delivered", sentence: `Delivered ${o.deliveredAt ? yWhen(o.deliveredAt, now) : ""}. The PDF is signed with SHA-256 hashes of every shot.`, overdue: false };
    case "cancelled":
      return { target: null, from: created, caption: "Cancelled", sentence: "This order was cancelled before the crew arrived on site.", overdue: false };
  }
}

/** Freshness rank so an SSE push and a poll response arriving out of order never step back. */
export function orderRank(o: OrderDto): number {
  const s = o.status === "cancelled" ? 50 : statusIndex(o.status);
  return s * 1000 + o.events.length;
}
