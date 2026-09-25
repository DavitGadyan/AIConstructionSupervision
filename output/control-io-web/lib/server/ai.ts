/**
 * Claude integrations:
 *  1. extractMilestones  - reads an official schedule/permit/contract PDF and
 *     returns dated milestones with the page they were read from.
 *  2. assessProgress     - looks at a flight's drone shots and states, per
 *     storey and phase, what is visibly complete, citing the shots.
 *
 * Both use structured outputs (Zod) so the result is validated before it
 * touches the database, and opt into server-side refusal fallbacks.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5";
export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

// ------------------------------------------------------------------ documents
const MilestoneSchema = z.object({
  floor: z.number().int().nullable().describe("Storey number (1 = first above-ground floor); null if the milestone is for the whole building"),
  phase: z.enum(["structure", "envelope", "glazing", "finishes"]),
  plannedStart: z.string().describe("ISO date YYYY-MM-DD"),
  plannedEnd: z.string().describe("ISO date YYYY-MM-DD"),
  sourcePage: z.number().int().describe("1-based PDF page the dates were read from"),
  sourceQuote: z.string().describe("Short verbatim excerpt of the row or sentence, max 160 chars"),
});

const ExtractionSchema = z.object({
  documentType: z.enum(["schedule", "permit", "contract", "other"]),
  issuer: z.string().nullable(),
  issuedAt: z.string().nullable().describe("ISO date the document was issued or signed, if stated"),
  projectName: z.string().nullable(),
  contractualCompletion: z.string().nullable().describe("ISO date of contractual/permitted completion, if stated"),
  delayPenaltyClause: z.string().nullable().describe("Verbatim clause about delay penalties or liquidated damages, if present"),
  milestones: z.array(MilestoneSchema),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

const EXTRACT_SYSTEM = `You read official construction documents for an independent construction supervisor.
Extract only what the document states. Never infer dates that are not written.
Map activities onto four phases:
- structure: foundations, columns, slabs, core walls, frame (per storey where given)
- envelope: external walls, facade panels, cladding, spandrels
- glazing: windows, curtain wall, glazing
- finishes: interior works, MEP fit-out, finishes, handover
Storey numbering: 1 is the first above-ground floor. If the document lists "Level 00/ground", treat it as floor 1 only when no separate first floor exists; otherwise ignore ground-level works.
Every milestone must cite the PDF page (1-based) and a short verbatim quote so a court can locate it.`;

export async function extractMilestones(pdf: Buffer, kindHint: string): Promise<Extraction> {
  const res = await anthropic().beta.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: betaZodOutputFormat(ExtractionSchema) },
    system: EXTRACT_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") } },
          { type: "text", text: `The uploader labelled this document as: ${kindHint}. Extract its metadata and all dated milestones.` },
        ],
      },
    ],
  });
  if (res.stop_reason === "refusal") throw new Error("The model declined to read this document");
  if (!res.parsed_output) throw new Error("Could not parse milestones from the document");
  return res.parsed_output;
}

// ------------------------------------------------------------------ progress
const AssessmentSchema = z.object({
  structuralFloorsComplete: z.number().int().describe("Storeys whose slab is cast and visibly complete"),
  floorInProgress: z
    .object({ floor: z.number().int(), pct: z.number().min(0).max(100), note: z.string() })
    .nullable()
    .describe("The storey currently being built, if any"),
  observations: z.array(
    z.object({
      floor: z.number().int(),
      phase: z.enum(["structure", "envelope", "glazing"]),
      pct: z.number().min(0).max(100),
      confidence: z.number().min(0).max(1),
      shotIds: z.array(z.string()).describe("IDs of the shots that show this"),
      rationale: z.string().describe("One sentence: what is visible"),
    }),
  ),
  siteNotes: z.array(z.string()).describe("Other things a supervisor should know: crane idle, no workers visible, material stockpiles, safety issues"),
});
export type Assessment = z.infer<typeof AssessmentSchema>;

export async function assessProgress(input: {
  projectName: string;
  floorsTotal: number;
  floorHeightM: number;
  capturedAt: Date;
  meshFloors: number | null;
  shots: { id: string; label: string; mediaType: "image/jpeg" | "image/png"; data: Buffer }[];
}): Promise<Assessment> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const s of input.shots.slice(0, 12)) {
    content.push({ type: "text", text: `Shot ${s.id} - ${s.label}` });
    content.push({ type: "image", source: { type: "base64", media_type: s.mediaType, data: s.data.toString("base64") } });
  }
  content.push({
    type: "text",
    text: [
      `Project: ${input.projectName}. ${input.floorsTotal} storeys above ground, storey height ${input.floorHeightM} m.`,
      `Flight date: ${input.capturedAt.toISOString().slice(0, 10)}.`,
      input.meshFloors != null
        ? `The 3D reconstruction's slab height corresponds to ${input.meshFloors} completed structural storeys - use it as a cross-check, and say so in the rationale if the photos disagree.`
        : "No 3D reconstruction is available for this flight.",
      "For every storey 1..N and each of structure / envelope / glazing, state the visible completion %.",
      "Count storeys from the photos carefully (count slab edges). Use 0 for work not started. If a phase cannot be seen on a storey, give your best estimate with low confidence.",
    ].join("\n"),
  });

  const res = await anthropic().beta.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    thinking: { type: "adaptive" },
    output_config: { effort: "high", format: betaZodOutputFormat(AssessmentSchema) },
    system:
      "You are an independent construction progress surveyor reviewing drone photographs of a multistorey building. Report only what is visible. Your output will be compared against the developer's official schedule and may be used as evidence, so be precise and conservative.",
    messages: [{ role: "user", content }],
  });
  if (res.stop_reason === "refusal") throw new Error("The model declined to assess these images");
  if (!res.parsed_output) throw new Error("Could not parse the progress assessment");
  return res.parsed_output;
}
