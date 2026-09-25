import type { Locale } from "@/lib/i18n/config";
import { guidesHy } from "./i18n/guides.hy";
import { guidesRu } from "./i18n/guides.ru";

export type GuideSlug =
  | "what-is-drone-construction-progress-monitoring"
  | "how-to-prove-a-developer-is-behind-schedule"
  | "drone-thermal-inspection-of-solar-panels";

export type GuideSection = {
  /** Question-style H2. */
  h2: string;
  paragraphs: string[];
  list?: string[];
  table?: { head: string[]; rows: string[][] };
};

export type Guide = {
  slug: GuideSlug;
  title: string;
  description: string;
  tldr: string;
  definition: { term: string; text: string };
  datePublished: string;
  dateModified: string;
  readingMinutes: number;
  image: { src: string; alt: string };
  sections: GuideSection[];
  sources?: { label: string; note: string }[];
};

export const guideAuthor = {
  name: "control.io Field Engineering Team",
  description: "Civil engineers, licensed drone pilots and photogrammetry specialists who run control.io's site supervision and inspection flights.",
};

export const guides: Guide[] = [
  {
    slug: "what-is-drone-construction-progress-monitoring",
    title: "What is drone construction progress monitoring?",
    description:
      "A plain-language guide to drone construction progress monitoring: how flights, photogrammetry and schedule comparison work together to measure what has been built.",
    tldr:
      "Drone construction progress monitoring means flying a building site on a regular schedule, turning the photos into a measurable 3D model, and comparing that model with the construction programme. The result is an objective, dated record of what was built and whether it matches the plan.",
    definition: {
      term: "Drone construction progress monitoring",
      text: "The repeated aerial capture of a construction site with an unmanned aircraft, followed by photogrammetric reconstruction and comparison against the planned schedule, to measure physical progress independently of the parties doing the work.",
    },
    datePublished: "2026-05-12",
    dateModified: "2026-09-18",
    readingMinutes: 7,
    image: { src: "/images/marketing/guide-progress.webp", alt: "Aerial drone photo of a residential tower under construction (AI-generated sample image)" },
    sections: [
      {
        h2: "How does drone progress monitoring work?",
        paragraphs: [
          "It has three stages: capture, reconstruction and comparison. In capture, a pilot flies a pre-planned route over the site: circular orbits at several heights, vertical passes along each facade, and a top-down (nadir) grid. Because the route is saved, every visit photographs the building from the same positions.",
          "In reconstruction, photogrammetry software finds the same features across hundreds of overlapping photos and computes their 3D positions. The outputs are a textured mesh, an orthomosaic (a geometrically corrected top-down image) and a point cloud.",
          "In comparison, the reconstruction is measured against the plan: which slabs are poured, which floors have facade panels, how high the structure stands. Those measurements are set against the dates in the schedule to decide whether each part of the building is on time.",
        ],
      },
      {
        h2: "What can a drone measure on a multistorey site?",
        paragraphs: ["A well-planned flight captures enough detail to measure most of the visible building programme:"],
        list: [
          "Number of completed structural floors and the height of the frame",
          "Slab pours, column and core progress on the working deck",
          "Facade and envelope installation per elevation and floor",
          "Roofing, external works and site logistics areas",
          "Stockpile and excavation volumes between two flights",
        ],
      },
      {
        h2: "What can it not measure?",
        paragraphs: [
          "Drones see what is visible from outside. Interior fit-out, MEP installation behind closed envelopes and anything under temporary covers cannot be measured from the air. For those trades, drone data is combined with interior 360° capture or site records. A good monitoring report says clearly which items were measured and which were not.",
        ],
      },
      {
        h2: "How accurate is a drone 3D model of a building?",
        paragraphs: [
          "Accuracy depends mainly on ground sample distance (GSD), the size of one image pixel on the ground, which is set by camera resolution and flight distance. Facade passes flown close to the building give a much finer GSD than high orbits. Ground control points or RTK positioning improve absolute accuracy. For progress purposes (is this slab poured, is this panel installed) relative accuracy between flights matters more than survey-grade absolute accuracy.",
        ],
      },
      {
        h2: "How is progress compared with the construction schedule?",
        paragraphs: [
          "The schedule is first turned into checkable milestones: 'slab level 9 poured by 14 March', 'south facade to level 6 by 30 April'. control.io's document AI extracts these from the programme PDF and links each to the source page. Each flight then marks milestones as met or not met, and the share of planned work actually achieved is converted to schedule time using earned schedule. That gives a delay measured in days, per floor and per trade.",
        ],
      },
      {
        h2: "Who uses drone progress monitoring?",
        paragraphs: [
          "Developers use it to check the contractor. Lenders use it before releasing loan tranches. Municipal building-control teams use it to watch many permitted sites. Insurers and sureties use it to spot projects drifting toward default. Contractors use it to document their own progress and support extension-of-time claims.",
        ],
      },
      {
        h2: "Is it legal to fly drones over construction sites?",
        paragraphs: [
          "Usually yes, under the local aviation rules for commercial drone operations, which typically require a licensed pilot, registered aircraft and permission for controlled airspace or flights near people. Rules differ by country, so operators must check local regulations (for example, the FAA's Part 107 in the United States or EASA's rules in the EU). control.io flies with certified pilots and handles permissions for each site.",
        ],
      },
    ],
  },
  {
    slug: "how-to-prove-a-developer-is-behind-schedule",
    title: "How to prove a developer is behind schedule (earned schedule explained)",
    description:
      "How to turn construction progress into a delay measured in days using earned schedule, and what evidence you need to prove it to a lender, buyer or court.",
    tldr:
      "To prove a project is late you need three things: the baseline schedule the developer committed to, an independent dated measurement of what was actually built, and a method that converts the gap into time. Earned schedule does the last step: it finds the date by which the plan expected today's progress, and the difference from today is the delay.",
    definition: {
      term: "Earned schedule (ES)",
      text: "A project-control technique, introduced by Walt Lipke in 2003, that measures schedule performance in units of time. ES is the point on the baseline at which the currently earned amount of work was planned to be complete.",
    },
    datePublished: "2026-06-03",
    dateModified: "2026-09-20",
    readingMinutes: 9,
    image: { src: "/images/marketing/guide-schedule.webp", alt: "Project manager and engineer checking the upper floors of a tower on site (AI-generated sample image)" },
    sections: [
      {
        h2: "What counts as proof that a project is late?",
        paragraphs: [
          "A claim that a building is late is only as strong as its weakest link. You need the baseline (the approved schedule or the contractual milestone dates), a measurement of actual progress that the developer did not produce, and a transparent calculation. Remove any of the three and the argument collapses into opinion.",
        ],
        list: [
          "The baseline: signed programme, loan disbursement schedule or permit conditions",
          "The measurement: dated, independent, repeatable, with original images kept",
          "The method: a calculation anyone can reproduce from the same inputs",
        ],
      },
      {
        h2: "Why is percent complete not enough?",
        paragraphs: [
          "'Tower B is 47% complete' says nothing on its own about lateness. It only becomes meaningful next to what was planned for today. And even '47% earned vs 61% planned' is a gap in work, not in time, and it cannot be put straight into a delay notice. Classic earned-value schedule variance is also expressed in money and tends towards zero as a project ends, even when it finishes months late.",
        ],
      },
      {
        h2: "How does earned schedule turn progress into days?",
        paragraphs: [
          "Take the planned progress curve from the baseline. Find the date on that curve where planned progress equals the progress actually earned today. That date is the earned schedule (ES). Compare it with the actual time (AT), today's date.",
        ],
        list: [
          "Schedule variance in time: SV(t) = ES − AT (negative means late)",
          "Schedule performance index: SPI(t) = ES ÷ AT (below 1.0 means late)",
          "Independent estimate of completion: planned duration ÷ SPI(t)",
        ],
      },
      {
        h2: "What does a worked example look like?",
        paragraphs: [
          "Take a product example. Tower B's baseline planned 61% of structure and envelope by 7 September. A drone flight on 7 September measures 47% earned. On the baseline curve, 47% was scheduled for 10 August. So ES = 10 August, AT = 7 September, and SV(t) = −28 days: the tower is 28 days behind the plan it was financed on.",
        ],
        table: {
          head: ["Input", "Value", "Source"],
          rows: [
            ["Planned progress today", "61%", "Baseline programme, p. 4"],
            ["Earned progress today", "47%", "Drone flight, 7 Sep, 3D model"],
            ["Date plan reached 47%", "10 Aug", "Baseline curve"],
            ["SV(t)", "−28 days", "ES − AT"],
          ],
        },
      },
      {
        h2: "How do you make the measurement independent and tamper-evident?",
        paragraphs: [
          "Fly on a fixed cadence with a saved route, keep every original image, and record a cryptographic hash (such as SHA-256) of each file at upload. The hash lets anyone confirm later that the image in the report is the image that was captured. Record capture time and position from the drone's metadata, and annex the schedule pages the milestones came from. control.io does all of this by default.",
        ],
      },
      {
        h2: "How should the delay be reported?",
        paragraphs: [
          "Report per floor and per trade, not only for the whole building: 'Floor 13 structure, 34 days late' is actionable, '12% behind' is not. Show the image that proves each finding next to the milestone it tests and cite the page of the schedule. Keep the tone factual; the report's job is to establish the facts, and decisions about notices, penalties or tranche holds belong to the reader and their advisers.",
        ],
      },
    ],
    sources: [
      { label: "Lipke, W. (2003). 'Schedule is Different'. The Measurable News.", note: "Original description of the earned schedule method." },
      { label: "McKinsey Global Institute / McKinsey & Company (2015). 'Imagining construction's digital future'.", note: "Reports that large projects typically take 20% longer to finish than scheduled." },
    ],
  },
  {
    slug: "drone-thermal-inspection-of-solar-panels",
    title: "Drone thermal inspection of solar panels: anomaly classes",
    description:
      "Which solar PV defects a drone thermal inspection finds, how they look in thermal images, how IEC TS 62446-3 classifies them, and what conditions an inspection needs.",
    tldr:
      "A drone thermal inspection flies an infrared camera over a working solar plant and finds modules that run hotter than their neighbours. The heat pattern points to the cause: a single hot cell suggests a crack or hot-spot, a hot third of a module points to an active bypass diode, and a whole warm module or row suggests a disconnected module or string. IEC TS 62446-3 sets out how such inspections should be done and classified.",
    definition: {
      term: "IEC TS 62446-3",
      text: "An IEC technical specification (Photovoltaic systems – Part 3: Outdoor infrared thermography of photovoltaic modules and plants) that describes how to perform and report thermographic inspections of PV plants, including required conditions and classes of abnormalities.",
    },
    datePublished: "2026-07-08",
    dateModified: "2026-09-15",
    readingMinutes: 8,
    image: { src: "/images/marketing/service-solar-thermal.webp", alt: "Thermal drone image of a solar farm with hot cells (AI-generated sample image)" },
    sections: [
      {
        h2: "Why inspect solar panels with a thermal drone?",
        paragraphs: [
          "A module that is not converting light into electricity turns more of it into heat. An infrared camera sees that heat directly, so a single flight reveals faults across thousands of modules that would take days to find from the ground. Pairing each thermal image with an RGB image of the same module separates real faults from reflections and dirt.",
        ],
      },
      {
        h2: "What conditions does a thermal PV inspection need?",
        paragraphs: ["Thermal contrast only appears when the plant is producing. IEC TS 62446-3 specifies minimum conditions; in practice the key ones are:"],
        list: [
          "Irradiance of at least 600 W/m² in the plane of the modules, stable during capture",
          "Clear sky, without passing clouds that change irradiance mid-flight",
          "Plant operating under normal load (inverters on, not curtailed)",
          "Low wind, which otherwise cools modules unevenly",
          "Viewing angle and image resolution sufficient to resolve individual cells",
        ],
      },
      {
        h2: "What anomaly types does a thermal inspection detect?",
        paragraphs: ["Each fault leaves a characteristic heat pattern:"],
        table: {
          head: ["Anomaly", "Thermal pattern", "Typical cause"],
          rows: [
            ["Single hot cell / hot-spot", "One cell clearly warmer than the rest", "Cracked cell, local shading, manufacturing defect"],
            ["Multiple hot cells", "Several scattered warm cells", "Micro-cracks, cell degradation"],
            ["Active bypass diode", "One third of the module uniformly warm", "Faulty cell string or shading in that sub-string"],
            ["Open module", "Whole module warmer than neighbours", "Disconnected module or failed connector"],
            ["Open string", "A full row of modules uniformly warm", "String disconnected, blown fuse, breaker off"],
            ["Soiling / bird droppings", "Irregular warm patches matching dirt", "Dust, droppings, debris"],
            ["Vegetation shading", "Warm cells along the lower edge", "Grass or shrubs growing into the array"],
            ["Junction box heating", "Hot point at the junction box", "Poor contact or diode failure"],
          ],
        },
      },
      {
        h2: "How does IEC TS 62446-3 classify anomalies?",
        paragraphs: [
          "The specification groups findings into classes of abnormality (CoA). Broadly, CoA 1 is a module without abnormality, CoA 2 is a thermal abnormality that should be investigated and scheduled for action, and CoA 3 is a safety-relevant thermal abnormality that needs prompt action. The class depends on the pattern and on the temperature difference relative to healthy modules under the measured conditions. control.io reports each anomaly with its type, its class and the conditions at capture.",
        ],
      },
      {
        h2: "What does a good solar inspection report contain?",
        paragraphs: ["A report should let a field crew walk straight to each fault:"],
        list: [
          "A geo-tagged map of the plant with every anomaly pinned to its module",
          "For each anomaly: thermal and RGB image, type, class and temperature difference",
          "Irradiance, ambient temperature and wind at capture time",
          "A prioritised list, safety-relevant findings first",
          "A comparison with the previous inspection where one exists",
        ],
      },
      {
        h2: "How often should a solar farm be inspected?",
        paragraphs: [
          "Many owners inspect annually, plus at commissioning and before warranty expiry. Plants with known issues, heavy soiling or vegetation growth benefit from more frequent flights. A repeat inspection on the same flight plan shows whether earlier faults were fixed and whether new ones are appearing.",
        ],
      },
    ],
    sources: [
      { label: "IEC TS 62446-3:2017. Photovoltaic (PV) systems – Requirements for testing, documentation and maintenance – Part 3: Photovoltaic modules and plants – Outdoor infrared thermography.", note: "Inspection conditions and classes of abnormality." },
    ],
  },
];

/* ---- Translations ------------------------------------------------------ */

/** Text-only shape of a translated guide; slug, dates, reading time and image come from the English entry. */
export type GuideText = Omit<Guide, "slug" | "datePublished" | "dateModified" | "readingMinutes" | "image"> & { imageAlt: string };
export type GuidesTranslation = {
  author: { name: string; description: string };
  guides: Record<GuideSlug, GuideText>;
};

const translations: Record<Exclude<Locale, "en">, GuidesTranslation> = { hy: guidesHy, ru: guidesRu };

export function getGuides(locale: Locale): Guide[] {
  if (locale === "en") return guides;
  const t = translations[locale].guides;
  return guides.map((g) => {
    const { imageAlt, ...text } = t[g.slug];
    return { ...g, ...text, image: { ...g.image, alt: imageAlt } };
  });
}

export const getGuide = (slug: string, locale: Locale = "en") => getGuides(locale).find((g) => g.slug === slug);

export const getGuideAuthor = (locale: Locale) => (locale === "en" ? guideAuthor : translations[locale].author);
