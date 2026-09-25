/**
 * Photoreal imagery for the site and the demo evidence.
 *
 *   npx tsx scripts/imagery/generate.ts [--dry-run] [--only id1,id2] [--group marketing|defects|flights] [--force]
 *
 * Providers
 *  - higgsfield: text-to-image (Soul, photographic). Needs HF_API_KEY_ID / HF_API_KEY_SECRET.
 *  - openai:     image edit (gpt-image-2) on a Blender render, so geometry, storey count and camera stay
 *                identical to the 3D model the dashboard measures. Needs OPENAI_API_KEY.
 * Keys come from .env and are never printed. Every run rewrites data/imagery/manifest.json.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import { ISSUES_BY_FLIGHT } from "../../lib/content/demoDefects";

for (const l of readFileSync(".env", "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)="?(.*?)"?$/.exec(l.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

type Slot =
  | { id: string; group: "marketing" | "defects"; provider: "higgsfield"; prompt: string; aspect: "16:9" | "4:3" | "3:4" | "1:1"; out: string }
  | { id: string; group: "flights" | "marketing"; provider: "openai"; prompt: string; plate: string; out: string };

const STYLE =
  "Hyperrealistic documentary photograph, shot on a full-frame camera, natural overcast daylight, true-to-life colours, fine detail, realistic textures and dirt, no text, no lettering, no readable writing, no logos, no watermark, no people facing camera";
const SITE = "a real construction site of a 16-storey reinforced-concrete residential tower in Yerevan, Armenia, with Mount Ararat haze on the horizon";

const marketing: Slot[] = [
  ["hero-howitworks", "16:9", `A drone pilot in a hi-vis vest and white hard hat holding an enterprise drone controller, a large grey industrial quadcopter hovering in front of ${SITE}`],
  ["industry-developers", "4:3", `Aerial drone photograph of ${SITE}, tower crane, fresh concrete floors at the top, formwork and rebar`],
  ["industry-banks-lenders", "4:3", "Two bank credit officers seen from behind in a modern glass office, looking at a large wall monitor that shows only a full-screen aerial drone photograph of a concrete tower under construction, city skyline through the window, shallow depth of field"],
  ["industry-municipal-building-control", "4:3", "A municipal building inspector in hi-vis vest and hard hat with a tablet on a construction site, looking up at a concrete residential tower under construction"],
  ["industry-insurers-sureties", "4:3", "Top-down aerial drone photograph of a busy urban construction site with a concrete tower core, tower crane, site cabins, material stacks and mud tracks"],
  ["industry-general-contractors", "4:3", "Construction workers tying rebar on the top working deck of a concrete tower under construction, plywood formwork and column shutters, city far below"],
  ["industry-energy-solar", "4:3", "Aerial drone photograph of a large utility-scale solar farm, long rows of tilted photovoltaic panels, service roads, inverter stations, dry grass, mountains in the distance"],
  ["service-progress", "4:3", `Low oblique aerial drone photograph of ${SITE}, some floors with facade panels, upper floors open frame, crane lifting rebar`],
  ["service-3d", "4:3", "An industrial drone flying a survey grid high above a construction site at golden hour, photogrammetry mission, concrete tower under construction below"],
  ["service-documents", "4:3", "Close-up of a construction engineer's hands holding a tablet that shows a full-screen aerial photograph of a concrete tower under construction, rolled blueprints and a white hard hat softly out of focus on a site-office desk, very shallow depth of field"],
  ["service-inspection", "4:3", "An enterprise inspection drone hovering close to the concrete facade of a residential building under construction, inspecting precast panels and window openings"],
  ["service-reports", "4:3", "A site manager in a hi-vis vest on a construction site holding an open bound report showing a full-page aerial photograph of the building, the report pages softly out of focus, concrete tower under construction behind, shallow depth of field"],
  ["service-solar", "4:3", "Close aerial drone photograph of photovoltaic solar panel rows with visible module frames and soiling, a technician walking between rows"],
  ["about-team", "16:9", "A small team of construction engineers and a drone pilot in hi-vis vests reviewing a tablet together on a construction site, concrete tower and crane behind them"],
  ["guide-progress", "16:9", `Aerial drone photograph of ${SITE} at mid-morning, crane, scaffold on upper floors`],
  ["guide-schedule", "16:9", "A project manager and a site engineer in hi-vis vests standing on a muddy construction site looking up at an unfinished concrete residential tower, one pointing at the upper floors, holding a tablet"],
  ["og", "16:9", `Wide aerial drone photograph of ${SITE}, dramatic soft clouds, lots of calm sky at the top`],
].map(([id, aspect, prompt]) => ({ id, group: "marketing", provider: "higgsfield", aspect: aspect as "4:3", prompt: `${prompt}. ${STYLE}.`, out: `public/images/marketing/${id}.webp` }));

const defects: Slot[] = Object.values(ISSUES_BY_FLIGHT)
  .flat()
  .filter((i, idx, arr) => arr.findIndex((x) => x.image === i.image) === idx)
  .map((i) => ({ id: `defect-${path.basename(i.image, ".webp")}`, group: "defects", provider: "higgsfield", aspect: "4:3", prompt: `${i.imagePrompt}. ${STYLE}.`, out: `public${i.image}` }));

const VIEWS: Record<string, string> = {
  "orbit-sw": "oblique aerial view from the south-west",
  "orbit-se": "oblique aerial view from the south-east",
  "orbit-ne": "oblique aerial view from the north-east",
  "facade-s": "straight-on view of the south facade",
  nadir: "straight top-down nadir view",
  deck: "close oblique view of the top working deck",
};
const flights: Slot[] = ["m4", "m6", "m8"].flatMap((f) =>
  Object.entries(VIEWS).map(([v, desc]) => ({
    id: `flight-${f}-${v}`,
    group: "flights" as const,
    provider: "openai" as const,
    plate: `data/plates/${f}/${v}.png`,
    out: `public/images/flights/${f}/${v}.webp`,
    prompt: [
      `Turn this 3D render into a hyperrealistic photograph taken by a DJI enterprise drone camera (${desc}) of a real construction site.`,
      "Keep EXACTLY the same composition, camera angle, building geometry, number of storeys, which floors have facade panels and windows, the position of the tower crane, site cabins, roads and neighbouring buildings. Do not add or remove floors.",
      "Make every surface real: weathered cast-in-place concrete with formwork marks, dusty plywood formwork, rusty rebar, muddy ground with tyre tracks, puddles, real glass reflections, safety netting, small workers in hi-vis on the deck, construction debris, realistic soft overcast daylight and atmospheric haze.",
      "No text, no watermark, no timestamp overlay.",
    ].join(" "),
  })),
);
const solarThermal: Slot = {
  id: "service-solar-thermal",
  group: "marketing",
  provider: "openai",
  plate: "public/samples/solar/thermal.jpg",
  out: "public/images/marketing/service-solar-thermal.webp",
  prompt:
    "Turn this into a real radiometric thermal (infrared, ironbow palette) drone image of a solar farm, keeping exactly the same layout, rows and the hot-spot positions: bright white/yellow single hot cells, an orange warm string, warm soiled modules. Realistic sensor noise and thermal blur, dark purple cool background. No text, no scale bar, no watermark.",
};

const SLOTS: Slot[] = [...marketing, solarThermal, ...defects, ...flights];

// ------------------------------------------------------------------ providers
const HF = "https://api.higgsfield.ai";
const hfAuth = () => `Key ${process.env.HF_API_KEY_ID}:${process.env.HF_API_KEY_SECRET}`;
async function higgsfield(prompt: string, aspect: string): Promise<Buffer> {
  const sub = await fetch(`${HF}/higgsfield-ai/soul/v2/standard`, {
    method: "POST",
    headers: { Authorization: hfAuth(), "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, aspect_ratio: aspect }),
  });
  if (!sub.ok) throw new Error(`higgsfield submit ${sub.status}: ${(await sub.text()).slice(0, 200)}`);
  const { request_id } = await sub.json();
  let delay = 3000;
  for (let i = 0; i < 80; i++) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.3, 10000);
    const st = await fetch(`${HF}/requests/${request_id}/status`, { headers: { Authorization: hfAuth() } }).then((r) => r.json());
    if (st.status === "completed") {
      const url = st.images?.[0]?.url;
      if (!url) throw new Error("higgsfield: no image url");
      return Buffer.from(new Uint8Array(await (await fetch(url)).arrayBuffer()));
    }
    if (["failed", "nsfw", "canceled"].includes(st.status)) throw new Error(`higgsfield ${st.status}`);
  }
  throw new Error("higgsfield timeout");
}

let openai: OpenAI | null = null;
const OPENAI_MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";
async function openaiEdit(prompt: string, plate: string): Promise<Buffer> {
  openai ??= new OpenAI();
  const png = await sharp(plate).resize(1536, 1024, { fit: "cover" }).png().toBuffer();
  const res = await openai.images.edit({
    model: OPENAI_MODEL,
    image: await toFile(png, "plate.png", { type: "image/png" }),
    prompt,
    size: "1536x1024",
    quality: "high",
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("openai: empty response");
  return Buffer.from(b64, "base64");
}

// ------------------------------------------------------------------ run
const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(n);
const val = (n: string) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : undefined);
const only = val("--only")?.split(",");
const group = val("--group");
const todo = SLOTS.filter((s) => (!only || only.includes(s.id)) && (!group || s.group === group) && (flag("--force") || !existsSync(s.out)));

async function run(s: Slot, attempt = 1): Promise<{ id: string; ok: boolean; error?: string }> {
  try {
    const raw = s.provider === "higgsfield" ? await higgsfield(s.prompt, s.aspect) : await openaiEdit(s.prompt, s.plate);
    mkdirSync(path.dirname(s.out), { recursive: true });
    await sharp(raw).resize({ width: 1920, withoutEnlargement: true }).webp({ quality: 84 }).toFile(s.out);
    console.log("ok  ", s.id);
    return { id: s.id, ok: true };
  } catch (e) {
    const msg = (e as Error).message.replace(/sk-[A-Za-z0-9_-]+/g, "sk-***");
    if (attempt < 3 && /429|timeout|ECONNRESET|fetch failed|5\d\d/.test(msg)) {
      await new Promise((r) => setTimeout(r, 8000 * attempt));
      return run(s, attempt + 1);
    }
    console.log("FAIL", s.id, msg.slice(0, 200));
    return { id: s.id, ok: false, error: msg.slice(0, 300) };
  }
}

async function main() {
  console.log(`${todo.length} of ${SLOTS.length} slots to generate${flag("--dry-run") ? " (dry run)" : ""}`);
  if (flag("--dry-run")) {
    for (const s of todo) console.log(`- ${s.id} [${s.provider}] -> ${s.out}${"plate" in s ? ` (plate ${s.plate}${existsSync(s.plate) ? "" : " MISSING"})` : ""}`);
    return;
  }
  const results: Awaited<ReturnType<typeof run>>[] = [];
  const queue = [...todo];
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) results.push(await run(queue.shift()!));
  });
  await Promise.all(workers);
  mkdirSync("data/imagery", { recursive: true });
  writeFileSync(
    "data/imagery/manifest.json",
    JSON.stringify(
      SLOTS.map((s) => ({ ...s, model: s.provider === "openai" ? OPENAI_MODEL : "higgsfield-ai/soul/v2/standard", exists: existsSync(s.out), lastRun: results.find((r) => r.id === s.id) ?? null })),
      null,
      2,
    ),
  );
  const failed = results.filter((r) => !r.ok);
  console.log(`done: ${results.length - failed.length} ok, ${failed.length} failed`);
}

main();
