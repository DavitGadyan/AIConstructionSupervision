import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import { fetch as streamingFetch } from "expo/fetch";
import {
  api,
  isActiveStatus,
  isApiError,
  liveUrl,
  statusIndex,
  type Flight,
  type Order,
  type OrderEventStatus,
  type ProjectProfile,
  type Shot,
} from "./api";
import { animateLayout } from "./hooks";
import { activeOrderOf, nextMilestone, sortOrders } from "./orders";
import {
  clearOrderNotifications,
  notifyOrderEvent,
  seedOrderEvents,
  setupNotifications,
  syncOrderReminders,
  takeNewEvents,
} from "./notify";
import { useSessionMaybe } from "./session";

/**
 * Live project feed: flights, inspection orders and the project profile.
 *
 * Two transports, both always wired:
 *  1. SSE over a streaming fetch (`expo/fetch` exposes a ReadableStream body on
 *     iOS, Android and web). Parsed by a tiny reader below. Events: shot,
 *     status, finding, order.
 *  2. Polling - every 10 s while SSE is down, every 30 s as a reconcile while
 *     it is up. Each tick GETs the flights and the active order (or the order
 *     list when nothing is running). This is the reliable path.
 *
 * Orders are cached by id (`ordersById`) across projects; `orders` and
 * `activeOrder` are the current project's view of that cache. Screens should
 * read the running order from here rather than from profile.activeOrder,
 * which is only as fresh as the last profile fetch.
 */

export type LiveMode = "connecting" | "streaming" | "polling" | "paused" | "stopped";

/** The newest order status change, for the in-app toast (OrderToast). */
export interface OrderNotice {
  /** unique per order + status: use as a React key */
  key: string;
  orderId: string;
  projectId: string;
  number: string;
  projectName: string;
  status: OrderEventStatus;
  message: string;
  at: string;
}

interface LiveApi {
  flights: Flight[] | undefined;
  error: string | null;
  loading: boolean;
  mode: LiveMode;
  lastMessage: string | null;
  /** shot ids that arrived since the screen opened - drives the "new" highlight */
  freshShotIds: Set<string>;
  /** bumps when a finding / status / delivered order arrives so dashboards can refetch */
  version: number;
  refresh: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;

  // ---- orders (v1.1)
  /** Every order this session has seen, by id (any project). */
  ordersById: Record<string, Order>;
  /** Current project's orders, newest first; undefined until the first load. */
  orders: Order[] | undefined;
  /** Current project's running order (not delivered / cancelled), if any. */
  activeOrder: Order | null;
  ordersLoading: boolean;
  ordersError: string | null;
  /** Refetch the current project's order list. */
  refreshOrders: () => Promise<void>;
  /** GET /api/orders/:id into the cache (also for orders on other projects). */
  fetchOrder: (id: string) => Promise<Order>;
  /** Put an order you just created / cancelled into the cache (no toast for it). */
  upsertOrder: (o: Order) => void;
  orderNotice: OrderNotice | null;
  dismissOrderNotice: () => void;

  // ---- project profile (v1.1)
  profile: ProjectProfile | undefined;
  profileError: string | null;
  profileLoading: boolean;
  refreshProfile: () => Promise<void>;
}

const LiveContext = createContext<LiveApi | null>(null);

type SseEvent = { event: string; data: string };

/** Minimal text/event-stream parser: feeds chunks, emits complete events. */
function createSseParser(onEvent: (e: SseEvent) => void) {
  let buffer = "";
  return (chunk: string) => {
    buffer += chunk.replace(/\r\n/g, "\n");
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      let event = "message";
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (!line || line.startsWith(":")) continue;
        const colon = line.indexOf(":");
        const field = colon < 0 ? line : line.slice(0, colon);
        const value = colon < 0 ? "" : line.slice(colon + 1).replace(/^ /, "");
        if (field === "event") event = value;
        else if (field === "data") data.push(value);
      }
      if (data.length || event !== "message") onEvent({ event, data: data.join("\n") });
    }
  };
}

function mergeShot(flights: Flight[], flightId: string, shot: Shot): Flight[] | null {
  const i = flights.findIndex((f) => f.id === flightId);
  if (i < 0) return null; // unknown flight: caller refetches
  const f = flights[i]!;
  if (f.shots.some((s) => s.id === shot.id)) return flights;
  const next = flights.slice();
  next[i] = { ...f, shots: [...f.shots, shot] };
  return next;
}

/**
 * How an order reached us:
 *  seed  - initial list / profile / own create or cancel: never notifies
 *  get   - explicit GET: notifies new events of orders already known
 *  poll  - list refresh: also announces orders we had never seen
 *  sse   - pushed: same as poll (the server computes canCancel for each subscriber)
 */
type OrderSource = "seed" | "get" | "poll" | "sse";

function looksValidOrder(o: unknown): o is Order {
  return !!o && typeof o === "object" && typeof (o as Order).id === "string" && typeof (o as Order).status === "string";
}

/** True when `next` is older than what we hold (a slow poll racing a pushed update). */
function isStale(prev: Order | undefined, next: Order) {
  if (!prev) return false;
  if ((next.events?.length ?? 0) < (prev.events?.length ?? 0)) return true;
  if (prev.status === "cancelled" || prev.status === "delivered") return next.status !== prev.status && isActiveStatus(next.status);
  return next.status !== "cancelled" && statusIndex(next.status) < statusIndex(prev.status);
}

export function LiveProvider({
  token,
  projectId,
  children,
}: {
  token: string | null;
  projectId: string | null;
  children: ReactNode;
}) {
  const session = useSessionMaybe();
  const expireRef = useRef(session?.expireSession);
  expireRef.current = session?.expireSession;
  /** Error text for state; a 401 means the token is dead, so end the session (auth gate -> login). */
  const failure = useCallback((e: unknown) => {
    if (isApiError(e, 401)) expireRef.current?.();
    return e instanceof Error ? e.message : String(e);
  }, []);

  const [flights, setFlights] = useState<Flight[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<LiveMode>("connecting");
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [freshShotIds, setFresh] = useState<Set<string>>(() => new Set());
  const [version, setVersion] = useState(0);
  const [active, setActive] = useState(true); // user pause/stop
  const [foreground, setForeground] = useState(true);
  const knownShots = useRef<Set<string> | null>(null);
  const streaming = useRef(false);
  const flightsRef = useRef<Flight[] | undefined>(undefined);
  flightsRef.current = flights;
  const flightsJson = useRef<string>("");

  const [ordersById, setOrdersById] = useState<Record<string, Order>>({});
  const ordersRef = useRef<Record<string, Order>>({});
  const [ordersLoadedFor, setOrdersLoadedFor] = useState<string | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [orderNotice, setOrderNotice] = useState<OrderNotice | null>(null);

  const [profile, setProfile] = useState<ProjectProfile | undefined>(undefined);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const profileJson = useRef<string>("");
  const profileInFlight = useRef(0);
  const profileRef = useRef<ProjectProfile | undefined>(undefined);
  profileRef.current = profile;

  const projectRef = useRef(projectId);
  projectRef.current = projectId;

  useEffect(() => {
    setupNotifications();
  }, []);

  // signed out: drop cached orders and scheduled reminders
  useEffect(() => {
    if (token) return;
    ordersRef.current = {};
    setOrdersById({});
    setOrdersLoadedFor(null);
    setOrderNotice(null);
    setProfile(undefined);
    clearOrderNotifications();
  }, [token]);

  const fetchFlights = useCallback(async () => {
    if (!token || !projectId) return;
    try {
      const list = await api.flights(token, projectId);
      const sorted = [...list].sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1));
      // highlight shots we have not seen before (not on the very first load)
      const ids = new Set(sorted.flatMap((f) => f.shots.map((s) => s.id)));
      if (knownShots.current) {
        const fresh = [...ids].filter((id) => !knownShots.current!.has(id));
        if (fresh.length) {
          animateLayout();
          setFresh((prev) => new Set([...prev, ...fresh]));
        }
      }
      knownShots.current = ids;
      // identical poll: keep the same array so screens (and their images) don't re-render
      const json = JSON.stringify(sorted);
      if (json !== flightsJson.current) {
        flightsJson.current = json;
        setFlights(sorted);
      }
      setError(null);
    } catch (e) {
      setError(failure(e));
    } finally {
      setLoading(false);
    }
  }, [token, projectId, failure]);

  const fetchProfile = useCallback(async () => {
    if (!token || !projectId) return;
    setProfileLoading(true);
    profileInFlight.current += 1;
    try {
      const p = await api.projectProfile(token, projectId);
      if (projectRef.current !== projectId) return;
      const json = JSON.stringify(p);
      if (json !== profileJson.current) {
        profileJson.current = json;
        setProfile(p);
      }
      setProfileError(null);
      if (p.activeOrder && looksValidOrder(p.activeOrder)) ingestRef.current(p.activeOrder, "seed");
    } catch (e) {
      if (projectRef.current !== projectId) return;
      setProfileError(failure(e));
    } finally {
      profileInFlight.current -= 1;
      setProfileLoading(false);
    }
  }, [token, projectId, failure]);

  // ---------------------------------------------------------------- orders

  /** Merge one order into the cache; notify/toast new events; keep reminders in step. */
  const ingest = useCallback(
    (incoming: Order, source: OrderSource) => {
      let order = incoming;
      const prev = ordersRef.current[order.id];
      if (isStale(prev, order)) return;

      if (!prev || JSON.stringify(prev) !== JSON.stringify(order)) {
        const next = { ...ordersRef.current, [order.id]: order };
        ordersRef.current = next;
        if (prev && prev.status !== order.status) animateLayout();
        setOrdersById(next);
      }

      if (source === "seed") {
        seedOrderEvents(order);
      } else {
        const fresh = takeNewEvents(order, source === "sse" || source === "poll");
        for (const ev of fresh) notifyOrderEvent(order, ev);
        const last = fresh[fresh.length - 1];
        if (last) {
          setOrderNotice({
            key: `${order.id}:${last.status}`,
            orderId: order.id,
            projectId: order.projectId,
            number: order.number,
            projectName: order.projectName,
            status: last.status,
            message: last.message,
            at: last.at,
          });
          setLastMessage(last.message);
        }
      }
      syncOrderReminders(order);

      if (prev && prev.status !== order.status && (order.status === "delivered" || order.status === "cancelled")) {
        // a delivered order brings a new flight + report: dashboards refetch
        setVersion((v) => v + 1);
        if (order.status === "delivered" && order.projectId === projectRef.current) fetchFlightsRef.current();
      }
    },
    [token],
  );
  const ingestRef = useRef(ingest);
  ingestRef.current = ingest;
  const fetchFlightsRef = useRef(fetchFlights);
  fetchFlightsRef.current = fetchFlights;

  const fetchOrders = useCallback(
    async (initial = false) => {
      if (!token || !projectId) return;
      if (initial) setOrdersLoading(true);
      try {
        const list = await api.orders(token, projectId);
        if (projectRef.current !== projectId) return;
        for (const o of list) if (looksValidOrder(o)) ingestRef.current(o, initial ? "seed" : "poll");
        setOrdersLoadedFor(projectId);
        setOrdersError(null);
      } catch (e) {
        if (projectRef.current !== projectId) return;
        setOrdersError(failure(e));
      } finally {
        if (initial) setOrdersLoading(false);
      }
    },
    [token, projectId, failure],
  );

  const fetchOrder = useCallback(
    async (id: string) => {
      if (!token) throw new Error("Not signed in");
      let o: Order;
      try {
        o = await api.order(token, id);
      } catch (e) {
        failure(e);
        // gone or no longer visible (unshared, reseeded): stop tracking it
        if (isApiError(e, 404) && ordersRef.current[id]) {
          const { [id]: _gone, ...rest } = ordersRef.current;
          ordersRef.current = rest;
          setOrdersById(rest);
        }
        throw e;
      }
      ingestRef.current(o, ordersRef.current[id] ? "get" : "seed");
      return ordersRef.current[id] ?? o;
    },
    [token, failure],
  );

  const upsertOrder = useCallback((o: Order) => {
    if (looksValidOrder(o)) ingestRef.current(o, "seed");
  }, []);

  const orders = useMemo(() => {
    if (!projectId || ordersLoadedFor !== projectId) {
      // before the list lands, still surface what we know (e.g. profile.activeOrder)
      const known = Object.values(ordersById).filter((o) => o.projectId === projectId);
      return known.length ? sortOrders(known) : undefined;
    }
    return sortOrders(Object.values(ordersById).filter((o) => o.projectId === projectId));
  }, [ordersById, projectId, ordersLoadedFor]);

  const activeOrder = useMemo(() => activeOrderOf(orders), [orders]);
  const activeRef = useRef<Order | null>(activeOrder);
  activeRef.current = activeOrder;

  /** One poll step for orders: the running order if any, else the list. */
  const pollOrders = useCallback(async () => {
    const a = activeRef.current;
    try {
      if (a) {
        await fetchOrder(a.id);
      } else {
        await fetchOrders(false);
      }
    } catch {
      // keep the cached order; the next tick retries
    }
  }, [fetchOrder, fetchOrders]);

  // reset when project changes
  useEffect(() => {
    flightsJson.current = "";
    setFlights(undefined);
    setFresh(new Set());
    knownShots.current = null;
    setLoading(!!(token && projectId));
    profileJson.current = "";
    setProfile(undefined);
    setProfileError(null);
    setOrdersError(null);
    setOrderNotice((n) => (n && n.projectId === projectId ? n : null));
    fetchFlights();
    fetchOrders(true);
    fetchProfile();
  }, [fetchFlights, fetchOrders, fetchProfile, token, projectId]);

  // profile follows new flights / delivered orders / a new or finished active order
  // (skipped when the project itself changed: the reset effect above already fetched it)
  const activeId = activeOrder?.id ?? null;
  const profileFor = useRef<string | null | undefined>(undefined);
  const profileVersion = useRef(version);
  useEffect(() => {
    const versionChanged = profileVersion.current !== version;
    profileVersion.current = version;
    if (profileFor.current !== projectId) {
      profileFor.current = projectId;
      return;
    }
    // an active order that just appeared/finished: only refetch if the profile disagrees
    // (a profile still loading will come back with the fresh activeOrder anyway)
    const p = profileRef.current;
    if (!versionChanged && (profileInFlight.current > 0 || (p && (p.activeOrder?.id ?? null) === activeId))) return;
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, activeId, projectId]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => setForeground(s === "active"));
    return () => sub.remove();
  }, []);

  const running = active && foreground && !!token && !!projectId;

  // coming back from the background: catch up at once instead of waiting a tick
  // (only on a real background -> foreground switch, not on sign-in / project change)
  const wasForeground = useRef(foreground);
  useEffect(() => {
    const resumed = foreground && !wasForeground.current;
    wasForeground.current = foreground;
    if (resumed && running) {
      fetchFlights();
      pollOrders();
    }
  }, [foreground, running, fetchFlights, pollOrders]);

  // SSE over streaming fetch
  useEffect(() => {
    if (!running || !token || !projectId) return;
    const controller = new AbortController();
    let retry: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const handle = (e: SseEvent) => {
      if (e.event === "ping") return;
      let payload: any;
      try {
        payload = JSON.parse(e.data);
      } catch {
        return;
      }
      if (e.event === "shot" && payload?.shot) {
        const shot: Shot = payload.shot;
        knownShots.current?.add(shot.id);
        setFresh((prev) => new Set([...prev, shot.id]));
        setLastMessage(`New shot: ${shot.label ?? shot.view ?? "drone frame"}`);
        if (!flightsRef.current?.some((f) => f.id === payload.flightId)) {
          fetchFlights();
          return;
        }
        animateLayout();
        flightsJson.current = "";
        setFlights((prev) => (prev ? (mergeShot(prev, payload.flightId, shot) ?? prev) : prev));
      } else if (e.event === "status") {
        flightsJson.current = "";
        setFlights((prev) =>
          prev?.map((f) => (f.id === payload.flightId ? { ...f, status: payload.status } : f)),
        );
        if (payload.message) setLastMessage(payload.message);
        if (payload.status === "done") {
          setVersion((v) => v + 1);
          fetchFlights();
        }
      } else if (e.event === "finding") {
        flightsJson.current = "";
        setFlights((prev) =>
          prev?.map((f) => (f.id === payload.flightId ? { ...f, daysBehind: payload.daysBehind } : f)),
        );
        setLastMessage(`Assessment updated: ${payload.daysBehind} days behind`);
        setVersion((v) => v + 1);
      } else if (e.event === "order" && looksValidOrder(payload)) {
        ingestRef.current(payload, "sse");
      }
    };

    const connect = async () => {
      setMode((m) => (m === "streaming" ? m : "connecting"));
      try {
        const res = await streamingFetch(liveUrl(projectId, token), {
          headers: { Accept: "text/event-stream", Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const body = res.body;
        if (!res.ok || !body || typeof body.getReader !== "function") throw new Error("no stream");
        streaming.current = true;
        setMode("streaming");
        const reader = body.getReader();
        const decoder = new TextDecoder();
        const feed = createSseParser(handle);
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          feed(decoder.decode(value, { stream: true }));
        }
        throw new Error("stream closed");
      } catch {
        streaming.current = false;
        if (cancelled) return;
        setMode("polling");
        retry = setTimeout(connect, 15000);
      }
    };
    connect();

    return () => {
      cancelled = true;
      streaming.current = false;
      controller.abort();
      if (retry) clearTimeout(retry);
    };
  }, [running, token, projectId, fetchFlights, fetchOrder]);

  // Polling fallback / reconcile
  useEffect(() => {
    if (!running) return;
    let t: ReturnType<typeof setTimeout>;
    const tick = async () => {
      await Promise.all([fetchFlights(), pollOrders()]);
      t = setTimeout(tick, streaming.current ? 30000 : 10000);
    };
    t = setTimeout(tick, 10000);
    return () => clearTimeout(t);
  }, [running, fetchFlights, pollOrders]);

  // When the running order's next milestone comes due, check it right away
  // (the demo time scale moves faster than the 10 s poll).
  const milestoneAt = activeOrder ? (nextMilestone(activeOrder, Date.now())?.at ?? null) : null;
  useEffect(() => {
    if (!running || !activeId || milestoneAt === null) return;
    const wait = Math.min(10 * 60_000, Math.max(2_000, milestoneAt - Date.now() + 1_500));
    const t = setTimeout(() => {
      fetchOrder(activeId).catch(() => {});
    }, wait);
    return () => clearTimeout(t);
  }, [running, activeId, milestoneAt, fetchOrder]);

  const pause = useCallback(() => {
    setActive(false);
    setMode("paused");
  }, []);
  const resume = useCallback(() => {
    setActive(true);
    setMode("connecting");
    fetchFlights();
  }, [fetchFlights]);
  const stop = useCallback(() => {
    setActive(false);
    setMode("stopped");
    setFresh(new Set());
    setLastMessage(null);
  }, []);
  const refresh = useCallback(async () => {
    await Promise.all([fetchFlights(), pollOrders()]);
  }, [fetchFlights, pollOrders]);
  const refreshOrders = useCallback(() => fetchOrders(false), [fetchOrders]);
  const dismissOrderNotice = useCallback(() => setOrderNotice(null), []);

  const value = useMemo<LiveApi>(
    () => ({
      flights,
      error,
      loading,
      mode,
      lastMessage,
      freshShotIds,
      version,
      refresh,
      pause,
      resume,
      stop,
      ordersById,
      orders,
      activeOrder,
      ordersLoading,
      ordersError,
      refreshOrders,
      fetchOrder,
      upsertOrder,
      orderNotice,
      dismissOrderNotice,
      profile,
      profileError,
      profileLoading,
      refreshProfile: fetchProfile,
    }),
    [
      flights,
      error,
      loading,
      mode,
      lastMessage,
      freshShotIds,
      version,
      refresh,
      pause,
      resume,
      stop,
      ordersById,
      orders,
      activeOrder,
      ordersLoading,
      ordersError,
      refreshOrders,
      fetchOrder,
      upsertOrder,
      orderNotice,
      dismissOrderNotice,
      profile,
      profileError,
      profileLoading,
      fetchProfile,
    ],
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive() {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error("useLive outside LiveProvider");
  return ctx;
}

/**
 * One order from the live cache, fetched on first use and kept fresh by the
 * provider (SSE / polling for the active order). For /order/[id].
 */
export function useOrder(id: string | null | undefined) {
  const live = useLive();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const order = id ? live.ordersById[id] : undefined;
  const { fetchOrder } = live;

  const reload = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      await fetchOrder(id);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [id, fetchOrder]);

  // always fetch once on open (canCancel is per caller and may be stale in the cache)
  useEffect(() => {
    reload();
  }, [reload]);

  // an order on another project is not polled by the provider: poll it here while it runs
  const running = !!order && isActiveStatus(order.status);
  const isCurrentActive = !!order && live.activeOrder?.id === order.id;
  useEffect(() => {
    if (!id || !running || isCurrentActive) return;
    const t = setInterval(() => {
      fetchOrder(id).catch(() => {});
    }, 10_000);
    return () => clearInterval(t);
  }, [id, running, isCurrentActive, fetchOrder]);

  return { order, error, loading: loading && !order, refreshing: loading && !!order, reload };
}
