/**
 * Showcase imagery with a DJI Mavic 4 Pro (gpt-image-2):
 *  - cover:       portfolio cover, subject kept in the centre half, calm edges, no text
 *  - drone-scan:  the site's "drone scanning the building" image (edit of the September orbit photo)
 *   npx tsx scripts/imagery/showcase.ts cover|drone-scan [variants]
 */
import { mkdirSync, readFileSync } from "node:fs";
import OpenAI, { toFile } from "openai";
import sharp from "sharp";

for (const l of readFileSync(".env", "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)="?(.*?)"?$/.exec(l.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const DRONE =
  "a DJI Mavic 4 Pro drone: dark grey foldable quadcopter with four slim folding arms and spinning propellers, a large round gimbal camera on the front with three Hasselblad lenses, premium consumer-flagship design";
const TOWER =
  "a 16-storey reinforced-concrete residential tower under construction: lower floors glazed, middle floors with grey precast panels, upper floors an open concrete frame, a band of green safety netting and formwork at the top, a yellow tower crane beside it, on a muddy fenced site";

const JOBS = {
  cover: {
    out: (i: number) => `../../showcase/upwork/01-cover-v${i}.png`,
    size: "1536x1024",
    src: "public/images/flights/m8/orbit-sw.webp",
    prompt: [
      `Cinematic hyperrealistic aerial photograph. In the foreground, sharp and detailed: ${DRONE}, hovering and facing the building.`,
      `Behind it: ${TOWER} - the same building as in the reference photo.`,
      "A faint cyan laser-scan grid and a few small glowing capture points drawn across the tower's facade, suggesting a 3D scan in progress.",
      "Composition for a thumbnail that will be cropped: the drone and the tower together sit inside the central half of the frame; everything within 25% of each edge is calm, empty background only (soft overcast sky above, hazy flat construction land and distant fields below and to the sides), no important detail near any edge.",
      "Soft diffused daylight, gentle atmospheric haze, shallow depth of field, 35mm, photorealistic. No text, no letters, no logos, no watermark, no people.",
    ].join(" "),
  },
  "drone-scan": {
    out: () => "public/images/marketing/drone-scan.webp",
    size: "1536x1024",
    src: "public/images/flights/m8/orbit-se.webp",
    prompt: [
      "Photorealistic photo of this exact building under construction and its site, unchanged: same tower, same storeys, same crane, same camera angle.",
      `Add ${DRONE}, hovering in the foreground on the left at mid-height of the tower, clearly pointed at the facade,`,
      "with a thin, subtle cyan plane of scanning light from its camera sweeping across the facade and a faint grid of small cyan capture points on the concrete where it has already scanned.",
      "Overcast daylight, real photograph, slight atmospheric haze. No text, no letters, no logos, no people.",
    ].join(" "),
  },
} as const;

const job = JOBS[(process.argv[2] ?? "cover") as keyof typeof JOBS];
const variants = Number(process.argv[3] ?? 1);
const openai = new OpenAI();
mkdirSync("../../showcase/upwork", { recursive: true });
const ref = await sharp(job.src).png().toBuffer();
await Promise.all(
  Array.from({ length: variants }, async (_, i) => {
    const res = (await openai.images.edit({
      model: "gpt-image-2",
      image: await toFile(ref, "reference.png", { type: "image/png" }),
      prompt: job.prompt,
      size: job.size,
      quality: "high",
    })) as OpenAI.ImagesResponse;
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error("empty result");
    const img = sharp(Buffer.from(b64, "base64")).resize(1536, 1024, { fit: "cover" });
    const out = job.out(i + 1);
    await (out.endsWith(".webp") ? img.webp({ quality: 84 }) : img.png()).toFile(out);
    console.log("wrote", out);
  }),
);
