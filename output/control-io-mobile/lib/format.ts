/**
 * Formatting helpers. Every clock time and date is shown in Asia/Yerevan: the
 * service only runs in Yerevan & Kotayk, so a site manager abroad (or the
 * screenshot machine) must see the same "14:10" the crew sees.
 *
 * Armenia has had no daylight saving since 2012, so Yerevan is a fixed UTC+4.
 * We compute it by offset instead of Intl `timeZone`, which Hermes does not
 * support on every platform.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const YEREVAN_TZ = "Asia/Yerevan";
/** UTC+4, no DST. */
export const YEREVAN_OFFSET_MIN = 240;
const OFFSET_MS = YEREVAN_OFFSET_MIN * 60_000;
const DAY_MS = 86_400_000;

type DateInput = string | number | Date | null | undefined;

function d(v: DateInput): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const x = v instanceof Date ? v : new Date(v);
  return Number.isNaN(x.getTime()) ? null : x;
}

const pad = (n: number) => String(n).padStart(2, "0");

export interface YerevanParts {
  year: number;
  /** 0-11 */
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** 0 = Sunday */
  weekday: number;
  /** days since epoch in Yerevan wall time: equal keys = same calendar day */
  dayKey: number;
}

/** Wall-clock parts of an instant in Asia/Yerevan. */
export function yerevanParts(v: DateInput): YerevanParts | null {
  const x = d(v);
  if (!x) return null;
  const shifted = new Date(x.getTime() + OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
    dayKey: Math.floor(shifted.getTime() / DAY_MS),
  };
}

/** The instant for a Yerevan wall-clock time (month is 0-11). */
export function fromYerevan(year: number, month: number, day: number, hour = 0, minute = 0): Date {
  return new Date(Date.UTC(year, month, day, hour, minute) - OFFSET_MS);
}

/** Midnight (Yerevan) of the day `dayKey` from yerevanParts(). */
export function yerevanDayStart(dayKey: number): Date {
  return new Date(dayKey * DAY_MS - OFFSET_MS);
}

/** "24.03" - the ORDI card date style */
export function shortDate(iso?: DateInput) {
  const p = yerevanParts(iso);
  return p ? `${pad(p.day)}.${pad(p.month + 1)}` : "-";
}

/** "7 Sep 2026" */
export function longDate(iso?: DateInput) {
  const p = yerevanParts(iso);
  return p ? `${p.day} ${MONTHS[p.month]} ${p.year}` : "-";
}

/** "09:12" (Yerevan) */
export function time(iso?: DateInput) {
  const p = yerevanParts(iso);
  return p ? `${pad(p.hour)}:${pad(p.minute)}` : "--:--";
}

export function dateTime(iso?: DateInput) {
  return `${longDate(iso)}, ${time(iso)}`;
}

/** "Today" | "Tomorrow" | "Yesterday" | "Wed 24 Sep" (Yerevan calendar days). */
export function dayLabel(iso: DateInput, now: number = Date.now()) {
  const p = yerevanParts(iso);
  const n = yerevanParts(now);
  if (!p || !n) return "-";
  const diff = p.dayKey - n.dayKey;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  const sameYear = p.year === n.year;
  return `${WEEKDAYS[p.weekday]} ${p.day} ${MONTHS[p.month]}${sameYear ? "" : ` ${p.year}`}`;
}

/** "Today, 14:10" */
export function dayTime(iso: DateInput, now: number = Date.now()) {
  if (!d(iso)) return "-";
  return `${dayLabel(iso, now)}, ${time(iso)}`;
}

/**
 * Both instants show the same Yerevan clock minute on the same day. A demo
 * time scale squeezes the 1 h arrival window into seconds, so its ends
 * often do.
 */
export function sameClockMinute(a: DateInput, b: DateInput) {
  const x = yerevanParts(a);
  const y = yerevanParts(b);
  return !!x && !!y && x.dayKey === y.dayKey && x.hour === y.hour && x.minute === y.minute;
}

/**
 * Arrival window "14:10–15:10". If the window ends on another day than it
 * starts, the end gets its day: "23:30 – Tomorrow 00:30". A window within one
 * minute reads "around 14:10" (the server's event messages word it that way too).
 */
export function clockRange(from: DateInput, to: DateInput, now: number = Date.now()) {
  const a = yerevanParts(from);
  const b = yerevanParts(to);
  if (!a && !b) return "--:--";
  if (!a || !b) return time(a ? from : to);
  if (sameClockMinute(from, to)) return `around ${time(from)}`;
  if (a.dayKey === b.dayKey) return `${time(from)}–${time(to)}`;
  return `${time(from)} – ${dayLabel(to, now)} ${time(to)}`;
}

/** Spoken form of clockRange for screen readers: "between 14:10 and 15:10", or "around 14:10". */
export function clockRangeSpoken(from: DateInput, to: DateInput) {
  if (!d(from) || !d(to)) return time(d(from) ? from : to);
  if (sameClockMinute(from, to)) return `around ${time(from)}`;
  return `between ${time(from)} and ${time(to)}`;
}

/**
 * Human countdown: "3 h 12 min", "12 min", "45 s", "now".
 * Minutes round up, and the last minute counts down in seconds.
 */
export function countdown(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "now";
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s} s`;
  const totalMin = Math.ceil(s / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  if (h >= 48) return `${Math.round(h / 24)} days`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/**
 * ORDI ring face: { value: "03:12", unit: "HOURS" } while an hour or more is
 * left, then { value: "12:05", unit: "MINUTES" } (mm:ss).
 */
export function countdownClock(ms: number): { value: string; unit: "HOURS" | "MINUTES" } {
  if (!Number.isFinite(ms) || ms <= 0) return { value: "00:00", unit: "MINUTES" };
  const s = Math.ceil(ms / 1000);
  if (s >= 3600) {
    const totalMin = Math.floor(s / 60);
    return { value: `${pad(Math.floor(totalMin / 60))}:${pad(totalMin % 60)}`, unit: "HOURS" };
  }
  return { value: `${pad(Math.floor(s / 60))}:${pad(s % 60)}`, unit: "MINUTES" };
}

/** "3–4 h" from [3, 4]; "12 h" from 12. */
export function hoursLabel(h: number | readonly [number, number]) {
  if (typeof h === "number") return `${h} h`;
  return h[0] === h[1] ? `${h[0]} h` : `${h[0]}–${h[1]} h`;
}

/** "225 000 AMD" (thin no-break space groups, as printed on invoices). */
export function amd(n: number | null | undefined, withCurrency = true) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  const whole = Math.round(n);
  const grouped = String(Math.abs(whole)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${whole < 0 ? "−" : ""}${grouped}${withCurrency ? " AMD" : ""}`;
}

/** Spoken price: "225000 drams". */
export function amdSpoken(n: number | null | undefined) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "price unavailable";
  return `${Math.round(n)} drams`;
}

export function pct(n: number | null | undefined, digits = 0) {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return `${n.toFixed(digits)}%`;
}

export function titleCase(s?: string | null) {
  if (!s) return "";
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function coord(n?: number | null, pos = "N", neg = "S") {
  if (n === null || n === undefined) return "-";
  return `${Math.abs(n).toFixed(5)}° ${n >= 0 ? pos : neg}`;
}

/** "40.19850° N, 44.53720° E" */
export function latLng(lat?: number | null, lng?: number | null) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return "-";
  return `${coord(lat)}, ${coord(lng, "E", "W")}`;
}

export function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function relative(iso?: DateInput) {
  const x = d(iso);
  if (!x) return "never";
  const s = Math.round((Date.now() - x.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

/** "12 400 m²" */
export function area(m2?: number | null) {
  if (m2 === null || m2 === undefined || !Number.isFinite(m2)) return "-";
  return `${amd(m2, false)} m²`;
}

/* ------------------------------------------------------------ contact links */

/** tel: link, keeping only dialable characters. */
export function telHref(phone?: string | null) {
  const digits = (phone ?? "").replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : undefined;
}

export function mailHref(email?: string | null) {
  const e = (email ?? "").trim();
  return e ? `mailto:${e}` : undefined;
}

/** https:// link for a website that may be stored without a scheme. */
export function webHref(url?: string | null) {
  const u = (url ?? "").trim();
  if (!u) return undefined;
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

/** "adb.am" from "https://www.adb.am/" */
export function prettyUrl(url?: string | null) {
  return (url ?? "").trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
}
