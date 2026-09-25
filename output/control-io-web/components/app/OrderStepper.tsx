/**
 * Order progress in the ORDI schedule/task-row anatomy: one white inner row
 * per milestone, the reached ones stamped in ink, the latest one in accent,
 * the rest as grey estimates. Yerevan time throughout. No hooks, so the
 * tracker (client) and server pages can both render it.
 */
import { cx } from "@/components/ui/primitives";
import type { OrderDto } from "@/lib/domain/orderTypes";
import { stepViews, yTime, yWhen, type StepView } from "./orderFormat";

export function OrderStepper({ order, now, compact = false }: { order: OrderDto; now: number; compact?: boolean }) {
  const steps = stepViews(order);
  const delayed = order.events.find((e) => e.status === "delayed");
  const cancelled = order.events.find((e) => e.status === "cancelled");
  return (
    <ol className={cx("space-y-2", compact && "space-y-1.5")} aria-label={`Progress of ${order.number}`}>
      {steps.map((s, i) => (
        <li
          key={s.status}
          aria-current={s.state === "current" ? "step" : undefined}
          className={cx(
            "grid grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-3 rounded-[var(--radius-inner)] px-3",
            compact ? "py-2" : "py-3",
            s.state === "next" || s.state === "skipped" ? "bg-white/55" : "bg-surface shadow-[var(--shadow-inner)]",
            s.state === "current" && "ring-2 ring-accent",
          )}
        >
          <Marker state={s.state} n={i + 1} />
          <div className="min-w-0 pt-0.5">
            <p className={cx("text-[15px] font-medium leading-snug", (s.state === "next" || s.state === "skipped") && "text-muted", s.state === "skipped" && "line-through decoration-1")}>{s.label}</p>
            {s.message && (!compact || s.state === "current") && s.status !== "requested" && !sameText(s.message, s.label) && (
              <p className="mt-0.5 text-[13px] leading-snug text-muted">{s.message}</p>
            )}
            {s.status === "processing" && delayed && order.status === "processing" && (
              <p className="mt-1 text-[13px] font-medium leading-snug text-warn">{delayed.message}</p>
            )}
          </div>
          <StepTime s={s} now={now} />
        </li>
      ))}
      {cancelled && (
        <li className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-start gap-3 rounded-[var(--radius-inner)] bg-surface px-3 py-3 shadow-[var(--shadow-inner)] ring-1 ring-line">
          <span className="grid size-7 place-items-center rounded-full bg-accent2 text-white" aria-hidden>
            <svg viewBox="0 0 16 16" className="size-3.5"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </span>
          <p className="pt-0.5 text-[15px] font-medium">Cancelled</p>
          <span className="pt-0.5 text-[14px] tabular">{yWhen(cancelled.at, now)}</span>
        </li>
      )}
    </ol>
  );
}

/** "Crew on site." adds nothing under the "Crew on site" label. */
const sameText = (a: string, b: string) => a.replace(/[.\s]+$/, "").toLowerCase() === b.toLowerCase();

function Marker({ state, n }: { state: StepView["state"]; n: number }) {
  if (state === "done")
    return (
      <span className="grid size-7 place-items-center rounded-full bg-ink text-white" aria-hidden>
        <svg viewBox="0 0 16 16" className="size-3.5"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
    );
  if (state === "current")
    return (
      <span className="relative grid size-7 place-items-center rounded-full bg-accent text-white" aria-hidden>
        <span className="absolute inset-0 rounded-full bg-accent/40 motion-safe:animate-ping" />
        <span className="relative size-2 rounded-full bg-white" />
      </span>
    );
  return (
    <span className="grid size-7 place-items-center rounded-full bg-ground text-[12px] font-medium text-muted tabular" aria-hidden>
      {n}
    </span>
  );
}

function StepTime({ s, now }: { s: StepView; now: number }) {
  if (s.at == null || s.state === "skipped") return <span className="pt-0.5 text-[14px] text-muted">-</span>;
  if (!s.estimate) {
    return <time dateTime={new Date(s.at).toISOString()} className="pt-0.5 text-right text-[14px] font-medium tabular">{yWhen(s.at, now)}</time>;
  }
  const text = s.until != null && yTime(s.until) !== yTime(s.at) ? `${yWhen(s.at, now)}–${yTime(s.until)}` : `${s.deadline ? "by " : "~"}${yWhen(s.at, now)}`;
  return (
    <span className="pt-0.5 text-right text-[14px] text-muted tabular" title={s.deadline ? "Deadline" : "Estimate"}>
      {text}
    </span>
  );
}
