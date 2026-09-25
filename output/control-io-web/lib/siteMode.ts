/**
 * The marketing site also ships as a static export (GitHub Pages, scripts/build-pages.sh) with no
 * server: no login, dashboard or API. Links into the app then go to NEXT_PUBLIC_APP_URL when a hosted
 * app exists, and otherwise to the contact page (an enquiry is the next step either way).
 */
export const STATIC_SITE = process.env.NEXT_PUBLIC_STATIC_SITE === "1";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

/** Where "Sign in" / "Get started" / "Open flights" lead; null means there is no app to sign in to. */
export const SIGN_IN_HREF: string | null = APP_URL ? `${APP_URL}/login` : STATIC_SITE ? null : "/login";
