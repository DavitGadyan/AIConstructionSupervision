/**
 * Project dashboard = ORDI screen 2, region for region:
 * headline over the 3D object (+ the Order inspection button), SegmentBar,
 * TimelineCard + AccentCard, and a right column with the active inspection
 * (when there is one), the floor table and the ring gauge.
 */
import Link from "next/link";
import { AccentCard, AccentSubCard, Button, GlassCard, Pill, RingGauge, SegmentBar, severityTone } from "@/components/ui/primitives";
import { Model3D } from "./Model3D";
import { ActiveOrderCard } from "./ActiveOrderCard";
import { yDateTime } from "./orderFormat";
import { OrderInspectionButton } from "./OrderInspectionButton";
import { PHASE_LABEL, type Phase } from "@/lib/domain/schedule";
import { ETA_HOURS, REPORT_HOURS, type OrderDto, type ProjectAccess } from "@/lib/domain/orderTypes";
import { formatAmd, FROM_PRICE_AMD } from "@/lib/domain/pricing";
import type { ProjectSummary } from "@/lib/server/queries";

export interface DashboardOrders {
  active: OrderDto | null;
  canOrder: boolean;
  /** The caller's access: upload / report actions only for "write". */
  access: ProjectAccess;
  /** Server render time, so countdowns hydrate without a mismatch. */
  now: number;
}

const DAY = 86_400_000;
const fmt = (d: Date | string) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

export function Dashboard({ s, orders }: { s: ProjectSummary; orders?: DashboardOrders }) {
  const { project, variance, latestFlight, findings, floors } = s;
  const base = `/app/projects/${project.id}`;
  const canWrite = !orders || orders.access === "write";
  const active = orders?.active ? { id: orders.active.id, number: orders.active.number, status: orders.active.status } : null;
  const behind = variance?.daysBehind ?? 0;
  const at = latestFlight ? new Date(latestFlight.capturedAt) : new Date();

  return (
    <div className="relative">
      {/* ORDI: the object sits behind the headline, top centre-right */}
      {latestFlight?.meshUrl && (
        <div className="pointer-events-none absolute -top-6 left-[34%] hidden h-[440px] w-[420px] xl:block" aria-hidden>
          <Model3D src={latestFlight.meshUrl} variant="hero" className="h-full w-full" />
        </div>
      )}
      <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-4">
          <div className="px-2 pb-2 pt-4 md:pt-10">
            <p className="eyebrow">{project.name}</p>
            <h1 className="display-xl mt-3 text-[48px] text-ink md:text-[76px]">
              {behind > 2 ? <>{behind} days<br />behind</> : behind < -2 ? <>{-behind} days<br />ahead</> : <>On<br />plan</>}
            </h1>
            <p className="mt-3 max-w-md text-[15px] text-muted">
              Latest flight {latestFlight ? yDateTime(latestFlight.capturedAt) : "—"}
              {latestFlight?.floorsDetected != null && <> · 3D model shows {latestFlight.floorsDetected} of {project.floorsTotal} storeys</>}
            </p>
            {orders && (
              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
                <OrderInspectionButton projectId={project.id} active={active} canOrder={orders.canOrder} />
                {!active && orders.canOrder && (
                  <p className="text-[13px] leading-snug text-muted">
                    Car + drone on site in {ETA_HOURS[0]}-{ETA_HOURS[1]} h
                    <br />
                    PDF within {REPORT_HOURS} h · from {formatAmd(FROM_PRICE_AMD)}
                  </p>
                )}
                {!active && !orders.canOrder && (
                  <Button href={`${base}/orders`} variant="light">Inspection history</Button>
                )}
              </div>
            )}
          </div>

          {variance ? (
            <SegmentBar
              label="Earned vs planned"
              total={<>{variance.earnedPct}<span className="text-[24px]">%</span> <span className="text-[20px] font-medium text-muted">/ {variance.plannedPct}%</span></>}
              segments={[
                ...variance.byPhase
                  .filter((p) => p.phase !== "finishes")
                  .map((p, i) => ({ label: `${PHASE_LABEL[p.phase]} · plan ${p.plannedPct}%`, value: p.earnedPct, tone: (["accent", "grey", "dark"] as const)[i] ?? ("light" as const) })),
                { label: "SPI", value: Math.round(variance.spi * 100), tone: "light" as const },
              ]}
            />
          ) : (
            <GlassCard title="No assessed flight yet" subtitle="Upload a flight and a baseline schedule to see schedule variance." href={`${base}/flights`} />
          )}

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <TimelineCard s={s} at={at} href={`${base}/documents`} />
            <AccentCard title="Lag alerts" subtitle={`${findings.length} milestone${findings.length === 1 ? "" : "s"} behind plan`} href={`${base}/reports`}>
              <div className="space-y-3">
                {findings.slice(0, 2).map((f) => (
                  <AccentSubCard key={f.id}>
                    <p className="font-display text-[17px] font-semibold">Floor {f.floor} · {PHASE_LABEL[f.phase as Phase]}</p>
                    <p className="mt-1 text-[13px] leading-snug text-white/85">
                      Planned complete {fmt(f.plannedEnd)}; observed {Math.round(f.observedPct)}% on {fmt(at)}.
                    </p>
                    <div className="mt-3 flex items-center gap-1.5">
                      <Pill tone="light" className="text-ink">{f.evidence.length} shots</Pill>
                      <Pill tone="dark">−{f.daysBehind}d</Pill>
                      <Pill tone={f.severity === "critical" ? "danger" : "dark"} className="ml-auto">{f.severity}</Pill>
                    </div>
                  </AccentSubCard>
                ))}
                {!findings.length && <AccentSubCard><p>No milestone is more than two days late.</p></AccentSubCard>}
              </div>
            </AccentCard>
          </div>
        </div>

        <div className="space-y-4">
          {orders?.active && <ActiveOrderCard initial={orders.active} initialNow={orders.now} />}
          <GlassCard title="Floors" subtitle="Structure observed vs planned" href={`${base}/model`}>
            <div className="grid grid-cols-[1fr_auto_64px_64px] gap-x-3 px-2 pb-2 text-[13px] text-muted">
              <span>Storey</span><span>Status</span><span className="text-right">Actual</span><span className="text-right">Plan</span>
            </div>
            <ul className="space-y-2">
              {pickFloors(floors).map((f) => (
                <li key={f.floor} className="inner grid grid-cols-[1fr_auto_64px_64px] items-center gap-x-3 px-3 py-2.5 text-[14px]">
                  <span>Level {String(f.floor).padStart(2, "0")}</span>
                  <Pill tone={severityTone(f.status)}>{f.status === "on-track" ? "on track" : f.status}</Pill>
                  <span className="text-right tabular">{f.structure ?? "—"}%</span>
                  <span className="text-right tabular text-muted">{f.plannedStructure ?? "—"}%</span>
                </li>
              ))}
            </ul>
            {canWrite ? (
              <Button href={`${base}/flights`} variant="light" className="mt-3 w-full">Upload flight</Button>
            ) : (
              <Button href={`${base}/flights`} variant="light" className="mt-3 w-full">All flights</Button>
            )}
          </GlassCard>

          <GlassCard
            title="Schedule variance"
            subtitle={<>Earned-schedule date: <b className="text-ink">{variance ? fmt(variance.earnedScheduleDate) : "—"}</b></>}
            action={<Link href={`${base}/flights`} className="rounded-[12px] bg-surface px-3 py-2 text-[13px] shadow-[var(--shadow-inner)]">Flights ⌄</Link>}
          >
            <div className="relative pb-2">
              <RingGauge value={Math.max(0, behind)} max={60} center={behind > 0 ? behind : 0} caption="Days behind" size={210} />
              <div className="absolute bottom-0 left-0 flex flex-col gap-2">
                <Link href={`${base}/live`} aria-label="Live feed" className="grid size-11 place-items-center rounded-[14px] bg-white/70"><svg viewBox="0 0 20 20" className="size-4" aria-hidden><path d="M7 5v10M13 5v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></Link>
                <Link href={`${base}/reports`} aria-label="Reports" className="grid size-11 place-items-center rounded-[14px] bg-surface shadow-[var(--shadow-inner)]"><span className="size-3 rounded-[3px] bg-ink" /></Link>
              </div>
              {canWrite && <Link href={`${base}/flights`} aria-label="Upload flight" className="absolute bottom-0 right-0 grid size-11 place-items-center rounded-[14px] bg-surface text-[22px] shadow-[var(--shadow-inner)]">+</Link>}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );

  function pickFloors(all: typeof floors) {
    // Rows around the construction front are the ones that matter.
    const front = all.findIndex((f) => (f.structure ?? 0) < 100);
    const i = front === -1 ? all.length - 1 : front;
    return all.slice(Math.max(0, i - 3), Math.max(0, i - 3) + 5).reverse();
  }
}

/**
 * ORDI "AI Smart Schedule": a date ruler with a few blocks spread across lanes.
 * Blocks are the construction front of each phase - the earliest milestone not
 * yet complete - plus the next structure milestone, so the card reads as
 * "where each trade is vs where it should be".
 */
function TimelineCard({ s, at, href }: { s: ProjectSummary; at: Date; href: string }) {
  const from = new Date(at.getTime() - 42 * DAY);
  const to = new Date(at.getTime() + 21 * DAY);
  const span = to.getTime() - from.getTime();
  const x = (d: Date | string) => Math.min(100, Math.max(0, ((new Date(d).getTime() - from.getTime()) / span) * 100));
  const byStart = [...s.timeline].sort((a, b) => +new Date(a.plannedStart) - +new Date(b.plannedStart));
  const front = (phase: string, skip = 0) => byStart.filter((m) => m.phase === phase && (m.actualPct ?? 0) < 100)[skip];
  const items = [front("structure"), front("structure", 1), front("envelope"), front("glazing")].filter((m): m is NonNullable<typeof m> => Boolean(m));
  const ticks = Array.from({ length: 7 }, (_, i) => new Date(from.getTime() + (i * span) / 6));
  return (
    <GlassCard
      title={<span className="flex flex-wrap items-center gap-2">Plan vs actual <Pill tone="dark">AI verified</Pill></span>}
      subtitle="Construction front of each trade vs the baseline"
      href={href}
    >
      <div className="inner relative overflow-hidden px-3 pb-4 pt-3">
        <div className="relative flex justify-between text-[12px] text-ink tabular">
          {ticks.map((t) => <span key={t.toISOString()}>{fmt(t)}</span>)}
        </div>
        <div className="relative mt-3 h-[212px]">
          {ticks.map((t) => <span key={t.toISOString()} className="absolute inset-y-0 border-l border-dashed border-line" style={{ left: `${x(t)}%` }} />)}
          {items.map((m, lane) => {
            const late = (m.actualPct ?? 0) < m.plannedPct - 5;
            const tone = m.phase === "structure" ? (late ? "bg-ink text-white" : "bg-accent text-white") : late ? "bg-accent2 text-white" : "bg-accent-soft text-ink";
            return (
              <div
                key={`${m.floor}-${m.phase}`}
                className={`absolute z-10 flex h-[46px] items-center gap-2 overflow-hidden rounded-[10px] py-1 pl-2.5 pr-1.5 text-[12px] ${tone}`}
                style={{ left: `min(${x(m.plannedStart)}%, calc(100% - 168px))`, width: `max(${x(m.plannedEnd) - x(m.plannedStart)}%, 168px)`, top: lane * 54 }}
                title={`Floor ${m.floor} ${m.phase}: planned ${fmt(m.plannedStart)}–${fmt(m.plannedEnd)}, observed ${m.actualPct ?? "?"}%`}
              >
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate font-semibold">L{m.floor} {PHASE_LABEL[m.phase as Phase]}</span>
                  <span className="block truncate opacity-80">due {fmt(m.plannedEnd)}</span>
                </span>
                <span className="grid h-[34px] min-w-[42px] place-items-center rounded-[8px] bg-white/25 px-1.5 font-semibold tabular">{Math.round(m.actualPct ?? 0)}%</span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 h-1 rounded-full bg-ground">
          <div className="h-1 rounded-full bg-ink" style={{ width: `${x(at)}%` }} aria-label={`Flight date ${fmt(at)}`} />
        </div>
      </div>
    </GlassCard>
  );
}
