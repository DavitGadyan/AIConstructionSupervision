"use client";

/** Dashboard accent card for the project's active inspection, kept live like the tracker. */
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AccentCard, AccentSubCard, Pill, cx } from "@/components/ui/primitives";
import type { OrderDto } from "@/lib/domain/orderTypes";
import { KIND_LABEL } from "@/lib/domain/pricing";
import { clock, countdown, isTerminal, STATUS_LABEL, stepViews, yWhen } from "./orderFormat";
import { useLiveOrder, useNow } from "./useLiveOrder";

export function ActiveOrderCard({ initial, initialNow }: { initial: OrderDto; initialNow: number }) {
  const router = useRouter();
  const { order, announcement } = useLiveOrder(initial);
  const now = useNow(initialNow);
  const cd = countdown(order, now);
  const steps = stepViews(order);
  const left = cd.target != null ? cd.target - now : null;
  const c = left != null ? clock(left) : null;

  // Once delivered (new flight + report) the dashboard numbers change: refresh them.
  useEffect(() => {
    if (isTerminal(order.status) && !isTerminal(initial.status)) router.refresh();
  }, [order.status, initial.status, router]);

  return (
    <AccentCard
      title="Active inspection"
      subtitle={
        <>
          <span className="tabular">{order.number}</span> · {KIND_LABEL[order.kind]} · {order.priority === "asap" ? "ASAP" : "Scheduled"}
        </>
      }
      href={`/app/projects/${order.projectId}/orders/${order.id}`}
      openLabel={`Track ${order.number}`}
    >
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <AccentSubCard>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-[17px] font-semibold">{STATUS_LABEL[order.status]}</p>
            <p className="mt-1 text-[13px] leading-snug text-white/85">{cd.sentence}</p>
          </div>
          {c && left != null && (
            <div className="shrink-0 text-right">
              <p className="font-display text-[34px] font-bold leading-none tabular">{left > 0 ? c.value : "Now"}</p>
              <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-white/80">{left > 0 ? `${c.unit} ${cd.caption}` : cd.caption}</p>
            </div>
          )}
        </div>
        <ol className="mt-4 flex gap-1" aria-label="Progress">
          {steps.map((s) => (
            <li
              key={s.status}
              title={`${s.label}${s.at ? ` · ${s.estimate ? "~" : ""}${yWhen(s.at, now)}` : ""}`}
              className={cx(
                "h-2 flex-1 rounded-full",
                s.state === "done" ? "bg-white" : s.state === "current" ? "bg-white motion-safe:animate-pulse" : "bg-white/25",
              )}
            >
              <span className="sr-only">
                {s.label}: {s.state === "next" ? "upcoming" : s.state === "current" ? "current" : "done"}
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {order.crew ? (
            <>
              <Pill tone="light" className="text-ink">{order.crew.pilot}</Pill>
              <Pill tone="dark">{order.crew.plate}</Pill>
            </>
          ) : (
            <Pill tone="dark">Crew assigned at dispatch</Pill>
          )}
          {order.etaArrivalFrom && !order.arrivedAt && (
            <Pill tone="dark" className="ml-auto">
              ETA {yWhen(order.etaArrivalFrom, now)}
            </Pill>
          )}
        </div>
      </AccentSubCard>
    </AccentCard>
  );
}
