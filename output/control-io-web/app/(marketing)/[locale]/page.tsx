import type { Metadata } from "next";
import { Container } from "@/components/marketing/Container";
import { FaqTable } from "@/components/marketing/FaqTable";
import { FromFlightTo3D } from "@/components/marketing/FromFlightTo3D";
import { DefectExplorer } from "@/components/marketing/DefectExplorer";
import { Hero } from "@/components/marketing/Hero";
import { inspectionServiceLd, OrderFromPhone } from "@/components/marketing/OrderFromPhone";
import {
  CtaCard,
  Gallery,
  Highlights,
  HowItWorks,
  IndustriesGrid,
  ServicesOverview,
  Stats,
  Values,
} from "@/components/marketing/HomeSections";
import { JsonLd } from "@/components/marketing/JsonLd";
import { TypeText } from "@/components/motion/TypeText";
import { getHome } from "@/lib/content/home";
import { absoluteUrl, faqLd, formatDate, LAST_UPDATED, site } from "@/lib/content/site";
import { getDictionary, localizePath, type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/i18n/metadata";
import { readLocale, type LocaleParams } from "@/lib/i18n/params";

export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = getDictionary(locale);
  return pageMetadata({ locale, path: "/", title: t.meta.siteTitle, description: t.site.defaultDescription, absoluteTitle: true });
}

export default async function HomePage({ params }: { params: LocaleParams }) {
  const locale: Locale = await readLocale(params);
  const t = getDictionary(locale);
  const { steps, homeFaq } = getHome(locale);

  const howToLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    inLanguage: locale,
    name: t.site.howToName,
    description: t.site.howToDescription,
    step: steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.title,
      text: s.text,
      url: absoluteUrl(localizePath("/#how-it-works", locale)),
    })),
  };

  return (
    <>
      <Hero locale={locale} />
      <FromFlightTo3D locale={locale} />
      <DefectExplorer locale={locale} t={t.explorer} />

      {/* Definition block: the entity statement, answer-first, for people and machines. */}
      <section aria-labelledby="definition-title" className="pt-16 md:pt-24">
        <Container>
          <div className="grid gap-6 border-l-2 border-accent pl-5 md:grid-cols-[220px_1fr] md:pl-8">
            <h2 id="definition-title" className="eyebrow pt-1.5">{t.home.definitionTitle}</h2>
            <div>
              <p className="max-w-[70ch] font-display text-[20px] font-medium leading-snug md:text-[26px]">{t.site.entityDefinition}</p>
              <p className="mt-4 text-[13px] text-muted">
                {t.common.lastUpdated} <time dateTime={LAST_UPDATED}>{formatDate(LAST_UPDATED, locale)}</time>
              </p>
            </div>
          </div>
        </Container>
      </section>

      <OrderFromPhone locale={locale} />

      <IndustriesGrid locale={locale} />
      <Highlights locale={locale} />
      <Values locale={locale} />
      <ServicesOverview locale={locale} />
      <HowItWorks locale={locale} />
      <Stats locale={locale} />
      <Gallery locale={locale} />

      <section aria-labelledby="faq-title" className="section-pad">
        <Container className="grid gap-10 lg:grid-cols-[0.8fr_1.6fr]">
          <div>
            <p className="eyebrow mb-3">{t.home.faq.eyebrow}</p>
            {/* Decorative big line (the FAQ table carries the real h2): typed, hidden from screen readers. */}
            <TypeText as="p" a11y="hidden" className="display-xl text-[clamp(52px,7vw,104px)]">
              {t.home.faq.bigLine1} <br />
              {t.home.faq.bigLine2}
            </TypeText>
            <p className="mt-6 max-w-[36ch] text-[17px] text-muted">
              {t.home.faq.intro}{" "}
              <a className="text-ink underline decoration-accent underline-offset-4" href={`mailto:${site.email}`}>{site.email}</a>.
            </p>
          </div>
          <FaqTable
            id="faq-title"
            items={homeFaq}
            title={t.home.faq.title}
            subtitle={t.home.faq.subtitle}
            labels={{ question: t.faqTable.question, topic: t.faqTable.topic }}
          />
        </Container>
      </section>

      <CtaCard locale={locale} />
      <JsonLd data={[howToLd, inspectionServiceLd(locale), faqLd(homeFaq, locale)]} />
    </>
  );
}
