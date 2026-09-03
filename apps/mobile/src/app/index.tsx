import { Redirect, router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { BrandMark } from "@/components/BrandMark";
import { HeroDemo } from "@/components/HeroDemo";
import { SplashAnimation } from "@/components/SplashAnimation";
import { activeRoutine, readJournal } from "@/lib/journal";
import { AppText, GhostButton, PrimaryButton, Screen, colors, spacing } from "@/theme";

export default function Landing() {
  const [splashDone, setSplashDone] = useState(false);
  /**
   * Someone who already has a routine is not a visitor. Sending them back
   * through the pitch and the splash animation on every launch was the most
   * visible symptom of the app having no memory — read once, at mount, so a
   * returning user never sees this screen at all.
   */
  const [returning] = useState(() => activeRoutine(readJournal()) !== undefined);

  if (returning) return <Redirect href="/today" />;

  if (!splashDone) {
    return <SplashAnimation onDone={() => setSplashDone(true)} />;
  }

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
