import type { Locale } from "@/lib/i18n/config";
import type { Tuple } from "@/lib/i18n/types";
import { servicesHy } from "./i18n/services.hy";
import { servicesRu } from "./i18n/services.ru";

export type ServiceId =
  | "progress-monitoring"
  | "3d-reconstruction"
  | "document-intelligence"
  | "structure-facade-inspection"
  | "delay-evidence-reports"
  | "solar-inspection";

export type HighlightId = "progress-monitoring" | "3d-reconstruction" | "delay-evidence-reports";

export type Service = {
  id: ServiceId;
  title: string;
  short: string;
  description: string;
  benefits: { title: string; text: string }[];
  image: { src: string; alt: string };
};

export const services: Service[] = [
  {
    id: "progress-monitoring",
    title: "Construction progress monitoring & schedule verification",
    short: "Scheduled drone flights measure what was actually built and set it against what the schedule says should exist by that date.",
    description:
      "control.io flies the same route over your site on a fixed cadence, counts completed floors, slabs and envelope panels in the reconstruction, and compares them with the baseline programme. The output is a per-floor, per-trade verdict: on track, watch or late, with the number of days behind.",
    benefits: [
      { title: "Per-floor verdicts", text: "Each storey and trade gets a status and a day count, not a vague percentage." },
      { title: "Same route every flight", text: "Repeatable flight paths make month-to-month images directly comparable." },
      { title: "Earned schedule, not guesses", text: "Progress is converted into schedule time so a slip reads as days behind." },
    ],
    image: { src: "/images/marketing/service-progress.webp", alt: "Oblique drone photo of a tower under construction used for progress monitoring (AI-generated sample image)" },
  },
  {
    id: "3d-reconstruction",
    title: "3D reconstruction & as-built mapping",
    short: "Photogrammetry turns every flight into a measurable 3D mesh, orthomosaic and point cloud.",
    description:
      "Overlapping drone photos are processed into a textured 3D mesh, a top-down orthomosaic and a dense point cloud. Engineers can measure heights, openings and stockpile volumes directly in the browser, and compare any two flights side by side.",
    benefits: [
      { title: "Mesh, ortho, point cloud", text: "Standard photogrammetry outputs you can export to your own CAD or BIM tools." },
      { title: "Measure in the browser", text: "Distances, heights and areas taken straight from the reconstruction." },
      { title: "Volumes and earthworks", text: "Stockpile and excavation volumes calculated between flights." },
    ],
    image: { src: "/images/marketing/service-3d.webp", alt: "Survey drone flying a photogrammetry grid over a construction site (AI-generated sample image)" },
  },
  {
    id: "document-intelligence",
    title: "Construction document intelligence",
    short: "AI reads schedules, permits and contracts and turns them into dated milestones, each with a page citation.",
    description:
      "Upload the construction schedule, building permit and contract. control.io extracts every dated obligation into a milestone list and links each one back to the page it came from, so the comparison with the drone evidence rests on the developer's own documents.",
    benefits: [
      { title: "Milestones with citations", text: "Every extracted date points to the source page and line for audit." },
      { title: "Schedules, permits, contracts", text: "Works with PDF programmes, scanned permits and contract annexes." },
      { title: "Human review built in", text: "An engineer confirms the milestone list before it is used in a report." },
    ],
    image: { src: "/images/marketing/service-documents.webp", alt: "Engineer holding a tablet with an aerial photo of the building next to blueprints (AI-generated sample image)" },
  },
  {
    id: "structure-facade-inspection",
    title: "High-precision structure & facade inspection",
    short: "Close-range facade passes capture cracks, missing anchors and envelope defects at a known ground sample distance.",
    description:
      "Vertical facade passes at a fixed stand-off distance produce high-resolution images of every elevation. Defects are tagged on the 3D model by floor and grid line, so the contractor receives a location, not just a photo.",
    benefits: [
      { title: "Located on the model", text: "Every defect pinned to a floor, elevation and grid position." },
      { title: "No scaffolding or rope access", text: "Survey tall elevations without closing the site or the street." },
      { title: "Before-and-after proof", text: "Re-fly the same pass to confirm the defect was repaired." },
    ],
    image: { src: "/images/marketing/service-inspection.webp", alt: "Inspection drone hovering close to a building facade under construction (AI-generated sample image)" },
  },
  {
    id: "delay-evidence-reports",
    title: "Delay evidence reports & real-time monitoring",
    short: "A live project feed plus PDF reports with hashed imagery and the official documents annexed.",
    description:
      "Stakeholders follow the project in a live dashboard between flights. After each flight control.io issues a PDF report that lists every late milestone, shows the drone image that proves it, records a SHA-256 hash of each photo and annexes the schedule pages it relies on, so the report can be checked independently.",
    benefits: [
      { title: "SHA-256 per image", text: "Each photo is hashed at upload so later tampering is detectable." },
      { title: "Documents annexed", text: "The cited schedule and permit pages travel inside the report." },
      { title: "Live feed between reports", text: "Flights, verdicts and alerts appear in the dashboard as they land." },
    ],
    image: { src: "/images/marketing/service-reports.webp", alt: "Site manager reading a delay report with aerial evidence photos (AI-generated sample image)" },
  },
  {
    id: "solar-inspection",
    title: "Solar panel inspection",
    short: "Thermal and RGB drone surveys find hot-spots, soiling, cracked cells, disconnected strings and shading.",
    description:
      "A radiometric thermal camera and an RGB camera fly the array together. Anomalies are classified along the lines of IEC TS 62446-3 (hot cells, active bypass diodes, open strings, soiling, vegetation shading) and each one is pinned to a module on a geo-tagged defect map, delivered with a PDF report.",
    benefits: [
      { title: "Thermal + RGB together", text: "Heat signatures are confirmed against a visual image of the same module." },
      { title: "Per-module defect map", text: "Every anomaly geo-tagged to a row, table and module position." },
      { title: "Prioritised PDF report", text: "Anomalies ranked by class so O&M crews fix safety issues first." },
    ],
    image: { src: "/images/marketing/service-solar-thermal.webp", alt: "Thermal drone image of solar panel rows showing hot cells and a warm string (AI-generated sample image)" },
  },
];

/** The three highlights shown directly after the industries grid on the home page. */
export const highlights: { id: HighlightId; kicker: string; title: string; text: string; image: { src: string; alt: string } }[] = [
  {
    id: "progress-monitoring",
    kicker: "01",
    title: "Progress verification",
    text: "Know which floors are finished, which are late and by how many days, measured from the air rather than reported by the party being measured.",
    image: { src: "/images/flights/m8/orbit-se.webp", alt: "Drone photo of the demo tower in September from the south-east (AI-generated sample image)" },
  },
  {
    id: "3d-reconstruction",
    kicker: "02",
    title: "3D as-built reconstruction",
    text: "Every flight becomes a measurable 3D model. Compare this month with last month, or the building with the plan, on screen.",
    image: { src: "/images/flights/m6/nadir.webp", alt: "Top-down drone photo of the demo tower site in July (AI-generated sample image)" },
  },
  {
    id: "delay-evidence-reports",
    kicker: "03",
    title: "Evidence-grade delay reports",
    text: "PDF reports with hashed photos and the cited schedule pages annexed, written to be checked by a lender, a court or a regulator.",
    image: { src: "/images/flights/m4/facade-s.webp", alt: "South facade of the demo tower in May (AI-generated sample image)" },
  },
];

/* ---- Translations ------------------------------------------------------ */

/** Text-only shape a translation must provide for every service (ids, images and order come from the English list). */
export type ServiceText = {
  title: string;
  short: string;
  description: string;
  benefits: Tuple<{ title: string; text: string }, 3>;
  imageAlt: string;
};

export type ServicesTranslation = {
  services: Record<ServiceId, ServiceText>;
  highlights: Record<HighlightId, { title: string; text: string; imageAlt: string }>;
};

const translations: Record<Exclude<Locale, "en">, ServicesTranslation> = { hy: servicesHy, ru: servicesRu };

export function getServices(locale: Locale): Service[] {
  if (locale === "en") return services;
  const t = translations[locale].services;
  return services.map((s) => {
    const x = t[s.id];
    return { ...s, title: x.title, short: x.short, description: x.description, benefits: [...x.benefits], image: { ...s.image, alt: x.imageAlt } };
  });
}

export function getHighlights(locale: Locale) {
  if (locale === "en") return highlights;
  const t = translations[locale].highlights;
  return highlights.map((h) => ({ ...h, title: t[h.id].title, text: t[h.id].text, image: { ...h.image, alt: t[h.id].imageAlt } }));
}
