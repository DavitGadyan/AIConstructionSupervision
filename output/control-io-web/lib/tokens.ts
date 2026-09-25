/**
 * The same tokens as globals.css, in TypeScript, for the places CSS cannot
 * reach - canvas, WebGL materials, PDF rendering, meta tags. Keep in sync.
 */
export const tokens = {
  color: {
    page: "#EEF1F2",
    ground: "#E4E8EA",
    surface: "#FFFFFF",
    ink: "#1C2226",
    muted: "#5F666B",
    accent: "#0A8FA3",
    accentDeep: "#077384",
    accentSoft: "#D3ECF0",
    accent2: "#6B737A",
    accent2Soft: "#DADFE2",
    danger: "#C2412D",
    warn: "#B7791F",
    ok: "#2F855A",
  },
  motion: { ease: [0.22, 1, 0.36, 1] as const, fast: 180, base: 320, slow: 600 },
  mode: "light" as const,
} as const;

export const site = {
  name: "control.io",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://control.io",
  email: "hello@control.io",
  phone: "+374 00 000 000",
  address: "Yerevan, Armenia",
  tagline: "Independent drone supervision for multistorey construction.",
} as const;

export type Tokens = typeof tokens;
