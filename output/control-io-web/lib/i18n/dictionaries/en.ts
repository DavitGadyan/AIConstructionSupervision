/**
 * English UI dictionary: every marketing string that is not part of the
 * long-form content in lib/content. hy.ts and ru.ts are typed `Dictionary`,
 * so TypeScript fails if either is missing a key that exists here.
 *
 * Values are plain strings (no functions) so a slice can be passed to client
 * components. Placeholders use `{name}` and are filled with `fmt()`.
 * Plural sets use { one, few?, many?, other } and are resolved with `plural()`.
 */
export type PluralForms = { one: string; few?: string; many?: string; other: string };

export const en = {
  meta: {
    siteTitle: "control.io — Drone construction supervision & delay evidence",
    titleTemplate: "%s — control.io",
    services: {
      title: "Services: drone progress monitoring, 3D as-built, delay reports, solar inspection",
      description:
        "control.io services: construction progress monitoring against the schedule, 3D reconstruction and as-built mapping, document intelligence, facade inspection, evidence-grade delay reports and drone solar panel inspection.",
    },
    industries: {
      title: "Industries: developers, lenders, cities, insurers, contractors, solar",
      description:
        "How developers, banks, municipal building control, insurers, general contractors and solar operators use control.io drone supervision and inspection.",
    },
    pricing: {
      title: "Pricing: drone construction supervision plans",
      description:
        "control.io pricing in USD: Pilot for a single site from $1,490/month with monthly flights, Portfolio for up to 10 sites from $5,900/month with bi-weekly flights, and custom Enterprise / Lender plans with API and white-label.",
    },
    resources: {
      title: "Resources: guides to drone construction monitoring and solar inspection",
      description:
        "Plain-language guides from control.io on drone construction progress monitoring, proving schedule delays with earned schedule, and thermal inspection of solar panels.",
    },
    about: {
      title: "About control.io",
      description:
        "control.io is an independent construction-supervision company using drones, 3D reconstruction and document AI to prove whether multistorey projects are on schedule.",
    },
    contact: {
      title: "Contact: book a pilot flight",
      description:
        "Contact control.io to book a pilot drone flight for your construction site or solar plant, or to discuss a lender or municipal programme.",
    },
    notFound: { title: "Page not found" },
  },

  site: {
    /** One sentence that defines the company; used on the home page, About and in JSON-LD. */
    entityDefinition:
      "control.io is an independent construction-supervision service that flies drones over multistorey building sites, reconstructs each flight as a 3D model, compares it with the official construction schedule, and issues evidence-grade PDF reports that show whether, where and by how much a project is late.",
    defaultDescription:
      "Drone flights, 3D reconstruction and AI comparison against the construction schedule. control.io proves whether a multistorey project is on time, with evidence-grade PDF delay reports. Also: drone thermal inspection of solar farms.",
    address: "Yerevan, Armenia",
    knowsAbout: [
      "Drone construction progress monitoring",
      "Photogrammetry",
      "3D as-built reconstruction",
      "Earned schedule analysis",
      "Construction delay evidence",
      "Solar panel thermal inspection",
      "IEC TS 62446-3",
    ],
    howToName: "How control.io verifies construction progress against the schedule",
    howToDescription: "Four steps from a drone flight to an evidence-grade delay report.",
    softwareDescription: "Drone construction supervision with 3D reconstruction, AI schedule comparison and evidence-grade delay reports.",
    softwareSubCategory: "Construction supervision",
    customPricing: "Custom pricing.",
  },

  common: {
    skipToContent: "Skip to content",
    home: "Home",
    breadcrumb: "Breadcrumb",
    lastUpdated: "Last updated",
    open: "Open",
    openNamed: "Open {name}",
    readMore: "Read more",
    minRead: "{n} min read",
  },

  nav: {
    label: "Main",
    homeLabel: "control.io home",
    services: "Services",
    industries: "Industries",
    pricing: "Pricing",
    resources: "Resources",
    about: "About",
    contact: "Contact",
    allIndustries: "All industries →",
    getStarted: "Get started",
    openMenu: "Open menu",
    closeMenu: "Close menu",
  },

  language: {
    /** Accessible name of the switcher button; {language} is the current language's native name. */
    button: "Language: {language}. Change language",
    listLabel: "Choose language",
  },

  footer: {
    blurb:
      "control.io is an independent drone supervision service for multistorey construction and solar plants. We measure what was built, compare it with the schedule, and report the difference with evidence.",
    quickLinks: "Quick links",
    industries: "Industries",
    contact: "Contact",
    signIn: "Sign in",
    language: "Language",
    rights: "© 2026 control.io. All rights reserved.",
    tagline: "Independent drone supervision for construction and solar",
  },

  hero: {
    titleLine1: "Built",
    titleLine2: "On",
    titleLine3: "Time?",
    howItWorks: "How it works",
    howItWorksText: "From drone flight to delay verdict in four steps.",
    howItWorksAlt: "Drone orbit of the tower, thumbnail for the how-it-works walkthrough",
    findingsSr: "Example delay findings from the latest flight",
    floor: "Floor {n}",
    critical: "Critical",
    watch: "Watch",
    structure: "Structure",
    todaysFlights: "Today's flights",
    droneSchedule: "Drone schedule for today",
    openFlights: "Open today's flights in the app",
    shots: "6 shots · 3D mesh",
    processing: "Processing",
    scheduled: "Scheduled",
    caption: "Independent drone supervision for multistorey sites, lenders and solar farms",
    exploreModel: "Explore the model",
    towerLabel: "3D model of a 16-storey tower under construction, reconstructed from drone photos, slowly rotating",
    carouselLabel: "Hero messages",
    prevMessage: "Previous message",
    nextMessage: "Next message",
    messageN: "Message {n}: {title}",
  },

  home: {
    definitionTitle: "What is control.io?",
    /** "Order an inspection from your phone" section (#order-from-phone). */
    orderApp: {
      eyebrow: "On-demand inspections",
      titleLine1: "Order",
      titleLine2: "from your phone",
      intro:
        "Owners and building inspectors order a full inspection or a revision from the control.io app, whenever they need one. In Yerevan and Kotayk a car with a drone crew pulls up within 3–4 hours, and the independent report arrives within 12 hours of the flight.",
      cardTitle: "From tap to report",
      cardSub: "ASAP order · Yerevan & Kotayk",
      cardLink: "See per-inspection prices",
      step: "Step {n}",
      step1Value: "1 tap",
      step1Title: "Tap Order",
      step1Text: "Choose a full inspection, a revision of open findings or specific floors. ASAP, or at a time that suits the site.",
      step1Tag: "In the app",
      step2Value: "3–4 h",
      step2Title: "Car + drone on site",
      step2Text: "A car with a certified pilot and a drone pulls up and flies the whole building. You follow the crew live.",
      step2Tag: "Tracked live",
      step3Value: "12 h",
      step3Title: "Independent report",
      step3Text: "A PDF with the 3D model, progress against the schedule and hashed photos, within 12 hours of the flight.",
      step3Tag: "PDF · 3D · schedule",
      priceFrom: "From",
      perInspection: "per inspection",
      /** {pct} is the ASAP surcharge, e.g. "25%". */
      priceNote: "ASAP +{pct}. VAT excluded, paid by invoice, no in-app payment.",
      cta: "Order an inspection",
      pricesLink: "See all prices",
      storesLabel: "Mobile apps",
      comingSoon: "coming soon",
      finePrint:
        "Service area: Yerevan and Kotayk. Times count from order confirmation. We fly in daylight only; strong wind, rain or restricted airspace can move the slot, and we call the site contact if it does.",
      phonesLabel: "control.io app screens",
      phoneHomeAlt: "control.io app home screen with the project snapshot and the Order an inspection card",
      phoneOrderAlt: "Order review screen with the price, the 3–4 hour arrival window and the 12-hour report promise",
      phoneTrackingAlt: "Order tracking screen with the arrival countdown, the order steps and the crew card",
      chipLabel: "Example order status",
      chipStatus: "Car on the way",
      ldName: "On-demand drone construction inspection",
      ldServiceType: "Drone construction inspection",
      ldDescription:
        "ASAP drone inspection of a building under construction in Yerevan and Kotayk: a car with a drone crew on site within 3–4 hours of order confirmation, and an independent PDF report within 12 hours of the flight. Paid by invoice.",
    },
    industries: {
      srTitle: "All industries",
      eyebrow: "Who it is for",
      title: "One flight, six kinds of decision",
      intro:
        "The same drone evidence answers different questions: is the tranche earned, is the permit respected, is the bond at risk, are the panels producing. Pick your seat at the table.",
      readMoreSr: "about control.io for {name}",
    },
    highlights: {
      eyebrow: "What we do",
      title: "Three answers every flight delivers",
      intro:
        "control.io measures a building from the air, rebuilds it in 3D and compares it with the schedule the developer committed to. Here is what that gives you.",
      learnAbout: "Learn about {title}",
    },
    values: {
      eyebrow: "What we stand on",
      titleLine1: "Three",
      titleLine2: "pillars",
      intro:
        "A supervision report is only worth something if the reader trusts how it was made. These three principles decide how we fly, process and write.",
    },
    services: {
      eyebrow: "Our services",
      title: "Six services, one evidence trail",
      intro:
        "Every service writes into the same project timeline, so a facade defect, a late slab and a hot solar module are all traceable to a dated, hashed image.",
    },
    how: {
      eyebrow: "How it works",
      title: "From drone flight to delay verdict",
      intro:
        "control.io follows the same four steps on every site: fly a saved route, reconstruct the site in 3D, compare it with milestones taken from the official documents, and report the difference.",
      cardTitle: "One flight, end to end",
      aiPill: "AI compared",
      cardSub: "Illustrative timeline for a standard tower flight",
      day: "Day {n}",
      step: "Step {n}",
    },
    stats: {
      eyebrow: "Why it matters",
      title: "Late is a number, not a feeling",
      intro: "Percent complete hides lateness. control.io converts measured progress into earned schedule, so the answer comes out in days.",
      barLabel: "Tower B · example flight, 7 Sep",
      earnedVsPlanned: "earned vs 61% planned",
      structure: "Structure",
      envelope: "Envelope",
      glazing: "Glazing",
      notBuilt: "Not yet built",
      mckinsey: "Large construction projects typically take 20% longer to finish than scheduled.",
      mckinseyCite: "McKinsey & Company, “Imagining construction’s digital future”, 2015.",
      daysBehindValue: "−28d",
      example:
        "Product example: Tower B’s 47% was planned for 10 August. Measured on 7 September, that is 28 days behind the financed schedule.",
      hashText:
        "Every drone image is hashed at upload and every milestone cites its source page, so each finding can be re-checked by a third party.",
    },
    gallery: {
      eyebrow: "Gallery",
      title: "Same tower, three flights",
      intro:
        "Three visits on the same saved route. Because the camera positions repeat, each image lines up with the last, and the difference is the progress.",
      cardTitle: "Tower B progression",
      cardSub: "Orbit south-west · repeat route",
      flight: "Flight {n}",
      floors: { one: "{n} floor", other: "{n} floors" } as PluralForms,
      statusStructure: "Structure",
      statusEnvelope: "Structure + envelope",
      statusTopped: "Topped out",
      orbitAlt: "Drone orbit of Tower B at {floors}, {flight}",
      facadeAlt: "Close-range facade pass of the south elevation, used for defect inspection",
      facadeCaption: "Facade pass, south elevation: every panel pinned to a floor and grid line.",
      nadirAlt: "Nadir drone image used to build the orthomosaic",
      nadirCaption: "Nadir grid for the orthomosaic.",
      deckAlt: "Working deck of the tower seen from above",
      deckCaption: "Deck view: slab, formwork and rebar status.",
    },
    faq: {
      eyebrow: "FAQ",
      bigLine1: "Ask",
      bigLine2: "us",
      intro: "Straight answers about flights, evidence, documents, solar inspection and price. Anything else:",
      title: "Frequently asked questions",
      subtitle: "About control.io",
    },
  },

  cta: {
    label: "Get started",
    title: "Book a pilot flight",
    subtitle: "One site, one month, one evidence-grade report.",
    step1Title: "We fly",
    step1Text: "A certified pilot flies your site on a saved route within your first month.",
    step2Title: "We compare",
    step2Text: "Your schedule is read, cited and compared with the 3D model, floor by floor.",
    step3Title: "You decide",
    step3Text: "A PDF delay report with hashed evidence lands in your inbox and dashboard.",
    primary: "Book a pilot flight",
    secondary: "See pricing",
    servicesTitle: "Not sure which service fits?",
    servicesSubtitle: "Tell us about your site and we will suggest a flight plan.",
  },

  faqTable: {
    defaultTitle: "Frequently asked questions",
    question: "Question",
    topic: "Topic",
  },

  servicesPage: {
    title: "Services",
    sub: "control.io offers six drone-based services for construction and solar. Each one produces dated, hashed imagery that feeds the same evidence trail, so findings from different services can be cross-checked.",
    tocLabel: "Services on this page",
    serviceN: "Service {n}",
  },

  industriesPage: {
    title: "Industries",
    sub: "control.io serves six groups that need to know, independently, whether a building or a solar plant is where it should be: developers, lenders, municipal building control, insurers and sureties, general contractors, and energy operators.",
  },

  industryPage: {
    eyebrow: "Problems and answers",
    /** {audience} is the industry's lower-case plural audience, {name} its display name. */
    problemsTitle: "How does control.io help {audience}?",
    problem: "The problem",
    withUs: "With control.io",
    deliverablesEyebrow: "Deliverables",
    deliverablesTitle: "What do {audience} receive?",
    faqTitle: "{name}: common questions",
    others: "Other industries",
  },

  pricingPage: {
    title: "Pricing",
    sub: "control.io is priced per site and flight cadence. Every plan includes flights, 3D reconstruction, AI schedule comparison and PDF delay reports. Prices are in USD, excluding taxes.",
    plans: "Plans",
    mostChosen: "Most chosen",
    from: "from",
    custom: "Custom",
    faqTitle: "Pricing questions",
    inspections: {
      eyebrow: "On-demand inspections",
      title: "Order a single inspection",
      sub: "Between planned flights, owners and building inspectors can order one inspection from the control.io app or dashboard. ASAP puts a car with a drone crew on site within 3–4 hours in Yerevan and Kotayk, and the independent PDF report follows within 12 hours of the flight.",
      listLabel: "Per-inspection prices in Armenian dram (AMD), VAT excluded",
      scheduled: "Scheduled",
      scheduledSub: "a time you pick, at least 3 h ahead",
      asap: "ASAP",
      asapSub: "crew on site in 3–4 h",
      kinds: {
        full: { name: "Full inspection", text: "The whole building: all facades, a nadir grid, a 3D model and progress against the schedule." },
        revision: { name: "Revision", text: "Re-inspection of open findings after the developer reports them fixed, with a fixed / still open verdict for each." },
        targeted: { name: "Targeted inspection", text: "Specific floors, facades or issues you name when ordering, with close-up evidence." },
      },
      /** {pct} is the ASAP surcharge, e.g. "25%". */
      asapNote: "ASAP adds {pct} to the price of any inspection.",
      invoice: "Paid by invoice. There is no payment in the app.",
      area: "Service area: Yerevan and Kotayk.",
      report: "Independent PDF report within 12 hours of the flight.",
      notesLabel: "Terms",
      cta: "Order an inspection",
    },
  },

  resourcesPage: {
    title: "Resources",
    sub: "Guides written by control.io's field engineers: how drone progress monitoring works, how to prove a project is late, and how to read a thermal inspection of a solar plant.",
    guides: "Guides",
    updated: "Updated {date}",
    readGuide: "Read the guide",
  },

  guidePage: {
    by: "By",
    published: "Published",
    lastUpdated: "Last updated",
    readingTime: "Reading time",
    onThisPage: "On this page",
    shortAnswer: "Short answer",
    definition: "Definition",
    sources: "Sources",
    aboutAuthor: "About the author",
  },

  aboutPage: {
    title: "About",
    whyEyebrow: "Why we exist",
    whyTitle: "Who checks the builder?",
    whyP1:
      "On most multistorey projects, the only detailed account of progress comes from the party doing the work. Buyers, lenders and city offices read that account and decide whether to pay, extend or intervene, usually without a way to check it.",
    whyP2:
      "control.io was started to give those readers an independent measurement. We fly the site, rebuild it in 3D, read the schedule the developer committed to and report the difference, with every image hashed and every date traced back to its source page.",
    whyP3:
      "The same method, a repeatable flight plus classified findings pinned to a map, also applies to solar plants, where thermal drones find faulty modules across very large arrays.",
    imageAlt: "Drone orbit of a six-storey tower from the north-east",
    principlesEyebrow: "Principles",
    principlesTitle: "Independence, evidence, speed",
    teamTitle: "Who does the work?",
    teamText: "The team is based in {address} and works with certified local pilots wherever our customers build.",
  },

  contactPage: {
    title: "Contact",
    sub: "Tell us about your site, portfolio or solar plant. We reply within one business day with a suggested flight plan and a quote.",
    formTitle: "Book a pilot flight",
    required: "All fields marked * are required.",
    direct: "Or reach us directly",
    email: "Email",
    phone: "Phone",
    office: "Office",
    ldName: "Contact control.io",
  },

  contactForm: {
    name: "Name *",
    email: "Work email *",
    company: "Company",
    role: "You are a…",
    roles: {
      developer: "Developer",
      lender: "Bank or lender",
      municipal: "Municipal building control",
      insurer: "Insurer or surety",
      contractor: "General contractor",
      solar: "Solar owner or O&M",
      other: "Other",
    },
    message: "Tell us about the site *",
    messagePlaceholder: "Location, number of storeys or MWp, current stage, and what you need to prove.",
    submit: "Book a pilot flight",
    sending: "Sending…",
    privacy: "We only use your details to reply to this enquiry.",
    thanks: "Thanks, we have your request.",
    delivered: "An engineer will reply with a suggested flight plan and quote.",
    notDelivered: "If you do not hear from us within one business day, please send the same details by email.",
    writeDirect: "You can also write to us directly at",
    another: "Send another message",
    mailSubject: "Pilot flight enquiry: {company}",
    /** Browser validation bubbles. */
    invalidRequired: "Please fill in this field.",
    invalidEmail: "Please enter a valid email address.",
    /**
     * Topic select. Values stay in English for the CRM ("pilot" | "inspection");
     * /contact?topic=inspection (every "Order an inspection" link) preselects "inspection".
     */
    topic: "What do you need?",
    topics: {
      pilot: "A pilot flight or a monitoring plan",
      inspection: "An on-demand inspection",
    },
    /** Replaces the pilot-flight copy while the topic is "inspection". */
    inspection: {
      title: "Order an on-demand inspection",
      note: "Yerevan and Kotayk. ASAP puts a car with a drone crew on site within 3–4 hours of confirmation, and the independent PDF report follows within 12 hours of the flight. Paid by invoice.",
      /** Prefilled into an empty message field: one line per detail the dispatcher needs. */
      messageStub: "Site address:\nInspection (full, revision or specific floors):\nWhen (ASAP, or a date and time):\nSite contact (name, phone):",
      submit: "Request an inspection",
      mailSubject: "On-demand inspection: {company}",
      delivered: "We will call you to confirm the order. The 3–4 hour window counts from that confirmation.",
    },
  },

  explorer: {
    eyebrow: "Defect explorer · sample project",
    titleLine1: "Every error,",
    titleLine2: "in 3D",
    intro:
      "The tower below is rebuilt from six drone photos. Each pin is a finding from the latest flight, checked against the baseline schedule. Pick one to fly to it.",
    flightGroup: "Drone flight",
    filterGroup: "Filter issues",
    flightShort: { m4: "May", m6: "Jul", m8: "Sep" },
    flightFull: { m4: "May 2026", m6: "Jul 2026", m8: "Sep 2026" },
    onPlan: "on plan",
    daysAhead: { one: "{n} day ahead", other: "{n} days ahead" } as PluralForms,
    daysBehind: { one: "{n} day behind", other: "{n} days behind" } as PluralForms,
    kinds: { delay: "Delays", defect: "Defects", safety: "Safety" },
    kind: { delay: "Delay", defect: "Defect", safety: "Safety" },
    severity: { critical: "Critical", late: "Late", watch: "Watch" },
    phase: { structure: "Structure", envelope: "Envelope", glazing: "Glazing" },
    showPlan: "Show plan",
    storeys: "Storeys",
    allStoreys: "All storeys",
    upToStorey: "Up to storey {n}",
    all: "All",
    resetView: "Reset view",
    canvasLabel: "3D model of the tower, {flight} flight, with {n} issue markers",
    storeysPlanned: { one: "{n} storey planned", other: "{n} storeys planned" } as PluralForms,
    staticView: "Static view · 3D needs WebGL",
    loading: "Loading 3D model…",
    hint: "Drag to orbit · scroll to zoom · tap a marker",
    flightLabel: "{flight} flight",
    announceFlight: "{flight} flight, {schedule}, {issues}",
    issues: { one: "{n} issue", other: "{n} issues" } as PluralForms,
    selected: "Selected: {label}",
    cleared: "Selection cleared",
    // Issue panel
    site: "Site",
    floor: "Floor {n}",
    markerLabel: "{title}. {severity} {kind}",
    markerDaysLate: { one: ", {n} day late", other: ", {n} days late" } as PluralForms,
    listTitle: "Issues on this flight",
    findings: { one: "{n} finding", other: "{n} findings" } as PluralForms,
    pickOne: "pick one to fly to it",
    noMatches: "No issues match the filters. Turn a filter back on or raise the storey slicer.",
    colIssue: "Issue",
    colSeverity: "Severity",
    listLabel: "Issues on the model",
    daysShort: "−{n}d",
    allIssues: "All issues",
    prevIssue: "Previous issue",
    nextIssue: "Next issue",
    daysBig: { one: "−{n} day", other: "−{n} days" } as PluralForms,
    behindBaseline: "behind the baseline",
    due: "due {date}",
    planned: "Planned",
    observed: "Observed",
    plannedObserved: "Planned {planned}% complete, observed {observed}% complete",
    source: "Source:",
    evidenceAlt: "AI-generated sample image illustrating: {title}",
    evidenceMissing: "Evidence image not available yet",
    evidenceCaption: "AI-generated sample imagery, not a real site photo.",
    seeInReport: "See it in a report",
    howWeMeasure: "How we measure",
  },

  notFound: {
    title: "Page not found",
    text: "The page you are looking for does not exist or has moved.",
    back: "Back to the home page",
  },
};

/** Same shape as the English dictionary, with every leaf widened to `string`. */
type Widen<T> = T extends string ? string : T extends readonly (infer U)[] ? Widen<U>[] : { [K in keyof T]: Widen<T[K]> };
export type Dictionary = Widen<typeof en>;
