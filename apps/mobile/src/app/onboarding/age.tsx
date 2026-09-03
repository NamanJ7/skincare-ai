import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { useOnboarding } from "@/state/onboarding";
import { AppText, Card, PrimaryButton, Screen, TextField, colors, spacing } from "@/theme";

export default function AgeGate() {
  const { update } = useOnboarding();
  const [value, setValue] = useState("");
  const age = Number.parseInt(value, 10);
  const valid = Number.isFinite(age) && age >= 1 && age <= 120;
  const blocked = valid && age < 16;

  function onContinue() {
    if (!valid || blocked) return;
    update({ age });
    // Capture comes before the questionnaire, but the parental-consent gate
    // still comes before the camera.
    if (age <= 17) router.push("/onboarding/consent");
    else router.push("/onboarding/photo");
  }

  return (
    <Screen contentStyle={{ paddingTop: spacing.section }}>
      <AppText variant="title">How old are you?</AppText>
      <AppText variant="body" color={colors.inkMuted}>
        We use this to tailor safe guidance for your skin — and to know whether we need a parent or guardian
        to approve.
      </AppText>

      <View style={{ marginTop: spacing.sm }}>
        <TextField
          label="Age"
          value={value}
          onChangeText={(t) => setValue(t.replace(/[^0-9]/g, "").slice(0, 3))}
          keyboardType="number-pad"
          placeholder="e.g. 24"
          maxLength={3}
        />
      </View>

      {blocked ? (
        <Card>
          <AppText variant="bodyStrong" color={colors.escalate}>
            Pore is for ages 16 and up
          </AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            Thanks for your interest. For younger skin, the safest step is to talk with a parent,
            pharmacist, or doctor about a gentle routine — a cleanser, a moisturiser and sunscreen
            is genuinely most of it at your age.
          </AppText>
        </Card>
      ) : null}

      <View style={{ marginTop: spacing.md }}>
        <PrimaryButton label="Continue to the photos" onPress={onContinue} disabled={!valid || blocked} />
      </View>
    </Screen>
  );
}
