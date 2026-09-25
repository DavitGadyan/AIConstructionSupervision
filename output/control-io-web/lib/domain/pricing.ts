/**
 * Per-inspection prices (placeholder AMD table, VAT excluded, paid by invoice).
 * Single source for the order quote (GET /api/orders/quote), the frozen
 * `priceAmd` on each order, and the landing / pricing pages.
 */
import { ETA_HOURS, ORDER_KINDS, REPORT_HOURS, type OrderKind, type OrderPriority, type QuoteDto } from "./orderTypes";

/** Base price per inspection kind (scheduled). Placeholders until commercial terms are final. */
export const PRICES_AMD: Record<OrderKind, number> = {
  full: 180_000,
  revision: 90_000,
  targeted: 120_000,
};

/** ASAP (car + drone on site in 3-4 h) costs this much more than a scheduled slot. */
export const ASAP_SURCHARGE = 0.25;

export const CURRENCY = "AMD" as const;

/** What each kind covers (shown on the quote and the order review step). */
export const INCLUDES: Record<OrderKind, string[]> = {
  full: ["Car + drone crew on site", "All facades, nadir and 3D model", "Progress vs. schedule", "Independent PDF report"],
  revision: ["Car + drone crew on site", "Re-inspection of open findings", "Fixed / still open per finding", "Independent PDF report"],
  targeted: ["Car + drone crew on site", "Chosen floors and issues", "Close-up evidence with GPS and SHA-256", "Independent PDF report"],
};

export const KIND_LABEL: Record<OrderKind, string> = {
  full: "Full inspection",
  revision: "Revision",
  targeted: "Targeted inspection",
};

/** Price for one order, rounded to whole AMD. */
export function priceAmd(kind: OrderKind, priority: OrderPriority): number {
  const base = PRICES_AMD[kind];
  return Math.round(priority === "asap" ? base * (1 + ASAP_SURCHARGE) : base);
}

/** The cheapest inspection ("from 90 000 AMD"). */
export const FROM_PRICE_AMD = Math.min(...ORDER_KINDS.map((k) => PRICES_AMD[k]));

export function quote(kind: OrderKind, priority: OrderPriority): QuoteDto {
  return {
    kind,
    priority,
    priceAmd: priceAmd(kind, priority),
    currency: CURRENCY,
    includes: [...INCLUDES[kind]],
    etaHours: [ETA_HOURS[0], ETA_HOURS[1]],
    reportHours: REPORT_HOURS,
  };
}

/** "225 000" - thin groups with a regular space, locale-independent (same on server, web and in tests). */
export function formatAmd(n: number, withCurrency = true): string {
  const s = Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return withCurrency ? `${s} ${CURRENCY}` : s;
}
