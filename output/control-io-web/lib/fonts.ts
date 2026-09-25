import { Inter, Noto_Sans_Armenian, Space_Grotesk } from "next/font/google";

/*
 * Space Grotesk has no Cyrillic or Armenian glyphs, Inter has Cyrillic but no
 * Armenian. The CSS stacks in globals.css therefore run
 * Space Grotesk -> Inter (Cyrillic) -> Noto Sans Armenian, and the browser
 * picks per glyph via each face's unicode-range.
 */
export const displayFont = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display-loaded",
  display: "swap",
  // The generated metric-matched fallback is local Arial, which *does* have
  // Cyrillic and would win over Inter for Russian headings. Without it,
  // Cyrillic falls through to Inter as intended.
  adjustFontFallback: false,
});
export const bodyFont = Inter({ subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"], variable: "--font-body-loaded", display: "swap" });
export const armenianFont = Noto_Sans_Armenian({
  subsets: ["armenian"],
  weight: "variable",
  variable: "--font-armenian-loaded",
  display: "swap",
  // Only Armenian pages need it; unicode-range keeps other pages from downloading it anyway.
  preload: false,
});

export const fontVariables = `${displayFont.variable} ${bodyFont.variable} ${armenianFont.variable}`;
