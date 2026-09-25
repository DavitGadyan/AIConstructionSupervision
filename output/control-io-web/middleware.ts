import { NextResponse, type NextRequest } from "next/server";
import { LOCALE_COOKIE, isLocale, type Locale } from "@/lib/i18n/config";

/**
 * - CORS for the API so the Expo app's web build can call it (PATCH for /api/company).
 * - Bounces signed-out visitors away from /app.
 * - Marketing i18n: English is served at unprefixed URLs by rewriting to the
 *   internal /en/... route (not a redirect); /en/... redirects to the
 *   unprefixed URL; /hy/... and /ru/... pass straight through.
 * - A first visit to "/" is redirected to the visitor's Accept-Language
 *   locale (hy/ru) only when there is no NEXT_LOCALE cookie and the request
 *   is not from a crawler, so "/" stays English for search engines.
 */

/** Top-level paths that are not part of the localized marketing site. */
const NON_MARKETING = /^\/(api|app|login|logout|embed|_next|_vercel|opengraph-image|twitter-image|icon|apple-icon|manifest|sitemap|robots)(\/|$|\.|-)/;

const BOT_UA =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora link preview|outbrain|pinterest|vkshare|w3c_validator|whatsapp|telegram|discord|slack|linkedin|skype|google-|headless|lighthouse|chrome-lighthouse|gptbot|chatgpt|claude|anthropic|perplexity|ccbot|bytespider|petalbot|yandex|baidu|duckduck|applebot|semrush|ahrefs|mj12/i;

/** Best hy/ru match from Accept-Language by q-value; null means English (or nothing better). */
function preferredLocale(header: string | null): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().toLowerCase().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { lang: tag.split("-")[0], q: q ? Number(q.slice(2)) || 0 : 1 };
    })
    .filter((x) => x.lang && x.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const { lang } of ranked) {
    if (lang === "en") return null;
    if (lang === "hy" || lang === "ru") return lang;
  }
  return null;
}

function marketing(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // /en/... -> canonical unprefixed URL.
  const en = pathname.match(/^\/en(\/.*)?$/);
  if (en) {
    const url = req.nextUrl.clone();
    url.pathname = en[1] || "/";
    return NextResponse.redirect(url, 308);
  }

  // /hy/..., /ru/...: served by the [locale] route as-is.
  const first = pathname.split("/")[1];
  if (isLocale(first)) return NextResponse.next();

  if (pathname === "/") {
    const cookie = req.cookies.get(LOCALE_COOKIE)?.value;
    const ua = req.headers.get("user-agent") ?? "";
    let target: Locale | null = null;
    if (isLocale(cookie)) target = cookie === "en" ? null : cookie;
    else if (ua && !BOT_UA.test(ua)) target = preferredLocale(req.headers.get("accept-language"));
    if (target) {
      const url = req.nextUrl.clone();
      url.pathname = `/${target}`;
      const res = NextResponse.redirect(url, 307);
      res.headers.set("Vary", "Cookie, Accept-Language, User-Agent");
      res.headers.set("Cache-Control", "private, no-store");
      return res;
    }
  }

  // Unprefixed -> internal English route. Unknown paths land on the
  // localized 404 inside the marketing layout.
  const url = req.nextUrl.clone();
  url.pathname = `/en${pathname === "/" ? "" : pathname}`;
  url.search = search;
  const res = NextResponse.rewrite(url);
  if (pathname === "/") res.headers.set("Vary", "Cookie, Accept-Language");
  return res;
}

const LOCALHOST_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

/**
 * CORS for the API. Native apps send no Origin and need none. Browsers get
 * credentialed CORS only from allowed origins: the site itself
 * (NEXT_PUBLIC_SITE_URL, or the request's own origin), CORS_ORIGINS
 * (comma-separated, e.g. the hosted Expo web build) and - outside production
 * only - any localhost port (Expo web dev servers). Any other site gets no
 * CORS headers, so browsers refuse to share the response with it.
 */
function allowedOrigin(req: NextRequest): string | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  if (origin === req.nextUrl.origin) return origin;
  try {
    if (process.env.NEXT_PUBLIC_SITE_URL && new URL(process.env.NEXT_PUBLIC_SITE_URL).origin === origin) return origin;
  } catch {
    /* malformed NEXT_PUBLIC_SITE_URL: ignore */
  }
  const listed = (process.env.CORS_ORIGINS ?? "").split(",").map((o) => o.trim().replace(/\/$/, "")).filter(Boolean);
  if (listed.includes(origin)) return origin;
  if (process.env.NODE_ENV !== "production" && LOCALHOST_ORIGIN.test(origin)) return origin;
  return null;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/api/")) {
    const origin = allowedOrigin(req);
    const headers: Record<string, string> = { Vary: "Origin" };
    if (origin) {
      headers["Access-Control-Allow-Origin"] = origin;
      headers["Access-Control-Allow-Methods"] = "GET,POST,PATCH,OPTIONS";
      headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
      headers["Access-Control-Allow-Credentials"] = "true";
    }
    if (req.method === "OPTIONS") {
      // A preflight from a site that is not allowed is refused outright.
      const refused = !origin && req.headers.get("origin") != null;
      return new NextResponse(null, { status: refused ? 403 : 204, headers });
    }
    const res = NextResponse.next();
    Object.entries(headers).forEach(([k, v]) => res.headers.set(k, v));
    return res;
  }
  if ((pathname === "/app" || pathname.startsWith("/app/")) && !req.cookies.get("cio_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (NON_MARKETING.test(pathname)) return NextResponse.next();
  return marketing(req);
}

export const config = {
  matcher: [
    "/api/:path*",
    "/app/:path*",
    // Everything else except Next internals and files with an extension
    // (images, llms.txt, sitemap.xml, robots.txt, icon.svg, ...).
    "/((?!_next/|api/|app/|.*\\.[a-zA-Z0-9]+$).*)",
  ],
};
