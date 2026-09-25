/**
 * Issues pinned to the demo tower for the interactive 3D explorer.
 *
 * Positions are in the GLB's coordinate space (three.js, Y up, metres):
 * footprint x ∈ [-12, 12], z ∈ [-8, 8] (z = +8.4 is the south facade),
 * storey n spans y ∈ [(n-1)·3.2 + 0.8, n·3.2 + 0.8].
 * Delay numbers mirror the seeded LagFinding rows so the home page, the
 * dashboard and the PDF tell the same story.
 */
/** Bump when the sample GLBs are re-rendered so browsers drop cached models. */
export const SAMPLE_ASSET_VERSION = "photo-2026-09-24";
/**
 * Sep flight, photo-textured (scripts/render-photo-samples.sh): the exact modelled geometry with
 * photographs projected onto it - the same file storeys are measured on.
 */
export const PHOTOREAL_M8 = `/samples/tower-m8.glb?v=${SAMPLE_ASSET_VERSION}`;

export type IssueKind = "delay" | "defect" | "safety";
export type IssueSeverity = "critical" | "late" | "watch";
export type FlightKey = "m4" | "m6" | "m8";

export interface DemoIssue {
  id: string;
  kind: IssueKind;
  severity: IssueSeverity;
  title: string;
  floor: number | null;
  phase?: "structure" | "envelope" | "glazing";
  position: [number, number, number];
  /** camera position to fly to when selected */
  camera: [number, number, number];
  plannedPct?: number;
  observedPct?: number;
  daysLate?: number;
  plannedEnd?: string;
  citation?: string;
  detail: string;
  /** photoreal evidence close-up */
  image: string;
  /** prompt used to generate the close-up (scripts/imagery) */
  imagePrompt: string;
}

const y = (floor: number, frac = 0.5) => (floor - 1) * 3.2 + 0.8 + 3.2 * frac;

export const FLIGHTS: { key: FlightKey; label: string; date: string; model: string; daysBehind: number }[] = [
  { key: "m4", label: "May", date: "2026-05-04", model: `/samples/tower-m4.glb?v=${SAMPLE_ASSET_VERSION}`, daysBehind: -14 },
  { key: "m6", label: "Jul", date: "2026-07-06", model: `/samples/tower-m6.glb?v=${SAMPLE_ASSET_VERSION}`, daysBehind: 0 },
  { key: "m8", label: "Sep", date: "2026-09-07", model: PHOTOREAL_M8, daysBehind: 28 },
];

const m8: DemoIssue[] = [
  {
    id: "l13-structure", kind: "delay", severity: "critical", title: "Floor 13 frame 40% complete", floor: 13, phase: "structure",
    position: [-5, y(13, 0.6), 0], camera: [-38, 58, 34], plannedPct: 100, observedPct: 40, daysLate: 28, plannedEnd: "2026-08-18",
    citation: "Baseline schedule Rev. 2, p. 3, row A-049",
    detail: "Columns on grid lines C–F still in formwork, slab not poured. The baseline had this storey finished on 18 Aug.",
    image: "/images/defects/l13-structure.webp",
    imagePrompt: "photorealistic close-up drone photograph of the top working deck of a concrete residential tower under construction, half the columns still wrapped in plywood formwork, rebar mats laid but slab not poured, two workers in orange vests, overcast daylight, no text",
  },
  {
    id: "l14-structure", kind: "delay", severity: "late", title: "Floor 14 not started", floor: 14, phase: "structure",
    position: [4, y(14, 0.4), -2], camera: [30, 64, 40], plannedPct: 100, observedPct: 0, daysLate: 20, plannedEnd: "2026-08-31",
    citation: "Baseline schedule Rev. 2, p. 3, row A-053",
    detail: "No columns or core walls above floor 13. Planned complete on 31 Aug.",
    image: "/images/defects/l14-structure.webp",
    imagePrompt: "photorealistic drone photograph looking down at the unfinished top of a concrete tower, bare starter bars sticking up from the slab where the next storey should be, empty deck, tower crane hook idle, overcast, no text",
  },
  {
    id: "l8-envelope", kind: "delay", severity: "critical", title: "Floor 8 facade panels missing", floor: 8, phase: "envelope",
    position: [4, y(8), 8.6], camera: [18, 30, 46], plannedPct: 100, observedPct: 0, daysLate: 29, plannedEnd: "2026-08-25",
    citation: "Baseline schedule Rev. 2, p. 2, row A-030",
    detail: "South and east elevations open above floor 7; no panels delivered to site in any of the six shots.",
    image: "/images/defects/l8-envelope.webp",
    imagePrompt: "photorealistic drone photograph of a building facade under construction: lower floors clad with light grey precast facade panels, the floors above still open concrete frame with no walls, safety netting, overcast daylight, no text",
  },
  {
    id: "l5-glazing", kind: "delay", severity: "critical", title: "Floor 5 windows not installed", floor: 5, phase: "glazing",
    position: [-6, y(5), 8.6], camera: [-14, 18, 40], plannedPct: 100, observedPct: 0, daysLate: 28, plannedEnd: "2026-08-25",
    citation: "Baseline schedule Rev. 2, p. 2, row A-019",
    detail: "Window openings on floor 5 are empty while floors 1–4 are glazed.",
    image: "/images/defects/l5-glazing.webp",
    imagePrompt: "photorealistic close drone photograph of a residential building facade under construction, bottom floors with installed dark glass windows, the floor above with empty rectangular window openings in grey facade panels, overcast daylight, no text",
  },
  {
    id: "l15-structure", kind: "delay", severity: "watch", title: "Floor 15 at risk", floor: 15, phase: "structure",
    position: [7, y(15, 0.3), 2], camera: [40, 70, 20], plannedPct: 57, observedPct: 0, daysLate: 7, plannedEnd: "2026-09-13",
    citation: "Baseline schedule Rev. 2, p. 3, row A-057",
    detail: "Planned to be 57% done at the flight date. Cannot start before floor 14.",
    image: "/images/defects/l15-structure.webp",
    imagePrompt: "photorealistic drone photograph of a tower crane lifting a bundle of rebar above an unfinished concrete building top, overcast sky, no text",
  },
  {
    id: "l6-crack", kind: "defect", severity: "late", title: "Crack in facade panel, floor 6", floor: 6,
    position: [9, y(6), 8.6], camera: [26, 22, 34],
    detail: "Diagonal crack ≈1.4 m across a precast spandrel on the south elevation. Flag for structural engineer review.",
    image: "/images/defects/l6-crack.webp",
    imagePrompt: "photorealistic close-up photograph of a diagonal crack running across a light grey precast concrete facade panel on a building under construction, window frame edge visible, natural light, no text",
  },
  {
    id: "l12-edge", kind: "safety", severity: "critical", title: "No edge protection on working deck", floor: 12,
    position: [-11, y(12, 1), -8.4], camera: [-40, 50, -34],
    detail: "North edge of the floor-12 slab has no guardrail or netting while crews work on floor 13.",
    image: "/images/defects/l12-edge.webp",
    imagePrompt: "photorealistic drone photograph of the edge of a concrete floor slab high on a building under construction with no guardrail or safety net, sheer drop visible, overcast daylight, no people, no text",
  },
  {
    id: "l12-rebar", kind: "defect", severity: "watch", title: "Exposed rebar at slab edge", floor: 12,
    position: [12.4, y(12, 0.95), 3], camera: [44, 44, 16],
    detail: "Insufficient concrete cover on the east slab edge; corrosion risk if left exposed.",
    image: "/images/defects/l12-rebar.webp",
    imagePrompt: "photorealistic close-up photograph of exposed steel rebar at the edge of a concrete floor slab with insufficient concrete cover, slight rust, construction site, natural light, no text",
  },
  {
    id: "crane-water", kind: "safety", severity: "watch", title: "Standing water at crane base", floor: null,
    position: [-17, 0.6, -12], camera: [-30, 16, -34],
    detail: "Pooled water around the tower-crane foundation after rain; check drainage and base inspection log.",
    image: "/images/defects/crane-water.webp",
    imagePrompt: "photorealistic drone photograph of a yellow tower crane foundation base on a muddy construction site with a large puddle of standing water around the concrete base, overcast, no text",
  },
];

/** Pull fly-to cameras back so the pin sits in context rather than filling the frame. */
function framed(list: DemoIssue[], k = 1.4): DemoIssue[] {
  return list.map((i) => ({ ...i, camera: i.camera.map((c, n) => i.position[n] + (c - i.position[n]) * k) as [number, number, number] }));
}

const RAW: Record<FlightKey, DemoIssue[]> = {
  m4: [
    {
      ...m8[5], id: "m4-note", kind: "defect", severity: "watch", title: "Honeycombing on floor 3 column", floor: 3,
      position: [-9.6, y(3), 8.2], camera: [-30, 16, 36],
      detail: "Minor surface honeycombing on a perimeter column. Project otherwise 14 days ahead of plan.",
      image: "/images/defects/m4-honeycomb.webp",
      imagePrompt: "photorealistic close-up photograph of a concrete column with minor honeycombing voids on its surface, construction site, natural light, no text",
    },
  ],
  m6: [
    { ...m8[4], id: "m6-l10", title: "Floor 10 frame in progress", floor: 10, position: [-5, y(10, 0.6), 0], camera: [-34, 46, 30], severity: "watch", plannedPct: 45, observedPct: 40, daysLate: 1, plannedEnd: "2026-07-13", citation: "Baseline schedule Rev. 2, p. 2, row A-037", detail: "On plan: formwork cycle matches the 13-day storey cycle.", image: "/images/defects/l13-structure.webp" },
    { ...m8[7], id: "m6-rebar", floor: 9, position: [12.4, y(9, 0.95), 3], camera: [44, 34, 16] },
  ],
  m8,
};

export const ISSUES_BY_FLIGHT: Record<FlightKey, DemoIssue[]> = { m4: framed(RAW.m4), m6: framed(RAW.m6), m8: framed(RAW.m8) };
