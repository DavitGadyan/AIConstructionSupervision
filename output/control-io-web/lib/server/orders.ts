/**
 * On-demand inspections (API.md "On-demand inspections (v1.1)").
 *
 * - create / list / get / cancel, with the roles matrix from API.md.
 * - `advanceAndPersist` runs on every read and on the ticker: the pure
 *   dispatch simulator (lib/domain/dispatch.ts) computes the due transitions,
 *   they are written with one version-checked update that also upserts one
 *   event row each (a single transaction), and `publish(projectId, "order",
 *   dto)` runs after commit. A busy database postpones the write, never fails
 *   the read.
 * - `deliverOrder` claims a lease, builds (or reuses) the order's flight and
 *   PDF report and marks the order delivered. After 3 failed attempts it
 *   emits a single "delayed" event and keeps retrying with backoff.
 */
import path from "node:path";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { backoff, db, isTransientDbError, retryTransient, TX_OPTIONS } from "./db";
import { publish } from "./events";
import { fileUrl, get, put } from "./storage";
import { HttpError, accessMap, projectForSession, readableProjectIds, type Session } from "./auth";
import { processFlight } from "./pipeline";
import { buildReport } from "./report";
import {
  advanceOrder,
  canCancel,
  cancelAllowedByRole,
  daylightWindowText,
  initialEstimates,
  safeScale,
  scheduleInDaylight,
  scheduleLeadOk,
  statusMessage,
  type AdvanceResult,
  type DispatchPatch,
  type DispatchState,
} from "../domain/dispatch";
import { inServiceArea, SERVICE_AREA_NAME } from "../domain/serviceArea";
import { priceAmd } from "../domain/pricing";
import {
  ACTIVE_STATUSES,
  CANCELLABLE_STATUSES,
  MIN_SCHEDULE_LEAD_HOURS,
  ORDER_KINDS,
  ORDER_PRIORITIES,
  STATUS_ORDER,
  isActiveStatus,
  type Crew,
  type OrderDto,
  type OrderEventStatus,
  type OrderKind,
  type OrderPriority,
  type OrderStatus,
  type ProjectAccess,
} from "../domain/orderTypes";

// ---------------------------------------------------------------------------
// Config (see .env.example)
// ---------------------------------------------------------------------------

/**
 * DISPATCH_SIMULATOR: "on" runs the ticker and advance-on-read (the simulator
 * invents crews, flights and PDF reports from earlier imagery); "off"
 * disables both (real ops drive orders). Unset: on in development and tests,
 * OFF in production (NODE_ENV=production), so a production server never
 * fakes fulfilment for real customer orders unless DISPATCH_SIMULATOR=on is
 * set explicitly (a demo install); the ticker then logs a warning at startup.
 */
export function simulatorOn(): boolean {
  const v = process.env.DISPATCH_SIMULATOR?.trim().toLowerCase();
  if (v) return v !== "off";
  return process.env.NODE_ENV !== "production";
}

/** DISPATCH_TIME_SCALE, frozen on each new order (1 = real time, 240 = 1 h in 15 s). */
export function currentTimeScale(): number {
  return safeScale(Number(process.env.DISPATCH_TIME_SCALE ?? 1));
}

/** DISPATCH_PROCESSING_HOURS (default 6, capped at the 12 h promise by the simulator). */
export function processingHours(): number {
  const n = Number(process.env.DISPATCH_PROCESSING_HOURS);
  return Number.isFinite(n) && n > 0 ? n : 6;
}

// ---------------------------------------------------------------------------
// Validation (zod)
// ---------------------------------------------------------------------------

/** Digits, spaces, + - ( ), 6-20 characters, at least 6 digits. */
export const PHONE_RE = /^[0-9+\-() ]{6,20}$/;
const phone = z
  .string()
  .trim()
  .regex(PHONE_RE, "Use digits, spaces and + - ( ), 6-20 characters")
  .refine((v) => (v.match(/\d/g)?.length ?? 0) >= 6, "A phone number needs at least 6 digits");

const MAX_SCHEDULE_AHEAD_MS = 90 * 24 * 3_600_000;

/** A full ISO-8601 date-time with an explicit zone ("…Z" or "…+04:00"): a bare date or local time would depend on the server's time zone. */
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})$/i;

export const CreateOrderSchema = z
  .object({
    projectId: z.string().trim().min(1, "Required"),
    kind: z.enum(ORDER_KINDS),
    priority: z.enum(ORDER_PRIORITIES),
    scheduledFor: z.string().trim().nullish(),
    contactName: z.string().trim().min(1, "Required").max(120),
    contactPhone: phone,
    accessNotes: z.string().trim().max(1000).nullish(),
    focus: z.array(z.string().trim().min(1).max(120)).max(20, "At most 20 focus items").optional(),
  })
  .superRefine((v, ctx) => {
    if (v.priority !== "scheduled") return;
    if (!v.scheduledFor) {
      ctx.addIssue({ code: "custom", path: ["scheduledFor"], message: "Required for a scheduled order" });
      return;
    }
    const t = ISO_DATE_TIME.test(v.scheduledFor) ? Date.parse(v.scheduledFor) : Number.NaN;
    const now = new Date();
    if (Number.isNaN(t)) ctx.addIssue({ code: "custom", path: ["scheduledFor"], message: "Must be an ISO-8601 date-time with a time zone, e.g. 2026-09-25T06:00:00Z" });
    else if (!scheduleLeadOk(new Date(t), now)) ctx.addIssue({ code: "custom", path: ["scheduledFor"], message: `Must be at least ${MIN_SCHEDULE_LEAD_HOURS} h from now` });
    else if (t - now.getTime() > MAX_SCHEDULE_AHEAD_MS) ctx.addIssue({ code: "custom", path: ["scheduledFor"], message: "Must be within 90 days" });
    else if (!scheduleInDaylight(new Date(t))) {
      ctx.addIssue({ code: "custom", path: ["scheduledFor"], message: `We fly in daylight only: start between ${daylightWindowText()} Yerevan time` });
    }
  });
export type CreateOrderBody = z.infer<typeof CreateOrderSchema>;

export const QuoteQuerySchema = z.object({ kind: z.enum(ORDER_KINDS), priority: z.enum(ORDER_PRIORITIES) });

// ---------------------------------------------------------------------------
// Rows and DTOs
// ---------------------------------------------------------------------------

export const orderInclude = {
  project: { select: { name: true, address: true, orgId: true } },
  requestedBy: { select: { id: true, name: true } },
  events: true,
  report: { select: { fileKey: true } },
} satisfies Prisma.InspectionOrderInclude;

export type OrderRow = Prisma.InspectionOrderGetPayload<{ include: typeof orderInclude }>;

/** Who is looking at an order (for canCancel). */
export interface OrderViewer {
  orgId: string;
  role: string;
  access: ProjectAccess | null;
}

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function parseCrew(json: string | null): Crew | null {
  if (!json) return null;
  try {
    const c = JSON.parse(json);
    return c && typeof c === "object" ? (c as Crew) : null;
  } catch {
    return null;
  }
}

function parseFocus(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

const eventRank = (s: string) => (s === "delayed" ? STATUS_ORDER.indexOf("processing") + 0.5 : s === "cancelled" ? 99 : STATUS_ORDER.indexOf(s as (typeof STATUS_ORDER)[number]));

export function toState(row: Pick<OrderRow, keyof Omit<DispatchState, "crew" | "priority" | "status">> & { crew: string | null; priority: string; status: string }): DispatchState {
  return {
    number: row.number,
    priority: row.priority as OrderPriority,
    status: row.status as OrderStatus,
    createdAt: row.createdAt,
    scheduledFor: row.scheduledFor,
    confirmedAt: row.confirmedAt,
    dispatchedAt: row.dispatchedAt,
    etaArrivalFrom: row.etaArrivalFrom,
    etaArrivalTo: row.etaArrivalTo,
    arrivedAt: row.arrivedAt,
    flightStartedAt: row.flightStartedAt,
    flightEndedAt: row.flightEndedAt,
    reportDueAt: row.reportDueAt,
    deliveredAt: row.deliveredAt,
    cancelledAt: row.cancelledAt,
    crew: parseCrew(row.crew),
    timeScale: row.timeScale,
  };
}

/**
 * The ordering org as a viewer: the `canCancel` of the payload handed to the
 * event bus. The SSE route (/api/projects/:id/live) recomputes `canCancel`
 * for each subscriber before sending, so no client ever sees this value.
 */
function orderingViewer(row: OrderRow): OrderViewer {
  return { orgId: row.orgId, role: "supervisor", access: row.orgId === row.project.orgId ? "write" : "order" };
}

export function toOrderDto(row: OrderRow, viewer: OrderViewer | null): OrderDto {
  const status = row.status as OrderStatus;
  const events = [...row.events].sort((a, b) => a.at.getTime() - b.at.getTime() || eventRank(a.status) - eventRank(b.status));
  return {
    id: row.id,
    number: row.number,
    projectId: row.projectId,
    projectName: row.project.name,
    projectAddress: row.project.address,
    orgId: row.orgId,
    kind: row.kind as OrderKind,
    priority: row.priority as OrderPriority,
    status,
    createdAt: row.createdAt.toISOString(),
    scheduledFor: iso(row.scheduledFor),
    etaArrivalFrom: iso(row.etaArrivalFrom),
    etaArrivalTo: iso(row.etaArrivalTo),
    arrivedAt: iso(row.arrivedAt),
    flightStartedAt: iso(row.flightStartedAt),
    flightEndedAt: iso(row.flightEndedAt),
    reportDueAt: iso(row.reportDueAt),
    deliveredAt: iso(row.deliveredAt),
    reportId: row.reportId,
    reportUrl: row.report ? fileUrl(row.report.fileKey) : null,
    crew: parseCrew(row.crew),
    contactName: row.contactName,
    contactPhone: row.contactPhone,
    accessNotes: row.accessNotes,
    focus: parseFocus(row.focus),
    requestedBy: { id: row.requestedBy.id, name: row.requestedBy.name },
    events: events.map((e) => ({ at: e.at.toISOString(), status: e.status as OrderEventStatus, message: e.message })),
    priceAmd: row.priceAmd,
    canCancel: viewer ? canCancel(status, { role: viewer.role, access: viewer.access, orderedByCallerOrg: row.orgId === viewer.orgId }) : false,
    timeScale: row.timeScale,
  };
}

function publishOrder(row: OrderRow) {
  publish(row.projectId, "order", toOrderDto(row, orderingViewer(row)));
}

function patchToData(p: DispatchPatch): Prisma.InspectionOrderUpdateInput {
  const { crew, ...rest } = p;
  return { ...rest, ...(crew !== undefined ? { crew: crew ? JSON.stringify(crew) : null } : {}) };
}

/** Nested write for event rows: one per status, idempotent (an existing row is kept). */
function upsertEvents(orderId: string, events: { status: OrderEventStatus; message: string; at: Date }[]): { events?: Prisma.OrderEventUpdateManyWithoutOrderNestedInput } {
  if (!events.length) return {};
  return {
    events: {
      upsert: events.map((e) => ({
        where: { orderId_status: { orderId, status: e.status } },
        create: { status: e.status, message: e.message, at: e.at },
        update: {},
      })),
    },
  };
}

/** P2025: a version- or status-checked `update` matched no row (someone else changed the order first). Nothing was written. */
function isLostRace(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025";
}

// Order writes below are single `update` calls with nested event upserts:
// Prisma runs each as one transaction inside its query engine (BEGIN
// IMMEDIATE ... COMMIT on SQLite) with no round trip to JavaScript while the
// write lock is held. Interactive `$transaction(async tx => …)` blocks are
// avoided on these hot paths: while one holds the lock, every other writer
// waiting for it occupies a query-engine worker thread for up to the SQLite
// busy timeout, and with more waiters than threads (9+ on an 8-core machine)
// the holder cannot run its next statement, expires (P2028) and the waiters
// time out (P1008).

// ---------------------------------------------------------------------------
// Advance on read (and on the ticker)
// ---------------------------------------------------------------------------

export interface AdvancedRow {
  row: OrderRow;
  /** From the simulator for the persisted state (null when the simulator is off, the order is terminal, or the database was busy). */
  result: AdvanceResult | null;
}

/** Advances in flight in this process, by order id (on globalThis so hot reloads share it). */
const gAdvance = globalThis as unknown as { __cioAdvancing?: Map<string, Promise<AdvancedRow>> };
const advancing: Map<string, Promise<AdvancedRow>> = (gAdvance.__cioAdvancing ??= new Map());

/**
 * Applies the due transitions to one order: one version-checked update that
 * also writes the event rows, publish after commit. Returns the fresh row.
 * When another request advanced the order first, returns the order as that
 * request left it.
 *
 * Concurrent callers for the same order (the ticker, the tracker's poll, the
 * page render, the mobile app...) share one write. A busy database (SQLite
 * lock wait, pool timeout) is not an error for a read: nothing was written,
 * so the stored row is returned with `result: null` and the ticker applies
 * the transitions on a later tick.
 */
export async function advanceRow(row: OrderRow, now: Date = new Date()): Promise<AdvancedRow> {
  if (!simulatorOn() || !isActiveStatus(row.status)) return { row, result: null };
  const opts = { processingHours: processingHours() };
  const r = advanceOrder(toState(row), now, row.timeScale, opts);
  if (!r.changed) return { row, result: r };

  const inflight = advancing.get(row.id);
  if (inflight) return inflight;
  const run = persistAdvance(row, r, now, opts).finally(() => advancing.delete(row.id));
  advancing.set(row.id, run);
  return run;
}

async function persistAdvance(row: OrderRow, r: AdvanceResult, now: Date, opts: { processingHours: number }): Promise<AdvancedRow> {
  try {
    try {
      const fresh = await db.inspectionOrder.update({
        where: { id: row.id, version: row.version, status: row.status },
        data: { ...patchToData(r.patch), version: { increment: 1 }, ...upsertEvents(row.id, r.transitions) },
        include: orderInclude,
      });
      if (r.transitions.length) publishOrder(fresh);
      return { row: fresh, result: r };
    } catch (e) {
      if (!isLostRace(e)) throw e;
      const fresh = await db.inspectionOrder.findUniqueOrThrow({ where: { id: row.id }, include: orderInclude });
      return { row: fresh, result: isActiveStatus(fresh.status) ? advanceOrder(toState(fresh), now, fresh.timeScale, opts) : null };
    }
  } catch (e) {
    if (!isTransientDbError(e)) throw e;
    console.warn(`[orders] ${row.number}: database busy (${e.code}), advance postponed to the next tick`);
    return { row, result: null };
  }
}

export async function advanceAndPersist(row: OrderRow, now: Date = new Date()): Promise<OrderRow> {
  return (await advanceRow(row, now)).row;
}

// ---------------------------------------------------------------------------
// Create / list / get / cancel
// ---------------------------------------------------------------------------

async function ensureTickerSoon() {
  // Imported lazily: ticker.ts imports this module.
  const { ensureTicker } = await import("./ticker");
  ensureTicker();
}

async function nextNumber(tx: Prisma.TransactionClient, year: number): Promise<string> {
  const prefix = `INS-${year}-`;
  const rows = await tx.inspectionOrder.findMany({ where: { number: { startsWith: prefix } }, select: { number: true } });
  const max = rows.reduce((m, r) => Math.max(m, parseInt(r.number.slice(prefix.length), 10) || 0), 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

function isUniqueViolation(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

async function activeConflict(projectId: string) {
  const active = await retryTransient(() =>
    db.inspectionOrder.findUnique({ where: { activeProjectId: projectId }, select: { id: true, number: true, status: true } }),
  );
  if (!active) return null;
  return new HttpError(409, `This project already has an active inspection (${active.number}, ${active.status.replace("_", " ")}). Track it or cancel it before ordering another.`, {
    activeOrderId: active.id,
  });
}

/** Attempts at writing one order: a lost race for the order number or a busy database is retried. */
const CREATE_ATTEMPTS = 8;

/**
 * Order numbers are drawn inside an interactive transaction (read the year's
 * highest number, insert the next). Prisma opens SQLite transactions with
 * BEGIN IMMEDIATE (checked with query logging on Prisma 6.19), so the write
 * lock is held before the read and the number is final; there is no
 * read-then-write lock upgrade to deadlock on. On Postgres a duplicate number
 * surfaces as P2002 and is drawn again.
 *
 * Interactive transactions starve when many wait at once (see the note
 * above advanceRow), so this process runs them one at a time: 10 simultaneous
 * orders used to end as one 201 and nine P2028/P1008 errors.
 */
const gCreate = globalThis as unknown as { __cioCreateChain?: Promise<unknown> };

function oneAtATime<T>(fn: () => Promise<T>): Promise<T> {
  const run = (gCreate.__cioCreateChain ?? Promise.resolve()).then(fn, fn);
  gCreate.__cioCreateChain = run.catch(() => undefined);
  return run;
}

export async function createOrder(s: Session, body: CreateOrderBody): Promise<OrderDto> {
  await ensureTickerSoon();
  const project = await projectForSession(body.projectId, s, "order");
  if (!inServiceArea(project.lat, project.lng)) {
    throw new HttpError(422, `${project.name} is outside our service area (${SERVICE_AREA_NAME}). Call us and we will quote a crew for this site.`);
  }
  const conflict = await activeConflict(project.id);
  if (conflict) throw conflict;

  const scale = currentTimeScale();
  const scheduledFor = body.priority === "scheduled" && body.scheduledFor ? new Date(body.scheduledFor) : null;
  const focus = [...new Set((body.focus ?? []).map((f) => f.trim()).filter(Boolean))].slice(0, 20);

  const insert = (now: Date) =>
    db.$transaction(async (tx) => {
      const number = await nextNumber(tx, now.getUTCFullYear());
      const state: DispatchState = {
        number,
        priority: body.priority,
        status: "requested",
        createdAt: now,
        scheduledFor,
        confirmedAt: null,
        dispatchedAt: null,
        etaArrivalFrom: null,
        etaArrivalTo: null,
        arrivedAt: null,
        flightStartedAt: null,
        flightEndedAt: null,
        reportDueAt: null,
        deliveredAt: null,
        cancelledAt: null,
        crew: null,
        timeScale: scale,
      };
      const est = initialEstimates(state, scale, { processingHours: processingHours() });
      return tx.inspectionOrder.create({
        data: {
          number,
          projectId: project.id,
          orgId: s.orgId,
          requestedById: s.userId,
          kind: body.kind,
          priority: body.priority,
          status: "requested",
          activeProjectId: project.id,
          timeScale: scale,
          scheduledFor,
          etaArrivalFrom: est.etaArrivalFrom,
          etaArrivalTo: est.etaArrivalTo,
          reportDueAt: est.reportDueAt,
          contactName: body.contactName,
          contactPhone: body.contactPhone,
          accessNotes: body.accessNotes || null,
          focus: JSON.stringify(focus),
          priceAmd: priceAmd(body.kind, body.priority),
          createdAt: now,
          events: { create: { status: "requested", message: statusMessage("requested", state, now), at: now } },
        },
        include: orderInclude,
      });
    }, TX_OPTIONS);

  for (let attempt = 1; attempt <= CREATE_ATTEMPTS; attempt++) {
    try {
      const row = await oneAtATime(() => insert(new Date()));
      publishOrder(row);
      return toOrderDto(row, { orgId: s.orgId, role: s.role, access: project.access });
    } catch (e) {
      if (isUniqueViolation(e)) {
        // Either another order became active first (409) or two processes drew the same number (draw again).
        const c = await activeConflict(project.id);
        if (c) throw c;
        continue;
      }
      // Busy database: nothing was written (the transaction rolled back). Back off with jitter and try again.
      if (isTransientDbError(e)) {
        if (attempt < CREATE_ATTEMPTS) await backoff(attempt);
        continue;
      }
      throw e;
    }
  }
  throw new HttpError(503, "Could not place the order right now, please try again");
}

/** Orders on one project, or on every project the caller can read. Newest first. */
export async function listOrders(s: Session, projectId?: string | null): Promise<OrderDto[]> {
  await ensureTickerSoon();
  if (projectId) await projectForSession(projectId, s, "read");
  const ids = projectId ? [projectId] : await readableProjectIds(s);
  if (!ids.length) return [];
  const access = await accessMap(ids, s);
  const rows = await db.inspectionOrder.findMany({ where: { projectId: { in: ids } }, include: orderInclude, orderBy: { createdAt: "desc" } });
  const out: OrderDto[] = [];
  for (const row of rows) {
    const fresh = await advanceAndPersist(row);
    out.push(toOrderDto(fresh, { orgId: s.orgId, role: s.role, access: access.get(fresh.projectId)?.access ?? null }));
  }
  return out;
}

/** Loads an order the caller can see (by id, or by number "INS-2026-0007"), or throws 404. */
async function visibleOrder(s: Session, idOrNumber: string) {
  const row = await db.inspectionOrder.findUnique({ where: /^INS-\d{4}-\d+$/.test(idOrNumber) ? { number: idOrNumber } : { id: idOrNumber }, include: orderInclude });
  const access = row ? (await accessMap([row.projectId], s)).get(row.projectId) : undefined;
  if (!row || !access) throw new HttpError(404, "Order not found");
  return { row, access };
}

export async function getOrder(s: Session, id: string): Promise<OrderDto> {
  await ensureTickerSoon();
  const { row, access } = await visibleOrder(s, id);
  const fresh = await advanceAndPersist(row);
  return toOrderDto(fresh, { orgId: s.orgId, role: s.role, access: access.access });
}

/** The project's active order (advanced to now), or null. */
export async function activeOrderFor(projectId: string, viewer: OrderViewer): Promise<OrderDto | null> {
  const row = await db.inspectionOrder.findUnique({ where: { activeProjectId: projectId }, include: orderInclude });
  if (!row) return null;
  await ensureTickerSoon();
  const fresh = await advanceAndPersist(row);
  return isActiveStatus(fresh.status) ? toOrderDto(fresh, viewer) : null;
}

export async function cancelOrder(s: Session, id: string): Promise<OrderDto> {
  const { row, access } = await visibleOrder(s, id);
  for (let attempt = 0; attempt < 3; attempt++) {
    const fresh = attempt === 0 ? await advanceAndPersist(row) : await advanceAndPersist(await db.inspectionOrder.findUniqueOrThrow({ where: { id: row.id }, include: orderInclude }));
    const ctx = { role: s.role, access: access.access, orderedByCallerOrg: fresh.orgId === s.orgId };
    if (!cancelAllowedByRole(ctx)) {
      throw new HttpError(403, s.role === "viewer" ? "Viewers can track inspections but not cancel them" : "Only the organisation that placed this order, or the project owner, can cancel it");
    }
    if (!(CANCELLABLE_STATUSES as readonly string[]).includes(fresh.status)) {
      throw new HttpError(
        409,
        fresh.status === "cancelled"
          ? "This order is already cancelled"
          : fresh.status === "delivered"
            ? "This order is already delivered"
            : "The crew is already on site; the order can no longer be cancelled",
      );
    }
    const now = new Date();
    let done: OrderRow;
    try {
      // Version-checked: a busy database is retried (nothing was written); P2025 means it changed meanwhile.
      done = await retryTransient(() =>
        db.inspectionOrder.update({
          where: { id: fresh.id, version: fresh.version, status: { in: [...CANCELLABLE_STATUSES] } },
          data: {
            status: "cancelled",
            cancelledAt: now,
            activeProjectId: null,
            version: { increment: 1 },
            ...upsertEvents(fresh.id, [{ status: "cancelled", message: statusMessage("cancelled", toState(fresh), now), at: now }]),
          },
          include: orderInclude,
        }),
      );
    } catch (e) {
      if (isLostRace(e)) continue; // advanced or cancelled concurrently: re-read and re-check
      throw e;
    }
    publishOrder(done);
    return toOrderDto(done, { orgId: s.orgId, role: s.role, access: access.access });
  }
  throw new HttpError(409, "The order changed while cancelling; please try again");
}

// ---------------------------------------------------------------------------
// Delivery: flight + PDF report, lease-guarded and idempotent
// ---------------------------------------------------------------------------

/** A claimed delivery is not retried by anyone else for this long. */
export const DELIVERY_LEASE_MS = 2 * 60_000;
/** Failures before the single "delayed" event. */
export const DELAYED_AFTER_FAILURES = 3;

const backoffMs = (attempts: number) => Math.min(DELIVERY_LEASE_MS, 10_000 * 2 ** Math.max(0, attempts - 1));

/** The most recent finished flight that was not itself flown for an order: its imagery stands in for the simulated flight. */
async function sourceFlightFor(projectId: string, excludeId?: string) {
  return db.flight.findFirst({
    where: { projectId, status: "done", source: { not: "order" }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    orderBy: { capturedAt: "desc" },
    include: { shots: { orderBy: { createdAt: "asc" } }, reconstruction: true },
  });
}

type SourceFlight = NonNullable<Awaited<ReturnType<typeof sourceFlightFor>>>;

/**
 * Creates (or completes) the order's Flight from the source flight's imagery:
 * shots cloned with their original capture times, plus the sample
 * reconstruction row. The flight is dated when that imagery was captured
 * (src.capturedAt), not at the simulated flight time: the assessment and the
 * report's verdict are computed against the plan as of the flight date, and
 * re-scoring months-old progress against today's plan made every simulated
 * delivery report the project further behind with no new evidence.
 */
async function ensureOrderFlight(order: OrderRow, src: SourceFlight) {
  const crew = parseCrew(order.crew);
  let flight = await db.flight.findUnique({ where: { orderId: order.id } });
  if (flight && flight.status !== "uploaded") return flight; // shots complete (processing ran or failed): reuse as is

  if (!flight) {
    try {
      flight = await db.flight.create({
        data: {
          projectId: order.projectId,
          orderId: order.id,
          capturedAt: src.capturedAt,
          pilot: crew?.pilot ?? "control.io crew",
          drone: crew?.drone ?? null,
          source: "order",
          status: "uploaded",
        },
      });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      flight = await db.flight.findUniqueOrThrow({ where: { orderId: order.id } }); // Flight.orderId is unique: one flight per order
      if (flight.status !== "uploaded") return flight;
    }
  }
  if (flight.capturedAt.getTime() !== src.capturedAt.getTime()) {
    flight = await db.flight.update({ where: { id: flight.id }, data: { capturedAt: src.capturedAt } }); // left by an older build
  }

  // (Re)build the shots from scratch: a crash mid-clone leaves the flight "uploaded" with a partial set.
  await db.shot.deleteMany({ where: { flightId: flight.id } });
  await db.reconstruction.deleteMany({ where: { flightId: flight.id } });
  for (const sh of src.shots.filter((x) => x.view !== "model-capture")) {
    const buf = await get(sh.fileKey);
    const stored = await put(`projects/${order.projectId}/flights/${flight.id}`, path.basename(sh.fileKey), buf);
    await db.shot.create({
      data: {
        flightId: flight.id,
        fileKey: stored.key,
        sha256: stored.sha256,
        view: sh.view,
        label: sh.label,
        capturedAt: sh.capturedAt, // the same image, so the same capture time (chain of custody)
        lat: sh.lat,
        lng: sh.lng,
        altM: sh.altM,
        width: sh.width,
        height: sh.height,
      },
    });
  }
  if (src.reconstruction?.provider === "sample" && src.reconstruction.meshKey) {
    await db.reconstruction.create({ data: { flightId: flight.id, provider: "sample", status: "queued", meshKey: src.reconstruction.meshKey } });
  }
  return flight;
}

export type DeliveryOutcome = "delivered" | "skipped" | "failed";

/**
 * Builds the order's flight + report and marks it delivered. Safe to call
 * repeatedly and from several places: a lease (deliveryLeaseAt) lets one
 * caller work at a time, an existing flight/report is reused, and the final
 * update only succeeds while the order is still "processing".
 */
export async function deliverOrder(orderId: string): Promise<DeliveryOutcome> {
  const claimedAt = new Date();
  const claim = await db.inspectionOrder.updateMany({
    where: { id: orderId, status: "processing", OR: [{ deliveryLeaseAt: null }, { deliveryLeaseAt: { lt: new Date(claimedAt.getTime() - DELIVERY_LEASE_MS) } }] },
    data: { deliveryLeaseAt: claimedAt, deliveryAttempts: { increment: 1 } },
  });
  if (claim.count === 0) return "skipped";
  const order = await db.inspectionOrder.findUniqueOrThrow({ where: { id: orderId }, include: { ...orderInclude, org: { select: { name: true } } } });

  try {
    let reportId = order.reportId;
    if (!reportId) {
      const existing = await db.flight.findUnique({ where: { orderId: order.id } });
      const src = await sourceFlightFor(order.projectId, existing?.id);
      if (!src && (!existing || existing.status === "uploaded")) throw new Error("No earlier finished flight on this project to simulate the inspection from");
      let flight = src ? await ensureOrderFlight(order, src) : existing!;
      if (flight.status !== "done") {
        await processFlight(flight.id);
        flight = await db.flight.findUniqueOrThrow({ where: { id: flight.id } });
        if (flight.status !== "done") throw new Error(`Flight processing failed: ${flight.error ?? flight.status}`);
      }
      const prior = await db.report.findFirst({ where: { flightId: flight.id }, orderBy: { createdAt: "desc" } });
      const report =
        prior ??
        (
          await buildReport({
            projectId: order.projectId,
            flightId: flight.id,
            userId: order.requestedById,
            order: {
              number: order.number,
              kind: order.kind,
              priority: order.priority,
              orderedBy: order.requestedBy.name,
              orgName: order.org.name,
              orderedAt: order.createdAt,
              crew: parseCrew(order.crew),
              flightStartedAt: order.flightStartedAt,
              reusedImageryFrom: src?.capturedAt ?? null,
            },
          })
        ).report;
      reportId = report.id;
      // Attach first, so a crash before the status update never builds a second report.
      await db.inspectionOrder.update({ where: { id: order.id }, data: { reportId } });
    }

    const deliveredAt = new Date();
    let delivered: OrderRow;
    try {
      // Only while still "processing" (P2025 otherwise: cancelled or delivered meanwhile); a busy database is retried.
      delivered = await retryTransient(() =>
        db.inspectionOrder.update({
          where: { id: order.id, status: "processing" },
          data: {
            status: "delivered",
            deliveredAt,
            report: { connect: { id: reportId } },
            activeProjectId: null,
            deliveryError: null,
            deliveryLeaseAt: null,
            version: { increment: 1 },
            ...upsertEvents(order.id, [{ status: "delivered", message: statusMessage("delivered", toState(order), deliveredAt), at: deliveredAt }]),
          },
          include: orderInclude,
        }),
      );
    } catch (e) {
      if (isLostRace(e)) return "skipped";
      throw e;
    }
    publishOrder(delivered);
    return "delivered";
  } catch (e) {
    const attempts = order.deliveryAttempts; // already incremented by the claim
    const message = (e as Error)?.message ?? String(e);
    console.error(`[orders] delivery of ${order.number} failed (attempt ${attempts}): ${message}`);
    await db.inspectionOrder.update({
      where: { id: order.id },
      // Retry after a backoff: the lease "expires" backoffMs from now.
      data: { deliveryError: message.slice(0, 500), deliveryLeaseAt: new Date(Date.now() - DELIVERY_LEASE_MS + backoffMs(attempts)) },
    });
    if (attempts >= DELAYED_AFTER_FAILURES) {
      const already = await db.orderEvent.findUnique({ where: { orderId_status: { orderId: order.id, status: "delayed" } } });
      if (!already) {
        try {
          await db.orderEvent.create({ data: { orderId: order.id, status: "delayed", message: statusMessage("delayed", toState(order)), at: new Date() } });
          publishOrder(await db.inspectionOrder.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude }));
        } catch (err) {
          if (!isUniqueViolation(err)) throw err;
        }
      }
    }
    return "failed";
  }
}

/** Clears delivery leases taken before this process started (single instance: nobody can still hold them). */
export async function releaseStaleLeases(bootedAt: Date) {
  await db.inspectionOrder.updateMany({ where: { status: "processing", deliveryLeaseAt: { lt: bootedAt } }, data: { deliveryLeaseAt: null } });
}

/** Active orders for the ticker. */
export async function activeOrderRows() {
  return db.inspectionOrder.findMany({ where: { status: { in: [...ACTIVE_STATUSES] } }, include: orderInclude, orderBy: { createdAt: "asc" } });
}
