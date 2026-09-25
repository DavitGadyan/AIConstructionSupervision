import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, AppState, LayoutAnimation, Platform, UIManager } from "react-native";

export interface AsyncState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  reload: () => Promise<void>;
  refresh: () => Promise<void>;
  setData: (fn: (prev: T | undefined) => T | undefined) => void;
}

/**
 * Load-once-then-refresh data hook. `loading` is only true for the first load;
 * pull-to-refresh sets `refreshing` so the list stays on screen.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], enabled = true): AsyncState<T> {
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);

  const run = useCallback(async (mode: "load" | "refresh" | "silent") => {
    const id = ++seq.current;
    if (mode === "load") setLoading(true);
    if (mode === "refresh") setRefreshing(true);
    try {
      const result = await fnRef.current();
      if (id !== seq.current) return;
      setDataState(result);
      setError(null);
    } catch (e) {
      if (id !== seq.current) return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (id === seq.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    run("load");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return {
    data,
    error,
    loading,
    refreshing,
    reload: useCallback(() => run("load"), [run]),
    refresh: useCallback(() => run("refresh"), [run]),
    setData: useCallback((f) => setDataState((p) => f(p)), []),
  };
}

let reduceMotionCache = false;

export function useReduceMotion() {
  const [reduce, setReduce] = useState(reduceMotionCache);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        reduceMotionCache = v;
        if (alive) setReduce(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => {
      reduceMotionCache = v;
      setReduce(v);
    });
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
  return reduce;
}

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  try {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  } catch {
    // New Architecture: already enabled
  }
}

/** Last known Reduce Motion setting, for non-hook code (kept fresh by useReduceMotion). */
export function prefersReducedMotion() {
  return reduceMotionCache;
}

/** LayoutAnimation that respects Reduce Motion. */
export function animateLayout() {
  if (reduceMotionCache || Platform.OS === "web") return;
  LayoutAnimation.configureNext(LayoutAnimation.create(260, "easeInEaseOut", "opacity"));
}

/** True while the app is in the foreground (AppState "active"). */
export function useAppActive() {
  const [active, setActive] = useState(AppState.currentState !== "background");
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => setActive(s === "active"));
    return () => sub.remove();
  }, []);
  return active;
}

/**
 * Current time in ms, re-rendering every `intervalMs` (ticks land on whole
 * interval boundaries so several countdowns on screen change together).
 * Stops while the app is backgrounded and catches up on return. Pass
 * `enabled = false` to freeze it (e.g. once an order is delivered).
 */
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  const active = useAppActive();
  useEffect(() => {
    if (!enabled || !active) return;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      const n = Date.now();
      setNow(n);
      t = setTimeout(tick, intervalMs - (n % intervalMs) + 5);
    };
    tick();
    return () => clearTimeout(t);
  }, [intervalMs, enabled, active]);
  return now;
}

/** Screen-reader announcement (VoiceOver / TalkBack; aria-live on web via the caller's live region). */
export function announce(message: string) {
  if (!message) return;
  try {
    AccessibilityInfo.announceForAccessibility(message);
  } catch {
    // web / unsupported: callers also render an accessibilityLiveRegion
  }
}

/** The previous render's value (undefined on first render). */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}
