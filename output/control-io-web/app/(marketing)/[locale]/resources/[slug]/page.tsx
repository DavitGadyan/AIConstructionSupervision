import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, PageHero } from "@/components/marketing/Container";
import { CtaCard } from "@/components/marketing/HomeSections";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/ui/primitives";
import { getGuide, getGuideAuthor, guides } from "@/lib/content/guides";
import { absoluteUrl, breadcrumbLd, formatDate } from "@/lib/content/site";
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
  return guides.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await read(params);
  const g = getGuide(slug, locale);
  if (!g) return {};
  return {
    ...pageMetadata({
      locale,
      path: `/resources/${g.slug}`,
      title: g.title,
      description: g.description,
      openGraph: { type: "article", publishedTime: g.datePublished, modifiedTime: g.dateModified },
    }),
    authors: [{ name: getGuideAuthor(locale).name }],
  };
}

// Unicode-aware so Armenian and Cyrillic headings still get stable anchors;
// for English it produces exactly the same ids as before.
const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/(^-|-$)/g, "");

export default async function GuidePage({ params }: { params: Params }) {
  const { locale, slug } = await read(params);
  const g = getGuide(slug, locale);
  if (!g) notFound();
  const d = getDictionary(locale);
  const t = d.guidePage;
  const guideAuthor = getGuideAuthor(locale);
  const L = (p: string) => localizePath(p, locale);

  const crumbs = [
    { name: d.common.home, href: L("/") },
    { name: d.resourcesPage.title, href: L("/resources") },
    { name: g.title, href: L(`/resources/${g.slug}`) },
  ];

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    inLanguage: locale,
    headline: g.title,
    description: g.description,
    image: absoluteUrl(g.image.src),
    datePublished: g.datePublished,
    dateModified: g.dateModified,
    mainEntityOfPage: absoluteUrl(L(`/resources/${g.slug}`)),
    author: { "@type": "Organization", name: guideAuthor.name, description: guideAuthor.description, url: absoluteUrl(L("/about")) },
    publisher: { "@id": absoluteUrl("/#organization") },
    about: g.definition.term,
  };

  return (
    <>
      <PageHero crumbs={<Breadcrumbs items={crumbs} label={d.common.breadcrumb} />} title={g.title} size="md">
        <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-2 text-[14px] text-muted">
          <div className="flex gap-2">
            <dt>{t.by}</dt>
            <dd>
              <Link href={L("/about")} className="text-ink underline decoration-accent underline-offset-4">{guideAuthor.name}</Link>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt>{t.published}</dt>
            <dd><time dateTime={g.datePublished}>{formatDate(g.datePublished, locale)}</time></dd>
          </div>
          <div className="flex gap-2">
            <dt>{t.lastUpdated}</dt>
            <dd><time dateTime={g.dateModified}>{formatDate(g.dateModified, locale)}</time></dd>
          </div>
          <div className="flex gap-2">
            <dt className="sr-only">{t.readingTime}</dt>
            <dd>{fmt(d.common.minRead, { n: g.readingMinutes })}</dd>
          </div>
        </dl>
      </PageHero>

      <Container className="section-pad grid gap-10 lg:grid-cols-[260px_1fr] lg:gap-16">
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <nav aria-label={t.onThisPage} className="glass p-3">
            <p className="eyebrow px-2 pb-2 pt-1">{t.onThisPage}</p>
            <ol className="grid gap-1">
              <li><a href="#tldr" className="block rounded-[10px] px-2 py-1.5 text-[14px] hover:bg-surface">{t.shortAnswer}</a></li>
              {g.sections.map((s) => (
                <li key={s.h2}>
                  <a href={`#${slugify(s.h2)}`} className="block rounded-[10px] px-2 py-1.5 text-[14px] hover:bg-surface">{s.h2}</a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        <article className="min-w-0 max-w-[760px]">
          <section id="tldr" aria-labelledby="tldr-title" className="inner scroll-mt-8 border-l-4 border-accent p-6 md:p-8">
            <h2 id="tldr-title" className="eyebrow text-accent-deep">{t.shortAnswer}</h2>
            <p className="mt-3 font-display text-[19px] font-medium leading-snug md:text-[22px]">{g.tldr}</p>
          </section>

          <aside aria-label={t.definition} className="glass mt-6 p-6">
            <dl>
              <dt className="font-display text-[18px] font-bold">{g.definition.term}</dt>
              <dd className="mt-2 text-[16px] text-muted">{g.definition.text}</dd>
            </dl>
          </aside>

          <div className="relative mt-8 overflow-hidden rounded-[var(--radius-card)]">
            <Image src={g.image.src} alt={g.image.alt} width={1600} height={1000} sizes="(min-width:1024px) 760px, 100vw" priority className="aspect-[16/10] w-full object-cover" />
          </div>

          {g.sections.map((s) => (
            <section key={s.h2} aria-labelledby={slugify(s.h2)} className="mt-12">
              <h2 id={slugify(s.h2)} className="scroll-mt-8 font-bold tracking-tight" style={{ fontSize: "var(--size-h2)" }}>
                {s.h2}
              </h2>
              {s.paragraphs.map((p) => (
                <p key={p.slice(0, 40)} className="mt-4 text-[17px] leading-[1.7] text-ink/85">{p}</p>
              ))}
              {s.list && (
                <ul className="mt-4 grid gap-2">
                  {s.list.map((li) => (
                    <li key={li} className="inner flex gap-3 px-4 py-3 text-[16px]">
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                      {li}
                    </li>
                  ))}
                </ul>
              )}
              {s.table && (
                <div className="inner mt-5 overflow-x-auto p-2">
                  <table className="w-full min-w-[520px] text-left text-[15px]">
                    <thead>
                      <tr>
                        {s.table.head.map((h) => (
                          <th key={h} scope="col" className="px-3 py-2.5 font-medium text-muted">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {s.table.rows.map((r) => (
                        <tr key={r[0]} className="border-t border-line">
                          {r.map((c, k) =>
                            k === 0 ? (
                              <th key={k} scope="row" className="px-3 py-2.5 font-medium">{c}</th>
                            ) : (
                              <td key={k} className="px-3 py-2.5 text-ink/85">{c}</td>
                            ),
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}

          {g.sources && (
            <section aria-labelledby="sources-title" className="mt-12 border-t border-line pt-6">
              <h2 id="sources-title" className="eyebrow">{t.sources}</h2>
              <ol className="mt-3 grid list-decimal gap-2 pl-5 text-[14px] text-muted">
                {g.sources.map((s) => (
                  <li key={s.label}>
                    <cite className="not-italic text-ink">{s.label}</cite> {s.note}
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section aria-labelledby="author-title" className="glass mt-12 p-6">
            <h2 id="author-title" className="eyebrow">{t.aboutAuthor}</h2>
            <p className="mt-2 font-display text-[18px] font-bold">{guideAuthor.name}</p>
            <p className="mt-1 text-[15px] text-muted">{guideAuthor.description}</p>
          </section>
        </article>
      </Container>

      <CtaCard locale={locale} />
      <JsonLd data={[breadcrumbLd(crumbs), articleLd]} />
    </>
  );
}
