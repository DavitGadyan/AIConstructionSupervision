"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui/primitives";
import { PHOTOREAL_M8 } from "@/lib/content/demoDefects";
import type { Dictionary } from "@/lib/i18n";

const FlightScene = dynamic(() => import("@/components/three/FlightScene").then((m) => m.FlightScene), { ssr: false });

type T = Dictionary["home"]["flightTo3d"];
const SHOTS = ["orbit-sw", "facade-s", "orbit-se", "orbit-ne", "nadir", "deck"] as const;

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Sticky 3D scene on one side, four steps on the other. The step nearest the middle of the viewport
 * drives the scene; clicking a step selects it too. Without WebGL the drone-scan photo stands in.
 */
export function FlightExplainer({ t }: { t: T }) {
  const [step, setStep] = useState(0);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [reduced, setReduced] = useState(false);
  const [inView, setInView] = useState(false);
  const [near, setNear] = useState(false); // mount the scene (and fetch the model) only once the reader gets close
  const stage = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    setWebgl(hasWebGL());
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setStep(Number((e.target as HTMLElement).dataset.step));
      },
      // phones: the sticky scene fills the top ~40 % of the screen, so the active step is the one just below it
      { rootMargin: window.matchMedia("(min-width: 1024px)").matches ? "-45% 0px -45% 0px" : "-62% 0px -28% 0px" },
    );
    items.current.forEach((el) => el && io.observe(el));
    const vis = new IntersectionObserver(([e]) => {
      setInView(e.isIntersecting);
      if (e.isIntersecting) setNear(true);
    }, { rootMargin: "150px 0px" });
    if (stage.current) vis.observe(stage.current);
    return () => {
      io.disconnect();
      vis.disconnect();
    };
  }, []);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:gap-10">
      <div ref={stage} className="sticky top-2 z-10 h-[38vh] min-h-[260px] overflow-hidden rounded-[22px] bg-ground lg:top-6 lg:h-[calc(100vh-48px)] lg:max-h-[760px]">
        {webgl && near ? (
          <FlightScene
            src={PHOTOREAL_M8}
            step={step}
            reduced={reduced}
            active={inView}
            label={t.canvasLabel}
            measureLabels={{ built: t.measureBuilt, planned: t.measurePlanned }}
          />
        ) : webgl === false ? (
          <Image src="/images/marketing/drone-scan.webp" alt={t.imageAlt} fill sizes="(min-width:1024px) 55vw, 100vw" className="object-cover" />
        ) : null}
        <p className="pointer-events-none absolute left-3 top-3 rounded-full bg-ink/80 px-3 py-1 text-[13px] font-medium text-white">
          {t.steps[step].title}
        </p>
      </div>

      <div>
        <figure className="overflow-hidden rounded-[22px] bg-surface shadow-[var(--shadow-inner)]">
          <Image
            src="/images/marketing/drone-scan.webp"
            alt={t.imageAlt}
            width={1536}
            height={1024}
            sizes="(min-width:1024px) 38vw, 100vw"
            className="aspect-[3/2] w-full object-cover"
          />
        </figure>
        <ol className="mt-2">
          {t.steps.map((s, i) => (
            <li
              key={s.title}
              ref={(el) => {
                items.current[i] = el;
              }}
              data-step={i}
              className="flex min-h-[46vh] items-center lg:min-h-[52vh]"
            >
              <button
                type="button"
                onClick={() => setStep(i)}
                aria-pressed={step === i}
                className={cx(
                  "w-full rounded-[18px] p-5 text-left transition md:p-6",
                  step === i ? "bg-surface shadow-[var(--shadow-inner)]" : "opacity-55 hover:opacity-80",
                )}
              >
                <span className="block font-display text-[22px] font-bold leading-tight md:text-[26px]">{s.title}</span>
                <span className="mt-2 block max-w-[46ch] text-[16px] leading-relaxed text-ink/80">{s.text}</span>
                {i === 0 && (
                  <span className="mt-4 block">
                    <span className="mb-2 block text-[13px] text-muted">{t.shots}</span>
                    <span className="grid grid-cols-6 gap-1.5">
                      {SHOTS.map((n) => (
                        <Image key={n} src={`/images/flights/m8/${n}.webp`} alt="" width={160} height={107} sizes="80px" className="aspect-[3/2] w-full rounded-[6px] object-cover" />
                      ))}
                    </span>
                  </span>
                )}
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
