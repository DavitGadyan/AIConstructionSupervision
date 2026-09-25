/**
 * Dispatch simulator ticker: every 2 s (and exactly when the next step is
 * due) it advances every active order and starts deliveries that are due.
 *
 * One ticker per process, whatever the number of bundles that import this
 * module (Next compiles instrumentation and each route separately) and
 * across hot reloads: the interval lives on globalThis and always calls the
 * most recently loaded implementation. A busy flag stops ticks overlapping,
 * and an in-flight set stops the same order being delivered twice here
 * (the DB lease in deliverOrder covers other processes).
 *
 * DISPATCH_SIMULATOR=off disables it; unset, it runs everywhere except in
 * production (NODE_ENV=production), where it needs DISPATCH_SIMULATOR=on and
 * then logs a warning at startup. Not started during `next build`.
 */
import { isTransientDbError } from "./db";
import { activeOrderRows, advanceRow, deliverOrder, releaseStaleLeases, simulatorOn } from "./orders";

export const TICK_MS = 2_000;

interface TickerState {
  interval: ReturnType<typeof setInterval>;
  wake: ReturnType<typeof setTimeout> | null;
  busy: boolean;
  inflight: Set<string>;
  bootedAt: Date;
  /** Leases taken before bootedAt were cleared (retried each tick until it succeeds). */
  leasesReleased?: boolean;
  ticks: number;
  impl: () => Promise<void>;
}

const g = globalThis as unknown as { __cioTicker?: TickerState };

const isBuild = () => process.env.NEXT_PHASE === "phase-production-build";

async function tick(): Promise<void> {
  const st = g.__cioTicker;
  if (!st || st.busy) return;
  st.busy = true;
  st.ticks++;
  let nextWake = Number.POSITIVE_INFINITY;
  try {
    if (!st.leasesReleased) {
      await releaseStaleLeases(st.bootedAt);
      st.leasesReleased = true;
    }
    const rows = await activeOrderRows();
    for (const row of rows) {
      try {
        const { row: fresh, result } = await advanceRow(row);
        if (!result) continue;
        if (result.deliveryReady) {
          if (!st.inflight.has(fresh.id)) {
            st.inflight.add(fresh.id);
            void deliverOrder(fresh.id)
              .catch((e) => console.error("[ticker] delivery crashed", e))
              .finally(() => st.inflight.delete(fresh.id));
          }
          continue;
        }
        const due = result.nextDueAt ?? result.deliveryDue;
        if (due) nextWake = Math.min(nextWake, due.getTime());
      } catch (e) {
        if (isTransientDbError(e)) console.warn(`[ticker] ${row.number}: database busy (${e.code}), retrying next tick`);
        else console.error(`[ticker] could not advance ${row.number}`, e);
      }
    }
  } catch (e) {
    if (isTransientDbError(e)) console.warn(`[ticker] database busy (${e.code}), retrying next tick`);
    else console.error("[ticker] tick failed", e);
  } finally {
    st.busy = false;
  }
  // Wake exactly when the next step is due if that is sooner than the next regular tick,
  // so each status change is applied (and pushed) on its own.
  const wait = nextWake - Date.now();
  if (Number.isFinite(wait) && wait < TICK_MS) {
    if (st.wake) clearTimeout(st.wake);
    st.wake = setTimeout(() => {
      st.wake = null;
      void st.impl();
    }, Math.max(0, wait) + 25);
    st.wake.unref?.();
  }
}

/** Starts the ticker once per process (no-op when disabled, during a build, or already running). */
export function ensureTicker(): boolean {
  if (!simulatorOn() || isBuild()) return false;
  const existing = g.__cioTicker;
  if (existing) {
    existing.impl = tick; // hot reload: run the newest code
    return true;
  }
  if (process.env.NODE_ENV === "production") {
    // Only reachable with DISPATCH_SIMULATOR=on set explicitly (production defaults to off).
    console.warn(
      [
        "",
        "!!! [ticker] DISPATCH_SIMULATOR=on in PRODUCTION !!!",
        "!!! Inspection orders are fulfilled by the demo simulator: it invents crews and flights and",
        "!!! delivers 'independent' PDF reports built from earlier imagery. Use this for demo installs only;",
        "!!! unset DISPATCH_SIMULATOR (or set it to off) where real customers order inspections.",
        "",
      ].join("\n"),
    );
  }
  const st: TickerState = {
    interval: setInterval(() => void g.__cioTicker?.impl(), TICK_MS),
    wake: null,
    busy: false,
    inflight: new Set(),
    bootedAt: new Date(),
    ticks: 0,
    impl: tick,
  };
  st.interval.unref?.();
  g.__cioTicker = st;
  void st.impl(); // catch up right away after a restart
  return true;
}

/** Stops the ticker (tests / scripts). */
export function stopTicker() {
  const st = g.__cioTicker;
  if (!st) return;
  clearInterval(st.interval);
  if (st.wake) clearTimeout(st.wake);
  delete g.__cioTicker;
}

export function tickerStatus() {
  const st = g.__cioTicker;
  return st ? { running: true, bootedAt: st.bootedAt.toISOString(), ticks: st.ticks, inflight: [...st.inflight] } : { running: false };
}
