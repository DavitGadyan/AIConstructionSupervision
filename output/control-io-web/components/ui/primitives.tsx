/**
 * ORDI component anatomy, re-skinned. Every marketing section and app screen is
 * assembled from these - a new look belongs here, never inline in a page.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { TypeText } from "@/components/motion/TypeText";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

/* Frosted container that holds white inner cards (ORDI "Today's Tasks"). */
export function GlassCard({
  title,
  subtitle,
  href,
  action,
  children,
  className,
  as: Tag = "section",
  openLabel,
  typed = false,
}: {
  title?: ReactNode;
  /** Type the title in when seen (marketing). Off by default so app pages stay still. */
  typed?: boolean;
  subtitle?: ReactNode;
  href?: string;
  action?: ReactNode;
  /** Accessible name of the arrow link (defaults to "Open {title}"). */
  openLabel?: string;
  children?: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return (
    <Tag className={cx("glass p-5 md:p-6", className)}>
      {(title || href || action) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title && <CardTitle typed={typed}>{title}</CardTitle>}
            {subtitle && <p className="mt-1 text-[14px] text-muted">{subtitle}</p>}
          </div>
          {action}
          {href && <ArrowButton href={href} label={openLabel ?? (typeof title === "string" ? `Open ${title}` : "Open")} />}
        </header>
      )}
      {children}
    </Tag>
  );
}

const cardTitleClass = "font-display text-[20px] font-semibold leading-tight md:text-[22px]";

/* Card h3, optionally typed in (components/motion/TypeText). */
function CardTitle({ typed, children }: { typed: boolean; children: ReactNode }) {
  if (!typed) return <h3 className={cardTitleClass}>{children}</h3>;
  return (
    <TypeText as="h3" className={cardTitleClass} maxDuration={900}>
      {children}
    </TypeText>
  );
}

/* Solid accent card (ORDI "Team Tasks Overview"). */
export function AccentCard({
  title,
  subtitle,
  href,
  children,
  className,
  openLabel = "Open",
  typed = false,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  href?: string;
  children?: ReactNode;
  className?: string;
  openLabel?: string;
  /** Type the title in when seen, with a white caret. Off by default. */
  typed?: boolean;
}) {
  return (
    <section className={cx("rounded-[var(--radius-card)] bg-accent p-5 text-white shadow-[var(--shadow-card)] [--type-caret:#fff] md:p-6", className)}>
      <header className="mb-4 flex items-start justify-between gap-4">
        <div>
          <CardTitle typed={typed}>{title}</CardTitle>
          {subtitle && <p className="mt-1 text-[14px] text-white/80">{subtitle}</p>}
        </div>
        {href && (
          <Link
            href={href}
            aria-label={openLabel}
            className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-btn)] bg-white/15 text-white transition hover:bg-white/25"
          >
            <ArrowIcon />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

/* Translucent sub-card that lives inside AccentCard. */
export function AccentSubCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-[var(--radius-inner)] bg-white/12 p-4 ring-1 ring-white/15", className)}>{children}</div>;
}

export function InnerCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("inner p-4", className)}>{children}</div>;
}

export function ArrowIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path d="M4.5 11.5l7-7M5.5 4.5h6v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-btn)] bg-surface text-ink shadow-[var(--shadow-inner)] transition hover:-translate-y-0.5"
    >
      <ArrowIcon />
    </Link>
  );
}

type Tone = "accent" | "grey" | "dark" | "light" | "danger" | "warn" | "ok";
const toneClass: Record<Tone, string> = {
  accent: "bg-accent text-white",
  grey: "bg-accent2 text-white",
  dark: "bg-ink text-white",
  light: "bg-surface text-ink ring-1 ring-line",
  danger: "bg-danger text-white",
  warn: "bg-warn text-white",
  ok: "bg-ok text-white",
};

/* Small solid label pill (ORDI "High" / "Medium" / "AI Optimized"). */
export function Pill({ tone = "accent", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center rounded-[var(--radius-pill)] px-2.5 py-1 text-[13px] font-medium leading-none tabular", toneClass[tone], className)}>
      {children}
    </span>
  );
}

export function severityTone(sev: string): Tone {
  return sev === "critical" ? "danger" : sev === "late" ? "accent" : sev === "watch" ? "grey" : "dark";
}

export function Button({
  href,
  children,
  variant = "dark",
  className,
  type,
  onClick,
  disabled,
}: {
  href?: string;
  children: ReactNode;
  variant?: "dark" | "accent" | "light" | "ghost";
  className?: string;
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
}) {
  const cls = cx(
    "inline-flex items-center justify-center gap-2 rounded-[var(--radius-btn)] px-5 py-3 text-[15px] font-medium transition disabled:opacity-50",
    variant === "dark" && "bg-ink text-white hover:bg-black",
    variant === "accent" && "bg-accent text-white hover:bg-accent-deep",
    variant === "light" && "bg-surface text-ink shadow-[var(--shadow-inner)] hover:-translate-y-0.5",
    variant === "ghost" && "text-ink hover:bg-white/50",
    className,
  );
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return (
    <button type={type ?? "button"} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

/* ORDI "Time Analytics": big total + labelled proportional segments. */
export function SegmentBar({
  label,
  total,
  segments,
}: {
  label: string;
  total: ReactNode;
  segments: { label: string; value: number; tone: "accent" | "grey" | "dark" | "light" }[];
}) {
  const sum = segments.reduce((a, s) => a + Math.max(s.value, 0.0001), 0);
  const bg = { accent: "bg-accent text-white", grey: "bg-accent2 text-white", dark: "bg-ink text-white", light: "bg-surface text-ink" };
  return (
    <div className="glass flex flex-col gap-4 p-5 md:flex-row md:items-end md:gap-6 md:p-6">
      <div className="shrink-0 md:max-w-[45%]">
        <p className="text-[14px] text-muted">{label}</p>
        <p className="mt-1 font-display text-[40px] font-bold leading-none tracking-tight tabular md:text-[44px]">{total}</p>
      </div>
      <div className="flex min-w-0 flex-1 gap-1.5">
        {segments.map((s) => (
          <div key={s.label} className="min-w-[56px]" style={{ flexGrow: Math.max(s.value, 0.0001) / sum }}>
            <p className="mb-2 truncate border-l border-dashed border-line pl-2 text-[13px] text-ink">{s.label}</p>
            <div className={cx("rounded-[10px] px-2.5 py-2 text-[12px] font-medium tabular", bg[s.tone])}>{Math.round(s.value)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ORDI "Time Tracker" ring. */
export function RingGauge({
  value,
  max,
  center,
  caption,
  size = 200,
}: {
  value: number;
  max: number;
  center: ReactNode;
  caption: string;
  size?: number;
}) {
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const frac = Math.min(1, Math.max(0, value / max));
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="rgba(255,255,255,.35)" stroke="rgba(28,34,38,.08)" strokeWidth="3" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${c * frac} ${c}`}
          className="transition-[stroke-dasharray] duration-700"
        />
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i / 24) * Math.PI * 2;
          return <circle key={i} cx={size / 2 + Math.cos(a) * (r - 18)} cy={size / 2 + Math.sin(a) * (r - 18)} r="1.3" fill="rgba(28,34,38,.18)" />;
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-display text-[40px] font-bold leading-none tabular">{center}</div>
          <div className="mt-1 text-[11px] font-medium uppercase tracking-wider">{caption}</div>
        </div>
      </div>
    </div>
  );
}

export function Breadcrumbs({ items, label = "Breadcrumb" }: { items: { name: string; href: string }[]; label?: string }) {
  return (
    <nav aria-label={label} className="text-[13px] text-muted">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((it, i) => (
          <li key={it.href} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden>/</span>}
            {i === items.length - 1 ? (
              <span aria-current="page" className="text-ink">{it.name}</span>
            ) : (
              <Link href={it.href} className="hover:text-ink">{it.name}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 font-display text-[26px] font-bold tracking-tight", className)}>
      <span className="grid size-8 place-items-center rounded-[9px] bg-ink text-white" aria-hidden>
        <svg viewBox="0 0 20 20" className="size-5" fill="none">
          <path d="M3 17V9l7-5 7 5v8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M7 17v-5h6v5" stroke="var(--color-accent)" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      </span>
      <span>
        control<span className="text-accent">.io</span>
      </span>
    </span>
  );
}
