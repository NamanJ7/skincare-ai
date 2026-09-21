import { Redirect, router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { BrandMark } from "@/components/BrandMark";
import { LegalAgreement } from "@/components/legal/LegalLinks";
import { HeroDemo } from "@/components/HeroDemo";
import { SplashAnimation } from "@/components/SplashAnimation";
import { hasProfile } from "@/lib/profile";
import { AppText, PrimaryButton, Screen, colors, spacing } from "@/theme";

export default function Landing() {
  /**
   * Someone who already has a routine is not a visitor. They opened the app to
   * find out what to do tonight, and every launch used to put a brand animation
   * and a marketing page between them and the answer. Read once, on mount, so
   * the decision can't flip underneath a render.
   */
  const [returning] = useState(hasProfile);
  const [splashDone, setSplashDone] = useState(false);

  if (returning) {
    return <Redirect href="/today" />;
  }

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

      {/*
        One way in, because there is one way in.
        There used to be a sign-up and a sign-in screen here. Neither created,
        checked or stored anything: any valid-looking input routed onward, the
        Apple and Google buttons called the same no-op as the email one, and
        sign-in let a fresh install straight through to an empty /today. Worse,
        sign-up promised "save your skin scans and routine, and track your
        progress over time" — and nothing in this app is saved anywhere but this
        phone. A screen that asks for a password it throws away is not a
        placeholder for accounts, it is a false statement about where the user's
        data lives. Real auth will not resemble those screens, so they are gone
        rather than kept warm.
      */}
      <View style={{ gap: spacing.sm }}>
        <PrimaryButton label="Get started" onPress={() => router.push("/onboarding/age")} />
        <LegalAgreement action="continuing" />
      </View>
    </Screen>
  );
}
