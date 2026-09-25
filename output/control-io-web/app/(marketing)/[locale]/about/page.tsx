import type { Metadata } from "next";
import Image from "next/image";
import { TypeText } from "@/components/motion/TypeText";
import { Container, LastUpdated, PageHero, SectionHeading } from "@/components/marketing/Container";
import { CtaCard } from "@/components/marketing/HomeSections";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/ui/primitives";
import { getGuideAuthor } from "@/lib/content/guides";
import { getHome } from "@/lib/content/home";
import { absoluteUrl, breadcrumbLd, formatDate, LAST_UPDATED, site } from "@/lib/content/site";
import { fmt, getDictionary, localizePath } from "@/lib/i18n";
import { pageMetadata } from "@/lib/i18n/metadata";
import { readLocale, type LocaleParams } from "@/lib/i18n/params";

export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = getDictionary(locale).meta.about;
  return pageMetadata({ locale, path: "/about", title: t.title, description: t.description });
}

export default async function AboutPage({ params }: { params: LocaleParams }) {
  const locale = await readLocale(params);
  const d = getDictionary(locale);
  const t = d.aboutPage;
  const { values } = getHome(locale);
  const guideAuthor = getGuideAuthor(locale);
  const L = (p: string) => localizePath(p, locale);
  const crumbs = [
    { name: d.common.home, href: L("/") },
    { name: t.title, href: L("/about") },
  ];
  const aboutLd = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    inLanguage: locale,
    name: d.meta.about.title,
    url: absoluteUrl(L("/about")),
    about: { "@id": `${site.url}/#organization` },
    dateModified: LAST_UPDATED,
  };
  return (
    <>
      <PageHero crumbs={<Breadcrumbs items={crumbs} label={d.common.breadcrumb} />} title={t.title} sub={d.site.entityDefinition}>
        <div className="mt-8">
          <LastUpdated iso={LAST_UPDATED} label={formatDate(LAST_UPDATED, locale)} prefix={d.common.lastUpdated} />
        </div>
      </PageHero>

      <section aria-labelledby="why-title" className="section-pad">
        <Container className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading id="why-title" eyebrow={t.whyEyebrow} title={t.whyTitle} className="mb-6 md:mb-6" />
            <div className="grid gap-4 text-[17px] text-ink/85">
              <p>{t.whyP1}</p>
              <p>{t.whyP2}</p>
              <p>{t.whyP3}</p>
            </div>
          </div>
          <div className="glass p-2">
            <Image
              src="/images/marketing/about-team.webp"
              alt={t.imageAlt}
              width={1600}
              height={1000}
              sizes="(min-width:1024px) 600px, 100vw"
              className="aspect-[16/10] w-full rounded-[22px] object-cover"
            />
          </div>
        </Container>
      </section>

      <section aria-labelledby="principles-title" className="px-3 md:px-6">
        <div className="stage mx-auto max-w-[1480px] section-pad">
          <Container>
            <SectionHeading id="principles-title" eyebrow={t.principlesEyebrow} title={t.principlesTitle} />
            <ul className="grid gap-4 md:grid-cols-3 hy:md:max-lg:grid-cols-1 ru:md:max-lg:grid-cols-1">
              {values.map((v, k) => (
                <li key={v.title} className="inner p-6 md:p-8">
                  <span className="display-xl tabular text-[56px] text-accent">0{k + 1}</span>
                  <TypeText as="h3" className="mt-4 font-display text-[24px] font-bold" delay={k * 120} maxDuration={900}>
                    {v.title}
                  </TypeText>
                  <p className="mt-2 text-[16px] text-muted">{v.text}</p>
                </li>
              ))}
            </ul>
          </Container>
        </div>
      </section>

      <section aria-labelledby="team-title" className="section-pad">
        <Container className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
          <TypeText as="h2" id="team-title" className="font-bold tracking-tight" style={{ fontSize: "var(--size-h1)" }}>
            {t.teamTitle}
          </TypeText>
          <div className="glass p-6 md:p-8">
            <p className="font-display text-[20px] font-bold">{guideAuthor.name}</p>
            <p className="mt-2 text-[16px] text-muted">
              {guideAuthor.description} {fmt(t.teamText, { address: d.site.address })}
            </p>
          </div>
        </Container>
      </section>

      <CtaCard locale={locale} />
      <JsonLd data={[breadcrumbLd(crumbs), aboutLd]} />
    </>
  );
}
