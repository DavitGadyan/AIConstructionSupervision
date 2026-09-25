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
  images: { unoptimized: true },
  poweredByHeader: false,
};

export default process.env.NEXT_PUBLIC_STATIC_SITE === "1" ? staticSite : server;
