/**
 * Pore design tokens — the single source of truth for the brand visual system.
 *
 * Direction: warm "clinical-calm" (a premium derm clinic, not a cold lab) on a
 * cream canvas, anchored by a deep clinic green with a soft lavender accent and
 * a whisper of antique gold from the logo. Serif display headlines (Fraunces)
 * over a clean sans body (Inter).
 *
 * Consumed by NativeWind/StyleSheet (mobile) and Tailwind (web) so the app and
 * the marketing site stay pixel-consistent. Never hardcode a hex anywhere else —
 * import from here.
 */

export const colors = {
  /** App/page background — Background Cream. */
  canvas: "#F7F3EC",
  /** Cards, sheets, inputs. White pops cleanly on the cream canvas. */
  surface: "#FFFFFF",
  /** Headlines + body. Warm near-black, never pure black. */
  ink: "#1C1C1A",
  /** Secondary text, captions. */
  inkMuted: "#6B6B66",
  /** 1px borders, dividers. Warmed to sit on cream. */
  hairline: "#E7E0D4",
  /** THE accent — Primary Clinic Green. CTAs, active states, progress, brand mark. */
  primary: "#32483F",
  /** Pressed/active CTA. */
  primaryPress: "#26382F",
  /** Text/icon on top of the primary fill. */
  onPrimary: "#FFFFFF",
  /** Accent Lavender — selected chips, progress tracks, soft highlights. */
  accent: "#E6E0F2",
  /** Readable violet for text/icons sitting on the lavender accent. */
  accentInk: "#5B4A7A",
  /** Antique gold from the logo — decorative hairlines/sparkles only, used sparingly. */
  gold: "#B6A07E",
  /** Positive progress / "improving" (reuses the clinic green). */
  improving: "#32483F",
  /** Irritation-risk / "go slow" warnings (warm amber, not alarming). */
  caution: "#C98A3B",
  /** "See a professional" cue (muted clay, calm — not a red alert). */
  escalate: "#C5705D",

  /**
   * The dark verdict surface on /compare — the one place the app goes dark, so
   * the answer to "is this working?" lands before the photographs do.
   *
   * These exist because that screen was hand-writing rgba(255,255,255,0.14) and
   * rgba(255,255,255,0.75) inline. A deliberate, documented part of the system
   * deserves tokens; three magic alphas is how a surface drifts.
   */
  onDark: "#FFFFFF",
  /** Secondary text on the dark surface. ~6.3:1 on `primary`. */
  onDarkMuted: "rgba(255,255,255,0.75)",
  /** Hairlines and row dividers on the dark surface. */
  onDarkHairline: "rgba(255,255,255,0.14)",
} as const;

/**
 * How direction reads on the verdict card.
 *
 * /compare rendered "Worse" and "No change" in the identical muted white, so
 * the one screen whose entire job is communicating direction made two of its
 * three outcomes look the same. Improvement gets the lavender it always had;
 * worsening gets the caution amber that already exists for exactly this.
 */
export const direction = {
  improved: "#E6E0F2",
  worse: "#E0A868",
  unchanged: "rgba(255,255,255,0.75)",
} as const;

/**
 * Motion. Two durations and nothing else — enough to make state changes
 * legible, few enough that transitions stay consistent across screens.
 */
export const motion = {
  /** Tap feedback, checkbox fills, colour changes. */
  fast: 120,
  /** Cards appearing, sheets, anything covering distance. */
  base: 220,
} as const;

/** 8px spacing base. */
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  section: 80,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  /** Default card radius — slightly rounder than Apple for warmth. */
  lg: 20,
  xl: 24,
  pill: 9999,
} as const;

/**
 * Font families as CSS/family names. Web (Tailwind) uses these directly with
 * font-weight. Mobile maps each (family, weight) to the weight-specific
 * @expo-google-fonts face name — see apps/mobile/src/theme/ui.tsx.
 */
export const fontFamily = {
  /** Elegant serif for headlines — matches the "Pore" wordmark. */
  display: "Fraunces",
  /** Clean sans for body + UI. */
  body: "Inter",
} as const;

/**
 * Type ramp. `family` picks display (serif) vs body (sans). Serif variants get
 * relaxed tracking — serifs read poorly when tightly kerned.
 */
export const typography = {
  hero: { family: "display", size: 40, weight: "600", lineHeight: 44, letterSpacing: -0.4 },
  title: { family: "display", size: 28, weight: "600", lineHeight: 32, letterSpacing: -0.2 },
  heading: { family: "display", size: 22, weight: "600", lineHeight: 28, letterSpacing: 0 },
  body: { family: "body", size: 17, weight: "400", lineHeight: 25, letterSpacing: -0.2 },
  bodyStrong: { family: "body", size: 17, weight: "600", lineHeight: 24, letterSpacing: -0.2 },
  caption: { family: "body", size: 14, weight: "400", lineHeight: 20, letterSpacing: 0 },
  label: { family: "body", size: 13, weight: "600", lineHeight: 16, letterSpacing: 0.2 },
} as const;

/** The single soft elevation — reserved for the Today + routine cards only. */
export const shadow = {
  card: {
    color: "rgba(28,28,26,0.06)",
    offset: { width: 0, height: 4 },
    radius: 20,
    opacity: 1,
    elevation: 2,
  },
} as const;

export type ColorToken = keyof typeof colors;
export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
export type FontFamilyToken = keyof typeof fontFamily;
export type TypographyVariant = keyof typeof typography;
