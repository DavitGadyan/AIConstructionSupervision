"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PageHero } from "@/components/marketing/Container";
import { Button } from "@/components/ui/primitives";
import { getDictionary } from "@/lib/i18n";
import { localizePath, splitLocale } from "@/lib/i18n/config";

/* not-found.tsx gets no params, so the locale comes from the URL. */
export default function NotFound() {
  const { locale } = splitLocale(usePathname() ?? "/");
  const t = getDictionary(locale);
  return (
    <>
      <title>{`${t.notFound.title} — control.io`}</title>
      <meta name="robots" content="noindex" />
      <PageHero
        crumbs={
          <Link href={localizePath("/", locale)} className="text-[13px] text-muted hover:text-ink">
            {t.common.home}
          </Link>
        }
        title="404"
        sub={t.notFound.text}
      >
        <div className="mt-8">
          <Button href={localizePath("/", locale)} variant="dark">
            {t.notFound.back}
          </Button>
        </div>
      </PageHero>
    </>
  );
}
