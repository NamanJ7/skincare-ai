import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import { useOnboarding } from "@/state/onboarding";
import { AppText, Card, PrimaryButton, Screen, colors, radius, spacing } from "@/theme";

export default function AgeGate() {
  const { update } = useOnboarding();
  const [value, setValue] = useState("");
  const age = Number.parseInt(value, 10);
  const valid = Number.isFinite(age) && age >= 1 && age <= 120;
  const blocked = valid && age < 16;

  function onContinue() {
    if (!valid || blocked) return;
    update({ age });
    if (age <= 17) router.push("/onboarding/consent");
    else router.push("/onboarding/intake");
  }

  return (
    <Screen contentStyle={{ paddingTop: spacing.section }}>
      <AppText variant="title">How old are you?</AppText>
      <AppText variant="body" color={colors.inkMuted}>
        We use this to tailor safe guidance for your skin — and to know whether we need a parent or guardian
        to approve.
      </AppText>

      <TextInput
        value={value}
        onChangeText={(t) => setValue(t.replace(/[^0-9]/g, "").slice(0, 3))}
        keyboardType="number-pad"
        placeholder="Age"
        placeholderTextColor={colors.inkMuted}
        style={styles.input}
        maxLength={3}
      />

      {blocked ? (
        <Card>
          <AppText variant="bodyStrong" color={colors.escalate}>
            Pore is for ages 16 and up
          </AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            Thanks for your interest! For younger skin, the safest step is to talk with a parent, pharmacist,
            or doctor about a gentle routine.
          </AppText>
        </Card>
      ) : null}

      <View style={{ marginTop: spacing.md }}>
        <PrimaryButton label="Continue" onPress={onContinue} disabled={!valid || blocked} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 22,
    fontWeight: "600",
    color: colors.ink,
    marginTop: spacing.sm,
  },
});
