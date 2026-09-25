import type { Metadata } from "next";
import { Container, LastUpdated, PageHero, SectionHeading } from "@/components/marketing/Container";
import { FaqTable } from "@/components/marketing/FaqTable";
import { Icon } from "@/components/marketing/icons";
import { JsonLd } from "@/components/marketing/JsonLd";
import { asapSurchargeLabel, formatAmdLocalized, inspectionServiceLd } from "@/components/marketing/OrderFromPhone";
import { TypeText } from "@/components/motion/TypeText";
import { Breadcrumbs, Button, Pill, cx } from "@/components/ui/primitives";
import { getHome } from "@/lib/content/home";
import { absoluteUrl, breadcrumbLd, faqLd, formatDate, LAST_UPDATED } from "@/lib/content/site";
import { ORDER_KINDS } from "@/lib/domain/orderTypes";
import { quote } from "@/lib/domain/pricing";
import { fmt, getDictionary, localizePath } from "@/lib/i18n";
import { pageMetadata } from "@/lib/i18n/metadata";
import { readLocale, type LocaleParams } from "@/lib/i18n/params";

export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = getDictionary(locale).meta.pricing;
  return pageMetadata({ locale, path: "/pricing", title: t.title, description: t.description });
}

export default async function PricingPage({ params }: { params: LocaleParams }) {
  const locale = await readLocale(params);
  const d = getDictionary(locale);
  const t = d.pricingPage;
  const ins = t.inspections;
  const { pricing, pricingFaq } = getHome(locale);
  const L = (p: string) => localizePath(p, locale);
  const crumbs = [
    { name: d.common.home, href: L("/") },
    { name: t.title, href: L("/pricing") },
  ];
  const softwareLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "control.io",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: d.site.softwareSubCategory,
    operatingSystem: "Web",
    inLanguage: locale,
    url: absoluteUrl(L("/")),
    description: d.site.softwareDescription,
    publisher: { "@id": absoluteUrl("/#organization") },
    offers: pricing.map((t) =>
      t.priceValue
        ? {
            "@type": "Offer",
            name: t.name,
            url: absoluteUrl(L("/pricing")),
            priceCurrency: "USD",
            price: t.priceValue,
            priceSpecification: { "@type": "UnitPriceSpecification", price: t.priceValue, priceCurrency: "USD", unitText: "MONTH", referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" } },
            description: t.audience,
          }
        : { "@type": "Offer", name: t.name, url: absoluteUrl(L("/pricing")), priceCurrency: "USD", description: `${t.audience} ${d.site.customPricing}` },
    ),
  };

  return (
    <>
      <PageHero
        crumbs={<Breadcrumbs items={crumbs} label={d.common.breadcrumb} />}
        title={t.title}
        sub={t.sub}
      >
        <div className="mt-8">
          <LastUpdated iso={LAST_UPDATED} label={formatDate(LAST_UPDATED, locale)} prefix={d.common.lastUpdated} />
        </div>
      </PageHero>

      <section aria-labelledby="plans-title" className="section-pad">
        <Container>
          <h2 id="plans-title" className="sr-only">{t.plans}</h2>
          <ul className="grid gap-4 lg:grid-cols-3">
            {pricing.map((plan, k) => (
              <li
                key={plan.name}
                className={cx(
                  "flex flex-col rounded-[var(--radius-card)] p-6 md:p-8",
                  plan.featured ? "bg-accent text-white shadow-[var(--shadow-card)]" : "glass",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  {/* White caret on the accent card, like AccentCard. */}
                  <TypeText
                    as="h3"
                    className={cx("font-display text-[24px] font-bold", plan.featured && "[--type-caret:#fff]")}
                    delay={k * 120}
                    maxDuration={900}
                  >
                    {plan.name}
                  </TypeText>
                  {plan.featured && <Pill tone="dark">{t.mostChosen}</Pill>}
                </div>
                <p className={cx("mt-1 text-[15px]", plan.featured ? "text-white/85" : "text-muted")}>{plan.audience}</p>
                <p className="mt-6">
                  {plan.price ? (
                    <>
                      <span className={cx("text-[14px]", plan.featured ? "text-white/85" : "text-muted")}>{t.from} </span>
                      <span className="display-xl tabular text-[56px] normal-case">${plan.price}</span>
                      {" "}
                      <span className={cx("text-[15px]", plan.featured ? "text-white/85" : "text-muted")}>{plan.cadence}</span>
                    </>
                  ) : (
                    <span className="display-xl text-[56px] hy:text-[clamp(26px,2.5vw,40px)] ru:text-[clamp(26px,2.5vw,40px)]">{t.custom}</span>
                  )}
                </p>
                <ul className="mt-6 grid flex-1 gap-2">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className={cx("flex items-start gap-3 rounded-[12px] px-3.5 py-2.5 text-[15px]", plan.featured ? "bg-white/12 ring-1 ring-white/15" : "inner")}
                    >
                      <Icon name="check" className={cx("mt-0.5 size-4 shrink-0", plan.featured ? "text-white" : "text-accent-deep")} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button href={L("/contact")} variant={plan.featured ? "light" : "dark"} className="mt-6 w-full">
                  {plan.cta}
                </Button>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Per-inspection prices (on-demand orders from the app or dashboard) */}
      <section id="inspections" aria-labelledby="inspections-title" className="scroll-mt-6 px-3 md:px-6">
        <div className="stage mx-auto max-w-[1480px] section-pad">
          <Container>
            <SectionHeading id="inspections-title" align="split" eyebrow={ins.eyebrow} title={ins.title} intro={ins.sub} />
            <ul aria-label={ins.listLabel} className="grid gap-4 lg:grid-cols-3">
              {ORDER_KINDS.map((kind, i) => {
                const k = ins.kinds[kind];
                return (
                  <li key={kind} className="glass flex flex-col p-2">
                    <div className="p-4 pb-5">
                      <TypeText as="h3" className="font-display text-[22px] font-bold leading-tight md:text-[24px]" delay={i * 120} maxDuration={900}>
                        {k.name}
                      </TypeText>
                      <p className="mt-2 text-[15px] text-muted">{k.text}</p>
                    </div>
                    <dl className="mt-auto grid gap-2">
                      <div className="inner flex flex-wrap items-end justify-between gap-x-4 gap-y-1 p-4">
                        <dt>
                          <span className="block font-medium">{ins.scheduled}</span>
                          <span className="block text-[13px] text-muted">{ins.scheduledSub}</span>
                        </dt>
                        <dd className="whitespace-nowrap font-display text-[26px] font-bold leading-none tracking-tight tabular">
                          {formatAmdLocalized(quote(kind, "scheduled").priceAmd, locale)}
                        </dd>
                      </div>
                      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 rounded-[var(--radius-inner)] bg-accent p-4 text-white">
                        <dt>
                          <span className="block font-medium">{ins.asap}</span>
                          <span className="block text-[13px] text-white/85">{ins.asapSub}</span>
                        </dt>
                        <dd className="whitespace-nowrap font-display text-[26px] font-bold leading-none tracking-tight tabular">
                          {formatAmdLocalized(quote(kind, "asap").priceAmd, locale)}
                        </dd>
                      </div>
                    </dl>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <ul aria-label={ins.notesLabel} className="grid gap-2 sm:grid-cols-2">
                {[fmt(ins.asapNote, { pct: asapSurchargeLabel(locale) }), ins.invoice, ins.area, ins.report].map((note) => (
                  <li key={note} className="inner flex items-start gap-3 px-3.5 py-2.5 text-[15px]">
                    <Icon name="check" className="mt-0.5 size-4 shrink-0 text-accent-deep" />
                    {note}
                  </li>
                ))}
              </ul>
              <Button href={L("/contact?topic=inspection")} variant="dark" className="justify-self-start">
                {ins.cta}
              </Button>
            </div>
          </Container>
        </div>
      </section>

      <section aria-labelledby="pricing-faq-title" className="pb-8 pt-16 md:pt-24">
        <Container>
          <FaqTable
            id="pricing-faq-title"
            items={pricingFaq}
            title={t.faqTitle}
            labels={{ question: d.faqTable.question, topic: d.faqTable.topic }}
          />
        </Container>
      </section>

      <JsonLd data={[breadcrumbLd(crumbs), softwareLd, inspectionServiceLd(locale), faqLd(pricingFaq, locale)]} />
    </>
  );
}
