"use client";

import { useEffect, useRef, useState } from "react";
import type { OrderDto } from "@/lib/domain/orderTypes";
import { isTerminal, orderRank, STATUS_LABEL } from "./orderFormat";

const POLL_MS = 15_000;

/**
 * A ticking clock for countdowns. Starts at the server's render time so the
 * first client render matches the HTML, then follows the real clock.
 */
export function useNow(initial: number, stepMs = 1000): number {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), stepMs);
    return () => clearInterval(t);
  }, [stepMs]);
  return now;
}

const fresher = (prev: OrderDto, next: OrderDto) => (orderRank(next) >= orderRank(prev) ? next : prev);

/**
 * One order, kept current by the project's SSE stream (`event: order`) with a
 * 15 s poll of GET /api/orders/:id as the fallback (and the poll also advances
 * the dispatch simulator on the server). `announcement` changes only when the
 * status does, for a polite live region.
 */
export function useLiveOrder(initial: OrderDto) {
  const [order, setOrder] = useState(initial);
  const [link, setLink] = useState<"connecting" | "live" | "polling">("connecting");
  const [announcement, setAnnouncement] = useState("");
  const lastStatus = useRef(initial.status);

  // A server refresh hands us a new `initial`: take it if it is newer.
  useEffect(() => setOrder((p) => (p.id === initial.id ? fresher(p, initial) : initial)), [initial]);

  const done = isTerminal(order.status);
  useEffect(() => {
    if (done) return; // a delivered or cancelled order never changes again
    if (typeof EventSource === "undefined") {
      setLink("polling");
      return;
    }
    const es = new EventSource(`/api/projects/${initial.projectId}/live`);
    es.addEventListener("ping", () => setLink("live"));
    es.addEventListener("order", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data) as OrderDto;
        if (d.id === initial.id) setOrder((p) => fresher(p, d));
      } catch {}
    });
    es.onerror = () => setLink("polling");
    return () => es.close();
  }, [initial.id, initial.projectId, done]);

  useEffect(() => {
    if (done) return;
    let stopped = false;
    const refetch = async () => {
      try {
        const res = await fetch(`/api/orders/${initial.id}`, { cache: "no-store" });
        if (!res.ok || stopped) return;
        const d = (await res.json()) as OrderDto;
        setOrder((p) => fresher(p, d));
      } catch {}
    };
    const t = setInterval(refetch, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && refetch();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [initial.id, done]);

  useEffect(() => {
    if (order.status === lastStatus.current) return;
    lastStatus.current = order.status;
    const last = order.events[order.events.length - 1];
    setAnnouncement(`${order.number}: ${STATUS_LABEL[order.status]}. ${last?.message ?? ""}`);
  }, [order]);

  return { order, setOrder, link, announcement };
}
