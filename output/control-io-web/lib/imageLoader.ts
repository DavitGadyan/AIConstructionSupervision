/**
 * next/image loader for the static export (GitHub Pages has no image optimizer). scripts/image-variants.mjs
 * writes `<name>.w<width>.webp` next to every image under /images and /samples at the widths below, and
 * this picks the smallest one that covers the requested width. Anything else is served as is.
 */
export const VARIANT_WIDTHS = [96, 160, 256, 384, 640, 960, 1280] as const;

export default function staticImageLoader({ src, width }: { src: string; width: number }) {
  if (!/^\/(images|samples)\/.+\.(webp|jpe?g|png)$/.test(src)) return src;
  const w = VARIANT_WIDTHS.find((v) => v >= width);
  return w ? src.replace(/\.(webp|jpe?g|png)$/, `.w${w}.webp`) : src;
}
