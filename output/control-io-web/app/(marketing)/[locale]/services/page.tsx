import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import { TypeText } from "@/components/motion/TypeText";
import { Container, LastUpdated, PageHero } from "@/components/marketing/Container";
import { CtaCard } from "@/components/marketing/HomeSections";
import { Icon } from "@/components/marketing/icons";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs, cx } from "@/components/ui/primitives";
import { getServices } from "@/lib/content/services";
import { absoluteUrl, breadcrumbLd, formatDate, LAST_UPDATED } from "@/lib/content/site";
import { fmt, getDictionary, localizePath } from "@/lib/i18n";
import { pageMetadata } from "@/lib/i18n/metadata";
import { readLocale, type LocaleParams } from "@/lib/i18n/params";

export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = getDictionary(locale).meta.services;
  return pageMetadata({ locale, path: "/services", title: t.title, description: t.description });
}

export default async function ServicesPage({ params }: { params: LocaleParams }) {
  const locale = await readLocale(params);
  const t = getDictionary(locale);
  const services = getServices(locale);
  const L = (p: string) => localizePath(p, locale);
  const crumbs = [
    { name: t.common.home, href: L("/") },
    { name: t.servicesPage.title, href: L("/services") },
  ];

  const serviceLd = services.map((s) => ({
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": absoluteUrl(L(`/services#${s.id}`)),
    name: s.title,
    description: s.description,
    url: absoluteUrl(L(`/services#${s.id}`)),
    serviceType: s.title,
    provider: { "@id": absoluteUrl("/#organization") },
    areaServed: "Worldwide",
    availableLanguage: ["en", "hy", "ru"],
    image: absoluteUrl(s.image.src),
  }));

  return (
    <>
      <PageHero
        crumbs={<Breadcrumbs items={crumbs} label={t.common.breadcrumb} />}
        title={t.servicesPage.title}
        sub={t.servicesPage.sub}
        aside={
          <nav aria-label={t.servicesPage.tocLabel} className="glass min-w-0 p-3">
            <ol className="grid grid-cols-[minmax(0,1fr)] gap-1.5">
              {services.map((s, k) => (
                <li key={s.id}>
                  <Link href={`#${s.id}`} className="inner flex items-center gap-3 px-3 py-2.5 text-[14px] transition hover:-translate-y-0.5">
                    <span className="tabular text-muted">0{k + 1}</span>
                    <span className="truncate font-medium">{s.title}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
        }
      >
        <div className="mt-8">
          <LastUpdated iso={LAST_UPDATED} label={formatDate(LAST_UPDATED, locale)} prefix={t.common.lastUpdated} />
        </div>
      </PageHero>

      <Container className="section-pad grid gap-16 md:gap-24">
        {services.map((s, k) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-8">
            <Reveal className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
              <div className={cx(k % 2 === 1 && "lg:order-2")}>
                <p className="eyebrow tabular">{fmt(t.servicesPage.serviceN, { n: `0${k + 1}` })}</p>
                <TypeText as="h2" id={`${s.id}-title`} className="mt-3 font-bold tracking-tight" style={{ fontSize: "var(--size-h2)" }}>
                  {s.title}
                </TypeText>
                <p className="mt-4 text-[17px] text-muted">{s.description}</p>
                <ul className="mt-6 grid gap-2.5">
                  {s.benefits.map((b) => (
                    <li key={b.title} className="inner flex items-start gap-3 p-4">
                      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-accent text-white">
                        <Icon name="check" className="size-3.5" />
                      </span>
                      <span>
                        <strong className="block font-medium">{b.title}</strong>
                        <span className="text-[15px] text-muted">{b.text}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="glass p-2">
                <Image
                  src={s.image.src}
                  alt={s.image.alt}
                  width={1600}
                  height={1000}
                  sizes="(min-width:1024px) 600px, 100vw"
                  className="aspect-[16/10] w-full rounded-[22px] object-cover"
                />
              </div>
            </Reveal>
          </section>
        ))}
      </Container>

      <CtaCard locale={locale} title={t.cta.servicesTitle} subtitle={t.cta.servicesSubtitle} />
      <JsonLd data={[breadcrumbLd(crumbs), ...serviceLd]} />
    </>
  );
}
