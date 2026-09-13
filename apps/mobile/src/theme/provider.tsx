import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Appearance, Platform, useColorScheme } from "react-native";

import {
  colorThemes,
  lightColors,
  type ThemeColors,
  type ThemeMode,
} from "@pore/shared";
import { save } from "@/lib/storage";
import {
  normalizeAppearancePreference,
  resolveThemeMode,
  type AppearancePreference,
} from "./appearance";

export interface PoreThemeContextValue {
  preference: AppearancePreference;
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  /** Persist and apply a preference; false leaves the current theme unchanged. */
  setPreference: (preference: AppearancePreference) => Promise<boolean>;
}

const defaultTheme: PoreThemeContextValue = {
  preference: "light",
  mode: "light",
  isDark: false,
  colors: lightColors,
  setPreference: async () => false,
};

const PoreThemeContext = createContext<PoreThemeContextValue>(defaultTheme);

export function ThemeProvider({
  children,
  initialPreference = "light",
}: {
  children: ReactNode;
  initialPreference?: AppearancePreference;
}) {
  const systemAppearance = useColorScheme();
  const [preference, setPreferenceState] = useState<AppearancePreference>(() =>
    normalizeAppearancePreference(initialPreference),
  );
  const mode = resolveThemeMode(preference, systemAppearance);
  const colors = colorThemes[mode];

  // Keep native controls and sheets aligned with an explicit app preference.
  // `unspecified` hands control back to the operating system for System mode.
  useEffect(() => {
    // React Native Web exposes Appearance without the native override method.
    if (Platform.OS === "web") return;
    Appearance.setColorScheme(
      preference === "system" ? "unspecified" : preference,
    );
  }, [preference]);

  const setPreference = useCallback(async (next: AppearancePreference) => {
    const normalized = normalizeAppearancePreference(next);
    const persisted = await save("appearance", normalized);
    if (persisted) setPreferenceState(normalized);
    return persisted;
  }, []);

  const value = useMemo<PoreThemeContextValue>(
    () => ({
      preference,
      mode,
      isDark: mode === "dark",
      colors,
      setPreference,
    }),
    [colors, mode, preference, setPreference],
  );

  return (
    <PoreThemeContext.Provider value={value}>
      {children}
    </PoreThemeContext.Provider>
  );
}

export function useTheme(): PoreThemeContextValue {
  return useContext(PoreThemeContext);
}

export function useThemeColors(): ThemeColors {
  return useTheme().colors;
}
