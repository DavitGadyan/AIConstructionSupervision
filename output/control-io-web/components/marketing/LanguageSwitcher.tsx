"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { cx } from "@/components/ui/primitives";
import { fmt, LOCALE_COOKIE, locales, localeMeta, localizePath, splitLocale, type Locale } from "@/lib/i18n/config";
import { Icon } from "./icons";

/*
 * Inline SVG flags: emoji flags do not render on Windows. Simplified but
 * recognisable; the wrapper clips them to a small rounded rectangle.
 */
export function Flag({ locale, className }: { locale: Locale; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx("inline-block h-[14px] w-[20px] shrink-0 overflow-hidden rounded-[3px] ring-1 ring-ink/15", className)}
    >
      {locale === "en" ? (
        <svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" className="block size-full">
          {/* No clipPath/ids: flags repeat on the page and some copies sit in hidden menus. */}
          <rect width="60" height="30" fill="#012169" />
          <path d="M0 0l60 30M60 0L0 30" stroke="#fff" strokeWidth="6" />
          <path d="M0 0l60 30M60 0L0 30" stroke="#C8102E" strokeWidth="2" />
          <path d="M30 0v30M0 15h60" stroke="#fff" strokeWidth="10" />
          <path d="M30 0v30M0 15h60" stroke="#C8102E" strokeWidth="6" />
        </svg>
      ) : (
        <svg viewBox="0 0 3 3" preserveAspectRatio="none" className="block size-full">
          {(locale === "hy" ? ["#D90012", "#0033A0", "#F2A800"] : ["#FFFFFF", "#0039A6", "#D52B1E"]).map((c, i) => (
            <rect key={c} x="0" y={i} width="3" height="1" fill={c} />
          ))}
        </svg>
      )}
    </span>
  );
}

function remember(locale: Locale) {
  try {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* cookies blocked: the switch still works, it just is not remembered */
  }
}

/** Same page in another locale; pathname may be the public URL or the internal /en/... one. */
function useTargets() {
  const pathname = usePathname() ?? "/";
  const { path } = splitLocale(pathname);
  return (l: Locale) => localizePath(path, l);
}

type Labels = { button: string; listLabel: string };

/**
 * Dropdown switcher (nav, footer). Menu-button pattern: the button toggles a
 * menu of links; arrows move between them, Escape closes and returns focus.
 */
export function LanguageSwitcher({
  locale,
  labels,
  placement = "down",
  align = "right",
  className,
}: {
  locale: Locale;
  labels: Labels;
  placement?: "down" | "up";
  align?: "left" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const menuId = useId();
  const target = useTargets();
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const focusItem = (i: number) => {
    const n = locales.length;
    itemRefs.current[((i % n) + n) % n]?.focus();
  };

  const openAndFocus = (i: number) => {
    setOpen(true);
    requestAnimationFrame(() => focusItem(i));
  };

  const onButtonKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openAndFocus(Math.max(0, locales.indexOf(locale)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openAndFocus(locales.length - 1);
    } else if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
    }
  };

  const onMenuKey = (e: React.KeyboardEvent) => {
    const i = itemRefs.current.findIndex((el) => el === document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(i + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(i - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusItem(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusItem(locales.length - 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const current = localeMeta[locale];

  return (
    <div ref={rootRef} className={cx("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={fmt(labels.button, { language: current.label })}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onButtonKey}
        className="inline-flex h-11 items-center gap-2 rounded-[var(--radius-btn)] bg-surface px-3 text-[14px] font-medium text-ink shadow-[var(--shadow-inner)] transition hover:-translate-y-0.5 md:h-12"
      >
        <Flag locale={locale} />
        <span className="tabular tracking-[0.04em]">{current.short}</span>
        <Icon name="chevron" className={cx("size-4 transition-transform", open && "rotate-180")} />
      </button>

      <div
        id={menuId}
        hidden={!open}
        className={cx(
          "glass absolute z-50 w-[220px] p-2",
          align === "right" ? "right-0" : "left-0",
          placement === "down" ? "top-full mt-3" : "bottom-full mb-3",
        )}
      >
        <ul role="menu" aria-label={labels.listLabel} onKeyDown={onMenuKey} className="grid gap-1.5">
          {locales.map((l, i) => {
            const on = l === locale;
            return (
              <li key={l} role="none">
                <Link
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  role="menuitem"
                  href={target(l)}
                  lang={localeMeta[l].hreflang}
                  hrefLang={localeMeta[l].hreflang}
                  aria-current={on ? "true" : undefined}
                  tabIndex={-1}
                  onClick={() => {
                    remember(l);
                    setOpen(false);
                  }}
                  className={cx(
                    "inner flex items-center gap-3 px-3 py-2.5 text-[15px] transition hover:-translate-y-0.5 focus-visible:-translate-y-0.5",
                    on && "ring-1 ring-accent/40",
                  )}
                >
                  <Flag locale={l} />
                  <span className="flex-1 font-medium">{localeMeta[l].label}</span>
                  <span className="tabular text-[12px] text-muted">{localeMeta[l].short}</span>
                  {on && <Icon name="check" className="size-4 text-accent-deep" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** Flat variant for the mobile menu: all three languages as pills, current one marked. */
export function LanguageList({ locale, labels, className }: { locale: Locale; labels: Labels; className?: string }) {
  const target = useTargets();
  return (
    <nav aria-label={labels.listLabel} className={className}>
      <ul className="grid grid-cols-3 gap-1.5">
        {locales.map((l) => {
          const on = l === locale;
          return (
            <li key={l}>
              <Link
                href={target(l)}
                lang={localeMeta[l].hreflang}
                hrefLang={localeMeta[l].hreflang}
                aria-current={on ? "true" : undefined}
                onClick={() => remember(l)}
                className={cx(
                  "flex items-center justify-center gap-2 rounded-[var(--radius-inner)] px-2 py-3 text-[14px] font-medium transition",
                  on ? "bg-ink text-white" : "inner",
                )}
              >
                <Flag locale={l} />
                <span className="truncate">{localeMeta[l].label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
