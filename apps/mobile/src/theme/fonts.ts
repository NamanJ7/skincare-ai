/**
 * Font wiring for mobile. React Native can't synthesize weights from a single
 * custom family the way the web does — each weight is a distinct loaded face.
 * So we load weight-specific @expo-google-fonts faces and resolve the right
 * one from a (family token, weight) pair.
 *
 * - `fontModules` is passed to `useFonts` in the root layout.
 * - `resolveFontFamily` is used by AppText to pick the loaded face name.
 */
// Deep imports (not the package barrel) so Metro bundles only these 8 faces.
import Fraunces_400Regular from "@expo-google-fonts/fraunces/400Regular/Fraunces_400Regular.ttf";
import Fraunces_500Medium from "@expo-google-fonts/fraunces/500Medium/Fraunces_500Medium.ttf";
import Fraunces_600SemiBold from "@expo-google-fonts/fraunces/600SemiBold/Fraunces_600SemiBold.ttf";
import Fraunces_700Bold from "@expo-google-fonts/fraunces/700Bold/Fraunces_700Bold.ttf";
import Inter_400Regular from "@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf";
import Inter_500Medium from "@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf";
import Inter_600SemiBold from "@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf";
import Inter_700Bold from "@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf";
import type { FontFamilyToken } from "@pore/shared";

/** Every face we load up front. Keys are the runtime fontFamily names. */
export const fontModules = {
  Fraunces_400Regular,
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} as const;

const FACES: Record<FontFamilyToken, Record<string, keyof typeof fontModules>> = {
  display: {
    "400": "Fraunces_400Regular",
    "500": "Fraunces_500Medium",
    "600": "Fraunces_600SemiBold",
    "700": "Fraunces_700Bold",
  },
  body: {
    "400": "Inter_400Regular",
    "500": "Inter_500Medium",
    "600": "Inter_600SemiBold",
    "700": "Inter_700Bold",
  },
};

/** Resolve a loaded face name from a family token + numeric weight string. */
export function resolveFontFamily(family: FontFamilyToken, weight: string): string {
  return FACES[family][weight] ?? FACES[family]["400"];
}
