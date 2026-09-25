/**
 * Photograph the projector renders (scripts/blender/render_projectors.py) with gpt-image-2 so that
 * scripts/blender/project_photos.py can map real-looking surfaces back onto the exact geometry.
 *
 *   npx tsx scripts/imagery/projectors.ts m8 [--force] [--no-mask] [--only top,site] [--remask]
 *   npx tsx scripts/imagery/projectors.ts --neighbours      # once: tileable facade + roof for the neighbour blocks
 *
 * Views run one after another so every later view is shown the south photograph as a reference and
 * comes back with the same materials and exposure. The building silhouette is locked with an edit
 * mask (only the building may be repainted) and re-applied afterwards, so the projection stays
 * aligned even if the model redraws a detail.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import OpenAI, { toFile } from "openai";
import sharp from "sharp";

for (const l of readFileSync(".env", "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)="?(.*?)"?$/.exec(l.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const args = process.argv.slice(2);
const flag = (f: string) => args.includes(f);
const openai = new OpenAI();

type View = { name: string; kind: "elevation" | "top" | "site"; res: [number, number]; png: string; tile: number };
type Photo = { name: string; size: [number, number]; mean: [number, number, number]; luminance: number; coverage: number };

const ORDER = ["south", "east", "north", "west", "top", "site"];
const rank = (v: View) => ORDER.findIndex((o) => v.name.startsWith(o)) * 10 + v.tile;

const side = (name: string) => name.replace(/_\d+$/, "");
const TOWER = "a 16-storey reinforced-concrete residential tower under construction";
const PROMPTS = {
  elevation: (v: View, ref: boolean) =>
    [
      `Straight-on architectural elevation photograph of this exact building, taken from far away with a very long lens so there is no perspective: ${TOWER}, seen from the ${side(v.name)}${v.tile || v.name.includes("_") ? " (part of the facade)" : ""}.`,
      "Keep EXACTLY the same silhouette, number of storeys, slab lines, columns, openings, which storeys have facade panels and which have windows, the green safety-netting band, the scaffold and the formwork box on top. Do not move any outline, slab line or opening.",
      "Real materials, photographed: weathered cast-in-place concrete with tie holes, formwork marks and water stains; precast facade panels with visible joints; window glass reflecting a flat overcast sky; dusty plywood; rusty rebar; green debris netting.",
      "Flat overcast daylight, no direct sun, no cast shadows, no people, no vehicles, no text, no watermark. Pure white background outside the building.",
      ref ? "The second image is a photograph of the same building's south side: match its materials, colours, weathering and exposure exactly." : "",
    ]
      .filter(Boolean)
      .join(" "),
  // No reference image here: shown a facade, the model drifts into a perspective view of the building.
  top: () =>
    [
      "Photorealise this image as a straight-down orthographic drone photograph (nadir, camera pointing exactly at the ground, no perspective, no sides of the building visible).",
      "It is the flat top of a concrete building under construction seen from directly above. Every rectangle stays exactly where it is, with the same size and outline: plywood formwork panels stay plywood, bare concrete slab stays concrete, the square box stays a square box, dots stay short rebar starter bars.",
      "Realistic weathered plywood with nail lines and stains, grey cast concrete with rebar tie wire, dust; flat overcast light, no cast shadows, no people, no crane, no text. Pure white background outside the building.",
    ].join(" "),
  site: () =>
    [
      "Straight-down aerial orthophoto of an empty construction-site pad, photographed by a survey drone: compacted muddy earth with tyre tracks, puddles and dried ruts, a rectangular gravel yard in the lower right, a trampled grass margin around the edge.",
      "Keep exactly the same layout and proportions of the areas. Photographic and natural, flat overcast light, no buildings, no vehicles, no equipment, no people, no text.",
    ].join(" "),
};

async function withRetry<T>(fn: () => Promise<T>, what: string): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (i >= 4 || !/fetch failed|ECONNRESET|ETIMEDOUT|429|5\d\d|timeout|server_error/i.test(msg)) throw e;
      console.warn(`${what}: attempt ${i} failed (${msg.slice(0, 120)}), retrying`);
      await new Promise((r) => setTimeout(r, 4000 * i));
    }
  }
}

/**
 * Keep only the render's silhouette and extend its edge colours outwards (in place, RGB). The model paints
 * the white studio background right up to the outline, and near-white pixels on the edge would otherwise be
 * sampled by the outermost faces as a white rim. Pixels outside the silhouette - and near-white pixels
 * within 3 px of it - take the average of their valid neighbours, pass by pass; whatever is left gets `mean`.
 */
function remask(rgb: Buffer, alpha: Buffer, w: number, h: number, mean: [number, number, number]) {
  const valid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) valid[i] = alpha[i] >= 200 ? 1 : 0;
  // distance (in passes) to the outside, capped at 3
  const near = new Uint8Array(w * h);
  let edge = Uint8Array.from(valid, (v) => 1 - v);
  for (let pass = 0; pass < 3; pass++) {
    const next = edge.slice();
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (edge[i]) continue;
        if ((x > 0 && edge[i - 1]) || (x < w - 1 && edge[i + 1]) || (y > 0 && edge[i - w]) || (y < h - 1 && edge[i + w])) {
          next[i] = 1;
          near[i] = 1;
        }
      }
    edge = next;
  }
  for (let i = 0; i < w * h; i++) if (near[i] && Math.min(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]) > 232) valid[i] = 0;
  for (let pass = 0; pass < 12; pass++) {
    const add: number[] = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (valid[i]) continue;
        let r = 0, g = 0, b = 0, k = 0;
        for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
          if (j < 0 || !valid[j]) continue;
          r += rgb[j * 3]; g += rgb[j * 3 + 1]; b += rgb[j * 3 + 2]; k++;
        }
        if (k) {
          rgb[i * 3] = Math.round(r / k); rgb[i * 3 + 1] = Math.round(g / k); rgb[i * 3 + 2] = Math.round(b / k);
          add.push(i);
        }
      }
    if (!add.length) break;
    for (const i of add) valid[i] = 1;
  }
  for (let i = 0; i < w * h; i++) if (!valid[i]) for (let c = 0; c < 3; c++) rgb[i * 3 + c] = mean[c];
}

/** Re-apply remask() to photos that are already on disk (no API calls). */
async function remaskExisting(dir: string, views: View[]) {
  for (const v of views) {
    const jpg = `${dir}/photo/${v.name}.jpg`;
    if (!existsSync(jpg) || v.kind === "site") continue;
    const [w, h] = v.res;
    const alpha = await sharp(`${dir}/${v.png}`).ensureAlpha().extractChannel(3).raw().toBuffer();
    const rgb = await sharp(jpg).resize(w, h, { fit: "fill" }).removeAlpha().raw().toBuffer();
    const meta = JSON.parse(readFileSync(`${dir}/photo/${v.name}.json`, "utf8")) as Photo;
    remask(rgb, alpha, w, h, meta.mean);
    await sharp(rgb, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 92, chromaSubsampling: "4:4:4" }).toFile(jpg);
    console.log("remasked", v.name);
  }
}

async function editView(dir: string, v: View, ref: Buffer | null, refLum: number | null, useMask: boolean): Promise<Photo> {
  const render = `${dir}/${v.png}`;
  const [w, h] = v.res;
  const alpha = await sharp(render).ensureAlpha().extractChannel(3).raw().toBuffer();
  // the building plus ~3 px, so the model may repaint the outline but not move it
  const dil = await sharp(render).ensureAlpha().extractChannel(3).blur(1.5).threshold(1).raw().toBuffer();
  const input = await sharp(render).flatten({ background: "#ffffff" }).png().toBuffer();
  const inv = Buffer.from(dil.map((a) => 255 - a));
  const maskPng = await sharp({ create: { width: w, height: h, channels: 3, background: "#ffffff" } })
    .joinChannel(inv, { raw: { width: w, height: h, channels: 1 } })
    .png()
    .toBuffer();
  const images = [await toFile(input, "view.png", { type: "image/png" })];
  if (ref) images.push(await toFile(ref, "reference.jpg", { type: "image/jpeg" }));
  const prompt = PROMPTS[v.kind](v, !!ref);
  const mask = useMask && v.kind !== "site" ? await toFile(maskPng, "mask.png", { type: "image/png" }) : undefined;
  const res = await withRetry(
    () =>
      openai.images.edit({
        model: "gpt-image-2",
        image: images.length > 1 ? images : images[0],
        ...(mask ? { mask } : {}),
        prompt,
        size: `${w}x${h}` as "1024x1024",
        quality: "high",
        output_format: "png",
      } as Parameters<typeof openai.images.edit>[0]),
    v.name,
  );
  const b64 = (res as OpenAI.ImagesResponse).data?.[0]?.b64_json; // not streamed
  if (!b64) throw new Error(`empty result for ${v.name}`);
  const ai = await sharp(Buffer.from(b64, "base64")).resize(w, h, { fit: "fill" }).removeAlpha().raw().toBuffer();

  // Mean colour and luminance inside the silhouette; coverage = building pixels the model painted non-white.
  const sum = [0, 0, 0];
  let n = 0;
  let painted = 0;
  for (let i = 0; i < w * h; i++) {
    if (alpha[i] < 128) continue;
    n++;
    const r = ai[i * 3], g = ai[i * 3 + 1], b = ai[i * 3 + 2];
    sum[0] += r; sum[1] += g; sum[2] += b;
    if (Math.min(r, g, b) < 245) painted++;
  }
  const mean = sum.map((s) => Math.round(s / Math.max(1, n))) as [number, number, number];
  let lum = (0.2126 * mean[0] + 0.7152 * mean[1] + 0.0722 * mean[2]) / 255;
  // Exposure lock to the south photo (the ground is a different material and stays as it comes).
  const gain = refLum && v.kind !== "site" ? Math.min(1.15, Math.max(0.85, refLum / Math.max(0.05, lum))) : 1;
  const out = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const inside = dil[i] > 0;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = inside ? Math.min(255, Math.round(ai[i * 3 + c] * gain)) : mean[c];
  }
  lum *= gain;
  remask(out, alpha, w, h, mean);
  await sharp(out, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 92, chromaSubsampling: "4:4:4" }).toFile(`${dir}/photo/${v.name}.jpg`);
  const photo: Photo = { name: v.name, size: [w, h], mean, luminance: Number(lum.toFixed(4)), coverage: Number((painted / Math.max(1, n)).toFixed(4)) };
  writeFileSync(`${dir}/photo/${v.name}.json`, JSON.stringify(photo, null, 1));
  if (photo.coverage < 0.9) console.warn(`${v.name}: only ${(photo.coverage * 100).toFixed(1)}% of the building was painted - check the photo`);
  console.log("ok", v.name, `${w}x${h}`, `gain ${gain.toFixed(2)}`, `coverage ${(photo.coverage * 100).toFixed(1)}%`);
  return photo;
}

/** Ratio of the site photo's outer ring to the CC0 grass scan, so the 800 m grass plane can be tinted to match. */
async function grassTint(dir: string): Promise<[number, number, number]> {
  const sitePath = `${dir}/photo/site.jpg`;
  if (!existsSync(sitePath)) return [1, 1, 1];
  const { data, info } = await sharp(sitePath).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const ring = [Math.round(w * 0.03), Math.round(h * 0.03)];
  const sum = [0, 0, 0];
  let n = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (x >= ring[0] && x < w - ring[0] && y >= ring[1] && y < h - ring[1]) continue;
      for (let c = 0; c < 3; c++) sum[c] += data[(y * w + x) * 3 + c];
      n++;
    }
  const grass = (await sharp("data/polyhaven/grass_diff.jpg").stats()).channels.map((c) => c.mean);
  return sum.map((s, c) => Number(Math.min(1.6, Math.max(0.3, s / n / grass[c])).toFixed(3))) as [number, number, number];
}

async function neighbours() {
  const dir = "data/projectors/common";
  mkdirSync(dir, { recursive: true });
  const tiles = {
    neighbour_wall: "Seamless tileable straight-on photograph of a plain weathered precast-concrete apartment facade wall: flat beige-grey panels with fine joints, rain streaks and dirt, no windows, no doors, no edges, no sky, no ground, uniform flat overcast light. Real photo texture, no text.",
    neighbour_roof: "Seamless tileable straight-down photograph of a flat bitumen roof membrane with patches of loose gravel, small stains and two small vent caps, uniform flat overcast light. Real photo texture, no edges, no text.",
  };
  for (const [name, prompt] of Object.entries(tiles)) {
    const out = `${dir}/${name}.jpg`;
    if (existsSync(out) && !flag("--force")) continue;
    const res = await withRetry(() => openai.images.generate({ model: "gpt-image-2", prompt, size: "1024x1024", quality: "high", output_format: "png" } as never), name);
    const b64 = (res as { data?: { b64_json?: string }[] }).data?.[0]?.b64_json;
    if (!b64) throw new Error(`empty result for ${name}`);
    const base = sharp(Buffer.from(b64, "base64")).resize(1024, 1024, { fit: "fill" }).removeAlpha();
    const [a, b, c, d] = await Promise.all([base.clone().toBuffer(), base.clone().flop().toBuffer(), base.clone().flip().toBuffer(), base.clone().flop().flip().toBuffer()]);
    // mirror-tiled 2x2 so the tile repeats without a seam
    await sharp({ create: { width: 2048, height: 2048, channels: 3, background: "#000" } })
      .composite([
        { input: a, left: 0, top: 0 },
        { input: b, left: 1024, top: 0 },
        { input: c, left: 0, top: 1024 },
        { input: d, left: 1024, top: 1024 },
      ])
      .jpeg({ quality: 90 })
      .toFile(out);
    console.log("ok", name);
  }
}

if (flag("--neighbours")) {
  await neighbours();
} else {
  const stage = args.find((x, i) => !x.startsWith("--") && args[i - 1] !== "--only") ?? "m8";
  const dir = `data/projectors/${stage}`;
  const index = JSON.parse(readFileSync(`${dir}/projectors.json`, "utf8")) as { views: View[] };
  mkdirSync(`${dir}/photo`, { recursive: true });
  const views = [...index.views].sort((p, q) => rank(p) - rank(q));
  if (flag("--remask")) {
    await remaskExisting(dir, views);
    process.exit(0);
  }
  let ref: Buffer | null = null;
  let refLum: number | null = null;
  const onlyAt = args.indexOf("--only");
  const only = onlyAt >= 0 ? new Set(args[onlyAt + 1].split(",")) : null;
  for (const v of views) {
    const jpg = `${dir}/photo/${v.name}.jpg`;
    let photo: Photo;
    const redo = only ? only.has(v.name) : flag("--force");
    if (existsSync(jpg) && !redo) {
      photo = JSON.parse(readFileSync(`${dir}/photo/${v.name}.json`, "utf8"));
      console.log("kept", v.name);
    } else {
      photo = await editView(dir, v, v.kind === "top" ? null : ref, refLum, !flag("--no-mask"));
    }
    if (!ref && v.kind === "elevation") {
      ref = await sharp(jpg).jpeg({ quality: 90 }).toBuffer();
      refLum = photo.luminance;
    }
  }
  const tint = await grassTint(dir);
  // The tint can exceed 1 (the CC0 scan is yellow, the orthophoto's margin is olive), which a glTF colour
  // factor cannot express, so it is baked into a grass texture that project_photos.py swaps in.
  const { data: g, info: gi } = await sharp("data/polyhaven/grass_diff.jpg").removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < g.length; i++) g[i] = Math.min(255, Math.round(g[i] * tint[i % 3]));
  await sharp(g, { raw: { width: gi.width, height: gi.height, channels: 3 } }).jpeg({ quality: 90 }).toFile(`${dir}/photo/grass.jpg`);
  const stats = { stage, grassTint: tint, views: views.map((v) => v.name) };
  writeFileSync(`${dir}/photo/stats.json`, JSON.stringify(stats, null, 1));
  console.log("stats", JSON.stringify(stats));
}
