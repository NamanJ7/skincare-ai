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
        />
      </OnboardingProvider>
    </SafeAreaProvider>
  );
}
