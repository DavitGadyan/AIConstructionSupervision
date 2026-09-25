"use client";

/**
 * Home-page "defect explorer": the drone-reconstructed tower with every delay,
 * defect and safety issue pinned on it. ORDI anatomy - a stage section with
 * eyebrow + split display heading, one big glass card holding the canvas
 * (left) and a white inner-card detail panel (right).
 *
 * The WebGL canvas is created only once the section is within 200px of the
 * viewport (and never on the server). Without WebGL the poster render carries
 * static pins and the same panel, so the section still works.
 */
import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FLIGHTS, ISSUES_BY_FLIGHT, type FlightKey, type IssueKind } from "@/lib/content/demoDefects";
import { cx, Pill } from "@/components/ui/primitives";
import { TypeText } from "@/components/motion/TypeText";
import { typeSequence } from "@/components/motion/typeTokens";
import type { TowerMarker, TowerModelHandle } from "@/components/three/TowerModel";
import { KindIcon, MarkerButton } from "@/components/three/markers";
import { localizeIssue } from "@/lib/content/demoDefects.i18n";
import { fmt, plural, type Locale } from "@/lib/i18n/config";
import { IssueDetail, IssueList, markerLabel, type ExplorerText } from "./explorer/IssuePanel";

const TowerModel = dynamic(() => import("@/components/three/TowerModel"), { ssr: false, loading: () => null });

const FLOORS_TOTAL = 16;
const FLOOR_H = 3.2;
const PLANNED: Record<FlightKey, number> = { m4: 4, m6: 9, m8: 15 };
const KINDS: IssueKind[] = ["delay", "defect", "safety"];

export function scheduleLabel(daysBehind: number, t: ExplorerText, locale: Locale) {
  if (daysBehind === 0) return t.onPlan;
  const n = Math.abs(daysBehind);
  return fmt(plural(locale, n, daysBehind < 0 ? t.daysAhead : t.daysBehind), { n });
}

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setR(m.matches);
    const on = () => setR(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return r;
}

/**
 * Approximate projection of GLB coordinates onto tower-m8-poster.webp (camera
 * at +x/+z, measured off the render). Good to a storey or so - it only
 * serves the no-WebGL fallback.
 */
function posterPoint([x, y, z]: [number, number, number]) {
  const left = 59 + 2.125 * (x - 12) - 2.02 * (z - 8.4);
  const top = 96 + 0.67 * (x - 12) - 0.65 * (8.4 - z) - 1.67 * y;
  return { left: Math.min(94, Math.max(6, left)), top: Math.min(95, Math.max(5, top)) };
}

export function DefectExplorer({ locale = "en", t }: { locale?: Locale; t: ExplorerText }) {
  const FULL_DATE = t.flightFull;
  const reduced = useReducedMotion();
  const [flight, setFlight] = useState<FlightKey>("m8");
  const [kinds, setKinds] = useState<Set<IssueKind>>(() => new Set(["delay", "defect", "safety"]));
  const [ghost, setGhost] = useState(false);
  const [slice, setSlice] = useState(FLOORS_TOTAL);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [interacted, setInteracted] = useState(false);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [near, setNear] = useState(false);
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [announce, setAnnounce] = useState("");

  const sectionRef = useRef<HTMLElement>(null);
  const modelRef = useRef<TowerModelHandle>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const autoDone = useRef(false);
  const focusDetail = useRef(false);

  const flightMeta = FLIGHTS.find((f) => f.key === flight)!;
  const all = useMemo(() => ISSUES_BY_FLIGHT[flight].map((i) => localizeIssue(i, locale)), [flight, locale]);
  const counts = useMemo(() => {
    const c: Record<IssueKind, number> = { delay: 0, defect: 0, safety: 0 };
    for (const i of all) c[i.kind]++;
    return c;
  }, [all]);
  const visible = useMemo(
    () => all.filter((i) => kinds.has(i.kind) && (i.floor == null || slice >= FLOORS_TOTAL || i.floor <= slice)),
    [all, kinds, slice],
  );
  const selected = visible.find((i) => i.id === selectedId) ?? null;
  const selIndex = selected ? visible.indexOf(selected) : -1;

  const markers = useMemo<TowerMarker[]>(
    () => visible.map((i) => ({ id: i.id, position: i.position, camera: i.camera, severity: i.severity, kind: i.kind, label: markerLabel(i, t, locale) })),
    [visible, t, locale],
  );

  // A filtered-out selection is cleared rather than left dangling.
  useEffect(() => {
    if (selectedId && !selected) setSelectedId(null);
  }, [selectedId, selected]);

  useEffect(() => setWebgl(hasWebGL()), []);

  // Lazy mount: the canvas exists only once we are within 200px.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const mount = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "200px 0px" });
    const seen = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.45 });
    mount.observe(el);
    seen.observe(el);
    return () => {
      mount.disconnect();
      seen.disconnect();
    };
  }, []);

  const select = useCallback(
    (id: string | null, opts?: { focus?: boolean; auto?: boolean }) => {
      if (!opts?.auto) {
        setInteracted(true);
        autoDone.current = true;
      }
      setSelectedId(id);
      focusDetail.current = Boolean(opts?.focus && id);
      if (!id) modelRef.current?.resetView();
      const issue = id ? all.find((i) => i.id === id) : null;
      setAnnounce(issue ? fmt(t.selected, { label: markerLabel(issue, t, locale) }) : t.cleared);
    },
    [all, t, locale],
  );

  useEffect(() => {
    if (selected && focusDetail.current) {
      focusDetail.current = false;
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [selected]);

  // Optional demo nudge: after 2.5 s in view with no interaction, open the
  // first critical issue. Never with reduced motion, and only once.
  useEffect(() => {
    if (reduced || interacted || autoDone.current || !loaded || !inView || selectedId) return;
    const t = setTimeout(() => {
      const first = visible.find((i) => i.severity === "critical");
      if (first && !autoDone.current) {
        autoDone.current = true;
        select(first.id, { auto: true });
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [reduced, interacted, loaded, inView, selectedId, visible, select]);

  // Warm the HTTP cache for the other flights once the first model is in.
  useEffect(() => {
    if (!loaded) return;
    for (const f of FLIGHTS) {
      if (document.querySelector(`link[data-glb="${f.key}"]`)) continue;
      const l = document.createElement("link");
      l.rel = "prefetch";
      l.as = "fetch";
      l.crossOrigin = "anonymous";
      l.href = f.model;
      l.dataset.glb = f.key;
      document.head.appendChild(l);
    }
  }, [loaded]);

  const onLoaded = useCallback(() => setLoaded(true), []);

  // Escape clears the selection. A native listener, because the 3D pins live
  // in drei <Html>'s own React root and their events skip React bubbling.
  const escRef = useRef<() => boolean>(() => false);
  escRef.current = () => {
    if (!selectedId) return false;
    const fromPanel = panelRef.current?.contains(document.activeElement);
    select(null);
    if (fromPanel) requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
    return true;
  };
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const on = (e: KeyboardEvent) => {
      if (e.key === "Escape" && escRef.current()) e.stopPropagation();
    };
    el.addEventListener("keydown", on);
    return () => el.removeEventListener("keydown", on);
  }, []);

  const step = (dir: 1 | -1) => {
    if (!visible.length) return;
    const next = visible[(selIndex + dir + visible.length) % visible.length];
    select(next.id, { focus: true });
  };

  const changeFlight = (k: FlightKey) => {
    if (k === flight) return;
    setInteracted(true);
    autoDone.current = true;
    setFlight(k);
    setSelectedId(null);
    setSlice(FLOORS_TOTAL);
    modelRef.current?.resetView();
    const f = FLIGHTS.find((x) => x.key === k)!;
    const n = ISSUES_BY_FLIGHT[k].length;
    setAnnounce(fmt(t.announceFlight, { flight: FULL_DATE[k], schedule: scheduleLabel(f.daysBehind, t, locale), issues: fmt(plural(locale, n, t.issues), { n }) }));
  };

  const toggleKind = (k: IssueKind) => {
    setInteracted(true);
    setKinds((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  };

  const titleTyping = useMemo(() => typeSequence([t.titleLine1, t.titleLine2]), [t.titleLine1, t.titleLine2]);
  const showCanvas = webgl === true && near;
  const hintVisible = showCanvas && loaded && !interacted && !selectedId;

  return (
    <section
      id="explorer"
      ref={sectionRef}
      aria-labelledby="explorer-title"
      className="scroll-mt-4 px-3 pt-3 md:px-6 md:pt-6"
    >
      <div className="stage @container mx-auto max-w-[1480px] px-4 pb-4 pt-10 md:px-8 md:pb-8 md:pt-14">
        <p aria-hidden className="display-xl pointer-events-none absolute -bottom-[3cqw] right-[-2cqw] z-0 select-none whitespace-nowrap text-[22cqw] text-white/35">
          3D
        </p>

        {/* Eyebrow + split display heading (ORDI "FOCUS / YOUR TIME") */}
        <div className="relative z-10 mb-8 md:mb-10">
          <p className="eyebrow mb-3">{t.eyebrow}</p>
          <h2
            id="explorer-title"
            aria-label={`${t.titleLine1} ${t.titleLine2}`}
            className="display-xl flex flex-col text-[clamp(52px,11cqw,150px)] md:flex-row md:items-end md:justify-between"
          >
            {/* Split headline: the pieces start together when the h2 is seen, piece 2 where piece 1 ends. */}
            <span>
              <TypeText a11y="hidden" trigger="h2" speed={titleTyping.step} delay={titleTyping.delays[0]} blink={false}>
                {t.titleLine1}
              </TypeText>
            </span>{" "}
            <span className="md:text-right">
              <TypeText a11y="hidden" trigger="h2" speed={titleTyping.step} delay={titleTyping.delays[1]}>
                {t.titleLine2}
              </TypeText>
            </span>
          </h2>
          <p className="mt-5 max-w-[56ch] text-[17px] text-muted">{t.intro}</p>
        </div>

        <div className="glass relative z-10 p-3 md:p-4">
          {/* Controls */}
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-3 md:mb-4">
            <div role="group" aria-label={t.flightGroup} className="grid w-full grid-cols-3 rounded-[var(--radius-btn)] bg-white/60 p-1 sm:flex sm:w-auto">
              {FLIGHTS.map((f) => {
                const on = f.key === flight;
                return (
                  <button
                    key={f.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => changeFlight(f.key)}
                    className={cx(
                      "flex min-w-0 flex-col items-start rounded-[11px] px-3 py-1.5 text-left transition sm:min-w-[86px]",
                      on ? "bg-ink text-white" : "text-ink hover:bg-white",
                    )}
                  >
                    <span className="text-[14px] font-semibold leading-tight">{t.flightShort[f.key]}</span>
                    <span className={cx("text-[11.5px] leading-tight", on ? "text-white/75" : "text-muted")}>{scheduleLabel(f.daysBehind, t, locale)}</span>
                  </button>
                );
              })}
            </div>

            {/* hy/ru labels are too long for three equal columns on a phone: let them wrap as pills instead. */}
            <div
              role="group"
              aria-label={t.filterGroup}
              className="grid w-full grid-cols-3 gap-1.5 max-sm:hy:flex max-sm:hy:flex-wrap max-sm:ru:flex max-sm:ru:flex-wrap sm:flex sm:w-auto sm:gap-2"
            >
              {KINDS.map((key) => {
                const on = kinds.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleKind(key)}
                    className={cx(
                      "inline-flex items-center justify-center gap-1.5 rounded-[12px] px-2 py-2 text-[13.5px] font-medium transition sm:gap-2 sm:px-3 sm:text-[14px]",
                      on ? "bg-surface text-ink shadow-[var(--shadow-inner)]" : "bg-white/35 text-muted line-through decoration-muted/60 hover:bg-white/60",
                    )}
                  >
                    <KindIcon kind={key} className="size-3.5 shrink-0" />
                    <span className="min-w-0 truncate">{t.kinds[key]}</span>
                    <span className={cx("tabular rounded-[6px] px-1.5 py-0.5 text-[12px] leading-none", on ? "bg-ink text-white" : "bg-white/60")}>{counts[key]}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5 max-sm:hy:flex max-sm:hy:flex-wrap max-sm:ru:flex max-sm:ru:flex-wrap sm:flex sm:w-auto sm:flex-wrap sm:gap-2 lg:ml-auto">
              <button
                type="button"
                aria-pressed={ghost}
                onClick={() => {
                  setInteracted(true);
                  setGhost((g) => !g);
                }}
                className={cx(
                  "inline-flex items-center gap-2 rounded-[12px] px-3 py-2 text-[14px] font-medium transition",
                  ghost ? "bg-accent text-white" : "bg-surface text-ink shadow-[var(--shadow-inner)]",
                )}
              >
                <span aria-hidden className={cx("size-3 rounded-[4px] border-2", ghost ? "border-white bg-white/40" : "border-accent")} />
                {t.showPlan}
              </button>
              <label className="inline-flex min-w-0 items-center gap-2 rounded-[12px] bg-surface px-3 py-2 text-[14px] shadow-[var(--shadow-inner)] max-sm:hy:order-last max-sm:hy:basis-full max-sm:ru:order-last max-sm:ru:basis-full">
                <span className="whitespace-nowrap font-medium">{t.storeys}</span>
                <input
                  type="range"
                  min={1}
                  max={FLOORS_TOTAL}
                  value={slice}
                  onChange={(e) => {
                    setInteracted(true);
                    setSlice(Number(e.target.value));
                  }}
                  aria-valuetext={slice >= FLOORS_TOTAL ? t.allStoreys : fmt(t.upToStorey, { n: slice })}
                  className="w-full min-w-0 accent-[var(--color-accent)] sm:w-24 md:w-28"
                />
                <span className="tabular min-w-[3ch] shrink-0 text-right text-muted" aria-hidden>
                  {slice >= FLOORS_TOTAL ? t.all : slice}
                </span>
              </label>
              <button
                type="button"
                onClick={() => select(null)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-[12px] bg-surface px-3 py-2 text-[14px] font-medium text-ink shadow-[var(--shadow-inner)] transition hover:-translate-y-0.5"
              >
                <svg viewBox="0 0 16 16" fill="none" className="size-3.5" aria-hidden>
                  <path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.5v2.8h2.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="sr-only sm:not-sr-only">{t.resetView}</span>
              </button>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)] lg:gap-4">
            {/* Canvas */}
            <div
              role="group"
              aria-label={fmt(t.canvasLabel, { flight: FULL_DATE[flight], n: visible.length })}
              className="relative h-[70vh] max-h-[560px] min-h-[380px] overflow-hidden rounded-[22px] bg-ground lg:h-[640px] lg:max-h-none"
            >
              {/* Poster: placeholder while loading, and the whole view without WebGL */}
              <div className={cx("absolute inset-0 transition-opacity duration-500", showCanvas && loaded ? "pointer-events-none opacity-0" : "opacity-100")}>
                <div className="relative mx-auto h-[92%] translate-y-[4%]" style={{ aspectRatio: "514 / 826" }}>
                  <Image src="/samples/tower-m8-poster.webp" alt="" fill sizes="(min-width:1024px) 420px, 60vw" className={cx("object-contain", webgl !== false && "opacity-70")} />
                  {webgl === false &&
                    visible.map((i) => {
                      const p = posterPoint(i.position);
                      return (
                        <MarkerButton
                          key={i.id}
                          id={i.id}
                          label={markerLabel(i, t, locale)}
                          severity={i.severity}
                          kind={i.kind}
                          selected={i.id === selectedId}
                          pulse={!reduced}
                          onSelect={(id) => select(id)}
                          className="absolute -translate-x-1/2 -translate-y-1/2"
                          style={{ left: `${p.left}%`, top: `${p.top}%` }}
                        />
                      );
                    })}
                </div>
              </div>

              {showCanvas && (
                <TowerModel
                  ref={modelRef}
                  src={flightMeta.model}
                  variant="explorer"
                  floorsTotal={FLOORS_TOTAL}
                  floorHeightM={FLOOR_H}
                  plannedFloors={ghost ? PLANNED[flight] : undefined}
                  sliceFloor={slice < FLOORS_TOTAL ? slice : null}
                  markers={markers}
                  selectedId={selected?.id ?? null}
                  onSelect={(id) => select(id)}
                  onInteract={() => {
                    setInteracted(true);
                    autoDone.current = true;
                  }}
                  onLoaded={onLoaded}
                  className={cx("absolute inset-0 transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0")}
                />
              )}

              <div className="pointer-events-none absolute left-3 top-3 z-40 flex flex-wrap gap-2">
                <Pill tone="dark">
                  {FULL_DATE[flight]} · {scheduleLabel(flightMeta.daysBehind, t, locale)}
                </Pill>
                {ghost && <Pill tone="accent">{fmt(plural(locale, PLANNED[flight], t.storeysPlanned), { n: PLANNED[flight] })}</Pill>}
                {webgl === false && <Pill tone="light">{t.staticView}</Pill>}
              </div>

              {showCanvas && !loaded && (
                <p className="absolute inset-x-0 bottom-4 z-40 text-center text-[13px] text-muted" role="status">
                  {t.loading}
                </p>
              )}

              <p
                aria-hidden
                className={cx(
                  "pointer-events-none absolute bottom-4 left-1/2 z-40 w-max max-w-[92%] -translate-x-1/2 rounded-full text-center sm:whitespace-nowrap bg-ink/80 px-4 py-2 text-[13px] text-white backdrop-blur transition-opacity duration-700",
                  hintVisible ? "opacity-100" : "opacity-0",
                )}
              >
                {t.hint}
              </p>
            </div>

            {/* Detail panel */}
            <div
              ref={panelRef}
              tabIndex={-1}
              className="inner min-w-0 p-4 outline-none md:p-5 lg:max-h-[640px] lg:overflow-y-auto"
            >
              {selected ? (
                <IssueDetail ref={headingRef} issue={selected} index={selIndex} total={visible.length} onBack={() => select(null)} onStep={step} t={t} locale={locale} />
              ) : (
                <IssueList issues={visible} flightLabel={fmt(t.flightLabel, { flight: FULL_DATE[flight] })} onSelect={(id) => select(id, { focus: true })} t={t} locale={locale} />
              )}
            </div>
          </div>
          <p className="sr-only" aria-live="polite">
            {announce}
          </p>
        </div>
      </div>
    </section>
  );
}

export default DefectExplorer;
