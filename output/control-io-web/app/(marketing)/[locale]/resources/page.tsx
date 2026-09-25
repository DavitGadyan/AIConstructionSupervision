import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Container, PageHero } from "@/components/marketing/Container";
import { JsonLd } from "@/components/marketing/JsonLd";
import { ArrowIcon, Breadcrumbs } from "@/components/ui/primitives";
import { getGuides } from "@/lib/content/guides";
import { absoluteUrl, breadcrumbLd, formatDate } from "@/lib/content/site";
import { fmt, getDictionary, localizePath } from "@/lib/i18n";
import { pageMetadata } from "@/lib/i18n/metadata";
import { readLocale, type LocaleParams } from "@/lib/i18n/params";

export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  const locale = await readLocale(params);
  const t = getDictionary(locale).meta.resources;
  return pageMetadata({ locale, path: "/resources", title: t.title, description: t.description });
}

export default async function ResourcesPage({ params }: { params: LocaleParams }) {
  const locale = await readLocale(params);
  const d = getDictionary(locale);
  const t = d.resourcesPage;
  const guides = getGuides(locale);
  const L = (p: string) => localizePath(p, locale);
  const crumbs = [
    { name: d.common.home, href: L("/") },
    { name: t.title, href: L("/resources") },
  ];
  const listLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: guides.map((g, i) => ({ "@type": "ListItem", position: i + 1, url: absoluteUrl(L(`/resources/${g.slug}`)), name: g.title })),
  };
  return (
    <>
      <PageHero
        crumbs={<Breadcrumbs items={crumbs} label={d.common.breadcrumb} />}
        title={t.title}
        sub={t.sub}
      />
      <section aria-labelledby="guides-title" className="section-pad">
        <Container>
          <h2 id="guides-title" className="sr-only">{t.guides}</h2>
          <ul className="grid gap-4 lg:grid-cols-3">
            {guides.map((g) => (
              <li key={g.slug}>
                <article className="glass group relative flex h-full flex-col p-2">
                  <Image
                    src={g.image.src}
                    alt={g.image.alt}
                    width={800}
                    height={500}
                    sizes="(min-width:1024px) 420px, 100vw"
                    className="aspect-[16/10] w-full rounded-[22px] object-cover"
                  />
                  <div className="flex flex-1 flex-col p-4">
                    <p className="tabular text-[13px] text-muted">
                      <time dateTime={g.dateModified}>{fmt(t.updated, { date: formatDate(g.dateModified, locale) })}</time> ·{" "}
                      {fmt(d.common.minRead, { n: g.readingMinutes })}
                    </p>
                    <h3 className="mt-2 font-display text-[22px] font-semibold leading-tight">
                      <Link href={L(`/resources/${g.slug}`)} className="after:absolute after:inset-0 after:rounded-[var(--radius-card)]">
                        {g.title}
                      </Link>
                    </h3>
                    <p className="mt-2 flex-1 text-[15px] text-muted">{g.description}</p>
                    <span className="mt-5 inline-flex items-center gap-2 text-[15px] font-medium text-accent-deep" aria-hidden>
                      {t.readGuide} <ArrowIcon />
                    </span>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </Container>
      </section>
      <JsonLd data={[breadcrumbLd(crumbs), listLd]} />
    </>
  );
}
