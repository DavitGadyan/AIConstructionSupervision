/** Read models shared by the API routes and the server-rendered app pages. */
import { db } from "./db";
import { accessFor, type Session } from "./auth";
import { fileUrl } from "./storage";
import { SAMPLE_ASSET_VERSION } from "../content/demoDefects";
import { toObservations, toPlanned } from "./pipeline";
import { PHASES, plannedPctAt, scheduleVariance, severityFor, type Phase } from "../domain/schedule";

export function meshUrl(key: string | null | undefined) {
  if (!key) return null;
  // Public sample meshes are cache-busted; stored meshes have unique keys already.
  return key.startsWith("/") ? `${key}?v=${SAMPLE_ASSET_VERSION}` : fileUrl(key);
}

/**
 * Projects the caller can see: their org's own projects first, then projects
 * other orgs share with it (`shared: true`). `access` is the caller's
 * effective access ("write" | "order" | "read"). Passing a bare orgId (older
 * call sites) treats the caller as a non-viewer.
 */
export async function listProjects(who: string | Pick<Session, "orgId" | "role">) {
  const caller = typeof who === "string" ? { orgId: who, role: "supervisor" as const } : who;
  const [own, shares] = await Promise.all([
    db.project.findMany({ where: { orgId: caller.orgId }, orderBy: { createdAt: "asc" } }),
    db.projectShare.findMany({ where: { orgId: caller.orgId }, include: { project: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const rows = [
    ...own.map((p) => ({ p, a: accessFor(p, null, caller)! })),
    ...shares.filter((x) => x.project.orgId !== caller.orgId).map((x) => ({ p: x.project, a: accessFor(x.project, x, caller)! })),
  ];
  return Promise.all(
    rows.map(async ({ p, a }) => {
      const s = await projectSummary(p.id);
      const cover = s.latestFlight ? await db.shot.findFirst({ where: { flightId: s.latestFlight.id, view: "orbit" } }) : null;
      return {
        id: p.id,
        name: p.name,
        address: p.address,
        developer: p.developer,
        floorsTotal: p.floorsTotal,
        daysBehind: s.variance?.daysBehind ?? 0,
        plannedPct: s.variance?.plannedPct ?? 0,
        earnedPct: s.variance?.earnedPct ?? 0,
        spi: s.variance?.spi ?? 1,
        lastFlightAt: s.latestFlight?.capturedAt ?? null,
        coverUrl: cover ? fileUrl(cover.fileKey) : null,
        status: severityFor(s.variance?.daysBehind ?? 0),
        shared: a.shared,
        access: a.access,
      };
    }),
  );
}

export type ProjectSummary = Awaited<ReturnType<typeof projectSummary>>;

export async function projectSummary(projectId: string, flightId?: string) {
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  const flight = await db.flight.findFirst({
    where: flightId ? { id: flightId, projectId } : { projectId, status: "done", observations: { some: {} } },
    // Latest capture; on a tie (a demo order's flight reuses an earlier flight's imagery and capture time) the original.
    orderBy: [{ capturedAt: "desc" }, { createdAt: "asc" }],
    include: { reconstruction: true, observations: true, findings: { orderBy: { daysBehind: "desc" } }, _count: { select: { shots: true } } },
  });
  const milestoneRows = await db.milestone.findMany({ where: { projectId }, orderBy: [{ floor: "asc" }, { plannedStart: "asc" }] });
  const ms = toPlanned(milestoneRows);
  const obs = flight ? toObservations(flight.observations) : [];
  const variance = flight && ms.length && obs.length ? scheduleVariance(ms, obs, flight.capturedAt) : null;
  const at = flight?.capturedAt ?? new Date();

  const plannedFloors = ms.filter((m) => m.phase === "structure" && m.floor != null && plannedPctAt(m, at) >= 100).length;

  const floors = Array.from({ length: project.floorsTotal }, (_, i) => {
    const floor = i + 1;
    const get = (phase: Phase) => obs.find((o) => o.floor === floor && o.phase === phase)?.pct ?? null;
    const plan = (phase: Phase) => {
      const m = ms.find((x) => x.floor === floor && x.phase === phase);
      return m ? Math.round(plannedPctAt(m, at)) : null;
    };
    const worst = variance?.milestones.filter((m) => m.milestone.floor === floor).reduce((a, m) => Math.max(a, m.daysBehind), -999) ?? -999;
    return {
      floor,
      structure: get("structure"),
      envelope: get("envelope"),
      glazing: get("glazing"),
      finishes: get("finishes"),
      plannedStructure: plan("structure"),
      plannedEnvelope: plan("envelope"),
      plannedGlazing: plan("glazing"),
      daysBehind: worst === -999 ? null : worst,
      status: worst === -999 ? "on-track" : severityFor(worst),
    };
  });

  const timeline = ms
    .filter((m) => m.floor != null && m.phase !== "finishes")
    .map((m) => ({
      floor: m.floor!,
      phase: m.phase,
      plannedStart: m.plannedStart,
      plannedEnd: m.plannedEnd,
      plannedPct: Math.round(plannedPctAt(m, at)),
      actualPct: obs.find((o) => o.floor === m.floor && o.phase === m.phase)?.pct ?? null,
    }));

  return {
    project,
    latestFlight: flight
      ? {
          id: flight.id,
          capturedAt: flight.capturedAt,
          status: flight.status,
          meshUrl: meshUrl(flight.reconstruction?.meshKey),
          floorsDetected: flight.reconstruction?.floorsDetected ?? null,
          shotCount: flight._count.shots,
        }
      : null,
    variance,
    plannedFloors,
    findings: (flight?.findings ?? []).map((f) => ({ ...f, evidence: JSON.parse(f.evidence) as string[] })),
    floors,
    timeline,
    phases: PHASES,
    milestoneCount: ms.length,
  };
}

export async function listFlights(projectId: string) {
  const flights = await db.flight.findMany({
    where: { projectId },
    orderBy: [{ capturedAt: "desc" }, { createdAt: "desc" }],
    include: { shots: { orderBy: { createdAt: "asc" } }, reconstruction: true, findings: true },
  });
  const ms = toPlanned(await db.milestone.findMany({ where: { projectId } }));
  const obsByFlight = await db.progressObservation.findMany({ where: { flightId: { in: flights.map((f) => f.id) } } });
  return flights.map((f) => {
    const obs = toObservations(obsByFlight.filter((o) => o.flightId === f.id));
    const v = ms.length && obs.length ? scheduleVariance(ms, obs, f.capturedAt) : null;
    return {
      id: f.id,
      capturedAt: f.capturedAt,
      status: f.status,
      error: f.error,
      source: f.source,
      pilot: f.pilot,
      drone: f.drone,
      meshUrl: meshUrl(f.reconstruction?.meshKey),
      floorsDetected: f.reconstruction?.floorsDetected ?? null,
      daysBehind: v?.daysBehind ?? null,
      plannedPct: v?.plannedPct ?? null,
      earnedPct: v?.earnedPct ?? null,
      findingsCount: f.findings.length,
      shots: f.shots.map((s) => ({
        id: s.id,
        url: fileUrl(s.fileKey),
        thumbUrl: fileUrl(s.fileKey),
        view: s.view,
        label: s.label,
        capturedAt: s.capturedAt,
        lat: s.lat,
        lng: s.lng,
        altM: s.altM,
        sha256: s.sha256,
      })),
    };
  });
}

export async function listDocuments(projectId: string) {
  const docs = await db.document.findMany({ where: { projectId }, orderBy: { uploadedAt: "asc" }, include: { _count: { select: { milestones: true } } } });
  return docs.map((d) => ({
    id: d.id,
    kind: d.kind,
    title: d.title,
    pages: d.pages,
    sha256: d.sha256,
    status: d.status,
    error: d.error,
    issuer: d.issuer,
    issuedAt: d.issuedAt,
    uploadedAt: d.uploadedAt,
    url: fileUrl(d.fileKey),
    milestoneCount: d._count.milestones,
  }));
}

export async function listReports(projectId: string) {
  const reports = await db.report.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, include: { flight: true, createdBy: true } });
  return reports.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    daysBehind: r.daysBehind,
    pages: r.pages,
    sha256: r.sha256,
    url: fileUrl(r.fileKey),
    flightAt: r.flight.capturedAt,
    createdBy: r.createdBy?.name ?? null,
  }));
}
