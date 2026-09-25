/**
 * The "Order inspection" call to action, or "Track INS-…" while an order is
 * active. Used in the top bar (compact) and next to the dashboard headline.
 * Renders nothing for callers who can neither order nor track anything.
 */
import Link from "next/link";
import { cx } from "@/components/ui/primitives";
import type { OrderStatus } from "@/lib/domain/orderTypes";
import { STATUS_LABEL } from "./orderFormat";

export function DroneIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="4.8" cy="4.8" r="2.3" />
        <circle cx="15.2" cy="4.8" r="2.3" />
        <circle cx="4.8" cy="15.2" r="2.3" />
        <circle cx="15.2" cy="15.2" r="2.3" />
        <path d="M6.5 6.5l1.9 1.9M13.5 6.5l-1.9 1.9M6.5 13.5l1.9-1.9M13.5 13.5l-1.9-1.9" />
        <rect x="8.2" y="8.2" width="3.6" height="3.6" rx="1" />
      </g>
    </svg>
  );
}

export interface ActiveOrderRef {
  id: string;
  number: string;
  status: OrderStatus;
}

export function OrderInspectionButton({
  projectId,
  active,
  canOrder,
  variant = "hero",
  className,
}: {
  projectId: string;
  active: ActiveOrderRef | null;
  canOrder: boolean;
  /** "bar": top-bar size (icon only below lg). "hero": dashboard size with text. */
  variant?: "bar" | "hero";
  className?: string;
}) {
  const base = `/app/projects/${projectId}/orders`;
  const bar = variant === "bar";
  const size = bar ? "h-11 rounded-[14px] px-3.5 md:h-12 lg:px-5" : "h-12 rounded-[var(--radius-btn)] px-5";

  if (active) {
    return (
      <Link
        href={`${base}/${active.id}`}
        aria-label={`Track inspection ${active.number}: ${STATUS_LABEL[active.status]}`}
        className={cx("inline-flex shrink-0 items-center gap-2.5 bg-surface text-[15px] font-medium text-ink shadow-[var(--shadow-inner)] transition hover:-translate-y-0.5", size, className)}
      >
        <span className="relative grid size-2.5 place-items-center" aria-hidden>
          <span className="absolute inset-0 rounded-full bg-accent motion-safe:animate-ping" />
          <span className="relative size-2.5 rounded-full bg-accent" />
        </span>
        <span className={cx(bar && "hidden lg:inline")}>
          Track <span className="tabular">{active.number}</span>
        </span>
        <span className={cx("rounded-[var(--radius-pill)] bg-accent px-2 py-1 text-[12px] leading-none text-white", bar && "hidden xl:inline")}>{STATUS_LABEL[active.status]}</span>
      </Link>
    );
  }
  if (!canOrder) return null;
  return (
    <Link
      href={`${base}#new-order`}
      aria-label="Order inspection"
      className={cx(
        "inline-flex shrink-0 items-center gap-2 text-[15px] font-medium text-white transition",
        bar ? "bg-ink hover:bg-black" : "bg-accent hover:bg-accent-deep",
        size,
        className,
      )}
    >
      <DroneIcon className="size-5" />
      <span className={cx(bar && "hidden lg:inline")}>Order inspection</span>
    </Link>
  );
}
