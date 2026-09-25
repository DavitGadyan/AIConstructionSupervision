import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TypeText } from "@/components/motion/TypeText";
import { Container, LastUpdated, PageHero, SectionHeading } from "@/components/marketing/Container";
import { FaqTable } from "@/components/marketing/FaqTable";
import { CtaCard } from "@/components/marketing/HomeSections";
import { Icon } from "@/components/marketing/icons";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/ui/primitives";
import { getIndustries, getIndustry, industries } from "@/lib/content/industries";
import { breadcrumbLd, faqLd, formatDate, LAST_UPDATED } from "@/lib/content/site";
import { fmt, getDictionary, isLocale, localizePath, type Locale } from "@/lib/i18n";
import { pageMetadata } from "@/lib/i18n/metadata";

type Params = Promise<{ locale: string; slug: string }>;

async function read(params: Params): Promise<{ locale: Locale; slug: string }> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  return { locale, slug };
}

export const dynamicParams = false;

export function generateStaticParams() {
  return industries.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await read(params);
  const ind = getIndustry(slug, locale);
  if (!ind) return {};
  return pageMetadata({ locale, path: `/industries/${ind.slug}`, title: ind.metaTitle, description: ind.metaDescription });
}

export default async function IndustryPage({ params }: { params: Params }) {
  const { locale, slug } = await read(params);
  const ind = getIndustry(slug, locale);
  if (!ind) notFound();
  const d = getDictionary(locale);
  const t = d.industryPage;
  const L = (p: string) => localizePath(p, locale);

  const crumbs = [
    { name: d.common.home, href: L("/") },
    { name: d.industriesPage.title, href: L("/industries") },
    { name: ind.name, href: L(`/industries/${ind.slug}`) },
  ];
  const others = getIndustries(locale).filter((i) => i.slug !== ind.slug);

  return (
    <>
      <PageHero
        crumbs={<Breadcrumbs items={crumbs} label={d.common.breadcrumb} />}
        title={ind.name}
        size="lg"
        sub={ind.intro}
        aside={
          <div className="glass p-2">
            <Image
              src={ind.image.src}
              alt={ind.image.alt}
              width={800}
              height={500}
              sizes="(min-width:1024px) 480px, 100vw"
              priority
              className="aspect-[16/10] w-full rounded-[22px] object-cover"
            />
          </div>
        }
      >
        <div className="mt-8">
          <LastUpdated iso={LAST_UPDATED} label={formatDate(LAST_UPDATED, locale)} prefix={d.common.lastUpdated} />
        </div>
      </PageHero>

      <section aria-labelledby="problems-title" className="section-pad">
        <Container>
          <SectionHeading
            id="problems-title"
            eyebrow={t.eyebrow}
            title={fmt(t.problemsTitle, { audience: ind.audience, name: ind.name })}
            intro={ind.short}
          />
          <ol className="grid gap-3">
            {ind.problems.map((p, k) => (
              <li key={p.problem} className="grid gap-3 md:grid-cols-2">
                <div className="glass flex gap-4 p-5 md:p-6">
                  <span className="tabular text-[13px] text-muted">0{k + 1}</span>
                  <div>
                    <p className="eyebrow mb-1">{t.problem}</p>
                    <p className="text-[17px] font-medium">{p.problem}</p>
                  </div>
                </div>
                <div className="inner flex gap-4 border-l-4 border-accent p-5 md:p-6">
                  <div>
                    <p className="eyebrow mb-1 text-accent-deep">{t.withUs}</p>
                    <p className="text-[17px]">{p.solution}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section aria-labelledby="deliverables-title" className="px-3 md:px-6">
        <div className="stage mx-auto max-w-[1480px] section-pad">
          <Container className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="eyebrow mb-3">{t.deliverablesEyebrow}</p>
              <TypeText as="h2" id="deliverables-title" className="font-bold tracking-tight" style={{ fontSize: "var(--size-h1)" }}>
                {fmt(t.deliverablesTitle, { audience: ind.audience, name: ind.name })}
              </TypeText>
            </div>
            <ul className="grid gap-2.5">
              {ind.deliverables.map((d) => (
                <li key={d} className="inner flex items-center gap-3 p-4 text-[16px]">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-white">
                    <Icon name="check" className="size-3.5" />
                  </span>
                  {d}
                </li>
              ))}
            </ul>
          </Container>
        </div>
      </section>

      <section aria-labelledby="ind-faq-title" className="section-pad">
        <Container>
          <FaqTable
            id="ind-faq-title"
            items={ind.faq}
            title={fmt(t.faqTitle, { name: ind.name })}
            labels={{ question: d.faqTable.question, topic: d.faqTable.topic }}
          />
        </Container>
      </section>

      <section aria-labelledby="other-title">
        <Container>
          <h2 id="other-title" className="eyebrow mb-4">{t.others}</h2>
          <ul className="flex flex-wrap gap-2">
            {others.map((o) => (
              <li key={o.slug}>
                <Link href={L(`/industries/${o.slug}`)} className="inner inline-flex items-center gap-2 px-4 py-2.5 text-[15px] transition hover:-translate-y-0.5">
                  <Icon name={o.icon} className="size-[18px] text-accent-deep" />
                  {o.name}
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <CtaCard locale={locale} />
      <JsonLd data={[breadcrumbLd(crumbs), faqLd(ind.faq, locale)]} />
    </>
  );
}
