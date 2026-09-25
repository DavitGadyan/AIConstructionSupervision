import Image from "next/image";
import Link from "next/link";
import { TypeText } from "@/components/motion/TypeText";
import { typeSequence } from "@/components/motion/typeTokens";
import { Pill } from "@/components/ui/primitives";
import { getHome } from "@/lib/content/home";
import { fmt, getDictionary, localizePath, type Locale } from "@/lib/i18n";
import { HeroCarousel } from "./HeroCarousel";
import { HeroTower } from "./HeroTower";
import { Icon } from "./icons";
import { SIGN_IN_HREF } from "@/lib/siteMode";

/**
 * ORDI screen 1, one-to-one. At xl and up every region is absolutely placed
 * in stage-relative percentages (measured off image_original1.png, stage
 * 1400x900) and the headline is sized in container units, so the composition
 * keeps its proportions at any desktop width. Below xl the same regions stack.
 */

export function Hero({ locale }: { locale: Locale }) {
  const d = getDictionary(locale);
  const t = d.hero;
  const rows = [
    { name: fmt(t.floor, { n: 13 }), sev: t.critical, tone: "danger" as const, trade: t.structure, delta: fmt(d.explorer.daysShort, { n: 28 }) },
    { name: fmt(t.floor, { n: 15 }), sev: t.watch, tone: "grey" as const, trade: t.structure, delta: fmt(d.explorer.daysShort, { n: 7 }) },
  ];
  // Demo site names (no real place or project); proper names, not translated.
  const flights = [
    { date: "23.09", time: locale === "en" ? "07:30 AM" : "07:30", site: "Residential tower · Site A", status: t.processing, dot: "bg-accent" },
    { date: "23.09", time: locale === "en" ? "11:00 AM" : "11:00", site: "Residential block · Site B", status: t.scheduled, dot: "bg-accent2" },
  ];
  // The split headline types as one line: piece k starts where piece k-1
  // ends (delay = typeDuration(prev)), one shared step, and the whole line is
  // capped at 700 ms. `eager` types it from first paint (not from hydration),
  // so the h1 is fully painted ~900 ms after the page first shows.
  const title = [t.titleLine1, t.titleLine2, t.titleLine3];
  const typing = typeSequence(title, { maxDuration: 700 });
  const piece = (k: number) => (
    <TypeText as="span" a11y="hidden" eager speed={typing.step} delay={typing.delays[k]} blink={k === title.length - 1}>
      {title[k]}
    </TypeText>
  );
  return (
    <section aria-labelledby="hero-title" className="px-3 pt-3 md:px-6 md:pt-6">
      <div className="stage @container mx-auto max-w-[1480px] px-4 pb-6 pt-[84px] md:px-8 md:pt-[108px] xl:aspect-[14/9] xl:max-h-[960px] xl:min-h-[760px] xl:p-0">
        {/* 10 · Watermark */}
        <p
          aria-hidden
          className="display-xl pointer-events-none absolute -bottom-[4cqw] left-1/2 z-0 -translate-x-1/2 select-none whitespace-nowrap text-[23cqw] text-white/35 xl:left-[62%]"
        >
          CONTROL
        </p>

        {/* 2 · Split headline */}
        <h1
          id="hero-title"
          aria-label={title.join(" ")}
          className="display-xl relative z-10 flex flex-col text-[21cqw] hy:text-[13.5cqw] md:text-[15cqw] md:hy:text-[13.5cqw] xl:absolute xl:inset-x-[1.6%] xl:top-[11.5%] xl:flex-row xl:justify-between xl:text-[10.6cqw] xl:hy:text-[4.5cqw] xl:ru:text-[7.2cqw]"
        >
          <span>{piece(0)}</span>{" "}
          <span className="text-right">
            {piece(1)} <br />
            {piece(2)}
          </span>
        </h1>

        {/* 3 · Centre object */}
        <HeroTower label={t.towerLabel} exploreLabel={t.exploreModel} className="pointer-events-none relative z-20 -mt-[8cqw] aspect-square w-[130%] -mx-[15%] max-w-none md:mx-auto md:w-full md:max-w-[640px] xl:absolute xl:left-[26%] xl:top-[3%] xl:mt-0 xl:aspect-auto xl:h-[98%] xl:w-[48%] xl:max-w-none" />

        <div className="relative z-30 grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 xl:contents">
          {/* 4 · How it works card */}
          <Link
            href={localizePath("/#how-it-works", locale)}
            className="group glass flex w-full min-w-0 max-w-full items-center gap-4 p-2 pr-5 transition hover:-translate-y-0.5 xl:absolute xl:left-[2%] xl:top-[27.5%] xl:z-30 xl:w-[21.5%] xl:min-w-[290px]"
          >
            <span className="relative block h-[104px] w-[104px] shrink-0 overflow-hidden rounded-[20px] bg-accent-soft">
              <Image
                src="/images/marketing/hero-howitworks.webp"
                alt={t.howItWorksAlt}
                width={208}
                height={208}
                sizes="104px"
                className="size-full object-cover transition duration-500 group-hover:scale-105"
              />
              <span className="absolute inset-0 grid place-items-center">
                <span className="grid size-10 place-items-center rounded-full bg-white/80 text-ink backdrop-blur-sm">
                  <Icon name="play" className="ml-0.5 size-4" />
                </span>
              </span>
            </span>
            <span>
              <span className="block font-display text-[20px] font-bold leading-tight">{t.howItWorks}</span>
              <span className="mt-1.5 block text-[15px] leading-snug text-ink/80">{t.howItWorksText}</span>
            </span>
          </Link>

          {/* 5 · Glass rows tray */}
          <div className="glass grid gap-2 rounded-[24px] p-3 xl:absolute xl:left-[14.8%] xl:top-[46%] xl:z-30 xl:w-[28%] xl:min-w-[360px]">
            <p className="sr-only">{t.findingsSr}</p>
            {rows.map((r) => (
              <div key={r.name} className="inner grid grid-cols-[1fr_auto_1fr_auto] items-center gap-3 rounded-[12px] px-3 py-2.5 text-[14px]">
                <span className="truncate">{r.name}</span>
                <Pill tone={r.tone}>{r.sev}</Pill>
                <span className="truncate text-ink/80">{r.trade}</span>
                <span className="tabular font-medium">{r.delta}</span>
              </div>
            ))}
          </div>

          {/* 6 · Today's flights */}
          <div className="glass relative p-4 md:col-span-2 xl:absolute xl:left-[54%] xl:top-[51.5%] xl:z-30 xl:w-[25.6%] xl:min-w-[330px] xl:overflow-visible">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-[22px] font-bold leading-tight">{t.todaysFlights}</h2>
                <p className="text-[14px] text-ink/70">{t.droneSchedule}</p>
              </div>
              <Link
                href={SIGN_IN_HREF ?? localizePath("/contact", locale)}
                aria-label={t.openFlights}
                className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-btn)] bg-surface shadow-[var(--shadow-inner)] transition hover:-translate-y-0.5"
              >
                <svg viewBox="0 0 16 16" fill="none" className="size-4" aria-hidden>
                  <path d="M4.5 11.5l7-7M5.5 4.5h6v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
            <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:w-[136%]">
              {flights.map((f) => (
                <li key={f.site} className="inner flex min-h-[150px] flex-col p-4">
                  <p className="tabular text-[13px] text-muted">
                    {f.date}
                    <span className="ml-3">{f.time}</span>
                  </p>
                  <p className="mt-2 font-medium">{f.site}</p>
                  <p className="text-[14px] text-ink/80">{t.shots}</p>
                  <p className="mt-auto flex items-center justify-between pt-4 text-[13px] text-muted">
                    {f.status}
                    <span className={`size-3 rounded-full ${f.dot}`} aria-hidden />
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {/* 7 + 8 · Lead copy and carousel: one bottom-anchored column on desktop, so a
              long slide (hy/ru, 1280 px laptops) pushes up instead of running into the controls */}
          <div className="contents xl:absolute xl:bottom-[3%] xl:left-[2.1%] xl:z-30 xl:flex xl:flex-col xl:items-start xl:gap-4">
            <HeroCarousel
              slides={getHome(locale).heroSlides}
              labels={t}
              leadClassName="min-h-[132px] md:pr-4 xl:min-h-0 xl:w-[max(23cqw,320px)]"
            />
          </div>

          {/* 9 · Caption */}
          <p className="self-end text-[13px] uppercase leading-snug tracking-[0.02em] text-ink/80 md:col-span-2 md:justify-self-end md:max-w-[320px] md:text-left xl:absolute xl:bottom-[3%] xl:right-[2.1%] xl:z-30 xl:w-[24%] xl:max-w-none">
            {t.caption}
          </p>
        </div>
      </div>
    </section>
  );
}
