"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Pill, severityTone } from "@/components/ui/primitives";
import type { TowerMarker, TowerModelHandle } from "@/components/three/TowerModel";
import { SEV_LABEL } from "@/components/three/markers";
import { Model3D } from "./Model3D";

interface Finding { id: string; floor: number | null; phase: string; severity: string; daysBehind: number; position: [number, number, number] }
interface Flight { id: string; capturedAt: string; meshUrl: string | null; floorsDetected: number | null; plannedFloors: number; findings?: Finding[] }

const PHASE: Record<string, string> = { structure: "Structure", envelope: "Envelope", glazing: "Glazing", finishes: "Finishes" };
const where = (f: Finding) => `${f.floor == null ? "Whole building" : `Floor ${f.floor}`} · ${PHASE[f.phase] ?? f.phase}`;
const isMarkerSev = (s: string): s is TowerMarker["severity"] => s === "critical" || s === "late" || s === "watch";

/** Full 3D page: flight picker, planned-floors ghost, storey slicer, evidence capture. */
export function ModelViewer({ projectId, flights, floorsTotal, floorHeightM, initialFlightId, embed = false, canCapture = true }: { projectId: string; flights: Flight[]; floorsTotal: number; floorHeightM: number; initialFlightId?: string; embed?: boolean; /** Saving evidence needs write access (403 otherwise). */ canCapture?: boolean }) {
  const withMesh = flights.filter((f) => f.meshUrl);
  const [flightId, setFlightId] = useState(initialFlightId && withMesh.some((f) => f.id === initialFlightId) ? initialFlightId : withMesh[0]?.id);
  const flight = withMesh.find((f) => f.id === flightId);
  const [ghost, setGhost] = useState(true);
  const [slice, setSlice] = useState<number>(floorsTotal);
  const [site, setSite] = useState(true);
  const [msg, setMsg] = useState("");
  const ref = useRef<TowerModelHandle>(null);
  const [pins, setPins] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Only findings that are actually behind get a pin; on-track rows stay in the report.
  const findings = useMemo(() => (flight?.findings ?? []).filter((f) => isMarkerSev(f.severity) && (slice >= floorsTotal || f.floor == null || f.floor <= slice)), [flight, slice, floorsTotal]);
  const markers = useMemo<TowerMarker[]>(
    () =>
      findings.map((f) => ({
        id: f.id,
        position: f.position,
        severity: f.severity as TowerMarker["severity"],
        kind: "delay",
        label: `${where(f)}, ${SEV_LABEL[f.severity as TowerMarker["severity"]].toLowerCase()}, ${f.daysBehind} days behind`,
      })),
    [findings],
  );
  const selected = findings.find((f) => f.id === selectedId) ?? null;
  useEffect(() => setSelectedId(null), [flightId]);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  async function capture() {
    const dataUrl = ref.current?.capture();
    if (!dataUrl || !flight) return;
    setMsg("Saving…");
    const res = await fetch(`/api/projects/${projectId}/flights/${flight.id}/captures`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl, label: `3D model ${new Date(flight.capturedAt).toISOString().slice(0, 10)}${ghost ? ` vs plan (${flight.plannedFloors} storeys planned)` : ""}` }),
    });
    setMsg(res.ok ? "Saved as evidence - it will appear in the next report." : "Could not save the capture");
  }

  if (!flight) return <p className="p-6 text-muted">No 3D reconstruction yet. Upload a flight with NODEODM_URL configured, or seed the sample flights.</p>;

  return (
    <div className={embed ? "flex h-dvh flex-col" : "space-y-4"}>
      <div className={`glass relative overflow-hidden p-0 ${embed ? "flex-1 rounded-none" : "h-[62vh] min-h-[420px]"}`}>
        <Model3D
          key={flight.id}
          ref={ref}
          src={flight.meshUrl!}
          variant="viewer"
          plannedFloors={ghost ? flight.plannedFloors : undefined}
          floorsTotal={floorsTotal}
          floorHeightM={floorHeightM}
          sliceFloor={slice < floorsTotal ? slice : null}
          towerOnly={!site}
          markers={pins ? markers : undefined}
          selectedId={selectedId}
          onSelect={setSelectedId}
          className="h-full w-full"
        />
        <div className="pointer-events-none absolute left-3 top-3 z-40 flex flex-wrap gap-2">
          <Pill tone="dark">{flight.floorsDetected ?? "?"} storeys built</Pill>
          {ghost && <Pill tone="accent">{flight.plannedFloors} planned</Pill>}
          {pins && findings.length > 0 && <Pill tone="light">{findings.length} findings</Pill>}
        </div>
        {selected && pins && (
          <div role="dialog" aria-label={`Finding: ${where(selected)}`} className="inner absolute bottom-3 left-3 right-3 z-40 max-w-[340px] p-4 shadow-[var(--shadow-card)] sm:right-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[13px] text-muted">{where(selected)}</p>
                <p className="mt-1 font-display text-[28px] font-bold leading-none tabular text-danger">−{selected.daysBehind} days</p>
              </div>
              <button type="button" aria-label="Close finding" onClick={() => setSelectedId(null)} className="grid size-8 place-items-center rounded-[10px] bg-page text-ink hover:bg-accent-soft">
                <svg viewBox="0 0 16 16" fill="none" className="size-3.5" aria-hidden>
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Pill tone={severityTone(selected.severity)}>{SEV_LABEL[selected.severity as TowerMarker["severity"]]}</Pill>
              <span className="text-[13px] text-muted">behind the baseline at this flight</span>
            </div>
          </div>
        )}
      </div>
      <div className={`glass grid gap-4 p-4 md:grid-cols-[1fr_1fr_auto] md:items-center ${embed ? "m-2" : ""}`}>
        <label className="flex flex-col gap-1 text-[13px] text-muted">
          Flight
          <select value={flight.id} onChange={(e) => setFlightId(e.target.value)} className="inner px-3 py-2.5 text-[15px] text-ink">
            {withMesh.map((f) => <option key={f.id} value={f.id}>{new Date(f.capturedAt).toISOString().slice(0, 10)} · {f.floorsDetected ?? "?"} storeys</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[13px] text-muted">
          Show up to storey {slice}
          <input type="range" min={1} max={floorsTotal} value={slice} onChange={(e) => setSlice(Number(e.target.value))} className="accent-[var(--color-accent)]" />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inner flex items-center gap-2 px-3 py-2.5 text-[14px]"><input type="checkbox" checked={ghost} onChange={(e) => setGhost(e.target.checked)} /> Planned</label>
          <label className="inner flex items-center gap-2 px-3 py-2.5 text-[14px]"><input type="checkbox" checked={site} onChange={(e) => setSite(e.target.checked)} /> Site</label>
          <label className="inner flex items-center gap-2 px-3 py-2.5 text-[14px]"><input type="checkbox" checked={pins} onChange={(e) => setPins(e.target.checked)} /> Findings</label>
          <Button variant="light" onClick={() => { setSelectedId(null); ref.current?.resetView(); }}>Reset view</Button>
          {!embed && canCapture && <Button variant="accent" onClick={capture}>Capture evidence</Button>}
        </div>
        {msg && <p role="status" className="text-[14px] text-muted md:col-span-3">{msg}</p>}
      </div>
    </div>
  );
}
