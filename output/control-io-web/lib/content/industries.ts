import type { Locale } from "@/lib/i18n/config";
import { industriesHy } from "./i18n/industries.hy";
import { industriesRu } from "./i18n/industries.ru";

export type IndustrySlug =
  | "developers"
  | "banks-lenders"
  | "municipal-building-control"
  | "insurers-sureties"
  | "general-contractors"
  | "energy-solar";

export type IndustryIcon = "building" | "bank" | "shield-check" | "umbrella" | "hard-hat" | "sun";

export type Industry = {
  slug: IndustrySlug;
  name: string;
  /** Lower-case plural used in running copy. */
  audience: string;
  icon: IndustryIcon;
  short: string;
  metaTitle: string;
  metaDescription: string;
  /** Answer-first opening paragraph. */
  intro: string;
  problems: { problem: string; solution: string }[];
  deliverables: string[];
  faq: { q: string; a: string }[];
  image: { src: string; alt: string };
};

export const industries: Industry[] = [
  {
    slug: "developers",
    name: "Developers",
    audience: "property developers",
    icon: "building",
    short: "Independent proof of progress for buyers, boards and investors, without waiting for the contractor's monthly report.",
    metaTitle: "Drone progress monitoring for property developers",
    metaDescription:
      "control.io gives property developers an independent, drone-measured view of progress on every multistorey site, compared with the programme and reported floor by floor.",
    intro:
      "For a developer, control.io is an independent check on what the main contractor reports. A drone flies each site on a fixed cadence, the flight is rebuilt as a 3D model, and the model is compared with the programme so you see, per floor and per trade, whether the building is where it should be on that date.",
    problems: [
      {
        problem: "Progress reports come from the contractor whose performance they describe.",
        solution: "Drone measurements are taken by a third party and the raw imagery is kept, hashed, for anyone to re-check.",
      },
      {
        problem: "Buyers and investors ask for updates the site team has no time to prepare.",
        solution: "Share a read-only live feed or a branded PDF after every flight, generated without site-team effort.",
      },
      {
        problem: "Slippage becomes visible only when a handover date is already lost.",
        solution: "Per-trade day counts flag a floor as 'watch' weeks before it becomes a critical delay.",
      },
    ],
    deliverables: [
      "Monthly or bi-weekly drone flights on a repeatable route",
      "3D model and orthomosaic for each flight",
      "Floor-by-floor progress verdict against the programme",
      "Investor-ready PDF report with image evidence",
      "Read-only live dashboard for buyers and partners",
    ],
    faq: [
      {
        q: "Does control.io replace the contractor's progress report?",
        a: "No. It sits beside it. The contractor still reports; control.io gives you an independent measurement so you can tell when the two disagree.",
      },
      {
        q: "Can I show the dashboard to apartment buyers?",
        a: "Yes. You can publish a read-only view per project, limited to imagery and high-level progress, without exposing commercial documents.",
      },
      {
        q: "How often should a residential tower be flown?",
        a: "Monthly flights suit most structures. During frame and envelope, when floors change quickly, bi-weekly flights give a clearer trend.",
      },
    ],
    image: { src: "/images/marketing/industry-developers.webp", alt: "Aerial drone photo of a concrete residential tower under construction with a tower crane (AI-generated sample image)" },
  },
  {
    slug: "banks-lenders",
    name: "Banks & lenders",
    audience: "banks and lenders",
    icon: "bank",
    short: "Release construction loan tranches against measured progress, with evidence your credit committee can file.",
    metaTitle: "Construction loan monitoring for banks and lenders",
    metaDescription:
      "control.io helps banks and construction lenders verify drawdown requests with drone-measured progress, earned schedule analysis and tamper-evident PDF evidence.",
    intro:
      "For lenders, control.io verifies a drawdown request before the money moves. Each disbursement milestone is matched to what the drone actually recorded on site, and the result is a PDF with hashed images and the relevant contract pages annexed, suitable for the credit file.",
    problems: [
      {
        problem: "Drawdown requests rely on the borrower's own progress claims.",
        solution: "Tranche milestones are checked against drone measurements taken independently of the borrower.",
      },
      {
        problem: "Site visits across a large loan book are slow and expensive.",
        solution: "One portfolio view shows every financed project, its schedule variance and its last flight date.",
      },
      {
        problem: "Evidence of a covenant breach has to stand up if the loan is disputed.",
        solution: "Reports carry SHA-256 hashes of every photo and cite the contract page each milestone comes from.",
      },
    ],
    deliverables: [
      "Drawdown verification report per disbursement",
      "Portfolio dashboard across all financed sites",
      "Earned schedule variance in days for each project",
      "Tamper-evident image evidence with SHA-256 hashes",
      "API export into loan-management systems (Enterprise)",
    ],
    faq: [
      {
        q: "Can control.io verify a specific loan tranche milestone?",
        a: "Yes. Upload the loan agreement's disbursement schedule; each milestone becomes a checkable item and the next flight reports whether it has been reached.",
      },
      {
        q: "Is the evidence usable in a dispute with the borrower?",
        a: "The reports are designed to be verifiable: original images are retained, each is hashed at upload, and the cited documents are annexed. Admissibility is always a question for your counsel and jurisdiction.",
      },
      {
        q: "Can the reports carry our bank's branding?",
        a: "White-label reports and dashboards are part of the Enterprise / Lender plan.",
      },
    ],
    image: { src: "/images/marketing/industry-banks-lenders.webp", alt: "Bank credit officers reviewing an aerial photo of a financed tower under construction (AI-generated sample image)" },
  },
  {
    slug: "municipal-building-control",
    name: "Municipal building control",
    audience: "building-control authorities",
    icon: "shield-check",
    short: "Check permitted works against what is being built, across many sites, without sending an inspector to every one.",
    metaTitle: "Drone monitoring for municipal building control",
    metaDescription:
      "control.io helps municipal building-control departments track permitted multistorey projects with scheduled drone flights, permit-linked milestones and dated evidence.",
    intro:
      "For a building-control authority, control.io is a way to watch many permitted sites at once. Permit conditions and approved programmes become milestones, scheduled drone flights record what exists, and the office sees which projects are stalled, ahead of permit, or out of step with what was approved.",
    problems: [
      {
        problem: "Inspectors cannot visit every active permit often enough.",
        solution: "Scheduled flights cover many sites, and inspectors go where the data shows a problem.",
      },
      {
        problem: "Abandoned or stalled projects are noticed late.",
        solution: "A site with no measurable change between flights is flagged automatically.",
      },
      {
        problem: "Enforcement needs dated, attributable evidence.",
        solution: "Every image carries capture time, location and a hash, and is tied to the permit clause it concerns.",
      },
    ],
    deliverables: [
      "City-wide map of monitored permits and their status",
      "Permit-linked milestone extraction with page citations",
      "Stalled-site and deviation alerts",
      "Dated, hashed image evidence per inspection",
      "Exportable reports for enforcement files",
    ],
    faq: [
      {
        q: "Can control.io tell if a building exceeds its permitted height?",
        a: "The 3D reconstruction measures heights and storey counts, which can be compared with the permitted envelope. A qualified officer should confirm any finding before enforcement.",
      },
      {
        q: "Who flies the drones for a municipality?",
        a: "control.io's certified pilots, or the municipality's own drone team using our flight plans and upload app.",
      },
      {
        q: "Does it work with scanned paper permits?",
        a: "Yes. Scanned permits are read with OCR and every extracted condition keeps a link to the scanned page for review.",
      },
    ],
    image: { src: "/images/marketing/industry-municipal-building-control.webp", alt: "Building inspector with a tablet looking up at a residential tower under construction (AI-generated sample image)" },
  },
  {
    slug: "insurers-sureties",
    name: "Insurers & sureties",
    audience: "insurers and sureties",
    icon: "umbrella",
    short: "Underwrite and monitor construction risk with a dated visual record of every insured or bonded site.",
    metaTitle: "Construction risk monitoring for insurers and sureties",
    metaDescription:
      "control.io gives construction insurers and surety providers dated drone evidence of site condition and progress, for underwriting, bond monitoring and claims.",
    intro:
      "For insurers and sureties, control.io provides a dated, repeatable record of each site. Underwriters see real progress before renewing cover, surety teams see early signs that a bonded contractor is falling behind, and claims teams have a timeline of images from before and after an event.",
    problems: [
      {
        problem: "Surety losses often follow delays that were visible months earlier.",
        solution: "Earned schedule variance shows a bonded project drifting long before default.",
      },
      {
        problem: "Claims hinge on what the site looked like before the loss.",
        solution: "Each flight is a dated baseline, stored with hashes so it cannot be quietly replaced.",
      },
      {
        problem: "Risk surveys are one-off snapshots.",
        solution: "A recurring flight cadence turns the survey into a trend over the life of the policy.",
      },
    ],
    deliverables: [
      "Pre-cover and renewal site survey",
      "Recurring progress and condition flights",
      "Early-warning alerts on schedule drift",
      "Before/after image sets for claims",
      "Portfolio export via API",
    ],
    faq: [
      {
        q: "Can control.io help with a builder's risk claim?",
        a: "If the site was flown before the incident, the earlier reconstruction documents its prior condition, and a post-event flight records the damage on the same model.",
      },
      {
        q: "Does control.io assess contractor financial health?",
        a: "No. It measures physical progress against the schedule. Sureties often use the variance as one input alongside their own financial review.",
      },
      {
        q: "How long are flight records kept?",
        a: "For the duration of the contract, and longer by agreement for policies with extended liability periods.",
      },
    ],
    image: { src: "/images/marketing/industry-insurers-sureties.webp", alt: "Top-down drone view of an insured urban construction site (AI-generated sample image)" },
  },
  {
    slug: "general-contractors",
    name: "General contractors",
    audience: "general contractors",
    icon: "hard-hat",
    short: "Show owners exactly where the programme stands and defend your own delay claims with the same evidence.",
    metaTitle: "Drone progress tracking for general contractors",
    metaDescription:
      "control.io helps general contractors document progress, coordinate trades and support extension-of-time claims with drone imagery, 3D models and schedule-linked reports.",
    intro:
      "For a general contractor, control.io documents your own progress so disputes are settled with images rather than arguments. The same flights that show an owner where the job stands also record owner-caused hold-ups, late design information and access problems for extension-of-time claims.",
    problems: [
      {
        problem: "Extension-of-time claims fail without contemporaneous records.",
        solution: "Every flight is a dated, hashed record of site condition, stored in one timeline.",
      },
      {
        problem: "Subcontractor progress is hard to see across a large frame.",
        solution: "Per-trade progress on the 3D model shows which crew is behind on which floor.",
      },
      {
        problem: "Owner meetings turn into debates about percentages.",
        solution: "Earned schedule turns progress into days, a unit everyone reads the same way.",
      },
    ],
    deliverables: [
      "Per-trade, per-floor progress on the 3D model",
      "Contemporaneous record for delay and disruption claims",
      "Look-ahead comparison against the current programme",
      "Owner-ready PDF reports",
      "Stockpile and earthworks volumes",
    ],
    faq: [
      {
        q: "Will control.io be used against us by the owner?",
        a: "The data is neutral: it records what was built and when. Contractors use the same record to prove owner-caused delays and support time extensions.",
      },
      {
        q: "Can we use our own drone team?",
        a: "Yes. We supply flight plans and an upload app; processing, comparison and reporting run on control.io.",
      },
      {
        q: "Does it import our programme from scheduling software?",
        a: "Upload a PDF export of the programme. The AI extracts activities and dates, and an engineer confirms them before first use.",
      },
    ],
    image: { src: "/images/marketing/industry-general-contractors.webp", alt: "Workers tying rebar on the top deck of a concrete tower (AI-generated sample image)" },
  },
  {
    slug: "energy-solar",
    name: "Energy & Solar",
    audience: "solar owners and O&M teams",
    icon: "sun",
    short: "Thermal and RGB drone inspection of solar farms, with every anomaly pinned to a module.",
    metaTitle: "Drone thermal inspection for solar farms",
    metaDescription:
      "control.io inspects solar PV plants with thermal and RGB drones, classifies hot-spots, soiling, cracked cells and disconnected strings, and maps every defect to a module.",
    intro:
      "For solar owners and O&M teams, control.io runs drone thermal and RGB inspections of PV plants. Anomalies are classified in the style of IEC TS 62446-3, each one is geo-tagged to its module, and the result is a ranked defect list and PDF report your field crew can work through row by row.",
    problems: [
      {
        problem: "Walking a large plant with a handheld camera takes days.",
        solution: "A drone covers the array in a fraction of the time under consistent irradiance.",
      },
      {
        problem: "Thermal images alone are hard to act on.",
        solution: "Each anomaly is paired with an RGB image and a module position on the map.",
      },
      {
        problem: "Warranty claims need documented evidence of module defects.",
        solution: "Reports record the anomaly class, temperature difference and conditions at capture.",
      },
    ],
    deliverables: [
      "Radiometric thermal and RGB imagery of the full array",
      "Anomaly classification: hot cells, bypass diodes, open strings, soiling, shading",
      "Geo-tagged per-module defect map",
      "Prioritised PDF report for O&M",
      "Year-on-year comparison of repeat inspections",
    ],
    faq: [
      {
        q: "What solar defects can a drone thermal inspection find?",
        a: "Hot-spots from cracked or damaged cells, active bypass diodes, disconnected modules and strings, soiling and bird droppings, vegetation shading and some junction-box faults.",
      },
      {
        q: "What conditions are needed for a thermal PV inspection?",
        a: "Clear sky and sufficient irradiance on the module plane (IEC TS 62446-3 calls for at least 600 W/m²), low wind and the plant operating under load.",
      },
      {
        q: "Do you inspect rooftop systems as well as ground-mount farms?",
        a: "Yes, where airspace and roof access allow a safe flight. Ground-mount plants are the most common case.",
      },
    ],
    image: { src: "/images/marketing/industry-energy-solar.webp", alt: "Aerial drone photo of a utility-scale solar farm (AI-generated sample image)" },
  },
];

/* ---- Translations ------------------------------------------------------ */

/** Text-only shape a translation provides per industry (slug, icon and image come from the English entry). */
export type IndustryText = Omit<Industry, "slug" | "icon" | "image"> & { imageAlt: string };
export type IndustriesTranslation = Record<IndustrySlug, IndustryText>;

const translations: Record<Exclude<Locale, "en">, IndustriesTranslation> = { hy: industriesHy, ru: industriesRu };

export function getIndustries(locale: Locale): Industry[] {
  if (locale === "en") return industries;
  const t = translations[locale];
  return industries.map((i) => {
    const { imageAlt, ...text } = t[i.slug];
    return { ...i, ...text, image: { ...i.image, alt: imageAlt } };
  });
}

export const getIndustry = (slug: string, locale: Locale = "en") => getIndustries(locale).find((i) => i.slug === slug);
