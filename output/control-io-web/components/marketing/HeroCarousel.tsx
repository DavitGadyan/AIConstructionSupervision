"use client";

import { useState } from "react";
import { cx } from "@/components/ui/primitives";
import { fmt } from "@/lib/i18n/config";
import { Icon } from "./icons";

/**
 * ORDI LeadCopy + CarouselControls. Cycles the lead message; manual only, so
 * nothing moves unless the visitor asks it to.
 */
export function HeroCarousel({
  slides: heroSlides,
  labels,
  leadClassName,
  controlsClassName,
}: {
  slides: { title: string; text: string }[];
  labels: { carouselLabel: string; prevMessage: string; nextMessage: string; messageN: string };
  leadClassName?: string;
  controlsClassName?: string;
}) {
  const [i, setI] = useState(0);
  const n = heroSlides.length;
  const go = (d: number) => setI((v) => (v + d + n) % n);
  const slide = heroSlides[i];

  return (
    <>
      <div className={leadClassName} aria-live="polite" aria-atomic="true">
        <p key={i} className="transition-[opacity,translate] duration-300 ease-[var(--ease-out)] starting:translate-y-1 starting:opacity-0">
          <strong className="block font-display text-[18px] font-bold md:text-[20px]">{slide.title}</strong>
          <span className="mt-3 block text-[15px] leading-[1.6] text-ink/80 md:text-[16px]">{slide.text}</span>
        </p>
      </div>

      <div className={cx("flex items-center gap-3", controlsClassName)} role="group" aria-label={labels.carouselLabel}>
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label={labels.prevMessage}
          className="grid size-11 place-items-center rounded-[var(--radius-btn)] bg-glass-strong text-ink shadow-[var(--shadow-inner)] transition hover:bg-surface active:scale-95"
        >
          <Icon name="arrow-left" className="size-[18px]" />
        </button>
        <ol className="flex items-center">
          {heroSlides.map((s, k) => (
            <li key={s.title}>
              <button
                type="button"
                onClick={() => setI(k)}
                aria-label={fmt(labels.messageN, { n: k + 1, title: s.title })}
                aria-current={k === i ? "true" : undefined}
                className="grid size-8 place-items-center rounded-full sm:size-11"
              >
                <span className={cx("block rounded-full bg-surface transition-all", k === i ? "size-3" : "size-1.5 opacity-70")} />
              </button>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label={labels.nextMessage}
          className="grid size-11 place-items-center rounded-[var(--radius-btn)] bg-glass-strong text-ink shadow-[var(--shadow-inner)] transition hover:bg-surface active:scale-95"
        >
          <Icon name="arrow-right" className="size-[18px]" />
        </button>
      </div>
    </>
  );
}
