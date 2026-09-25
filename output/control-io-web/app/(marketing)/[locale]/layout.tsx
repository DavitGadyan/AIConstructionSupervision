import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "../../globals.css";
import { RootDocument } from "@/components/RootDocument";
import { Footer } from "@/components/marketing/Footer";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Nav } from "@/components/marketing/Nav";
import { getIndustries } from "@/lib/content/industries";
import { organizationLd, websiteLd } from "@/lib/content/site";
import { getDictionary, isLocale, locales, localeMeta, type Locale } from "@/lib/i18n";
import { ogImage } from "@/lib/i18n/metadata";
import { baseMetadata, baseViewport } from "@/lib/rootMetadata";

/**
 * Root layout of the marketing site, one per locale, so the prerendered HTML
 * carries the right <html lang>. English is served at the unprefixed URLs via
 * a middleware rewrite to /en/...; hy and ru live at /hy/... and /ru/....
 *
 * The nav floats over the top of the page so that on the home page it sits
 * inside the hero stage, exactly as in ORDI screen 1.
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const viewport = baseViewport;

type Params = Promise<{ locale: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "en";
  const t = getDictionary(locale);
  return {
    ...baseMetadata,
    title: { default: t.meta.siteTitle, template: t.meta.titleTemplate },
    description: t.site.defaultDescription,
    openGraph: {
      type: "website",
      siteName: "control.io",
      url: locale === "en" ? "/" : `/${locale}`,
      locale: localeMeta[locale].ogLocale,
      title: t.meta.siteTitle,
      description: t.site.defaultDescription,
      images: [ogImage],
    },
    twitter: { card: "summary_large_image", title: t.meta.siteTitle, description: t.site.defaultDescription, images: [ogImage.url] },
  };
}

export default async function MarketingLayout({ children, params }: { children: React.ReactNode; params: Params }) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw;
  const t = getDictionary(locale);
  const industries = getIndustries(locale).map((i) => ({ slug: i.slug, name: i.name, icon: i.icon }));

  return (
    <RootDocument lang={locale}>
      <div className="relative min-h-dvh overflow-x-clip bg-page">
        <a
          href="#main"
          className="sr-only z-50 rounded-[var(--radius-btn)] bg-ink px-4 py-2 text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
        >
          {t.common.skipToContent}
        </a>
        <header className="absolute inset-x-0 top-0 z-40 px-3 pt-3 md:px-6 md:pt-6">
          <div className="mx-auto max-w-[1480px] px-4 md:px-8 xl:px-[1.4%]">
            <Nav locale={locale} t={t.nav} lang={t.language} industries={industries} />
          </div>
        </header>
        <main id="main">{children}</main>
        <Footer locale={locale} />
        <JsonLd data={[organizationLd(locale), websiteLd(locale)]} />
      </div>
    </RootDocument>
  );
}
