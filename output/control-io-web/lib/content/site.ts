/**
 * Marketing-site constants: navigation, entity facts and dates that several
 * pages (and the JSON-LD / llms.txt) must agree on.
 */
import { site } from "@/lib/tokens";
import { formatDate as formatDateLocale, localizePath, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";

export { site };

/** Shown as the visible "Last updated" date on GEO pages and used in dateModified. */
export const LAST_UPDATED = "2026-09-23";

export function formatDate(iso: string, locale: Locale = "en") {
  return formatDateLocale(iso, locale);
}

export const absoluteUrl = (path = "/") => new URL(path, site.url).toString();

/** One sentence that defines the company, reused wherever an entity statement is needed. */
export const entityDefinition =
  "control.io is an independent construction-supervision service that flies drones over multistorey building sites, reconstructs each flight as a 3D model, compares it with the official construction schedule, and issues evidence-grade PDF reports that show whether, where and by how much a project is late.";

export const defaultDescription =
  "Drone flights, 3D reconstruction and AI comparison against the construction schedule. control.io proves whether a multistorey project is on time, with evidence-grade PDF delay reports. Also: drone thermal inspection of solar farms.";

export function organizationLd(locale: Locale = "en") {
  const t = getDictionary(locale).site;
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${site.url}/#organization`,
    name: site.name,
    url: site.url,
    logo: `${site.url}/opengraph-image`,
    email: site.email,
    telephone: site.phone,
    description: t.entityDefinition,
    address: { "@type": "PostalAddress", addressLocality: "Yerevan", addressCountry: "AM" },
    areaServed: "Worldwide",
    knowsAbout: t.knowsAbout,
    knowsLanguage: ["en", "hy", "ru"],
  };
}

export function websiteLd(locale: Locale = "en") {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${site.url}/#website`,
    name: site.name,
    url: absoluteUrl(localizePath("/", locale)),
    publisher: { "@id": `${site.url}/#organization` },
    inLanguage: locale,
  };
}

/** `items[].href` must already be localized. */
export function breadcrumbLd(items: { name: string; href: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absoluteUrl(it.href) })),
  };
}

export function faqLd(items: { q: string; a: string }[], locale: Locale = "en") {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: locale,
    mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}
