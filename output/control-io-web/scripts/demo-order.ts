/**
 * Puts the demo project's inspection order into a given state, for
 * screenshots and manual testing. Uses the real server code paths
 * (advanceAndPersist, deliverOrder, cancelOrder), so events, stamps, flight
 * and PDF are exactly what the simulator would produce.
 *
 *   npx tsx scripts/demo-order.ts --state dispatched
 *   npx tsx scripts/demo-order.ts --state delivered --kind revision --as inspector@control.io
 *   npx tsx scripts/demo-order.ts --state none          # remove every demo order except INS-2026-0001
 *
 * Options:
 *   --state     none | requested | confirmed | dispatched | on_site | flying | processing | delivered | cancelled
 *   --kind      full | revision | targeted            (default: revision for authority orgs, else full)
 *   --priority  asap | scheduled                      (default asap; scheduled = tomorrow 10:00 Yerevan)
 *   --as        email of the ordering user            (default demo@control.io)
 *   --project   project id or slug                    (default the demo tower)
 *   --scale     time scale frozen on the order        (default 1, so the state holds for a while)
 *   --keep      do not remove earlier demo orders first
 *
 * The dev server keeps advancing the order at its own time scale afterwards.
 */
import { rm } from "node:fs/promises";
import path from "node:path";
import { db } from "../lib/server/db";
import { advanceAndPersist, cancelOrder, deliverOrder, orderInclude, processingHours } from "../lib/server/orders";
import { HOUR, MINUTE, initialEstimates, safeScale, statusMessage, timeline, type DispatchState } from "../lib/domain/dispatch";
import { priceAmd } from "../lib/domain/pricing";
import { DEMO } from "../lib/domain/demo";
import { ORDER_KINDS, ORDER_PRIORITIES, ORDER_STATUSES, type OrderKind, type OrderPriority, type OrderStatus, type OrgRole, type UserRole } from "../lib/domain/orderTypes";
import type { Session } from "../lib/server/auth";

const HISTORICAL = "INS-2026-0001";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : "";
}

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

async function clearDemoOrders(projectId: string) {
  const orders = await db.inspectionOrder.findMany({ where: { projectId, number: { not: HISTORICAL } }, select: { id: true, number: true } });
  if (!orders.length) return;
  // Flights flown for these orders (and, by cascade, their shots, findings and reports), plus their stored files.
  const flights = await db.flight.findMany({ where: { orderId: { in: orders.map((o) => o.id) } }, select: { id: true, reports: { select: { fileKey: true } } } });
  const root = path.resolve(process.env.STORAGE_DIR ?? "./storage");
  for (const f of flights) {
    await rm(path.join(root, "projects", projectId, "flights", f.id), { recursive: true, force: true });
    for (const r of f.reports) await rm(path.join(root, r.fileKey), { force: true });
  }
  await db.flight.deleteMany({ where: { id: { in: flights.map((f) => f.id) } } });
  await db.inspectionOrder.deleteMany({ where: { id: { in: orders.map((o) => o.id) } } });
  console.log(`Removed ${orders.map((o) => o.number).join(", ")}`);
}

async function nextNumber(year: number) {
  const prefix = `INS-${year}-`;
  const rows = await db.inspectionOrder.findMany({ where: { number: { startsWith: prefix } }, select: { number: true } });
  const max = rows.reduce((m, r) => Math.max(m, parseInt(r.number.slice(prefix.length), 10) || 0), 0);
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

/** Tomorrow 10:00 in Yerevan (UTC+4). */
function tomorrowTen(now: Date) {
  const y = new Date(now.getTime() + 4 * HOUR);
  return new Date(Date.UTC(y.getUTCFullYear(), y.getUTCMonth(), y.getUTCDate() + 1, 6, 0, 0));
}

async function main() {
  const state = (arg("state") ?? "") as OrderStatus | "none";
  if (state !== "none" && !(ORDER_STATUSES as readonly string[]).includes(state)) fail(`--state must be none | ${ORDER_STATUSES.join(" | ")}`);
  const email = (arg("as") || "demo@control.io").toLowerCase();
  const scale = safeScale(Number(arg("scale") || 1));

  const projectKey = arg("project") || DEMO.project.slug;
  const project = await db.project.findFirst({ where: { OR: [{ id: projectKey }, { slug: projectKey }] } });
  if (!project) fail(`Project ${projectKey} not found (run the seed first)`);
  const user = await db.user.findUnique({ where: { email }, include: { org: true } });
  if (!user) fail(`User ${email} not found`);

  if (arg("keep") === undefined) await clearDemoOrders(project.id);
  else {
    const active = await db.inspectionOrder.findUnique({ where: { activeProjectId: project.id } });
    if (active) fail(`${active.number} is still active on this project; drop --keep to replace it`);
  }
  if (state === "none") return;

  const kindArg = arg("kind");
  const kind = (kindArg || (user.org.role === "authority" ? "revision" : "full")) as OrderKind;
  if (!(ORDER_KINDS as readonly string[]).includes(kind)) fail(`--kind must be ${ORDER_KINDS.join(" | ")}`);
  const priority = (arg("priority") || "asap") as OrderPriority;
  if (!(ORDER_PRIORITIES as readonly string[]).includes(priority)) fail(`--priority must be ${ORDER_PRIORITIES.join(" | ")}`);

  const now = new Date();
  const number = await nextNumber(now.getUTCFullYear());
  const opts = { processingHours: processingHours() };

  // Back-date the order so that, advanced to now, it has just reached the target state.
  const probe: DispatchState = {
    number, priority, status: "requested", createdAt: now, scheduledFor: null,
    confirmedAt: null, dispatchedAt: null, etaArrivalFrom: null, etaArrivalTo: null, arrivedAt: null,
    flightStartedAt: null, flightEndedAt: null, reportDueAt: null, deliveredAt: null, cancelledAt: null,
    crew: null, timeScale: scale,
  };
  const t = timeline(probe, scale, opts);
  const off = (d: Date) => d.getTime() - now.getTime();
  const steps: Record<string, [number, number]> = {
    // [due offset of the target state, due offset of the next one]
    requested: [0, off(t.confirmedAt)],
    confirmed: [off(t.confirmedAt), off(t.dispatchedAt)],
    cancelled: [off(t.confirmedAt), off(t.dispatchedAt)],
    dispatched: [off(t.dispatchedAt), off(t.arrivedAt)],
    on_site: [off(t.arrivedAt), off(t.flightStartedAt)],
    flying: [off(t.flightStartedAt), off(t.flightEndedAt)],
    processing: [off(t.flightEndedAt), off(t.deliveryDue)],
    delivered: [off(t.deliveryDue), off(t.deliveryDue) + HOUR],
  };
  const [due, next] = steps[state];
  const hold = Math.min(10 * MINUTE / scale, (next - due) / 4);
  const createdAt = new Date(now.getTime() - due - hold);
  const scheduledFor = priority === "scheduled" ? tomorrowTen(now) : null;
  if (scheduledFor && state !== "requested" && state !== "confirmed" && state !== "cancelled") {
    fail("--priority scheduled only supports --state requested | confirmed | cancelled (the slot is tomorrow)");
  }

  const base: DispatchState = { ...probe, createdAt, scheduledFor };
  const est = initialEstimates(base, scale, opts);
  const row = await db.inspectionOrder.create({
    data: {
      number,
      projectId: project.id,
      orgId: user.orgId,
      requestedById: user.id,
      kind,
      priority,
      status: "requested",
      activeProjectId: project.id,
      timeScale: scale,
      scheduledFor,
      etaArrivalFrom: est.etaArrivalFrom,
      etaArrivalTo: est.etaArrivalTo,
      reportDueAt: est.reportDueAt,
      contactName: "Site manager",
      contactPhone: "+374 00 000 300",
      accessNotes: "Gate 2, site office. Hard hats required.",
      focus: JSON.stringify(kind === "targeted" ? ["Floor 13 structure", "Floor 8 envelope"] : []),
      priceAmd: priceAmd(kind, priority),
      createdAt,
      events: { create: { status: "requested", message: statusMessage("requested", base, createdAt), at: createdAt } },
    },
    include: orderInclude,
  });

  let fresh = await advanceAndPersist(row, now);

  if (state === "cancelled") {
    const s: Session = { userId: user.id, orgId: user.orgId, name: user.name, email: user.email, role: user.role as UserRole, orgRole: user.org.role as OrgRole };
    await cancelOrder(s, row.id);
  }

  if (state === "delivered") {
    const outcome = await deliverOrder(row.id);
    if (outcome !== "delivered") {
      // The dev server's ticker may have claimed it first; wait for it.
      for (let i = 0; i < 60; i++) {
        const o = await db.inspectionOrder.findUniqueOrThrow({ where: { id: row.id } });
        if (o.status === "delivered") break;
        if (i === 59) fail(`Delivery did not finish (${outcome}); deliveryError: ${o.deliveryError ?? "-"}`);
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  fresh = await db.inspectionOrder.findUniqueOrThrow({ where: { id: row.id }, include: orderInclude });
  console.log(
    JSON.stringify(
      {
        id: fresh.id,
        number: fresh.number,
        status: fresh.status,
        kind: fresh.kind,
        priority: fresh.priority,
        orderedBy: `${user.name} (${user.org.name})`,
        timeScale: fresh.timeScale,
        etaArrival: [fresh.etaArrivalFrom, fresh.etaArrivalTo],
        reportDueAt: fresh.reportDueAt,
        reportId: fresh.reportId,
        events: fresh.events.sort((a, b) => a.at.getTime() - b.at.getTime()).map((e) => `${e.at.toISOString()} ${e.status}: ${e.message}`),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
