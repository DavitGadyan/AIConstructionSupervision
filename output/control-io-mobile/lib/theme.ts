/**
 * The design system for control.io, re-skinned from the ORDI template.
 *
 * This is the only place a colour, font, radius or spacing value is written
 * down. Components read from `theme`; nothing hardcodes a hex.
 *
 * ORDI -> control.io
 *   sand/amber gradient ground -> cool concrete #E4E8EA fading to #D6DDE0
 *   orange accent              -> lagoon blue #0A8FA3
 *   amber accent2              -> metal grey #6B737A
 */
// `mode` is typed as the union so components can branch on it.
export const theme = {
  mode: "light" as "light" | "dark",

  colors: {
    ground: "#E4E8EA",
    groundDeep: "#D6DDE0",
    surface: "#FFFFFF",
    glass: "rgba(255,255,255,0.55)",
    glassStrong: "rgba(255,255,255,0.72)",
    glassBorder: "rgba(255,255,255,0.8)",
    inner: "#F2F4F5",
    ink: "#1C2226",
    muted: "#5F666B",
    faint: "#9AA1A5",
    accent: "#0A8FA3",
    accentSoft: "rgba(10,143,163,0.12)",
    accentPressed: "#087A8B",
    // translucent sub-cards that sit on the solid accent card
    onAccent: "#FFFFFF",
    onAccentMuted: "rgba(255,255,255,0.78)",
    onAccentCard: "rgba(255,255,255,0.14)",
    onAccentBorder: "rgba(255,255,255,0.22)",
    accent2: "#6B737A",
    dark: "#1C2226",
    danger: "#C2412D",
    dangerSoft: "rgba(194,65,45,0.12)",
    warn: "#B7791F",
    ok: "#2F855A",
    hairline: "rgba(28,34,38,0.08)",
    track: "rgba(28,34,38,0.10)",
    shadow: "#1C2226",
    scrim: "rgba(12,16,18,0.92)",
    overlay: "rgba(12,16,18,0.35)",
    overlayText: "rgba(255,255,255,0.82)",
    transparent: "transparent",
    // v1.1 additions: soft status fills for pills/notes, input chrome, map
    warnSoft: "rgba(183,121,31,0.14)",
    okSoft: "rgba(47,133,90,0.12)",
    inputBorder: "rgba(28,34,38,0.14)",
    mapPlaceholder: "#DCE3E6",
  },

  fonts: {
    display: "SpaceGrotesk_500Medium",
    displaySemi: "SpaceGrotesk_600SemiBold",
    displayBold: "SpaceGrotesk_700Bold",
    body: "Inter_400Regular",
    bodyMedium: "Inter_500Medium",
    bodySemi: "Inter_600SemiBold",
    bodyBold: "Inter_700Bold",
  },

  type: {
    hero: 40,
    display: 34,
    gauge: 44,
    h1: 28,
    h2: 22,
    h3: 18,
    body: 16,
    label: 15,
    small: 13,
    micro: 11,
    leadingDisplay: 1.08,
    leadingBody: 1.45,
  },

  spacing: {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    gutter: 16,
    // room under content for the floating tab bar
    tabClearance: 120,
  },

  radius: {
    card: 28,
    inner: 16,
    pill: 8,
    btn: 14,
    round: 999,
  },

  shadow: {
    shadowColor: "#1C2226",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },

  // 44pt is Apple's minimum tap target and the right floor on Android too.
  tap: 44,
  iconButton: 48,

  // v1.1 additions
  /** Durations (ms). Everything that moves reads these; Reduce Motion drops them to 0. */
  motion: {
    fast: 160,
    base: 240,
    slow: 360,
    toast: 5000,
  },
  /** Min height of text inputs and choice rows. */
  field: 52,
  /** Default height of the non-interactive map preview. */
  mapHeight: 184,
} as const;

export type Theme = typeof theme;

export type Status = "on-track" | "watch" | "late" | "critical";

export function statusColor(s: string | undefined): string {
  switch (s) {
    case "on-track":
    case "done":
    case "ok":
      return theme.colors.ok;
    case "watch":
    case "processing":
    case "uploaded":
    case "reconstructing":
    case "assessing":
      return theme.colors.warn;
    case "late":
    case "critical":
    case "failed":
    case "error":
      return theme.colors.danger;
    default:
      return theme.colors.accent2;
  }
}
