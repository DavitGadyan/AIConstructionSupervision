"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/primitives";

export function GenerateReport({ projectId, flights }: { projectId: string; flights: { id: string; label: string }[] }) {
  const router = useRouter();
  const [flightId, setFlightId] = useState(flights[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/projects/${projectId}/reports`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ flightId }) });
    setBusy(false);
    if (!res.ok) return setErr((await res.json().catch(() => ({}))).error ?? "Could not build the report");
    const { url } = await res.json();
    window.open(url, "_blank", "noopener");
    router.refresh();
  }
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1 text-[13px] text-white/80">
        Flight
        <select value={flightId} onChange={(e) => setFlightId(e.target.value)} className="rounded-[12px] bg-white/15 px-3 py-3 text-[15px] text-white ring-1 ring-white/20 [&>option]:text-ink">
          {flights.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
      </label>
      <Button onClick={go} disabled={busy || !flightId} variant="light">{busy ? "Building PDF…" : "Generate PDF report"}</Button>
      {err && <p role="alert" className="text-[14px] text-white">{err}</p>}
    </div>
  );
}
