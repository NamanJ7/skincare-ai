import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { OnboardingProvider } from "@/state/onboarding";
import { colors } from "@/theme";
import { fontModules } from "@/theme/fonts";

// Keep the native splash up until the brand fonts are ready, so we never flash
// system fonts before Fraunces/Inter load.
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 300 });

/**
 * A back affordance, and nothing else.
 *
 * Every screen already writes its own title, so the header carries only the
 * chevron. It is the platform's, not ours: that way the back label, the iOS
 * swipe-back interaction and the screen-reader behaviour all come for free and
 * stay consistent with the rest of the phone. Screens used to hand-roll a
 * "Back" ghost button where they remembered to, and four of them didn't.
 */
const backOnly = {
  headerShown: true,
  headerTitle: "",
  headerBackTitle: "Back",
  headerShadowVisible: false,
  headerTransparent: false,
  headerTintColor: colors.primary,
  headerStyle: { backgroundColor: colors.canvas },
} as const;

/** Full-bleed screens: the landing pitch, the camera, and the daily home. */
const noHeader = { headerShown: false } as const;

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontModules);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <OnboardingProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.canvas },
          }}
        >
          <Stack.Screen name="index" options={noHeader} />
          <Stack.Screen name="today" options={noHeader} />
          <Stack.Screen name="onboarding/photo" options={noHeader} />
          <Stack.Screen name="(auth)/sign-in" options={backOnly} />
          <Stack.Screen name="(auth)/sign-up" options={backOnly} />
          <Stack.Screen name="onboarding/age" options={backOnly} />
          <Stack.Screen name="onboarding/consent" options={backOnly} />
          <Stack.Screen name="onboarding/intake" options={backOnly} />
          <Stack.Screen name="plan" options={backOnly} />
          <Stack.Screen name="compare" options={backOnly} />
          <Stack.Screen name="legal/privacy" options={backOnly} />
          <Stack.Screen name="legal/terms" options={backOnly} />
        </Stack>
      </OnboardingProvider>
    </SafeAreaProvider>
  );
}
