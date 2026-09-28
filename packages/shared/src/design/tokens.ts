/**
 * Pore design tokens — the single source of truth for the brand visual system.
 *
 * The five named swatches below are the approved palette. Semantic theme
 * colors are intentionally separate: a role may use an approved swatch, a
 * contrast-safe derivative, or a restrained safety color. Components consume
 * roles rather than assuming that a pale brand accent is readable as text.
 */

/** Exact approved Pore brand swatches. Do not alter or replace these values. */
export const brandColors = {
  warmIvory: "#F7F4EE",
  charcoal: "#1F1F1F",
  sage: "#A8B59A",
  softLavender: "#DCCFF0",
  mistGray: "#E6E7EB",
} as const;

export type ThemeMode = "light" | "dark";

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  inputBackground: string;
  navBackground: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  borderStrong: string;
  brandAccent: string;
  onBrandAccent: string;
  actionPrimary: string;
  actionPrimaryPressed: string;
  onActionPrimary: string;
  link: string;
  info: string;
  infoSoft: string;
  onInfo: string;
  success: string;
  successSoft: string;
  onSuccess: string;
  warning: string;
  warningSoft: string;
  onWarning: string;
  error: string;
  errorSoft: string;
  onError: string;
  disabledSurface: string;
  disabledContent: string;
  focusRing: string;
  chartTrack: string;
  overlay: string;
  shadowColor: string;
  canvas: string;
  ink: string;
  inkMuted: string;
  hairline: string;
  primary: string;
  primaryPress: string;
  onPrimary: string;
  accent: string;
  accentInk: string;
  gold: string;
  improving: string;
  caution: string;
  escalate: string;
  accentSoft: string;
  primaryTint: string;
  primaryTintSoft: string;
  cautionSoft: string;
  escalateSoft: string;
  scrim: string;
  guidePositive: string;
  cameraSurface: string;
  cameraScrim: string;
  guideActive: string;
  guideIdle: string;
  surfaceFade: string;
}

/** Camera roles stay stable across app themes so live guidance never shifts. */
const cameraColors = {
  guidePositive: "#A8B59A",
  cameraSurface: "#000000",
  cameraScrim: "rgba(0,0,0,0.45)",
  guideActive: "rgba(255,255,255,0.85)",
  guideIdle: "rgba(255,255,255,0.45)",
} as const;

export const lightColors = {
  background: brandColors.warmIvory,
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  inputBackground: "#FFFFFF",
  navBackground: "#FFFFFF",
  textPrimary: brandColors.charcoal,
  textSecondary: "#5D605A",
  border: brandColors.mistGray,
  borderStrong: "#747770",
  brandAccent: brandColors.sage,
  onBrandAccent: brandColors.charcoal,
  actionPrimary: brandColors.charcoal,
  actionPrimaryPressed: "#111111",
  onActionPrimary: brandColors.warmIvory,
  link: brandColors.charcoal,
  info: "#5B4A7A",
  infoSoft: brandColors.softLavender,
  onInfo: "#5B4A7A",
  success: "#3F5B4C",
  successSoft: "rgba(63,91,76,0.12)",
  onSuccess: "#3F5B4C",
  warning: "#875513",
  warningSoft: "rgba(135,85,19,0.12)",
  onWarning: "#875513",
  error: "#945244",
  errorSoft: "rgba(148,82,68,0.10)",
  onError: "#945244",
  disabledSurface: "#EEEFEA",
  disabledContent: "#71736D",
  focusRing: brandColors.charcoal,
  chartTrack: brandColors.mistGray,
  overlay: "rgba(31,31,31,0.45)",
  shadowColor: "rgba(31,31,31,0.10)",

  // Compatibility aliases used by screens during the incremental migration.
  canvas: brandColors.warmIvory,
  ink: brandColors.charcoal,
  inkMuted: "#5D605A",
  hairline: brandColors.mistGray,
  primary: brandColors.charcoal,
  primaryPress: "#111111",
  onPrimary: brandColors.warmIvory,
  accent: brandColors.softLavender,
  accentInk: "#5B4A7A",
  gold: "#75613D",
  improving: "#3F5B4C",
  caution: "#875513",
  escalate: "#945244",
  accentSoft: "#F0EBF8",
  primaryTint: "rgba(31,31,31,0.08)",
  primaryTintSoft: "rgba(168,181,154,0.18)",
  cautionSoft: "rgba(135,85,19,0.12)",
  escalateSoft: "rgba(148,82,68,0.10)",
  scrim: "rgba(247,244,238,0.45)",
  ...cameraColors,
  surfaceFade: "rgba(255,255,255,0.76)",
} as const satisfies ThemeColors;

export const darkColors = {
  background: brandColors.charcoal,
  surface: "#292A28",
  surfaceElevated: "#343532",
  inputBackground: "#2F302E",
  navBackground: "#292A28",
  textPrimary: brandColors.warmIvory,
  textSecondary: brandColors.mistGray,
  border: "#4B4D49",
  borderStrong: "#8C9087",
  brandAccent: brandColors.sage,
  onBrandAccent: brandColors.charcoal,
  actionPrimary: brandColors.warmIvory,
  actionPrimaryPressed: brandColors.mistGray,
  onActionPrimary: brandColors.charcoal,
  link: brandColors.softLavender,
  info: "#EADFF8",
  infoSoft: "rgba(220,207,240,0.16)",
  onInfo: "#EADFF8",
  success: "#BFD1B5",
  successSoft: "rgba(191,209,181,0.16)",
  onSuccess: "#BFD1B5",
  warning: "#F1C27D",
  warningSoft: "rgba(241,194,125,0.16)",
  onWarning: "#F1C27D",
  error: "#F2A89C",
  errorSoft: "rgba(242,168,156,0.16)",
  onError: "#F2A89C",
  disabledSurface: "#343632",
  disabledContent: "#A4A79F",
  focusRing: brandColors.sage,
  chartTrack: "#454742",
  overlay: "rgba(0,0,0,0.68)",
  shadowColor: "rgba(0,0,0,0.42)",

  // Compatibility aliases used by screens during the incremental migration.
  canvas: brandColors.charcoal,
  ink: brandColors.warmIvory,
  inkMuted: brandColors.mistGray,
  hairline: "#4B4D49",
  primary: brandColors.warmIvory,
  primaryPress: brandColors.mistGray,
  onPrimary: brandColors.charcoal,
  accent: "#4A4258",
  accentInk: "#EADFF8",
  gold: "#D8C39E",
  improving: "#BFD1B5",
  caution: "#F1C27D",
  escalate: "#F2A89C",
  accentSoft: "rgba(220,207,240,0.12)",
  primaryTint: "rgba(247,244,238,0.10)",
  primaryTintSoft: "rgba(168,181,154,0.16)",
  cautionSoft: "rgba(241,194,125,0.16)",
  escalateSoft: "rgba(242,168,156,0.16)",
  scrim: "rgba(31,31,31,0.62)",
  ...cameraColors,
  surfaceFade: "rgba(41,42,40,0.82)",
} as const satisfies ThemeColors;

export const colorThemes = {
  light: lightColors,
  dark: darkColors,
} as const satisfies Record<ThemeMode, ThemeColors>;

export function colorsFor(mode: ThemeMode): ThemeColors {
  return colorThemes[mode];
}

/**
 * Light-theme compatibility export. New UI should read colors from the mobile
 * ThemeProvider; this keeps shared/web and not-yet-migrated screens stable.
 */
export const colors = lightColors;

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

/** Standard icon dimensions for controls and status treatments. */
export const iconSize = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

/** Minimum interactive size aligned with iOS and Android accessibility guidance. */
export const touchTarget = {
  min: 44,
} as const;

/** Semantic stroke widths for dividers, controls, accents, and focus rings. */
export const borderWidth = {
  hairline: 1,
  emphasis: 2,
  accent: 3,
  ring: 4,
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
  hero: {
    family: "display",
    size: 40,
    weight: "600",
    lineHeight: 44,
    letterSpacing: -0.4,
  },
  title: {
    family: "display",
    size: 28,
    weight: "600",
    lineHeight: 32,
    letterSpacing: -0.2,
  },
  heading: {
    family: "display",
    size: 22,
    weight: "600",
    lineHeight: 28,
    letterSpacing: 0,
  },
  body: {
    family: "body",
    size: 17,
    weight: "400",
    lineHeight: 25,
    letterSpacing: -0.2,
  },
  bodyStrong: {
    family: "body",
    size: 17,
    weight: "600",
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  caption: {
    family: "body",
    size: 14,
    weight: "400",
    lineHeight: 20,
    letterSpacing: 0,
  },
  label: {
    family: "body",
    size: 13,
    weight: "600",
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  /** Sans screen title for utility surfaces (tabs, recurring flows). Serif `title` is for brand moments. */
  titleSans: {
    family: "body",
    size: 24,
    weight: "600",
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  /** Sans card/section heading — replaces serif `heading` off brand moments. */
  headline: {
    family: "body",
    size: 18,
    weight: "600",
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  /** Big sans number for utility stats (consistency %, streaks). */
  stat: {
    family: "body",
    size: 32,
    weight: "600",
    lineHeight: 38,
    letterSpacing: -0.4,
  },
  /** Uppercase section/kicker label — wider tracking than `label`. */
  overline: {
    family: "body",
    size: 12,
    weight: "600",
    lineHeight: 16,
    letterSpacing: 1,
  },
} as const;

/** Shared motion rhythm. Components must still respect reduced-motion settings. */
export const motion = {
  duration: {
    fast: 150,
    base: 250,
    gentle: 350,
    celebrate: 450,
    draw: 800,
  },
  easing: {
    /** Cubic-bezier [x1, y1, x2, y2]. */
    exit: [0.33, 1, 0.68, 1],
    enter: [0.32, 0, 0.67, 0],
    inOut: [0.65, 0, 0.35, 1],
  },
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
  /** Reserved for floating controls such as the raised Scan tab action. */
  floating: {
    color: "rgba(28,28,26,0.18)",
    offset: { width: 0, height: 4 },
    radius: 10,
    opacity: 1,
    elevation: 4,
  },
} as const;

export type ColorToken = keyof ThemeColors;
export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
export type IconSizeToken = keyof typeof iconSize;
export type BorderWidthToken = keyof typeof borderWidth;
export type FontFamilyToken = keyof typeof fontFamily;
export type TypographyVariant = keyof typeof typography;
