import { describe, expect, it } from "vitest";

import {
  initialAppearancePreference,
  isAppearancePreference,
  normalizeAppearancePreference,
  resolveThemeMode,
} from "./appearance";

describe("appearance preference", () => {
  it.each(["system", "light", "dark"] as const)("accepts %s", (preference) => {
    expect(isAppearancePreference(preference)).toBe(true);
    expect(normalizeAppearancePreference(preference)).toBe(preference);
  });

  it.each([undefined, null, "", "automatic", "sepia", 1])(
    "normalizes invalid value %j to system",
    (value) => {
      expect(normalizeAppearancePreference(value)).toBe("system");
    },
  );

  it("follows the device only when preference is system", () => {
    expect(resolveThemeMode("system", "dark")).toBe("dark");
    expect(resolveThemeMode("system", "light")).toBe("light");
    expect(resolveThemeMode("system", null)).toBe("light");
    expect(resolveThemeMode("light", "dark")).toBe("light");
    expect(resolveThemeMode("dark", "light")).toBe("dark");
  });

  it("starts a brand-new install in light mode", () => {
    expect(initialAppearancePreference(null)).toBe("light");
    expect(initialAppearancePreference(undefined)).toBe("light");
    expect(initialAppearancePreference("dark")).toBe("dark");
    expect(initialAppearancePreference("system")).toBe("system");
  });
});
