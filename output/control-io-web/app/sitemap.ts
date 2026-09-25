export const dynamic = "force-static";
import type { MetadataRoute } from "next";
import { guides } from "@/lib/content/guides";
import { industries } from "@/lib/content/industries";
import { absoluteUrl, LAST_UPDATED } from "@/lib/content/site";
import { locales, localizePath } from "@/lib/i18n/config";
import { languageAlternates } from "@/lib/i18n/metadata";

/** Every marketing page in every locale, each entry carrying its hreflang alternates. */
export default function sitemap(): MetadataRoute.Sitemap {
  const d = new Date(LAST_UPDATED);
  const pages: { path: string; priority: number; changeFrequency: "weekly" | "monthly"; lastModified: Date }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly", lastModified: d },
    { path: "/services", priority: 0.9, changeFrequency: "monthly", lastModified: d },
    { path: "/industries", priority: 0.8, changeFrequency: "monthly", lastModified: d },
    ...industries.map((i) => ({ path: `/industries/${i.slug}`, priority: 0.8, changeFrequency: "monthly" as const, lastModified: d })),
    { path: "/pricing", priority: 0.8, changeFrequency: "monthly", lastModified: d },
    { path: "/resources", priority: 0.7, changeFrequency: "weekly", lastModified: d },
    ...guides.map((g) => ({ path: `/resources/${g.slug}`, priority: 0.7, changeFrequency: "monthly" as const, lastModified: new Date(g.dateModified) })),
    { path: "/about", priority: 0.5, changeFrequency: "monthly", lastModified: d },
    { path: "/contact", priority: 0.6, changeFrequency: "monthly", lastModified: d },
  ];
  return pages.flatMap((p) => {
    const languages = Object.fromEntries(Object.entries(languageAlternates(p.path)).map(([k, v]) => [k, absoluteUrl(v)]));
    return locales.map((l) => ({
      url: absoluteUrl(localizePath(p.path, l)),
      lastModified: p.lastModified,
      changeFrequency: p.changeFrequency,
      // English stays the primary version of each page.
      priority: l === "en" ? p.priority : Math.round(p.priority * 0.9 * 10) / 10,
      alternates: { languages },
    }));
  });
}
