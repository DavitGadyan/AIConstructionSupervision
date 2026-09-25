import { fontVariables } from "@/lib/fonts";

/**
 * Runs in <head> before the first paint: `html.js` tells CSS that JavaScript is
 * on, so typed headings (components/motion/TypeText) may start hidden. Without
 * JS the class never appears and every heading is plain, visible text.
 */
const JS_FLAG = "document.documentElement.classList.add('js')";

/**
 * The <html>/<body> shell shared by every root layout. The marketing site has
 * its own root layout per locale (app/(marketing)/[locale]/layout.tsx) so that
 * <html lang> is right in the static HTML; /app, /login and /embed use this
 * with lang="en".
 *
 * suppressHydrationWarning: the head script adds a class React did not render.
 */
export function RootDocument({ lang, children }: { lang: string; children: React.ReactNode }) {
  return (
    <html lang={lang} className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: JS_FLAG }} />
      </head>
      <body>
        <noscript>
          <style>{"[data-reveal]{opacity:1!important;transform:none!important}"}</style>
        </noscript>
        {children}
      </body>
    </html>
  );
}
