/**
 * One-off repair of demo data written before the fix in ensureOrderFlight
 * (lib/server/orders.ts): the dispatch simulator used to date an order's
 * flight at the simulated flight time although its photos are copies of an
 * earlier flight's, so the copied progress was scored against a later plan
 * and every simulated delivery reported the project further behind (e.g. 44
 * instead of 28 days, 12 instead of 8 findings) with no new evidence.
 *
 * For every flight with source "order" whose photos are byte-identical
 * copies (same SHA-256) of another flight's, this re-dates the flight and
 * each shot to the source imagery's capture times and recomputes the
 * flight's findings (idempotent). With --reports it also re-renders each such
 * order's PDF (same generation time, saying the verdict is as of the reused
 * imagery), points the order at it and deletes the superseded PDF.
 *
 *   npx tsx scripts/repair-order-flights.ts                    # dry run
 *   npx tsx scripts/repair-order-flights.ts --apply            # flights + findings
 *   npx tsx scripts/repair-order-flights.ts --apply --reports  # ... and re-render the orders' PDFs
 */
import { rm } from "node:fs/promises";
import path from "node:path";
import { db } from "../lib/server/db";
import { recomputeFindings } from "../lib/server/pipeline";
import { buildReport } from "../lib/server/report";
import { parseCrew } from "../lib/server/orders";

const apply = process.argv.includes("--apply");
const reports = process.argv.includes("--reports");

async function main() {
  const flights = await db.flight.findMany({
    where: { source: "order" },
    include: { shots: true, order: { include: { requestedBy: true, org: true, report: true } } },
    orderBy: { createdAt: "asc" },
  });
  let repaired = 0;
  for (const f of flights) {
    const photos = f.shots.filter((s) => s.view !== "model-capture");
    if (!photos.length) continue;
    // The source: a non-order flight of the same project holding every photo's exact bytes.
    const originals = await db.shot.findMany({
      where: { sha256: { in: photos.map((s) => s.sha256) }, flight: { projectId: f.projectId, source: { not: "order" } } },
      include: { flight: { select: { id: true, capturedAt: true } } },
      orderBy: { createdAt: "asc" },
    });
    const bySha = new Map<string, (typeof originals)[number]>();
    for (const o of originals) if (!bySha.has(o.sha256)) bySha.set(o.sha256, o);
    const src = bySha.get(photos[0].sha256)?.flight;
    if (!src || photos.some((s) => bySha.get(s.sha256)?.flight.id !== src.id)) {
      console.log(`${f.id} (${f.order?.number ?? "no order"}): photos are not copies of one earlier flight; left as is`);
      continue;
    }
    const shotFixes = photos.filter((s) => s.capturedAt.getTime() !== bySha.get(s.sha256)!.capturedAt.getTime());
    const redate = f.capturedAt.getTime() !== src.capturedAt.getTime();
    const tag = `${f.order?.number ?? f.id}: flight ${f.capturedAt.toISOString()} -> ${src.capturedAt.toISOString()}`;
    const dated = !redate && !shotFixes.length;
    if (!apply) {
      console.log(dated ? `[dry run] ${f.order?.number ?? f.id}: already dated at its imagery` : `[dry run] ${tag}, ${shotFixes.length} shot time(s)`);
      continue;
    }
    if (dated) {
      console.log(`${f.order?.number ?? f.id}: already dated at its imagery (${src.capturedAt.toISOString()})`);
    } else {
      await db.flight.update({ where: { id: f.id }, data: { capturedAt: src.capturedAt } });
      for (const s of shotFixes) await db.shot.update({ where: { id: s.id }, data: { capturedAt: bySha.get(s.sha256)!.capturedAt } });
      const v = f.status === "done" ? await recomputeFindings(f.id) : null;
      console.log(`${tag}; findings recomputed: ${v ? `${v.daysBehind} days behind` : "n/a"}`);
      repaired++;
    }

    const order = f.order;
    if (!reports || !order?.report || f.status !== "done") continue;
    const old = order.report;
    const { report } = await buildReport({
      projectId: f.projectId,
      flightId: f.id,
      userId: order.requestedById,
      generatedAt: old.createdAt,
      order: {
        number: order.number,
        kind: order.kind,
        priority: order.priority,
        orderedBy: order.requestedBy.name,
        orgName: order.org.name,
        orderedAt: order.createdAt,
        crew: parseCrew(order.crew),
        flightStartedAt: order.flightStartedAt,
        reusedImageryFrom: src.capturedAt,
      },
    });
    await db.inspectionOrder.update({ where: { id: order.id }, data: { reportId: report.id } });
    await db.report.delete({ where: { id: old.id } });
    await rm(path.join(path.resolve(process.env.STORAGE_DIR ?? "./storage"), old.fileKey), { force: true });
    console.log(`  ${order.number}: report re-rendered (${old.daysBehind} -> ${report.daysBehind} days behind)`);
  }
  console.log(apply ? `Repaired ${repaired} flight(s).` : "Dry run: pass --apply to write.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
