import { db } from "./db";
import { meshUrl } from "./queries";
import { plannedPctAt, type Phase } from "../domain/schedule";

export interface ModelFinding {
  id: string;
  floor: number | null;
  phase: string;
  severity: string;
  daysBehind: number;
  /** GLB space, Y up, metres - where the marker sits on the model */
  position: [number, number, number];
}

/**
 * Where a finding sits on the demo tower (storey n spans
 * y ∈ [(n-1)·3.2 + 0.8, n·3.2 + 0.8]): structure at the centre of the
 * storey, envelope and glazing on the south facade.
 */
export function findingPosition(floor: number | null, phase: string, floorHeightM = 3.2): [number, number, number] {
  const y = floor == null ? 1.6 : (floor - 1) * floorHeightM + 0.8 + floorHeightM / 2;
  if (phase === "envelope") return [4, y, 8.6];
  if (phase === "glazing") return [-6, y, 8.6];
  return [-5, y, 0];
}

/** Flights with meshes + how many storeys the plan expected by each flight + its findings. */
export async function modelFlights(projectId: string) {
  const [flights, ms, findings, project] = await Promise.all([
    db.flight.findMany({ where: { projectId }, orderBy: { capturedAt: "desc" }, include: { reconstruction: true } }),
    db.milestone.findMany({ where: { projectId, phase: "structure" } }),
    db.lagFinding.findMany({
      where: { projectId },
      orderBy: [{ daysBehind: "desc" }],
      select: { id: true, flightId: true, floor: true, phase: true, severity: true, daysBehind: true },
    }),
    db.project.findUnique({ where: { id: projectId }, select: { floorHeightM: true } }),
  ]);
  const h = project?.floorHeightM ?? 3.2;
  return flights.map((f) => ({
    id: f.id,
    capturedAt: f.capturedAt.toISOString(),
    meshUrl: meshUrl(f.reconstruction?.meshKey),
    floorsDetected: f.reconstruction?.floorsDetected ?? null,
    plannedFloors: ms.filter((m) => m.floor != null && plannedPctAt({ ...m, phase: m.phase as Phase, id: m.id }, f.capturedAt) >= 100).length,
    findings: findings
      .filter((x) => x.flightId === f.id)
      .map(
        (x): ModelFinding => ({
          id: x.id,
          floor: x.floor,
          phase: x.phase,
          severity: x.severity,
          daysBehind: x.daysBehind,
          position: findingPosition(x.floor, x.phase, h),
        }),
      ),
  }));
}
