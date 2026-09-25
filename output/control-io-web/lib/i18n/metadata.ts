import type { Metadata } from "next";
import { locales, localeMeta, localizePath, type Locale } from "./config";

/**
 * Shared social card (app/opengraph-image.tsx). The marketing root layout is
 * per-locale, so the file convention at app/ no longer attaches it
 * automatically; every page references it explicitly.
 */
export const ogImage = { url: "/opengraph-image", width: 1200, height: 630, alt: "control.io — independent drone supervision for multistorey construction" };

/** hreflang map for a site path (unprefixed, e.g. "/services"): en, hy, ru and x-default (= English). */
export function languageAlternates(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of locales) out[localeMeta[l].hreflang] = localizePath(path, l);
  out["x-default"] = localizePath(path, "en");
  return out;
}

/**
 * Per-page metadata with a canonical in the page's own locale, hreflang
 * alternates for every locale, and OpenGraph locale tags. `path` is the
 * unprefixed site path. `title` goes through the layout's title template
 * unless `absoluteTitle` is set.
 */
export function pageMetadata({
  locale,
  path,
  title,
  description,
  absoluteTitle = false,
  openGraph,
}: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  absoluteTitle?: boolean;
  openGraph?: Metadata["openGraph"];
}): Metadata {
  const url = localizePath(path, locale);
  const fullTitle = absoluteTitle ? title : `${title} — control.io`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph: {
      type: "website",
      siteName: "control.io",
      url,
      locale: localeMeta[locale].ogLocale,
      alternateLocale: locales.filter((l) => l !== locale).map((l) => localeMeta[l].ogLocale),
      title: fullTitle,
      description,
      images: [ogImage],
      ...openGraph,
    },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [ogImage.url] },
  };
}
