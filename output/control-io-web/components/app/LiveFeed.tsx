"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, GlassCard, Pill } from "@/components/ui/primitives";
import type { OrderDto, OrderEventStatus } from "@/lib/domain/orderTypes";
import { STATUS_LABEL, statusTone, yClock, yTime } from "./orderFormat";

interface Shot { id: string; url: string; label: string | null; view: string; capturedAt: string }
export interface OrderFeedItem { kind: "order"; at: string; orderId: string; number: string; status: OrderEventStatus; message: string }
type Item =
  | { kind: "shot"; at: string; flightId: string; shot: Shot }
  | { kind: "status"; at: string; flightId?: string; status: string; message: string }
  | { kind: "finding"; at: string; daysBehind: number }
  | OrderFeedItem;

/** Order events not seen yet, oldest first (a catch-up can deliver several at once). */
function newOrderItems(o: OrderDto, seen: Set<string>): OrderFeedItem[] {
  const out: OrderFeedItem[] = [];
  for (const e of o.events) {
    const key = `${o.id}:${e.status}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ kind: "order", at: e.at, orderId: o.id, number: o.number, status: e.status, message: e.message });
  }
  return out;
}

/** Live SSE feed of a project: new shots as they land, pipeline status, fresh findings and inspection orders. All times Yerevan. */
export function LiveFeed({ projectId, initialShots, initialOrderItems = [] }: { projectId: string; initialShots: Shot[]; initialOrderItems?: OrderFeedItem[] }) {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const [items, setItems] = useState<Item[]>(initialOrderItems);
  const [shots, setShots] = useState<Shot[]>(initialShots);
  const seen = useRef(new Set(initialOrderItems.map((i) => `${i.orderId}:${i.status}`)));

  useEffect(() => {
    if (paused) return;
    const es = new EventSource(`/api/projects/${projectId}/live`);
    const now = () => new Date().toISOString();
    es.addEventListener("ping", () => setConnected(true));
    es.addEventListener("shot", (e) => {
      const d = JSON.parse((e as MessageEvent).data);
      setShots((s) => [d.shot, ...s].slice(0, 60));
      setItems((i) => [{ kind: "shot" as const, at: now(), flightId: d.flightId, shot: d.shot }, ...i].slice(0, 50));
    });
    es.addEventListener("status", (e) => {
      const d = JSON.parse((e as MessageEvent).data);
      setItems((i) => [{ kind: "status" as const, at: now(), ...d }, ...i].slice(0, 50));
      if (d.status === "done") router.refresh();
    });
    es.addEventListener("finding", (e) => {
      const d = JSON.parse((e as MessageEvent).data);
      setItems((i) => [{ kind: "finding" as const, at: now(), daysBehind: d.daysBehind }, ...i].slice(0, 50));
    });
    es.addEventListener("order", (e) => {
      const o = JSON.parse((e as MessageEvent).data) as OrderDto;
      const fresh = newOrderItems(o, seen.current);
      if (!fresh.length) return;
      setItems((i) => [...fresh.reverse(), ...i].slice(0, 50));
      // A delivered order brings a new flight and report: refresh the server-rendered parts.
      if (fresh.some((f) => f.status === "delivered")) router.refresh();
    });
    es.onerror = () => setConnected(false);
    return () => es.close();
  }, [projectId, paused, router]);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <GlassCard
        title={<span className="flex items-center gap-2">Live shots <span className={`size-2.5 rounded-full ${connected && !paused ? "animate-pulse bg-ok" : "bg-accent2"}`} aria-hidden /></span>}
        subtitle={paused ? "Paused" : connected ? "Connected - new drone shots appear as they upload" : "Connecting…"}
        action={<Button variant="light" onClick={() => setPaused((p) => !p)}>{paused ? "Resume" : "Pause"}</Button>}
      >
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shots.map((s) => (
            <li key={s.id} className="inner overflow-hidden p-0 motion-safe:animate-[fadeIn_.4s_ease-out]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.url} alt={s.label ?? s.view} className="aspect-[16/10] w-full object-cover" loading="lazy" />
              <p className="flex justify-between gap-2 p-3 text-[13px]"><span className="truncate">{s.label ?? s.view}</span><span className="shrink-0 text-muted tabular">{yTime(s.capturedAt)}</span></p>
            </li>
          ))}
        </ul>
      </GlassCard>
      <GlassCard title="Activity" subtitle="Pipeline and inspection events · Yerevan time">
        <ol className="space-y-2" aria-live="polite">
          {items.length === 0 && <li className="inner text-[14px] text-muted">Waiting for activity. Upload a flight or order an inspection to follow it here.</li>}
          {items.map((it, i) => (
            <li key={i} className="inner flex items-start gap-3 text-[14px]">
              <span className="shrink-0 pt-0.5 text-[12px] text-muted tabular">{yClock(it.at)}</span>
              {it.kind === "shot" && <span>New shot: {it.shot.label ?? it.shot.view}</span>}
              {it.kind === "status" && <span className="flex flex-wrap items-center gap-2"><Pill tone={it.status === "failed" ? "danger" : it.status === "done" ? "dark" : "grey"}>{it.status}</Pill>{it.message}</span>}
              {it.kind === "finding" && <span>Variance updated: <b>{it.daysBehind} days</b></span>}
              {it.kind === "order" && (
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <Pill tone={statusTone(it.status)}>{STATUS_LABEL[it.status]}</Pill>
                  <Link href={`/app/projects/${projectId}/orders/${it.orderId}`} className="font-medium tabular underline-offset-4 hover:underline">{it.number}</Link>
                  <span className="min-w-0">{it.message}</span>
                </span>
              )}
            </li>
          ))}
        </ol>
      </GlassCard>
    </div>
  );
}
