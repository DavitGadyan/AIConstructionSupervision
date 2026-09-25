/**
 * Responsive WebP variants for the static export (see lib/imageLoader.ts): for every image under
 * <dir>/images and <dir>/samples writes <name>.w<width>.webp at each width (never upscaled).
 *   node scripts/image-variants.mjs out
 */
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const WIDTHS = [96, 160, 256, 384, 640, 960, 1280];
const root = process.argv[2] ?? "out";
const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = path.join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(webp|jpe?g|png)$/i.test(f) && !/\.w\d+\.webp$/.test(f)) files.push(p);
  }
};
for (const d of ["images", "samples"]) {
  try {
    walk(path.join(root, d));
  } catch {
    /* folder missing */
  }
}
let n = 0;
await Promise.all(
  files.map(async (f) => {
    const img = sharp(f);
    const { width = 0, hasAlpha } = await img.metadata();
    for (const w of WIDTHS) {
      const out = f.replace(/\.(webp|jpe?g|png)$/i, `.w${w}.webp`);
      await sharp(f).resize({ width: Math.min(w, width), withoutEnlargement: true }).webp({ quality: w <= 384 ? 72 : 78, alphaQuality: hasAlpha ? 90 : 100, effort: 5 }).toFile(out);
      n++;
    }
  }),
);
console.log(`image variants: ${n} files from ${files.length} images`);
