/** Copy for the home page that is not a service or an industry. */
import type { Locale } from "@/lib/i18n/config";
import type { Tuple } from "@/lib/i18n/types";
import { homeHy } from "./i18n/home.hy";
import { homeRu } from "./i18n/home.ru";

export const heroSlides = [
  {
    title: "Proof, not progress claims",
    text: "Drone flights measure every floor and compare it with the schedule your developer signed, so a delay is shown, not argued.",
  },
  {
    title: "Every flight becomes a 3D model",
    text: "Photogrammetry turns each visit into a measurable mesh you can orbit, slice by floor and compare with last month.",
  },
  {
    title: "The schedule, read for you",
    text: "AI extracts dated milestones from programmes, permits and contracts, and cites the page each one came from.",
  },
  {
    title: "Reports that survive scrutiny",
    text: "PDF delay reports carry SHA-256 hashes of every image and annex the official documents they rely on.",
  },
  {
    title: "Built for lenders and cities",
    text: "Portfolio views, drawdown checks and permit tracking for the people who pay for or regulate the building.",
  },
  {
    title: "Solar farms, too",
    text: "Thermal and RGB flights find hot-spots, soiling and dead strings, pinned to the exact module on a map.",
  },
];

export const values = [
  {
    title: "Independence",
    text: "We are not the contractor and not the developer. Our pilots, our processing and our reports answer to the evidence, which is why lenders and municipalities can rely on them.",
  },
  {
    title: "Evidence",
    text: "Original images are kept, hashed and linked to the schedule page they test. Anyone can re-open a finding and see exactly what it rests on.",
  },
  {
    title: "Speed",
    text: "A delay found in month three can still be recovered. Regular flights and automatic comparison surface slippage while there is time to act on it.",
  },
];

export const steps = [
  {
    title: "Fly",
    text: "A certified pilot flies a saved route: orbits, facade passes and a nadir grid. The same route every visit keeps images comparable.",
    start: 0,
    end: 18,
    row: 0,
    tone: "accent" as const,
  },
  {
    title: "Reconstruct",
    text: "Photogrammetry rebuilds the site as a 3D mesh, orthomosaic and point cloud. Every photo is hashed on upload.",
    start: 16,
    end: 47,
    row: 1,
    tone: "dark" as const,
  },
  {
    title: "Compare with the plan",
    text: "The model is measured floor by floor and set against milestones the AI extracted from the schedule, permit and contract.",
    start: 48,
    end: 78,
    row: 1,
    tone: "light" as const,
  },
  {
    title: "Report",
    text: "You receive a verdict per floor and trade, days behind in earned-schedule terms, and a PDF with the evidence annexed.",
    start: 74,
    end: 100,
    row: 2,
    tone: "grey" as const,
  },
];

export const homeFaq = [
  {
    topic: "Product",
    q: "What is control.io?",
    a: "control.io is an independent construction-supervision service. It flies drones over multistorey sites, rebuilds each flight as a 3D model, compares the model with the official construction schedule and issues PDF reports that show which floors are late and by how many days.",
  },
  {
    topic: "Method",
    q: "How does control.io know whether a building is behind schedule?",
    a: "The AI extracts dated milestones from the schedule, permit and contract. Each flight's 3D model is measured floor by floor and trade by trade, and the measured progress is converted into earned schedule, the date by which the plan expected that much work. The difference from today is the delay in days.",
  },
  {
    topic: "Evidence",
    q: "Are the delay reports usable as evidence?",
    a: "They are built to be verifiable. Original images are retained, each receives a SHA-256 hash at upload, capture time and location are recorded, and the schedule pages each finding relies on are annexed. Whether a report is admissible in a specific proceeding is a matter for your lawyers and jurisdiction.",
  },
  {
    topic: "Flights",
    q: "How often are sites flown?",
    a: "Monthly on the Pilot plan and bi-weekly on Portfolio. Enterprise customers can set any cadence, including weekly flights during frame and envelope work.",
  },
  {
    topic: "Flights",
    q: "Who flies the drone?",
    a: "control.io's certified pilots, operating under local aviation rules. Enterprise customers and contractors with their own drone teams can fly our saved routes and upload through the app.",
  },
  {
    topic: "3D",
    q: "What 3D outputs do I receive?",
    a: "A textured 3D mesh, a top-down orthomosaic and a point cloud for every flight, viewable in the browser and exportable for CAD and BIM tools.",
  },
  {
    topic: "Documents",
    q: "Which documents can the AI read?",
    a: "Construction schedules and programmes (PDF exports), building permits including scanned ones, contracts and loan agreements with milestone schedules. Every extracted milestone keeps a citation to its source page, and an engineer confirms the list before it is used.",
  },
  {
    topic: "Solar",
    q: "Does control.io inspect solar panels?",
    a: "Yes. Thermal and RGB drone flights detect hot-spots, cracked cells, active bypass diodes, disconnected strings, soiling and vegetation shading. Each anomaly is classified and pinned to a module on a geo-tagged map.",
  },
  {
    topic: "Pricing",
    q: "How much does control.io cost?",
    a: "The Pilot plan for a single site starts from USD 1,490 per month including monthly flights. Portfolio covers up to 10 sites from USD 5,900 per month. Enterprise and lender plans with API access and white-label reports are priced per portfolio.",
  },
  {
    topic: "On demand",
    q: "How fast can you inspect a site on demand?",
    a: "In Yerevan and Kotayk, an ASAP order from the control.io app or dashboard puts a car with a drone crew on site within 3–4 hours of confirmation, and the independent PDF report arrives within 12 hours of the flight. Owners and building inspectors can order a full inspection, a revision of open findings or specific floors; the price is shown before you confirm and paid by invoice. We fly in daylight only, and strong wind, rain or restricted airspace can move the slot, in which case we call the site contact.",
  },
];

export const pricing = [
  {
    name: "Pilot",
    price: "1,490",
    priceValue: 1490,
    cadence: "per month",
    audience: "One site, one clear answer.",
    features: [
      "1 active construction site",
      "Monthly drone flight on a saved route",
      "3D model, orthomosaic and point cloud per flight",
      "AI milestone extraction from your schedule",
      "PDF delay report after every flight",
      "Live dashboard for 5 users",
    ],
    cta: "Book a pilot flight",
    featured: false,
  },
  {
    name: "Portfolio",
    price: "5,900",
    priceValue: 5900,
    cadence: "per month",
    audience: "Developers and lenders with several live projects.",
    features: [
      "Up to 10 active sites",
      "Bi-weekly flights on every site",
      "Portfolio dashboard with schedule variance",
      "Facade inspection passes included",
      "Drawdown and milestone verification",
      "Unlimited users",
    ],
    cta: "Talk to sales",
    featured: true,
  },
  {
    name: "Enterprise / Lender",
    price: null,
    priceValue: null,
    cadence: "custom",
    audience: "Banks, insurers, cities and large contractors.",
    features: [
      "Any number of sites and any cadence",
      "REST API and loan-system export",
      "White-label reports and dashboards",
      "Bring-your-own pilots option",
      "Solar inspection programmes",
      "Dedicated evidence engineer",
    ],
    cta: "Contact us",
    featured: false,
  },
];

export const pricingFaq = [
  { q: "Are drone flights included in the price?", a: "Yes. Pilot and Portfolio include flights by control.io's certified pilots at the stated cadence. Travel to remote sites may be quoted separately." },
  { q: "Is there a minimum term?", a: "Pilot is billed monthly. We recommend at least three flights, which is what it takes to see a trend rather than a snapshot. Portfolio and Enterprise terms are agreed per contract." },
  { q: "Is solar inspection priced the same way?", a: "Solar inspections are quoted per plant, based on its size and location, as a one-off or recurring programme. Contact us for a quote." },
  { q: "Do prices include taxes?", a: "Prices are shown in USD excluding VAT and local taxes, which are added where applicable." },
];

/* ---- Translations ------------------------------------------------------ */

type TitleText = { title: string; text: string };

/**
 * Text-only shape of a home-page translation. Items are matched to the English
 * lists by position; numbers, tones and prices come from the English lists.
 * Plan names (Pilot, Portfolio, Enterprise / Lender) are product names and
 * may be kept or adapted per locale.
 */
export type HomeTranslation = {
  heroSlides: Tuple<TitleText, 6>;
  values: Tuple<TitleText, 3>;
  steps: Tuple<TitleText, 4>;
  homeFaq: Tuple<{ topic: string; q: string; a: string }, 10>;
  pricing: Tuple<{ name: string; cadence: string; audience: string; features: Tuple<string, 6>; cta: string }, 3>;
  pricingFaq: Tuple<{ q: string; a: string }, 4>;
};

const translations: Record<Exclude<Locale, "en">, HomeTranslation> = { hy: homeHy, ru: homeRu };

export function getHome(locale: Locale) {
  if (locale === "en") return { heroSlides, values, steps, homeFaq, pricing, pricingFaq };
  const t = translations[locale];
  return {
    heroSlides: heroSlides.map((s, i) => ({ ...s, ...t.heroSlides[i] })),
    values: values.map((v, i) => ({ ...v, ...t.values[i] })),
    steps: steps.map((s, i) => ({ ...s, ...t.steps[i] })),
    homeFaq: homeFaq.map((f, i) => ({ ...f, ...t.homeFaq[i] })),
    pricing: pricing.map((p, i) => ({ ...p, ...t.pricing[i], features: [...t.pricing[i].features] })),
    pricingFaq: pricingFaq.map((f, i) => ({ ...f, ...t.pricingFaq[i] })),
  };
}
