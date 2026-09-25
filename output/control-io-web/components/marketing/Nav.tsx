"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Logo, cx } from "@/components/ui/primitives";
import type { IndustryIcon } from "@/lib/content/industries";
import type { Dictionary } from "@/lib/i18n";
import { localizePath, splitLocale, type Locale } from "@/lib/i18n/config";
import { Icon } from "./icons";
import { LanguageList, LanguageSwitcher } from "./LanguageSwitcher";
import { SIGN_IN_HREF } from "@/lib/siteMode";

/**
 * ORDI TopNav: wordmark left, four text links, dark pill CTA. Sits over the top
 * of the hero stage on the home page and over the page ground elsewhere.
 */
export function Nav({
  locale,
  t,
  lang,
  industries,
}: {
  locale: Locale;
  t: Dictionary["nav"];
  lang: Dictionary["language"];
  industries: { slug: string; name: string; icon: IndustryIcon }[];
}) {
  const pathname = usePathname();
  const current = splitLocale(pathname ?? "/").path;
  const L = (p: string) => localizePath(p, locale);
  const [menuOpen, setMenuOpen] = useState(false);
  const [indOpen, setIndOpen] = useState(false);
  const indRef = useRef<HTMLDivElement>(null);
  const indId = useId();
  const menuId = useId();

  // Close everything on route change.
  useEffect(() => {
    setMenuOpen(false);
    setIndOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIndOpen(false);
        setMenuOpen(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (indRef.current && !indRef.current.contains(e.target as Node)) setIndOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  const linkCls = (href: string) =>
    cx(
      "relative text-[16px] text-ink transition-colors hover:text-accent-deep after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:origin-left after:scale-x-0 after:bg-current after:transition-transform hover:after:scale-x-100",
      current.startsWith(href) && "after:scale-x-100",
    );

  return (
    <nav aria-label={t.label} className="relative flex h-[64px] items-center justify-between gap-4 md:h-[84px]">
      <Link href={L("/")} aria-label={t.homeLabel} className="rounded-[10px]">
        <Logo className="text-[22px] md:text-[26px]" />
      </Link>

      <div className="ml-auto mr-6 hidden items-center gap-10 lg:flex xl:mr-[60px] xl:gap-[60px]">
        <Link href={L("/services")} className={linkCls("/services")}>{t.services}</Link>

        <div ref={indRef} className="relative">
          <button
            type="button"
            aria-expanded={indOpen}
            aria-controls={indId}
            onClick={() => setIndOpen((v) => !v)}
            className={cx(linkCls("/industries"), "inline-flex items-center gap-1")}
          >
            {t.industries}
            <Icon name="chevron" className={cx("size-4 transition-transform", indOpen && "rotate-180")} />
          </button>
          <div
            id={indId}
            hidden={!indOpen}
            className="glass absolute left-1/2 top-full z-40 mt-4 w-[380px] -translate-x-1/2 p-3"
          >
            <ul className="grid gap-1.5">
              {industries.map((i) => (
                <li key={i.slug}>
                  <Link
                    href={L(`/industries/${i.slug}`)}
                    className="inner flex items-center gap-3 px-3 py-2.5 text-[15px] transition hover:-translate-y-0.5"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-accent-deep">
                      <Icon name={i.icon} className="size-[18px]" />
                    </span>
                    <span className="font-medium">{i.name}</span>
                  </Link>
                </li>
              ))}
              <li>
                <Link href={L("/industries")} className="block px-3 py-2 text-[14px] text-muted hover:text-ink">
                  {t.allIndustries}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <Link href={L("/pricing")} className={linkCls("/pricing")}>{t.pricing}</Link>
        <Link href={L("/resources")} className={linkCls("/resources")}>{t.resources}</Link>
      </div>

      <div className="flex items-center gap-2">
        <LanguageSwitcher locale={locale} labels={lang} className="hidden lg:block" />
        <Link
          href={SIGN_IN_HREF ?? L("/contact")}
          className="inline-flex h-11 items-center whitespace-nowrap rounded-[var(--radius-btn)] bg-ink px-4 text-[15px] font-medium text-white transition hover:bg-black active:scale-[0.98] md:h-12 md:px-5 md:text-[16px]"
        >
          {t.getStarted}
        </Link>
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          aria-label={menuOpen ? t.closeMenu : t.openMenu}
          onClick={() => setMenuOpen((v) => !v)}
          className="grid size-11 place-items-center rounded-[var(--radius-btn)] bg-surface text-ink shadow-[var(--shadow-inner)] lg:hidden"
        >
          <Icon name={menuOpen ? "close" : "menu"} />
        </button>
      </div>

      <div id={menuId} hidden={!menuOpen} className="glass absolute inset-x-0 top-full z-40 mt-2 p-3 lg:hidden">
        <ul className="grid gap-1.5">
          {[
            { label: t.services, href: "/services" },
            { label: t.pricing, href: "/pricing" },
            { label: t.resources, href: "/resources" },
            { label: t.about, href: "/about" },
            { label: t.contact, href: "/contact" },
          ].map((l) => (
            <li key={l.href}>
              <Link href={L(l.href)} className="inner block px-4 py-3 text-[16px] font-medium">{l.label}</Link>
            </li>
          ))}
        </ul>
        <p className="eyebrow mb-2 mt-4 px-1">{t.industries}</p>
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {industries.map((i) => (
            <li key={i.slug}>
              <Link href={L(`/industries/${i.slug}`)} className="inner flex items-center gap-3 px-3 py-2.5 text-[15px]">
                <Icon name={i.icon} className="size-[18px] text-accent-deep" />
                {i.name}
              </Link>
            </li>
          ))}
        </ul>
        <LanguageList locale={locale} labels={lang} className="mt-4" />
      </div>
    </nav>
  );
}
