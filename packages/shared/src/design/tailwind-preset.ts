/**
 * Tailwind v3 preset built from the Pore design tokens. NativeWind (mobile)
 * extends this so utility classes like `bg-canvas`, `text-ink`, `rounded-lg`
 * map to the exact token values. Web (Tailwind v4) references the same hexes
 * from ./tokens when its config is wired up.
 */
import { colors, fontFamily, radius, spacing } from "./tokens";

export const tailwindPreset = {
  theme: {
    extend: {
      colors: {
        canvas: colors.canvas,
        surface: colors.surface,
        ink: colors.ink,
        "ink-muted": colors.inkMuted,
        hairline: colors.hairline,
        primary: {
          DEFAULT: colors.primary,
          press: colors.primaryPress,
          fg: colors.onPrimary,
        },
        accent: {
          DEFAULT: colors.accent,
          fg: colors.accentInk,
        },
        gold: colors.gold,
        improving: colors.improving,
        caution: colors.caution,
        escalate: colors.escalate,
      },
      borderRadius: {
        sm: `${radius.sm}px`,
        md: `${radius.md}px`,
        lg: `${radius.lg}px`,
        xl: `${radius.xl}px`,
        pill: "9999px",
      },
      spacing: {
        xxs: `${spacing.xxs}px`,
        xs: `${spacing.xs}px`,
        sm: `${spacing.sm}px`,
        md: `${spacing.md}px`,
        lg: `${spacing.lg}px`,
        xl: `${spacing.xl}px`,
        xxl: `${spacing.xxl}px`,
        section: `${spacing.section}px`,
      },
      fontFamily: {
        sans: [fontFamily.body, "system-ui", "sans-serif"],
        display: [fontFamily.display, "Georgia", "serif"],
      },
    },
  },
};

export default tailwindPreset;
