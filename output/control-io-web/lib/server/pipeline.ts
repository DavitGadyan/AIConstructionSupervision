/**
 * Flight + document processing. Everything the live feed shows comes from
 * here: status changes are published on the project's event bus as they happen.
 */
import { db } from "./db";
import { publish } from "./events";
import { get } from "./storage";
import { aiEnabled, assessProgress, extractMilestones } from "./ai";
import { reconstructNodeOdm, reconstructSample } from "./reconstruction";
import { DEMO, demoObservations } from "../domain/demo";
import { floorsFromMeshHeight, scheduleVariance, type Observation, type Phase, type PlannedMilestone } from "../domain/schedule";

export function toPlanned(rows: { id: string; floor: number | null; phase: string; plannedStart: Date; plannedEnd: Date; documentId: string | null; sourcePage: number | null; sourceQuote: string | null }[]): PlannedMilestone[] {
  return rows.map((r) => ({
    id: r.id,
    floor: r.floor,
    phase: r.phase as Phase,
    plannedStart: r.plannedStart,
    plannedEnd: r.plannedEnd,
    sourceDocumentId: r.documentId,
    sourcePage: r.sourcePage,
    sourceQuote: r.sourceQuote,
  }));
}

export function toObservations(rows: { floor: number; phase: string; pct: number; confidence: number; shotIds: string }[]): Observation[] {
  return rows.map((r) => ({ floor: r.floor, phase: r.phase as Phase, pct: r.pct, confidence: r.confidence, shotIds: JSON.parse(r.shotIds) }));
}

async function setStatus(projectId: string, flightId: string, status: string, message: string, error?: string) {
  await db.flight.update({ where: { id: flightId }, data: { status, error: error ?? null } });
  publish(projectId, "status", { flightId, status, message });
}

/** Re-derive LagFinding rows for a flight from its observations and the plan. */
export async function recomputeFindings(flightId: string) {
  const flight = await db.flight.findUniqueOrThrow({ where: { id: flightId }, include: { observations: true } });
  const ms = toPlanned(await db.milestone.findMany({ where: { projectId: flight.projectId } }));
  if (!ms.length || !flight.observations.length) return null;
  const v = scheduleVariance(ms, toObservations(flight.observations), flight.capturedAt);
  await db.lagFinding.deleteMany({ where: { flightId } });
  const late = v.milestones.filter((m) => m.daysBehind > 2 && m.plannedPct > 0);
  if (late.length) {
    await db.lagFinding.createMany({
      data: late.map((m) => ({
        projectId: flight.projectId,
        flightId,
        milestoneId: m.milestone.id,
        floor: m.milestone.floor,
        phase: m.milestone.phase,
        plannedPct: m.plannedPct,
        observedPct: m.observedPct,
        daysBehind: m.daysBehind,
        severity: m.severity,
        plannedEnd: m.milestone.plannedEnd,
        evidence: JSON.stringify(m.shotIds),
      })),
    });
  }
  publish(flight.projectId, "finding", { flightId, daysBehind: v.daysBehind });
  return v;
}

/** Full pipeline for one flight. Safe to call again (idempotent per flight). */
export async function processFlight(flightId: string) {
  const flight = await db.flight.findUniqueOrThrow({
    where: { id: flightId },
    include: { shots: true, project: true, reconstruction: true },
  });
  const { project } = flight;
  try {
    // 1. reconstruction
    await setStatus(project.id, flightId, "reconstructing", "Building 3D model");
    const sampleMesh = flight.reconstruction?.provider === "sample" ? flight.reconstruction.meshKey : null;
    const photoShots = flight.shots.filter((s) => s.view !== "model-capture");
    const rec = sampleMesh
      ? await reconstructSample(sampleMesh)
      : await reconstructNodeOdm(project.id, photoShots.map((s) => s.fileKey), (pct) =>
          publish(project.id, "status", { flightId, status: "reconstructing", message: `Photogrammetry ${pct}%` }),
        );
    const meshFloors = rec.slabTopM != null
      ? floorsFromMeshHeight(rec.slabTopM, project.floorHeightM)
      : rec.heightM
        ? floorsFromMeshHeight(rec.heightM * 0.92, project.floorHeightM)
        : null;
    await db.reconstruction.upsert({
      where: { flightId },
      create: { flightId, provider: rec.provider, status: rec.status, meshKey: rec.meshKey, heightM: rec.heightM, floorsDetected: meshFloors, jobId: rec.jobId },
      update: { provider: rec.provider, status: rec.status, meshKey: rec.meshKey, heightM: rec.heightM, floorsDetected: meshFloors, jobId: rec.jobId },
    });

    // 2. assessment
    await setStatus(project.id, flightId, "assessing", "Comparing with the plan");
    const shotIds = photoShots.map((s) => s.id);
    let observations: (Observation & { rationale?: string; source: string })[] = [];
    const sampleKey = sampleMesh?.match(/tower-(m\d)\.glb/)?.[1];
    const sampleFlight = DEMO.flights.find((f) => f.key === sampleKey);

    if (aiEnabled() && photoShots.length) {
      const shots = await Promise.all(
        photoShots.slice(0, 12).map(async (s) => ({
          id: s.id,
          label: s.label ?? s.view,
          mediaType: (s.fileKey.endsWith(".png") ? "image/png" : "image/jpeg") as "image/png" | "image/jpeg",
          data: await get(s.fileKey),
        })),
      );
      const a = await assessProgress({
        projectName: project.name,
        floorsTotal: project.floorsTotal,
        floorHeightM: project.floorHeightM,
        capturedAt: flight.capturedAt,
        meshFloors,
        shots,
      });
      observations = a.observations.map((o) => ({ ...o, source: "ai" }));
    } else if (sampleFlight) {
      // No API key: sample flights fall back to the scene's known ground truth.
      observations = demoObservations(sampleFlight, shotIds).map((o) => ({ ...o, source: "seed", rationale: "Sample flight: ground truth of the synthetic scene" }));
    } else if (meshFloors != null) {
      // Mesh-only: structure is provable from slab height; other phases unknown.
      observations = Array.from({ length: project.floorsTotal }, (_, i) => ({
        floor: i + 1,
        phase: "structure" as Phase,
        pct: i + 1 <= meshFloors ? 100 : 0,
        confidence: 0.7,
        shotIds,
        source: "mesh",
        rationale: `Slab height in 3D model = ${meshFloors} storeys`,
      }));
    } else {
      await setStatus(project.id, flightId, "done", "Shots stored. Set ANTHROPIC_API_KEY or NODEODM_URL to assess progress automatically.");
      return null;
    }

    await db.progressObservation.deleteMany({ where: { flightId } });
    await db.progressObservation.createMany({
      data: observations.map((o) => ({
        flightId,
        floor: o.floor,
        phase: o.phase,
        pct: o.pct,
        confidence: o.confidence,
        shotIds: JSON.stringify(o.shotIds),
        rationale: o.rationale ?? null,
        source: o.source,
      })),
    });

    // 3. findings
    const v = await recomputeFindings(flightId);
    await setStatus(project.id, flightId, "done", v ? `${v.daysBehind} days ${v.daysBehind >= 0 ? "behind" : "ahead of"} plan` : "Assessment stored");
    return v;
  } catch (e) {
    await setStatus(project.id, flightId, "failed", "Processing failed", (e as Error).message);
    return null;
  }
}

/** Parse an uploaded official document into milestones (Claude). */
export async function ingestDocument(documentId: string) {
  const doc = await db.document.findUniqueOrThrow({ where: { id: documentId } });
  if (!aiEnabled()) {
    await db.document.update({ where: { id: documentId }, data: { status: "uploaded", error: "Set ANTHROPIC_API_KEY to extract milestones automatically" } });
    return;
  }
  await db.document.update({ where: { id: documentId }, data: { status: "extracting", error: null } });
  publish(doc.projectId, "status", { documentId, status: "extracting", message: `Reading ${doc.title}` });
  try {
    const x = await extractMilestones(await get(doc.fileKey), doc.kind);
    const valid = x.milestones.filter((m) => !Number.isNaN(Date.parse(m.plannedStart)) && !Number.isNaN(Date.parse(m.plannedEnd)));
    await db.$transaction([
      db.milestone.deleteMany({ where: { documentId } }),
      db.milestone.createMany({
        data: valid.map((m) => ({
          projectId: doc.projectId,
          documentId,
          floor: m.floor,
          phase: m.phase,
          plannedStart: new Date(m.plannedStart),
          plannedEnd: new Date(m.plannedEnd),
          sourcePage: m.sourcePage,
          sourceQuote: m.sourceQuote.slice(0, 300),
        })),
      }),
      db.document.update({
        where: { id: documentId },
        data: { status: "extracted", issuer: x.issuer, issuedAt: x.issuedAt ? new Date(x.issuedAt) : null },
      }),
    ]);
    publish(doc.projectId, "status", { documentId, status: "extracted", message: `${valid.length} milestones from ${doc.title}` });
    // New plan -> every flight's findings change.
    const flights = await db.flight.findMany({ where: { projectId: doc.projectId, status: "done" } });
    for (const f of flights) await recomputeFindings(f.id);
  } catch (e) {
    await db.document.update({ where: { id: documentId }, data: { status: "failed", error: (e as Error).message } });
  }
}
