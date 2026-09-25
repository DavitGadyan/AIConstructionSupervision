/** @type {import('next').NextConfig} */
const server = {
  output: "standalone",
  // Separate dir lets a dev server run while `next build` runs.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: { formats: ["image/avif", "image/webp"] },
  poweredByHeader: false,
  // Node-only libraries used by route handlers; keep them out of the bundle.
  serverExternalPackages: ["@react-pdf/renderer", "@prisma/client", "pdf-lib"],
  experimental: { serverActions: { bodySizeLimit: "50mb" } },
};

/** Static marketing site for GitHub Pages (scripts/build-pages.sh): plain files, no image optimizer. */
const staticSite = {
  output: "export",
  trailingSlash: true,
  // no optimizer on Pages: pre-built WebP variants (scripts/image-variants.mjs) picked by lib/imageLoader.ts
  images: {
    loader: "custom",
    loaderFile: "./lib/imageLoader.ts",
    deviceSizes: [640, 960, 1280, 1920],
    imageSizes: [96, 160, 256, 384],
  },
  poweredByHeader: false,
};

export default process.env.NEXT_PUBLIC_STATIC_SITE === "1" ? staticSite : server;
