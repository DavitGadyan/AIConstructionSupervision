/**
 * The visible sky for the 3D explorer: Poly Haven's tone-mapped JPG of the same HDRI that lights the
 * scene (scripts/blender/fetch_polyhaven.py), resized to a 4k equirect WebP. The 1k .hdr stays for lighting.
 *   npx tsx scripts/imagery/sky.ts [local-tonemapped.jpg]
 */
import { mkdirSync, readFileSync } from "node:fs";
import sharp from "sharp";

const HDRI = "kloofendal_48d_partly_cloudy_puresky";
const URL = `https://dl.polyhaven.com/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/${HDRI}.jpg`;
const OUT = "public/hdri/sky-4k.webp";

const local = process.argv[2];
const src = local ? readFileSync(local) : Buffer.from(await (await fetch(URL)).arrayBuffer());
mkdirSync("public/hdri", { recursive: true });
const info = await sharp(src).resize(4096, 2048, { fit: "fill" }).webp({ quality: 80 }).toFile(OUT);
console.log("wrote", OUT, `${info.width}x${info.height}`, `${Math.round(info.size / 1024)} KB`);
