"use client";

/**
 * Live tracking of one inspection order: SSE (`event: order`) + a 15 s poll,
 * a countdown ring (ORDI "Time Tracker"), the milestone stepper, the crew and
 * Cancel while it is allowed. Two layouts:
 * - "page": the order detail page (headline, stepper, ring, crew, details)
 * - "summary": the active order on the Orders page (ring + compact stepper)
 */
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AccentCard, AccentSubCard, Button, GlassCard, Pill, RingGauge, cx } from "@/components/ui/primitives";
import type { OrderDto } from "@/lib/domain/orderTypes";
import { formatAmd, KIND_LABEL } from "@/lib/domain/pricing";
import { OrderStepper } from "./OrderStepper";
import { clock, countdown, isTerminal, STATUS_LABEL, STATUS_TITLE, statusTone, stepViews, yDateTime, yWhen } from "./orderFormat";
import { useLiveOrder, useNow } from "./useLiveOrder";

export function OrderTracker({ initial, initialNow, variant = "page" }: { initial: OrderDto; initialNow: number; variant?: "page" | "summary" }) {
  const router = useRouter();
  const { order, setOrder, link, announcement } = useLiveOrder(initial);
  const now = useNow(initialNow);
  const base = `/app/projects/${order.projectId}/orders`;

  // The Orders page swaps the tracker for the form once the order is over.
  const wasTerminal = useRef(isTerminal(initial.status));
  useEffect(() => {
    if (isTerminal(order.status) && !wasTerminal.current) {
      wasTerminal.current = true;
      router.refresh();
    }
  }, [order.status, router]);

  const live = isTerminal(order.status) ? null : <LinkDot link={link} />;
  const sr = (
    <p className="sr-only" aria-live="polite" aria-atomic="true">
      {announcement}
    </p>
  );

  if (variant === "summary") {
    return (
      <GlassCard
        title={
          <span className="flex flex-wrap items-center gap-2">
            Active inspection <Pill tone={statusTone(order.status)}>{STATUS_LABEL[order.status]}</Pill>
          </span>
        }
        subtitle={
          <>
            <span className="tabular">{order.number}</span> · {KIND_LABEL[order.kind]} · ordered {yWhen(order.createdAt, now)} by {order.requestedBy.name}
          </>
        }
        href={`${base}/${order.id}`}
        openLabel={`Open tracker for ${order.number}`}
      >
        {sr}
        <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="inner flex flex-col items-center gap-3 px-4 py-5">
            <CountdownRing order={order} now={now} size={196} />
            <p className="text-center text-[14px] leading-snug text-muted">{countdown(order, now).sentence}</p>
            {live}
          </div>
          <div className="min-w-0 space-y-3">
            <OrderStepper order={order} now={now} compact />
            {order.crew && (
              <p className="inner flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-[14px]">
                <span className="font-medium">{order.crew.pilot}</span>
                <span className="text-muted">{order.crew.vehicle}</span>
                <Pill tone="light">{order.crew.plate}</Pill>
                <a href={`tel:${order.crew.pilotPhone.replace(/\s/g, "")}`} className="ml-auto font-medium text-accent underline-offset-4 hover:underline">
                  Call pilot
                </a>
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button href={`${base}/${order.id}`} variant="dark">Open tracker</Button>
              <CancelControl order={order} onDone={(o) => { setOrder(o); router.refresh(); }} />
            </div>
          </div>
        </div>
      </GlassCard>
    );
  }

  const cd = countdown(order, now);
  const [l1, l2] = STATUS_TITLE[order.status];
  return (
    <div className="space-y-4">
      {sr}
      <div className="px-2 pt-2 md:pt-6">
        <p className="eyebrow flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="tabular">{order.number}</span>
          <span aria-hidden>·</span>
          <span>{KIND_LABEL[order.kind]}</span>
          <span aria-hidden>·</span>
          <span>{order.priority === "asap" ? "ASAP" : "Scheduled"}</span>
        </p>
        <h1 className="display-xl mt-3 text-[44px] text-ink md:text-[76px]">
          {l1}
          <br />
          {l2}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className={cx("max-w-xl text-[15px]", cd.overdue ? "text-warn" : "text-muted")}>{cd.sentence}</p>
          {live}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-4">
          <GlassCard title="Progress" subtitle="Reached steps in ink, estimates in grey · Yerevan time">
            <OrderStepper order={order} now={now} />
          </GlassCard>
          <Details order={order} now={now} />
        </div>

        {/* Phones: the countdown and the crew come first. */}
        <div className="order-first space-y-4 xl:order-none">
          <GlassCard title={order.status === "delivered" ? "Report" : "Countdown"} subtitle={cd.target ? `Next: ${nextLabel(order)}` : cd.caption}>
            <div className="pb-1">
              <CountdownRing order={order} now={now} size={210} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {order.reportUrl && (
                <a href={order.reportUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-btn)] bg-ink px-5 py-3 text-[15px] font-medium text-white hover:bg-black">
                  Open PDF report
                </a>
              )}
              {order.status === "delivered" && <Button href={`/app/projects/${order.projectId}/reports`} variant="light">All reports</Button>}
              <CancelControl order={order} onDone={(o) => { setOrder(o); router.refresh(); }} />
            </div>
          </GlassCard>
          <CrewCard order={order} now={now} />
        </div>
      </div>
    </div>
  );
}

function nextLabel(o: OrderDto) {
  const next = stepViews(o).find((s) => s.state === "next");
  return next ? next.label.toLowerCase() : "report";
}

export function LinkDot({ link }: { link: "connecting" | "live" | "polling" }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-muted">
      <span className={cx("size-2 rounded-full", link === "live" ? "bg-ok motion-safe:animate-pulse" : "bg-accent2")} aria-hidden />
      {link === "live" ? "Live" : link === "polling" ? "Updating every 15 s" : "Connecting…"}
    </span>
  );
}

/**
 * RingGauge's tick dots are trig floats that differ in the last digit between
 * Node and the browser, so the ring is drawn after hydration; the server HTML
 * carries the same-size box with the countdown text.
 */
function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

function RingShell({ size, center, caption }: { size: number; center: React.ReactNode; caption: string }) {
  return (
    <div className="relative mx-auto grid place-items-center rounded-full bg-white/35 text-center ring-[3px] ring-ink/[0.08]" style={{ width: size, height: size }}>
      <div>
        <div className="font-display text-[40px] font-bold leading-none tabular">{center}</div>
        <div className="mt-1 text-[11px] font-medium uppercase tracking-wider">{caption}</div>
      </div>
    </div>
  );
}

export function CountdownRing({ order, now, size = 200 }: { order: OrderDto; now: number; size?: number }) {
  const mounted = useMounted();
  const Gauge = mounted ? RingGauge : RingShell;
  const cd = countdown(order, now);
  if (cd.target == null) {
    return (
      <Gauge
        value={order.status === "delivered" ? 1 : 0}
        max={1}
        center={order.status === "delivered" ? "Ready" : "-"}
        caption={cd.caption}
        size={size}
      />
    );
  }
  const total = Math.max(1, cd.target - cd.from);
  const left = cd.target - now;
  const c = clock(left);
  return (
    <div role="timer" aria-label={`${left > 0 ? `${c.value} ${c.unit}` : "due now"} ${cd.caption}`}>
      <Gauge
        value={Math.min(total, Math.max(0, now - cd.from))}
        max={total}
        center={left > 0 ? c.value : "Now"}
        caption={left > 0 ? `${c.unit} ${cd.caption}` : cd.caption}
        size={size}
      />
    </div>
  );
}

function CrewCard({ order, now }: { order: OrderDto; now: number }) {
  const crew = order.crew;
  const dispatch = stepViews(order).find((s) => s.status === "dispatched");
  if (order.status === "cancelled" && !crew) return null;
  return (
    <AccentCard title="Your crew" subtitle={crew ? crew.vehicle : "Car + drone unit"}>
      {crew ? (
        <div className="space-y-3">
          <AccentSubCard className="flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-white font-display text-[17px] font-semibold text-accent" aria-hidden>
              {crew.pilot.split(" ").map((p) => p[0]).join("").slice(0, 2)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[18px] font-semibold leading-tight">{crew.pilot}</p>
              <p className="text-[13px] text-white/85">Drone pilot · {crew.pilotPhone}</p>
            </div>
          </AccentSubCard>
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill tone="light" className="text-ink">{crew.plate}</Pill>
            <Pill tone="dark">{crew.drone}</Pill>
          </div>
          {!isTerminal(order.status) && (
            <a
              href={`tel:${crew.pilotPhone.replace(/\s/g, "")}`}
              className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-btn)] bg-white px-5 py-3 text-[15px] font-medium text-ink transition hover:-translate-y-0.5"
            >
              <svg viewBox="0 0 20 20" className="size-4" aria-hidden><path d="M6.5 3.5l2 3.5-1.6 1.4a8.6 8.6 0 004.7 4.7L13 11.5l3.5 2-.8 2.4c-.3.8-1.1 1.2-1.9 1A13 13 0 013.1 5.2c-.2-.8.2-1.6 1-1.9l2.4-.8z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
              Call {crew.pilot.split(" ")[0]}
            </a>
          )}
        </div>
      ) : (
        <AccentSubCard>
          <p className="text-[15px] leading-snug">
            The pilot, vehicle and plate appear here when the crew leaves base
            {dispatch?.at && order.status !== "cancelled" ? <> (about <span className="tabular">{yWhen(dispatch.at, now)}</span>)</> : null}.
          </p>
        </AccentSubCard>
      )}
    </AccentCard>
  );
}

function Details({ order, now }: { order: OrderDto; now: number }) {
  const rows: [string, React.ReactNode][] = [
    ["Order", <span key="n" className="tabular">{order.number}</span>],
    ["Inspection", KIND_LABEL[order.kind]],
    ["When", order.priority === "asap" ? `ASAP, ordered ${yWhen(order.createdAt, now)}` : `Scheduled for ${order.scheduledFor ? yDateTime(order.scheduledFor) : "-"}`],
    ["Site", `${order.projectName}, ${order.projectAddress}`],
    [
      "Site contact",
      <span key="c">
        {order.contactName} ·{" "}
        <a className="text-accent underline-offset-4 hover:underline" href={`tel:${order.contactPhone.replace(/\s/g, "")}`}>
          {order.contactPhone}
        </a>
      </span>,
    ],
    ["Access notes", order.accessNotes || "-"],
    ["Price", <span key="p"><b className="tabular">{formatAmd(order.priceAmd)}</b> <span className="text-muted">· VAT excl., paid by invoice</span></span>],
    ["Ordered by", `${order.requestedBy.name}, ${yDateTime(order.createdAt)}`],
  ];
  return (
    <GlassCard title="Order details">
      <dl className="inner divide-y divide-line p-0">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 px-4 py-3 text-[14px] sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-4">
            <dt className="text-muted">{k}</dt>
            <dd className="min-w-0 break-words">{v}</dd>
          </div>
        ))}
        {order.focus.length > 0 && (
          <div className="grid gap-1 px-4 py-3 text-[14px] sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-4">
            <dt className="text-muted">Focus</dt>
            <dd className="flex flex-wrap gap-1.5">
              {order.focus.map((f) => (
                <Pill key={f} tone="light">{f}</Pill>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </GlassCard>
  );
}

/** Cancel with an inline confirmation; shown only while the API says the caller may cancel. */
export function CancelControl({ order, onDone }: { order: OrderDto; onDone: (o: OrderDto) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!order.canCancel && !err) return null;

  async function cancel() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/cancel`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(body.error ?? "Could not cancel the order");
        return;
      }
      setConfirming(false);
      onDone(body as OrderDto);
    } catch {
      setErr("Network error, please try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-2">
      {!confirming ? (
        order.canCancel && (
          <Button variant="ghost" onClick={() => setConfirming(true)} className="self-start px-3 text-muted">
            Cancel order
          </Button>
        )
      ) : (
        <div className="inner space-y-3 p-4" role="group" aria-label="Confirm cancellation">
          <p className="text-[14px]">
            Cancel <b className="tabular">{order.number}</b>? The crew is recalled. You can cancel until the crew is on site.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={cancel} disabled={busy} className="rounded-[var(--radius-btn)] bg-danger px-4 py-2.5 text-[14px] font-medium text-white disabled:opacity-50">
              {busy ? "Cancelling…" : "Yes, cancel"}
            </button>
            <Button variant="light" onClick={() => setConfirming(false)} className="px-4 py-2.5 text-[14px]">Keep order</Button>
          </div>
        </div>
      )}
      {err && (
        <p role="alert" className="text-[14px] text-danger">
          {err}
        </p>
      )}
    </div>
  );
}

