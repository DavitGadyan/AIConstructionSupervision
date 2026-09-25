/**
 * Locale configuration for the marketing site. English lives at the root
 * (`/services`), Armenian and Russian under a prefix (`/hy/services`,
 * `/ru/services`). Internally every marketing page sits under
 * `app/(marketing)/[locale]`; middleware rewrites unprefixed URLs to `/en/...`.
 *
 * Kept free of server-only imports so client components (the language
 * switcher, the nav) can use it.
 */
export const locales = ["en", "hy", "ru"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

/** Cookie that remembers an explicit language choice from the switcher. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (locales as readonly string[]).includes(v);
}

export const localeMeta: Record<
  Locale,
  { /** Name in its own language. */ label: string; short: string; ogLocale: string; dateLocale: string; hreflang: string }
> = {
  en: { label: "English", short: "EN", ogLocale: "en_US", dateLocale: "en-GB", hreflang: "en" },
  hy: { label: "Հայերեն", short: "HY", ogLocale: "hy_AM", dateLocale: "hy-AM", hreflang: "hy" },
  ru: { label: "Русский", short: "RU", ogLocale: "ru_RU", dateLocale: "ru-RU", hreflang: "ru" },
};

/**
 * Prefix a site-relative path with the locale. English stays unprefixed.
 * `localizePath("/services#x", "hy")` -> `/hy/services#x`; `("/", "ru")` -> `/ru`.
 * Paths outside the marketing site (/login, /app, /api) are returned as-is.
 */
export function localizePath(path: string, locale: Locale): string {
  if (!path.startsWith("/") || /^\/(login|logout|app|api|embed)(\/|$|\?|#)/.test(path)) return path;
  const { path: bare } = splitLocale(path);
  if (locale === defaultLocale) return bare;
  if (bare === "/") return `/${locale}`;
  if (bare.startsWith("/#") || bare.startsWith("/?")) return `/${locale}${bare.slice(1)}`;
  return `/${locale}${bare}`;
}

/** `/hy/industries/x` -> { locale: "hy", path: "/industries/x" }; unprefixed -> "en". */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  const m = pathname.match(/^\/(en|hy|ru)(?=\/|$|\?|#)(.*)$/);
  if (!m) return { locale: defaultLocale, path: pathname || "/" };
  const rest = m[2] || "/";
  return { locale: m[1] as Locale, path: rest.startsWith("/") ? rest : `/${rest}` };
}

/** Replace `{name}` placeholders. Dictionaries stay plain strings so they can cross to client components. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** Pick the plural form for a count. `forms` = { one, few?, many?, other }. */
export function plural(locale: Locale, n: number, forms: { one: string; few?: string; many?: string; other: string }): string {
  const cat = new Intl.PluralRules(localeMeta[locale].dateLocale).select(n);
  return (forms as Record<string, string | undefined>)[cat] ?? forms.other;
}

export function formatDate(iso: string, locale: Locale = defaultLocale): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(localeMeta[locale].dateLocale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
