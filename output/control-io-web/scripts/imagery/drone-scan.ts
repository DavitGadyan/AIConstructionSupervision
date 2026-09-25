/**
 * "Drone scanning the building": gpt-image-2 edit of the September orbit photo, so it is the same
 * building as the 3D model. Also the start frame of the Higgsfield orbit clip.
 *   npx tsx scripts/imagery/drone-scan.ts
 */
import { readFileSync } from "node:fs";
import OpenAI, { toFile } from "openai";
import sharp from "sharp";

for (const l of readFileSync(".env", "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)="?(.*?)"?$/.exec(l.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const SRC = "public/images/flights/m8/orbit-se.webp";
const OUT = "public/images/marketing/drone-scan.webp";
const PROMPT = [
  "Photorealistic photo of this exact building under construction and its site, unchanged: same tower, same storeys, same crane, same camera angle.",
  "Add a white enterprise survey drone (quadcopter with a gimbal camera underneath) hovering in the foreground on the left at mid-height of the tower, clearly pointed at the facade,",
  "with a thin, subtle cyan plane of scanning light sweeping across the facade and a faint grid of small cyan capture points on the concrete where it has already scanned.",
  "Overcast daylight, real photograph, slight atmospheric haze, no text, no logos, no people.",
].join(" ");

const openai = new OpenAI();
const png = await sharp(SRC).png().toBuffer();
const res = (await openai.images.edit({
  model: "gpt-image-2",
  image: await toFile(png, "orbit.png", { type: "image/png" }),
  prompt: PROMPT,
  size: "1536x1024",
  quality: "high",
})) as OpenAI.ImagesResponse;
const b64 = res.data?.[0]?.b64_json;
if (!b64) throw new Error("empty result");
await sharp(Buffer.from(b64, "base64")).resize(1536, 1024, { fit: "cover" }).webp({ quality: 84 }).toFile(OUT);
console.log("wrote", OUT);
