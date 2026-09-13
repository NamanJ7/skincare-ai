import type { ThemeMode } from "@pore/shared";

export const APPEARANCE_PREFERENCES = ["system", "light", "dark"] as const;

export type AppearancePreference = (typeof APPEARANCE_PREFERENCES)[number];
export type SystemAppearance = ThemeMode | "unspecified" | null | undefined;

export function isAppearancePreference(
  value: unknown,
): value is AppearancePreference {
  return (
    typeof value === "string" &&
    APPEARANCE_PREFERENCES.includes(value as AppearancePreference)
  );
}

/** Invalid or legacy values fail safely to the system appearance. */
export function normalizeAppearancePreference(
  value: unknown,
): AppearancePreference {
  return isAppearancePreference(value) ? value : "system";
}

/** A brand-new install starts in Pore's light theme, regardless of the device. */
export function initialAppearancePreference(
  persisted: unknown,
): AppearancePreference {
  return persisted == null ? "light" : normalizeAppearancePreference(persisted);
}

export function resolveThemeMode(
  preference: AppearancePreference,
  systemAppearance: SystemAppearance,
): ThemeMode {
  if (preference !== "system") return preference;
  return systemAppearance === "dark" ? "dark" : "light";
}
