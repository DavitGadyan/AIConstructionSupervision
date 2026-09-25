import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { TypeText } from "@/components/motion/TypeText";
import { AccentCard, AccentSubCard, ArrowButton, ArrowIcon, Button, GlassCard, Pill, SegmentBar, cx } from "@/components/ui/primitives";
import { getHighlights, getServices } from "@/lib/content/services";
import { getIndustries } from "@/lib/content/industries";
import { getHome } from "@/lib/content/home";
import { fmt, getDictionary, localizePath, plural, type Locale } from "@/lib/i18n";
import { Container, SectionHeading } from "./Container";
import { Icon } from "./icons";

/* 2 · Industries grid ------------------------------------------------------ */
export function IndustriesGrid({ locale, headingLevel = "h2" }: { locale: Locale; headingLevel?: "h2" | "none" }) {
  const d = getDictionary(locale);
  const t = d.home.industries;
  const industries = getIndustries(locale);
  return (
    <section aria-labelledby="industries-title" className="section-pad">
      <Container>
        {headingLevel === "none" && <h2 id="industries-title" className="sr-only">{t.srTitle}</h2>}
        {headingLevel === "h2" && (
          <SectionHeading
            id="industries-title"
            align="split"
            eyebrow={t.eyebrow}
            title={t.title}
            intro={t.intro}
          />
        )}
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {industries.map((ind, k) => (
            <Reveal as="li" key={ind.slug} delay={k * 60}>
              <article className="glass group flex h-full flex-col p-2">
                <div className="relative aspect-[16/10] overflow-hidden rounded-[22px] bg-accent-soft">
                  <Image
                    src={ind.image.src}
                    alt={ind.image.alt}
                    width={800}
                    height={500}
                    sizes="(min-width:1024px) 420px, (min-width:640px) 50vw, 100vw"
                    className="size-full object-cover transition duration-700 group-hover:scale-[1.03]"
                  />
                  <span className="absolute left-3 top-3 grid size-11 place-items-center rounded-[var(--radius-btn)] bg-surface text-accent-deep shadow-[var(--shadow-inner)]">
                    <Icon name={ind.icon} />
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="font-display text-[22px] font-semibold">{ind.name}</h3>
                  <p className="mt-2 flex-1 text-[15px] text-muted">{ind.short}</p>
                  <Link
                    href={localizePath(`/industries/${ind.slug}`, locale)}
                    className="mt-5 inline-flex items-center gap-2 self-start rounded-[var(--radius-btn)] bg-surface px-4 py-2.5 text-[15px] font-medium shadow-[var(--shadow-inner)] transition hover:-translate-y-0.5"
                  >
                    {d.common.readMore} <span className="sr-only">{fmt(t.readMoreSr, { name: ind.name })}</span>
                    <ArrowIcon />
                  </Link>
                </div>
              </article>
            </Reveal>
          ))}
        </ul>
      </Container>
    </section>
  );
}

/* 3 · Service highlights -------------------------------------------------- */
export function Highlights({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).home.highlights;
  const highlights = getHighlights(locale);
  return (
    <section aria-labelledby="highlights-title" className="px-3 md:px-6">
      <div className="stage mx-auto max-w-[1480px] section-pad">
        <Container>
          <SectionHeading
            id="highlights-title"
            eyebrow={t.eyebrow}
            title={t.title}
            intro={t.intro}
          />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3">
            {highlights.map((h, k) => (
              <Reveal key={h.id} delay={k * 80} className={cx(k === 1 && "lg:translate-y-10")}>
                <article className="glass flex h-full flex-col p-2">
                  <div className="flex items-start justify-between gap-4 p-4">
                    <div>
                      <p className="tabular text-[13px] text-muted">{h.kicker}</p>
                      <h3 className="mt-1 font-display text-[24px] font-bold leading-tight">{h.title}</h3>
                    </div>
                    <ArrowButton href={localizePath(`/services#${h.id}`, locale)} label={fmt(t.learnAbout, { title: h.title })} />
                  </div>
                  <p className="px-4 pb-5 text-[15px] text-ink/80">{h.text}</p>
                  <div className="mt-auto overflow-hidden rounded-[22px]">
                    <Image src={h.image.src} alt={h.image.alt} width={800} height={500} sizes="(min-width:1024px) 420px, 100vw" className="aspect-[16/10] w-full object-cover" />
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </Container>
      </div>
    </section>
  );
}

/* 4 · Values --------------------------------------------------------------- */
export function Values({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).home.values;
  const { values } = getHome(locale);
  return (
    <section aria-labelledby="values-title" className="section-pad">
      <Container className="grid gap-10 lg:grid-cols-[0.9fr_1.6fr] lg:gap-16">
        <div className="lg:sticky lg:top-10 lg:self-start">
          <p className="eyebrow mb-3">{t.eyebrow}</p>
          <TypeText as="h2" id="values-title" className="display-xl text-[clamp(52px,8vw,120px)]">
            {t.titleLine1} <br />
            {t.titleLine2}
          </TypeText>
          <p className="mt-6 max-w-[40ch] text-[17px] text-muted">{t.intro}</p>
        </div>
        <ol className="grid gap-4">
          {values.map((v, k) => (
            <Reveal as="li" key={v.title} delay={k * 80}>
              <div className="inner grid gap-4 p-6 md:grid-cols-[120px_1fr] md:p-8">
                <span className="display-xl tabular text-[64px] text-accent md:text-[80px]">0{k + 1}</span>
                <div>
                  <TypeText as="h3" className="font-display text-[26px] font-bold" delay={k * 120} maxDuration={900}>
                    {v.title}
                  </TypeText>
                  <p className="mt-2 text-[16px] text-muted">{v.text}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </ol>
      </Container>
    </section>
  );
}

/* 5 · Our services --------------------------------------------------------- */
export function ServicesOverview({ locale }: { locale: Locale }) {
  const d = getDictionary(locale);
  const t = d.home.services;
  const services = getServices(locale);
  return (
    <section aria-labelledby="services-title" className="section-pad pt-0 md:pt-0">
      <Container>
        <SectionHeading
          id="services-title"
          align="split"
          eyebrow={t.eyebrow}
          title={t.title}
          intro={t.intro}
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {services.map((s, k) => (
            <Reveal key={s.id} delay={(k % 3) * 60}>
              <GlassCard as="article" title={s.title} href={localizePath(`/services#${s.id}`, locale)} openLabel={fmt(d.common.openNamed, { name: s.title })} className="h-full">
                <p className="mb-4 text-[15px] text-ink/80">{s.short}</p>
                <ul className="grid gap-2">
                  {s.benefits.map((b) => (
                    <li key={b.title} className="inner flex items-start gap-3 px-3.5 py-3 text-[15px]">
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-deep">
                        <Icon name="check" className="size-3.5" />
                      </span>
                      <span>
                        <strong className="font-medium">{b.title}.</strong> <span className="text-muted">{b.text}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </GlassCard>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}

/* 6 · How it works (ORDI TimelineCard) ------------------------------------ */
const blockTone = {
  accent: "bg-accent text-white",
  dark: "bg-ink text-white",
  light: "bg-accent2-soft text-ink",
  grey: "bg-accent2 text-white",
};

export function HowItWorks({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).home.how;
  const { steps } = getHome(locale);
  const ruler = [0, null, 1, null, 2, null, 3].map((n) => (n == null ? "" : fmt(t.day, { n })));
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="scroll-mt-6 px-3 md:px-6">
      <div className="stage mx-auto max-w-[1480px] section-pad">
        <Container>
          <SectionHeading
            id="how-title"
            eyebrow={t.eyebrow}
            title={t.title}
            intro={t.intro}
          />
          <div className="glass p-5 md:p-6">
            <header className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="font-display text-[22px] font-bold">{t.cardTitle}</h3>
                  <Pill tone="dark">{t.aiPill}</Pill>
                </div>
                <p className="mt-1 text-[14px] text-muted">{t.cardSub}</p>
              </div>
            </header>
            <div className="inner relative overflow-hidden p-4 md:p-6">
              <div className="grid grid-cols-7 text-[12px] text-muted md:text-[13px]">
                {ruler.map((r, k) => (
                  <span key={k} className="tabular">{r}</span>
                ))}
              </div>
              <div className="pointer-events-none absolute inset-x-4 bottom-10 top-12 grid grid-cols-7 md:inset-x-6" aria-hidden>
                {ruler.map((_, k) => (
                  <span key={k} className="border-l border-dashed border-line" />
                ))}
              </div>
              <div className="relative mt-4 grid gap-3" aria-hidden>
                {[0, 1, 2].map((row) => (
                  <div key={row} className="relative h-[52px]">
                    {steps
                      .filter((s) => s.row === row)
                      .map((s) => (
                        <div
                          key={s.title}
                          className={cx("absolute inset-y-0 flex items-center rounded-[12px] px-3 text-[13px] font-medium md:text-[14px]", blockTone[s.tone])}
                          style={{ left: `${s.start}%`, width: `${s.end - s.start}%` }}
                        >
                          <span className="truncate">{s.title}</span>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
              <div className="relative mt-6 h-[3px] rounded-full bg-line" aria-hidden>
                <div className="absolute inset-y-0 left-0 w-[62%] rounded-full bg-ink" />
              </div>
            </div>

            <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 hy:lg:max-xl:grid-cols-2">
              {steps.map((s, k) => (
                <li key={s.title} className="inner p-5">
                  <p className="tabular text-[13px] text-muted">{fmt(t.step, { n: k + 1 })}</p>
                  <h3 className="mt-1 font-display text-[20px] font-bold">{s.title}</h3>
                  <p className="mt-2 text-[15px] text-muted">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </div>
    </section>
  );
}

/* 7 · Stats ------------------------------------------------------------------ */
export function Stats({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).home.stats;
  return (
    <section aria-labelledby="stats-title" className="section-pad">
      <Container>
        <SectionHeading
          id="stats-title"
          align="split"
          eyebrow={t.eyebrow}
          title={t.title}
          intro={t.intro}
        />
        <SegmentBar
          label={t.barLabel}
          total={
            <>
              47% <span className="text-[20px] font-medium text-muted md:text-[24px]">{t.earnedVsPlanned}</span>
            </>
          }
          segments={[
            { label: t.structure, value: 27, tone: "accent" },
            { label: t.envelope, value: 13, tone: "grey" },
            { label: t.glazing, value: 7, tone: "dark" },
            { label: t.notBuilt, value: 53, tone: "light" },
          ]}
        />
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <figure className="glass p-6 md:p-8">
            <blockquote className="display-xl text-[64px] md:text-[80px]">+20%</blockquote>
            <figcaption className="mt-4 text-[15px] text-muted">
              {t.mckinsey} <cite className="not-italic text-ink">{t.mckinseyCite}</cite>
            </figcaption>
          </figure>
          <figure className="inner p-6 md:p-8">
            <p className="display-xl text-[64px] normal-case text-accent md:text-[80px]">{t.daysBehindValue}</p>
            <figcaption className="mt-4 text-[15px] text-muted">{t.example}</figcaption>
          </figure>
          <figure className="rounded-[var(--radius-card)] bg-ink p-6 text-white md:p-8">
            <p className="display-xl text-[48px] md:text-[60px]">SHA-256</p>
            <figcaption className="mt-4 text-[15px] text-white/75">{t.hashText}</figcaption>
          </figure>
        </div>
      </Container>
    </section>
  );
}

/* 8 · Gallery (TodayCardPair anatomy) ------------------------------------- */
export function Gallery({ locale }: { locale: Locale }) {
  const d = getDictionary(locale);
  const t = d.home.gallery;
  const floors = (n: number) => fmt(plural(locale, n, t.floors), { n });
  const progression = [
    { key: "m4", label: fmt(t.flight, { n: 1 }), floors: floors(4), status: t.statusStructure, date: "14.03" },
    { key: "m6", label: fmt(t.flight, { n: 2 }), floors: floors(6), status: t.statusEnvelope, date: "16.05" },
    { key: "m8", label: fmt(t.flight, { n: 3 }), floors: floors(8), status: t.statusTopped, date: "18.07" },
  ];
  return (
    <section aria-labelledby="gallery-title" className="px-3 md:px-6">
      <div className="stage mx-auto max-w-[1480px] section-pad">
        <Container>
          <SectionHeading
            id="gallery-title"
            eyebrow={t.eyebrow}
            title={t.title}
            intro={t.intro}
          />
          <GlassCard
            title={t.cardTitle}
            subtitle={t.cardSub}
            href={localizePath("/services#3d-reconstruction", locale)}
            openLabel={fmt(d.common.openNamed, { name: t.cardTitle })}
          >
            <ul className="grid gap-3 md:grid-cols-3">
              {progression.map((p) => (
                <li key={p.key} className="inner flex flex-col overflow-hidden p-2">
                  <Image
                    src={`/images/flights/${p.key}/orbit-sw.webp`}
                    alt={fmt(t.orbitAlt, { floors: p.floors, flight: p.label })}
                    width={1536}
                    height={1024}
                    sizes="(min-width:768px) 33vw, 100vw"
                    className="aspect-[16/10] w-full rounded-[12px] object-cover"
                  />
                  <div className="flex items-end justify-between gap-3 p-3">
                    <div>
                      <p className="tabular text-[13px] text-muted">{p.date} · {p.label}</p>
                      <p className="font-medium">{p.floors}</p>
                      <p className="text-[14px] text-muted">{p.status}</p>
                    </div>
                    <span className={cx("size-3 rounded-full", p.key === "m8" ? "bg-accent" : "bg-accent2")} aria-hidden />
                  </div>
                </li>
              ))}
            </ul>
          </GlassCard>

          <div className="mt-4 grid gap-4 md:grid-cols-[1.3fr_1fr] md:items-start">
            <figure className="inner overflow-hidden p-2">
              <Image
                src="/images/flights/m8/facade-s.webp"
                alt={t.facadeAlt}
                width={1600}
                height={1000}
                sizes="(min-width:768px) 60vw, 100vw"
                className="aspect-[16/10] w-full rounded-[12px] object-cover"
              />
              <figcaption className="p-3 text-[14px] text-muted">{t.facadeCaption}</figcaption>
            </figure>
            <div className="grid gap-4">
              <figure className="inner overflow-hidden p-2">
                <Image src="/images/flights/m8/nadir.webp" alt={t.nadirAlt} width={800} height={500} sizes="(min-width:768px) 40vw, 100vw" className="aspect-[16/9] w-full rounded-[12px] object-cover" />
                <figcaption className="p-3 text-[14px] text-muted">{t.nadirCaption}</figcaption>
              </figure>
              <figure className="inner overflow-hidden p-2">
                <Image src="/images/flights/m8/deck.webp" alt={t.deckAlt} width={800} height={500} sizes="(min-width:768px) 40vw, 100vw" className="aspect-[16/9] w-full rounded-[12px] object-cover" />
                <figcaption className="p-3 text-[14px] text-muted">{t.deckCaption}</figcaption>
              </figure>
            </div>
          </div>
        </Container>
      </div>
    </section>
  );
}

/* 10 · CTA ------------------------------------------------------------------- */
export function CtaCard({ locale, title, subtitle }: { locale: Locale; title?: string; subtitle?: string }) {
  const d = getDictionary(locale);
  const t = d.cta;
  const heading = title ?? t.title;
  return (
    <section aria-label={t.label} className="section-pad">
      <Container>
        <AccentCard
          title={<span className="text-[clamp(28px,4vw,48px)] font-bold">{heading}</span>}
          subtitle={subtitle ?? t.subtitle}
          href={localizePath("/contact", locale)}
          openLabel={fmt(d.common.openNamed, { name: heading })}
          className="p-6 md:p-10"
          typed
        >
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { t: t.step1Title, d: t.step1Text },
              { t: t.step2Title, d: t.step2Text },
              { t: t.step3Title, d: t.step3Text },
            ].map((x) => (
              <AccentSubCard key={x.t}>
                <p className="font-display text-[20px] font-semibold">{x.t}</p>
                <p className="mt-1 text-[15px] text-white/85">{x.d}</p>
              </AccentSubCard>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button href={localizePath("/contact", locale)} variant="light">{t.primary}</Button>
            <Button href={localizePath("/pricing", locale)} variant="dark">{t.secondary}</Button>
          </div>
        </AccentCard>
      </Container>
    </section>
  );
}
