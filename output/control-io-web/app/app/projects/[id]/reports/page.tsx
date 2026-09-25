import { AccentCard, GlassCard, Pill, severityTone } from "@/components/ui/primitives";
import { GenerateReport } from "@/components/app/GenerateReport";
import { listFlights, listReports } from "@/lib/server/queries";
import { severityFor } from "@/lib/domain/schedule";
import { orderContext } from "@/components/app/orderContext";
import { requireSession } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports" };

export default async function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const [s, { id }] = await Promise.all([requireSession(), params]);
  const [reports, flights, { access }] = await Promise.all([listReports(id), listFlights(id), orderContext(id, s)]);
  const assessed = flights.filter((f) => f.daysBehind != null);
  return (
    <div className="space-y-4">
      <div className="px-2 pt-4">
        <h1 className="display-xl text-[44px] md:text-[72px]">Reports</h1>
        <p className="mt-3 max-w-2xl text-muted">A signed-off evidence pack: verdict, plan-vs-actual per storey, every late milestone quoted from the official schedule, all drone shots and 3D captures with SHA-256 hashes, and the official documents annexed.</p>
      </div>
      {access === "write" && (
        <AccentCard title="New report" subtitle="Built from an assessed flight">
          <GenerateReport projectId={id} flights={assessed.map((f) => ({ id: f.id, label: `${new Date(f.capturedAt).toISOString().slice(0, 10)} · ${f.daysBehind! > 0 ? `${f.daysBehind} days behind` : f.daysBehind! < 0 ? `${-f.daysBehind!} days ahead` : "on plan"}` }))} />
        </AccentCard>
      )}
      <GlassCard title="Issued reports" subtitle={`${reports.length} report${reports.length === 1 ? "" : "s"}`}>
        <ul className="space-y-2">
          {reports.length === 0 && <li className="inner text-muted">No reports yet.</li>}
          {reports.map((r) => (
            <li key={r.id} className="inner grid grid-cols-[1fr_auto] items-center gap-3 md:grid-cols-[1.2fr_1fr_auto_auto]">
              <div>
                <p className="font-medium">Flight {new Date(r.flightAt).toISOString().slice(0, 10)}</p>
                <p className="text-[13px] text-muted">Issued {new Date(r.createdAt).toLocaleString("en-GB")} {r.createdBy ? `by ${r.createdBy}` : ""} · {r.pages} pages</p>
              </div>
              <p className="hidden truncate font-mono text-[11px] text-muted md:block" title={r.sha256}>sha256 {r.sha256.slice(0, 24)}…</p>
              <Pill tone={severityTone(severityFor(r.daysBehind))}>{r.daysBehind > 0 ? `−${r.daysBehind}d` : "on plan"}</Pill>
              <a href={r.url} target="_blank" rel="noreferrer" className="rounded-[12px] bg-ink px-4 py-2 text-[14px] text-white">Open PDF</a>
            </li>
          ))}
        </ul>
      </GlassCard>
    </div>
  );
}
