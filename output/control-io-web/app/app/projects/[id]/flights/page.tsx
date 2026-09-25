import { GlassCard, Pill, severityTone } from "@/components/ui/primitives";
import { UploadFlight } from "@/components/app/UploadFlight";
import { listFlights } from "@/lib/server/queries";
import { severityFor } from "@/lib/domain/schedule";
import { orderContext } from "@/components/app/orderContext";
import { requireSession } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Flights & shots" };

const fmt = (d: Date) => new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";

export default async function FlightsPage({ params }: { params: Promise<{ id: string }> }) {
  const [s, { id }] = await Promise.all([requireSession(), params]);
  const [flights, { access }] = await Promise.all([listFlights(id), orderContext(id, s)]);
  return (
    <div className="space-y-4">
      <h1 className="display-xl px-2 pt-4 text-[44px] md:text-[72px]">Flights</h1>
      {access === "write" && (
        <GlassCard title="New flight" subtitle="Upload a flight from the drone's SD card, or use the mobile app on site.">
          <UploadFlight projectId={id} />
        </GlassCard>
      )}
      {flights.map((f) => (
        <GlassCard
          key={f.id}
          title={fmt(f.capturedAt)}
          subtitle={`${f.shots.length} shots · ${f.drone ?? "drone"} · pilot ${f.pilot ?? "—"}${f.floorsDetected != null ? ` · 3D: ${f.floorsDetected} storeys` : ""}${f.source === "sample" ? " · sample imagery" : ""}`}
          href={`/app/projects/${id}/model?flight=${f.id}`}
        >
          <div className="mb-3 flex flex-wrap gap-2">
            <Pill tone={f.status === "done" ? "dark" : f.status === "failed" ? "danger" : "grey"}>{f.status}</Pill>
            {f.daysBehind != null && <Pill tone={severityTone(severityFor(f.daysBehind))}>{f.daysBehind > 0 ? `${f.daysBehind} days behind` : f.daysBehind < 0 ? `${-f.daysBehind} days ahead` : "on plan"}</Pill>}
            {f.error && <span className="text-[13px] text-danger">{f.error}</span>}
          </div>
          <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
            {f.shots.map((s) => (
              <li key={s.id} className="inner w-[260px] shrink-0 snap-start overflow-hidden p-0">
                <a href={s.url} target="_blank" rel="noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.thumbUrl} alt={`${s.label ?? s.view}, ${fmt(s.capturedAt)}`} loading="lazy" className="aspect-[16/10] w-full object-cover" />
                </a>
                <div className="space-y-1 p-3 text-[13px]">
                  <p className="font-medium text-ink">{s.label ?? s.view}</p>
                  <p className="text-muted">{new Date(s.capturedAt).toISOString().slice(11, 16)} UTC{s.altM != null ? ` · ${s.altM} m` : ""}{s.lat != null ? ` · ${s.lat.toFixed(5)}, ${s.lng?.toFixed(5)}` : ""}</p>
                  <p className="truncate font-mono text-[11px] text-muted" title={s.sha256}>sha256 {s.sha256.slice(0, 16)}…</p>
                </div>
              </li>
            ))}
          </ul>
        </GlassCard>
      ))}
    </div>
  );
}
