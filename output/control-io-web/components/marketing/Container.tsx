import { TypeText } from "@/components/motion/TypeText";
import { textOf } from "@/components/motion/typeTokens";
import { cx } from "@/components/ui/primitives";

/** Shared horizontal frame for marketing sections. */
export function Container({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("mx-auto w-full max-w-[1320px] px-4 md:px-8", className)}>{children}</div>;
}

/** Eyebrow + h2 + optional intro, answer-first. The h2 types in when seen. */
export function SectionHeading({
  eyebrow,
  title,
  intro,
  id,
  align = "left",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  id?: string;
  align?: "left" | "split";
  className?: string;
}) {
  if (align === "split") {
    return (
      <div className={cx("mb-10 grid gap-6 md:mb-14 md:grid-cols-[1.1fr_1fr] md:items-end", className)}>
        <div>
          {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
          <TypeText as="h2" id={id} className="font-bold tracking-tight" style={{ fontSize: "var(--size-h1)" }}>{title}</TypeText>
        </div>
        {intro && <p className="max-w-[52ch] text-[17px] text-muted md:justify-self-end">{intro}</p>}
      </div>
    );
  }
  return (
    <div className={cx("mb-10 max-w-[760px] md:mb-14", className)}>
      {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
      <TypeText as="h2" id={id} className="font-bold tracking-tight" style={{ fontSize: "var(--size-h1)" }}>{title}</TypeText>
      {intro && <p className="mt-4 text-[17px] text-muted">{intro}</p>}
    </div>
  );
}

/** Giant ORDI-style display heading used as the h1 on inner pages; types in on load. */
export function PageTitle({ children, sub, size = "xl", compact = false }: { children: string; sub?: React.ReactNode; size?: "xl" | "lg" | "md"; compact?: boolean }) {
  const clamp =
    size === "xl" ? (compact ? "clamp(52px,10vw,148px)" : "clamp(52px,12.5vw,184px)") : size === "lg" ? "clamp(40px,6.5vw,104px)" : "clamp(34px,4.6vw,68px)";
  // Words never break mid-word, so a long Armenian or Russian word
  // ("Ծառայություններ", "Муниципальный") would overflow the giant uppercase
  // heading. Cap the size so the longest word fits the column (100cqw of the
  // wrapper), using the per-script glyph width from globals.css.
  const longest = Math.max(1, ...textOf(children).split(/\s+/).map((w) => Array.from(w).length));
  const fontSize = `min(${clamp}, calc(100cqw / (${longest} * var(--glyph-w))))`;
  return (
    <div className="@container min-w-0">
      <TypeText
        as="h1"
        eager
        className={cx("display-xl mt-6 [overflow-wrap:normal] [hyphens:none]", size === "md" && "max-w-[18ch] leading-[0.95]")}
        style={{ fontSize }}
      >
        {children}
      </TypeText>
      {sub && <p className="mt-6 max-w-[62ch] text-[17px] text-muted md:text-[18px]">{sub}</p>}
    </div>
  );
}

export function LastUpdated({ iso, label, prefix = "Last updated" }: { iso: string; label: string; prefix?: string }) {
  return (
    <p className="text-[13px] text-muted">
      {prefix} <time dateTime={iso}>{label}</time>
    </p>
  );
}

/** Inner-page header: the nav sits inside this stage, like the home hero. */
export function PageHero({
  crumbs,
  title,
  sub,
  aside,
  children,
  size = "xl",
}: {
  size?: "xl" | "lg" | "md";
  crumbs: React.ReactNode;
  /** Plain text: PageTitle sizes it by its longest word and types it in. */
  title: string;
  sub?: React.ReactNode;
  aside?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-3 pt-3 md:px-6 md:pt-6">
      <div className="stage @container mx-auto max-w-[1480px] pb-10 pt-[84px] md:pb-16 md:pt-[112px]">
        <p aria-hidden className="display-xl pointer-events-none absolute -bottom-[3cqw] right-[-2cqw] select-none text-[22cqw] text-white/35">
          CONTROL
        </p>
        <Container className="relative">
          {crumbs}
          <div className={cx("grid grid-cols-[minmax(0,1fr)] gap-8", aside ? "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-end" : null)}>
            <PageTitle sub={sub} size={size} compact={Boolean(aside)}>{title}</PageTitle>
            {aside}
          </div>
          {children}
        </Container>
      </div>
    </div>
  );
}
