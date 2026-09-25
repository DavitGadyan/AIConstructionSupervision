/**
 * Seeds the demo org, user, project, official documents, baseline milestones
 * and three sample drone flights, then runs the real pipeline on each flight.
 * v1.1 adds the on-demand inspection personas:
 *  - demo@control.io       owner,  "Lender bank" (lender)
 *  - viewer@control.io     viewer, same bank (tracks, cannot order)
 *  - inspector@control.io  owner,  "Building control authority" (authority),
 *                          the project is shared with it (access: order)
 *  - outside@control.io    owner of a project in Gyumri, outside the service area (422 on order)
 *  and one delivered historical order INS-2026-0001 linked to the M8 report.
 * All passwords: demo1234. Orgs, people, plates and phones are generic
 * role labels: no real company, street or person is referenced.
 *
 *   npx tsx scripts/seed.ts        (needs public/samples/* from scripts/blender)
 */
import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import sharp from "sharp";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { db } from "../lib/server/db";
import { put } from "../lib/server/storage";
import { hashPassword } from "../lib/server/auth";
import { processFlight } from "../lib/server/pipeline";
import { buildReport } from "../lib/server/report";
import { DEMO, demoMilestones } from "../lib/domain/demo";
import { CREWS } from "../lib/domain/crews";
import { advanceOrder, arrivalOffsetMs, DURATIONS, HOUR, initialEstimates, statusMessage, type DispatchState } from "../lib/domain/dispatch";
import { priceAmd } from "../lib/domain/pricing";
import { PHASE_LABEL } from "../lib/domain/schedule";

const fmt = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  await rm(path.resolve(process.env.STORAGE_DIR ?? "./storage"), { recursive: true, force: true });
  await db.orderEvent.deleteMany();
  await db.inspectionOrder.deleteMany();
  await db.projectShare.deleteMany();
  await db.report.deleteMany();
  await db.org.deleteMany({ where: { slug: "demo-bank" } });
  await db.$transaction([
    db.lagFinding.deleteMany(), db.progressObservation.deleteMany(), db.reconstruction.deleteMany(), db.shot.deleteMany(),
    db.flight.deleteMany(), db.milestone.deleteMany(), db.document.deleteMany(), db.project.deleteMany(), db.user.deleteMany(), db.org.deleteMany(),
  ]);

  const password = await hashPassword("demo1234");
  const org = await db.org.create({
    data: {
      name: "Lender bank",
      slug: "demo-bank",
      role: "lender",
      legalName: "Lender bank",
      taxId: "00000001",
      address: "Yerevan, Armenia",
      phone: "+374 00 000 100",
      email: "supervision@bank.example",
      website: "https://bank.example",
    },
  });
  const owner = await db.user.create({
    data: { email: "demo@control.io", name: "Owner", role: "owner", orgId: org.id, passwordHash: password },
  });
  await db.user.create({
    data: { email: "viewer@control.io", name: "Viewer", role: "viewer", orgId: org.id, passwordHash: password },
  });
  const project = await db.project.create({
    data: {
      orgId: org.id,
      ...DEMO.project,
      contractor: "General contractor",
      lender: org.name,
      buildingType: "Residential tower",
      grossAreaM2: 18_400,
      units: 128,
    },
  });

  // Inspector persona: the building-control authority, which the bank shares the project with (may order).
  const authority = await db.org.create({
    data: {
      name: "Building control authority",
      slug: "demo-building-control",
      role: "authority",
      legalName: "Building control authority",
      address: "Yerevan, Armenia",
      phone: "+374 00 000 200",
      email: "inspections@building-control.example",
      website: "https://building-control.example",
    },
  });
  await db.user.create({
    data: { email: "inspector@control.io", name: "Inspector", role: "owner", orgId: authority.id, passwordHash: password },
  });
  await db.projectShare.create({ data: { projectId: project.id, orgId: authority.id, access: "order" } });

  // A site outside the Yerevan & Kotayk service area (POST /api/orders answers 422 there).
  const outside = await db.org.create({ data: { name: "Regional developer", slug: "regional-developer", role: "developer", address: "Gyumri, Armenia" } });
  await db.user.create({
    data: { email: "outside@control.io", name: "Owner", role: "owner", orgId: outside.id, passwordHash: password },
  });
  await db.project.create({
    data: {
      orgId: outside.id,
      name: "Residential block, Gyumri",
      slug: "residential-block-gyumri",
      address: "Gyumri, Armenia",
      lat: 40.7894,
      lng: 43.8475,
      developer: "Regional developer",
      floorsTotal: 9,
      startDate: new Date("2026-04-01T00:00:00Z"),
      plannedCompletion: new Date("2027-10-01T00:00:00Z"),
      buildingType: "Residential block",
      units: 54,
    },
  });

  // Official documents
  const docs = [
    { file: "baseline-schedule-rev2.pdf", kind: "schedule", title: "Baseline Construction Schedule Rev. 2", issuer: DEMO.project.developer, issuedAt: "2026-02-16" },
    { file: "building-permit.pdf", kind: "permit", title: `Building Permit ${DEMO.project.permitNo}`, issuer: "City Building Control Authority", issuedAt: "2025-12-18" },
    { file: "construction-contract-extract.pdf", kind: "contract", title: "Construction Contract, clauses 8.2-8.7", issuer: DEMO.project.developer, issuedAt: "2026-01-02" },
  ];
  let scheduleDocId = "";
  for (const d of docs) {
    const buf = await readFile(`data/samples/${d.file}`);
    const pages = (await PDFDocument.load(buf)).getPageCount();
    const stored = await put(`projects/${project.id}/documents`, d.file, buf);
    const doc = await db.document.create({
      data: { projectId: project.id, kind: d.kind, title: d.title, fileKey: stored.key, sha256: stored.sha256, pages, issuer: d.issuer, issuedAt: new Date(d.issuedAt), status: d.kind === "schedule" ? "extracted" : "uploaded" },
    });
    if (d.kind === "schedule") scheduleDocId = doc.id;
  }

  // Baseline milestones, with the page/row they appear on in the schedule PDF
  const ms = demoMilestones();
  await db.milestone.createMany({
    data: ms.map((m, i) => ({
      projectId: project.id,
      documentId: scheduleDocId,
      floor: m.floor,
      phase: m.phase,
      plannedStart: m.plannedStart,
      plannedEnd: m.plannedEnd,
      sourcePage: 2 + Math.floor(i / 34),
      sourceQuote: `A-${String(i + 1).padStart(3, "0")} L${String(m.floor).padStart(2, "0")} ${PHASE_LABEL[m.phase]} ${fmt(m.plannedStart)} - ${fmt(m.plannedEnd)}`,
    })),
  });

  // Flights
  const flightIds: Record<string, string> = {};
  for (const f of DEMO.flights) {
    const flight = await db.flight.create({
      data: { projectId: project.id, capturedAt: f.capturedAt, pilot: f.pilot, drone: f.drone, source: "sample", status: "uploaded" },
    });
    for (const [i, v] of DEMO.shotViews.entries()) {
      // Photoreal drone photo (scripts/imagery/generate.ts).
      const photo = `public/images/flights/${f.key}/${v.name}.webp`;
      if (!existsSync(photo)) throw new Error(`missing sample photo ${photo} - run scripts/imagery/generate.ts`);
      const buf = await sharp(photo).jpeg({ quality: 90 }).toBuffer();
      const stored = await put(`projects/${project.id}/flights/${flight.id}`, `${v.name}.jpg`, buf);
      await db.shot.create({
        data: {
          flightId: flight.id,
          fileKey: stored.key,
          sha256: stored.sha256,
          view: v.view,
          label: v.label,
          capturedAt: new Date(f.capturedAt.getTime() + i * 95_000),
          lat: DEMO.project.lat + (i - 3) * 0.00021,
          lng: DEMO.project.lng + ((i % 3) - 1) * 0.00027,
          altM: v.alt,
          width: existsSync(photo) ? 1536 : 1600,
          height: existsSync(photo) ? 1024 : 1000,
        },
      });
    }
    await db.reconstruction.create({ data: { flightId: flight.id, provider: "sample", status: "queued", meshKey: `/samples/tower-${f.key}.glb` } });
    flightIds[f.key] = flight.id;
    const v = await processFlight(flight.id);
    console.log(f.key, fmt(f.capturedAt), v ? `${v.daysBehind} days behind, EV ${v.earnedPct}% vs PV ${v.plannedPct}%` : "no variance");
  }
  // Historical on-demand inspection: INS-2026-0001 (full, ASAP) was the M8 flight; its report is the M8 report.
  const m8 = DEMO.flights.find((f) => f.key === "m8")!;
  const number = "INS-2026-0001";
  const crew = { ...CREWS[0] }; // Drone unit 1: the crew recorded on the historical order
  // Back-date the order so the simulator's own timeline puts the flight start exactly at the M8 capture time.
  const leadMs = DURATIONS.confirmMs + DURATIONS.etaFromMs + arrivalOffsetMs(number, DURATIONS.etaToMs - DURATIONS.etaFromMs) + DURATIONS.setupMs;
  const createdAt = new Date(m8.capturedAt.getTime() - leadMs);
  const base: DispatchState = {
    number, priority: "asap", status: "requested", createdAt, scheduledFor: null,
    confirmedAt: null, dispatchedAt: null, etaArrivalFrom: null, etaArrivalTo: null, arrivedAt: null,
    flightStartedAt: null, flightEndedAt: null, reportDueAt: null, deliveredAt: null, cancelledAt: null,
    crew, timeScale: 1,
  };
  const run = advanceOrder({ ...base, ...initialEstimates(base) }, new Date(m8.capturedAt.getTime() + 30 * 24 * HOUR));
  const o = run.order;
  const deliveredAt = run.deliveryDue!;
  const { report } = await buildReport({
    projectId: project.id,
    flightId: flightIds.m8,
    userId: owner.id,
    generatedAt: deliveredAt,
    order: { number, kind: "full", priority: "asap", orderedBy: owner.name, orgName: org.name, orderedAt: createdAt, crew, flightStartedAt: o.flightStartedAt },
  });
  const hist = await db.inspectionOrder.create({
    data: {
      number,
      projectId: project.id,
      orgId: org.id,
      requestedById: owner.id,
      kind: "full",
      priority: "asap",
      status: "delivered",
      activeProjectId: null,
      timeScale: 1,
      confirmedAt: o.confirmedAt,
      dispatchedAt: o.dispatchedAt,
      etaArrivalFrom: o.etaArrivalFrom,
      etaArrivalTo: o.etaArrivalTo,
      arrivedAt: o.arrivedAt,
      flightStartedAt: o.flightStartedAt,
      flightEndedAt: o.flightEndedAt,
      reportDueAt: o.reportDueAt,
      deliveredAt,
      crew: JSON.stringify(crew),
      contactName: "Site manager",
      contactPhone: "+374 00 000 300",
      accessNotes: "Gate 2, site office. Hard hats required.",
      focus: "[]",
      priceAmd: priceAmd("full", "asap"),
      reportId: report.id,
      createdAt,
      events: {
        create: [
          { status: "requested", message: statusMessage("requested", o, createdAt), at: createdAt },
          ...run.transitions.map((t) => ({ status: t.status, message: t.message, at: t.at })),
          { status: "delivered", message: statusMessage("delivered", o, deliveredAt), at: deliveredAt },
        ],
      },
    },
  });
  await db.flight.update({ where: { id: flightIds.m8 }, data: { orderId: hist.id } });
  console.log(`${number} delivered ${deliveredAt.toISOString()} -> report ${report.id}`);

  console.log("Seeded. Logins (password demo1234): demo@control.io (owner), viewer@control.io (viewer), inspector@control.io (authority), outside@control.io (outside the service area)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
