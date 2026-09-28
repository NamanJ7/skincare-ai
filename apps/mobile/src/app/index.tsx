import { Redirect, router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { BrandMark } from "@/components/BrandMark";
import { HeroDemo } from "@/components/HeroDemo";
import { SplashAnimation } from "@/components/SplashAnimation";
import { track } from "@/lib/analytics";
import { useOnboarding } from "@/state/onboarding";
import {
  AppText,
  PrimaryButton,
  Screen,
  spacing,
  useThemeColors,
} from "@/theme";

export default function Landing() {
  const colors = useThemeColors();
  const { data } = useOnboarding();
  const [splashDone, setSplashDone] = useState(false);

  // Returning users (persisted profile) skip the funnel entirely.
  if (data.onboardingComplete) {
    return <Redirect href="/(tabs)" />;
  }

  if (!splashDone) {
    return <SplashAnimation onDone={() => setSplashDone(true)} />;
  }

  return (
    <Screen
      contentStyle={{
        justifyContent: "space-between",
        paddingVertical: spacing.md,
      }}
    >
      {/* prominent first-run brand lockup */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
        }}
      >
        <View
          style={{
            width: 74,
            height: 74,
            borderRadius: 37,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.surfaceElevated,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <BrandMark size={64} />
        </View>
        <View style={{ gap: spacing.xxs }}>
          <AppText variant="title" color={colors.actionPrimary}>
            Pore
          </AppText>
          <AppText variant="overline" color={colors.textSecondary}>
            PERSONAL SKIN GUIDANCE
          </AppText>
        </View>
      </View>

      {/* live demo */}
      <View
        style={{
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 1,
        }}
      >
        <HeroDemo />
      </View>

      {/* headline */}
      <View style={{ gap: spacing.xs }}>
        <AppText variant="hero" style={{ textAlign: "center" }}>
          See your skin more clearly
        </AppText>
        <AppText
          variant="body"
          color={colors.textSecondary}
          style={{ textAlign: "center" }}
        >
          Take quality-checked photos, understand visible patterns, and get a
          routine built around you.
        </AppText>
      </View>

      {/* auth */}
      <View style={{ gap: spacing.sm }}>
        <PrimaryButton
          label="Get started"
          onPress={() => {
            track("onboarding_started", { source: "landing" });
            router.push("/onboarding/age");
          }}
        />
      </View>
    </Screen>
  );
}
