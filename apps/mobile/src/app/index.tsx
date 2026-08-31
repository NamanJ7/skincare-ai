import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { BrandMark } from "@/components/BrandMark";
import { HeroDemo } from "@/components/HeroDemo";
import { SplashAnimation } from "@/components/SplashAnimation";
import { useOnboarding } from "@/state/onboarding";
import { AppText, GhostButton, PrimaryButton, Screen, colors, spacing } from "@/theme";

export default function Landing() {
  const { data } = useOnboarding();
  const [splashDone, setSplashDone] = useState(false);
  // Restored synchronously by the provider, so this is already correct on the
  // first render — someone with a routine never sees the pitch for it again.
  const returning = data.plan !== undefined;

  useEffect(() => {
    if (splashDone && returning) router.replace("/today");
  }, [splashDone, returning]);

  if (!splashDone) {
    return <SplashAnimation onDone={() => setSplashDone(true)} />;
  }

  // Redirecting; rendering the landing would flash it behind the transition.
  if (returning) return null;

  return (
    <Screen scroll={false} contentStyle={{ justifyContent: "space-between", paddingVertical: spacing.md }}>
      {/* brand row */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs }}>
        <BrandMark size={26} />
        <AppText variant="heading" color={colors.primary}>
          Pore
        </AppText>
      </View>

      {/* live demo */}
      <View style={{ alignItems: "center", justifyContent: "center", flexShrink: 1 }}>
        <HeroDemo />
      </View>

      {/* headline */}
      <View style={{ gap: spacing.xs }}>
        <AppText variant="hero" style={{ textAlign: "center" }}>
          Know exactly what your skin needs
        </AppText>
        <AppText variant="body" color={colors.inkMuted} style={{ textAlign: "center" }}>
          Scan your skin, answer a few questions, and get a personalized routine — with a clear reason
          for every step.
        </AppText>
      </View>

      {/* auth */}
      <View style={{ gap: spacing.sm }}>
        <PrimaryButton label="Get started" onPress={() => router.push("/sign-up")} />
        <GhostButton label="I already have an account" onPress={() => router.push("/sign-in")} />
      </View>
    </Screen>
  );
}
