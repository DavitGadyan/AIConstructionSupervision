import { TypeText } from "@/components/motion/TypeText";
import { ArrowIcon, Button, GlassCard, cx } from "@/components/ui/primitives";
import { absoluteUrl, site } from "@/lib/content/site";
import { ORDER_KINDS, ORDER_PRIORITIES } from "@/lib/domain/orderTypes";
import { PRICES_AMD, quote } from "@/lib/domain/pricing";
import { fmt, getDictionary, localeMeta, localizePath, type Locale } from "@/lib/i18n";
import homeScreen from "@/public/images/app/home.webp";
import orderScreen from "@/public/images/app/order.webp";
import trackingScreen from "@/public/images/app/tracking.webp";
import { Container } from "./Container";
import { Icon } from "./icons";
import { PhoneMockup } from "./PhoneMockup";

/* ---- Price helpers (shared with the pricing page) ------------------------ */

/** AMD in the reader's locale: "AMD 90,000" (en), "90 000 ֏" (hy), "90 000 AMD" (ru). */
export function formatAmdLocalized(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(localeMeta[locale].dateLocale, { style: "currency", currency: "AMD", maximumFractionDigits: 0 }).format(amount);
}

/** Cheapest inspection, for the "from" line. */
export function fromPriceAmd(): number {
  return Math.min(...ORDER_KINDS.map((k) => PRICES_AMD[k]));
}

/** ASAP surcharge as a locale percent ("25%", "25 %"), derived from quote() so it cannot drift from the order API. */
export function asapSurchargeLabel(locale: Locale): string {
  const frac = quote("full", "asap").priceAmd / quote("full", "scheduled").priceAmd - 1;
  return new Intl.NumberFormat(localeMeta[locale].dateLocale, { style: "percent", maximumFractionDigits: 1 }).format(frac);
}

/** schema.org Service for on-demand inspections: area served, the 12 h report and per-kind AMD offers. */
export function inspectionServiceLd(locale: Locale) {
  const d = getDictionary(locale);
  const t = d.home.orderApp;
  const ins = d.pricingPage.inspections;
  const L = (p: string) => localizePath(p, locale);
  const armenia = { "@type": "Country", name: "Armenia" };
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${site.url}/#on-demand-inspection`,
    name: t.ldName,
    serviceType: t.ldServiceType,
    description: t.ldDescription,
    url: absoluteUrl(L("/#order-from-phone")),
    provider: { "@id": `${site.url}/#organization` },
    areaServed: [
      { "@type": "City", name: "Yerevan", containedInPlace: armenia },
      { "@type": "AdministrativeArea", name: "Kotayk Province", containedInPlace: armenia },
    ],
    availableChannel: { "@type": "ServiceChannel", serviceUrl: absoluteUrl(L("/contact?topic=inspection")) },
    serviceOutput: { "@type": "Report", name: t.step3Title, description: t.step3Text, encodingFormat: "application/pdf" },
    offers: ORDER_KINDS.flatMap((kind) =>
      ORDER_PRIORITIES.map((priority) => ({
        "@type": "Offer",
        name: `${ins.kinds[kind].name} · ${priority === "asap" ? ins.asap : ins.scheduled}`,
        description: ins.kinds[kind].text,
        price: quote(kind, priority).priceAmd,
        priceCurrency: "AMD",
        url: absoluteUrl(L("/pricing#inspections")),
      })),
    ),
  };
}

/* ---- Section --------------------------------------------------------------- */

/**
 * The screenshots (public/images/app, 560x1212, captured from the Expo web
 * export) are static imports, so they are served from content-hashed URLs
 * (/_next/static/media/home.<hash>.webp). Overwriting a file gives it a new
 * URL and a new /_next/image cache key, so no optimizer, browser or CDN cache
 * can keep showing the previous frame. Replace the files in place; no code
 * change is needed.
 */
const PHONES = [
  // Left, behind: Home.
  { key: "home", src: homeScreen, cls: "sm:mt-10 lg:left-0 lg:top-[9%] lg:mt-0 lg:w-[38%]" },
  // Centre, in front: Order review.
  { key: "order", src: orderScreen, cls: "lg:left-1/2 lg:top-0 lg:z-10 lg:w-[44%] lg:-translate-x-1/2" },
  // Right, behind: Tracking (the status chip floats over it).
  { key: "tracking", src: trackingScreen, cls: "sm:mt-16 lg:right-0 lg:top-[15%] lg:mt-0 lg:w-[38%]" },
] as const;

/**
 * "Order an inspection from your phone" (#order-from-phone). ORDI anatomy on a
 * ground stage: giant display heading, a glass card of white step cards, and
 * three phone frames. On phones the frames become one snap-scrolling row.
 *
 * Grid areas keep a sensible reading order on small screens (heading, phones,
 * steps, price + CTA, fine print) while desktop puts the phones beside the text.
 */
export function OrderFromPhone({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).home.orderApp;
  const L = (p: string) => localizePath(p, locale);

  // Words never break mid-word, so cap the size until the longest word fits the column.
  const longest = Math.max(1, ...`${t.titleLine1} ${t.titleLine2}`.split(/\s+/).map((w) => Array.from(w).length));
  const titleSize = `min(clamp(48px, 6vw, 92px), calc(100cqw / (${longest} * var(--glyph-w))))`;

  const alts = { home: t.phoneHomeAlt, order: t.phoneOrderAlt, tracking: t.phoneTrackingAlt };
  const steps = [
    { value: t.step1Value, title: t.step1Title, text: t.step1Text, tag: t.step1Tag, dot: "bg-accent2" },
    { value: t.step2Value, title: t.step2Title, text: t.step2Text, tag: t.step2Tag, dot: "bg-accent" },
    { value: t.step3Value, title: t.step3Title, text: t.step3Text, tag: t.step3Tag, dot: "bg-ink" },
  ];

  return (
    <section id="order-from-phone" aria-labelledby="order-app-title" className="scroll-mt-6 px-3 pt-16 md:px-6 md:pt-24">
      <div className="stage mx-auto max-w-[1480px] section-pad">
        <Container className="grid grid-cols-[minmax(0,1fr)] gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] xl:gap-x-16">
          {/* A · Heading + intro */}
          <div className="lg:col-start-1 lg:row-start-1">
            <p className="eyebrow mb-3">{t.eyebrow}</p>
            <div className="@container min-w-0">
              <TypeText as="h2" id="order-app-title" className="display-xl [hyphens:none] [overflow-wrap:normal]" style={{ fontSize: titleSize }}>
                {t.titleLine1} <br />
                {t.titleLine2}
              </TypeText>
            </div>
            <p className="mt-6 max-w-[46ch] text-[17px] text-ink/80 md:text-[18px]">{t.intro}</p>
          </div>

          {/* P · Phones: snap row on phones, three columns on tablets, overlapping cluster on desktop */}
          <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center">
            <div className="relative">
              {/* Same order number and arrival window as the tracking screenshot it floats over. */}
              <p className="glass mb-4 inline-flex max-w-full items-center gap-3 rounded-[var(--radius-inner)] px-4 py-3 lg:absolute lg:bottom-[7%] lg:right-[3%] lg:z-20 lg:mb-0">
                <span className="relative flex size-2.5 shrink-0" aria-hidden>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
                </span>
                <span className="min-w-0">
                  <span className="sr-only">{t.chipLabel}: </span>
                  <span className="block text-[12px] leading-tight text-muted tabular">INS-2026-0007</span>
                  <span className="block text-[14px] font-medium leading-snug">
                    {t.chipStatus}{" "}
                    <span className="whitespace-nowrap">
                      <span aria-hidden>·</span> <span className="tabular">09:40–10:40</span>
                    </span>
                  </span>
                </span>
              </p>
              <div
                role="region"
                aria-label={t.phonesLabel}
                tabIndex={0}
                className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:block lg:aspect-[20/19]"
              >
                {PHONES.map((p) => (
                  <PhoneMockup
                    key={p.key}
                    src={p.src}
                    alt={alts[p.key]}
                    sizes="(min-width:1024px) 280px, (min-width:640px) 30vw, 72vw"
                    className={cx("w-[72%] max-w-[280px] shrink-0 self-start snap-start sm:w-auto sm:max-w-none lg:absolute", p.cls)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* S · Steps (ORDI glass card with white inner cards) */}
          <GlassCard
            as="div"
            title={t.cardTitle}
            subtitle={t.cardSub}
            href={L("/pricing#inspections")}
            openLabel={t.cardLink}
            className="lg:col-span-2 lg:row-start-3"
          >
            <ol className="grid gap-2 md:grid-cols-3">
              {steps.map((s, k) => (
                <li key={s.title} className="inner flex flex-col p-5 md:max-lg:p-4">
                  <p className="flex items-center justify-between text-[13px] text-muted tabular">
                    {fmt(t.step, { n: k + 1 })}
                    {k < steps.length - 1 && <Icon name="arrow-right" className="size-4 shrink-0" />}
                  </p>
                  <p className="mt-3 font-display text-[clamp(32px,3.2vw,44px)] font-bold leading-none tracking-tight text-accent tabular">{s.value}</p>
                  <TypeText as="h4" className="mt-3 font-display text-[19px] font-semibold leading-tight md:max-lg:text-[17px]" delay={k * 120} maxDuration={900}>
                    {s.title}
                  </TypeText>
                  <p className="mt-2 text-[15px] text-muted">{s.text}</p>
                  <p className="mt-auto flex items-center justify-between gap-3 pt-5 text-[13px] text-muted">
                    {s.tag}
                    <span className={cx("size-2.5 shrink-0 rounded-full", s.dot)} aria-hidden />
                  </p>
                </li>
              ))}
            </ol>
          </GlassCard>

          {/* B · Price, CTA, store availability */}
          <div className="lg:col-start-1 lg:row-start-2">
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[15px] text-muted">{t.priceFrom}</span>
              <span className="whitespace-nowrap font-display text-[clamp(34px,3.4vw,48px)] font-bold leading-none tracking-tight tabular">
                {formatAmdLocalized(fromPriceAmd(), locale)}
              </span>
              <span className="text-[15px] text-muted">{t.perInspection}</span>
            </p>
            <p className="mt-2 text-[14px] text-muted">{fmt(t.priceNote, { pct: asapSurchargeLabel(locale) })}</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button href={L("/contact?topic=inspection")} variant="accent">
                {t.cta} <ArrowIcon />
              </Button>
              <Button href={L("/pricing#inspections")} variant="light">{t.pricesLink}</Button>
            </div>
            <ul aria-label={t.storesLabel} className="mt-4 flex flex-wrap gap-2">
              {["App Store", "Google Play"].map((store) => (
                <li key={store} className="inline-flex items-center gap-2 rounded-[var(--radius-btn)] bg-white/55 px-3 py-2 text-[13px] ring-1 ring-line">
                  <svg viewBox="0 0 16 16" className="size-3.5 text-muted" fill="none" aria-hidden>
                    <rect x="4" y="1.5" width="8" height="13" rx="2" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M7 12h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  <span className="font-medium">{store}</span>
                  <span className="text-muted">· {t.comingSoon}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* F · Fine print */}
          <p className="max-w-[90ch] text-[13px] text-muted lg:col-span-2 lg:row-start-4">{t.finePrint}</p>
        </Container>
      </div>
    </section>
  );
}
