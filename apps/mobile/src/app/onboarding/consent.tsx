import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, TextInput } from "react-native";

import { useOnboarding } from "@/state/onboarding";
import { AppText, Card, PrimaryButton, Screen, colors, radius, spacing } from "@/theme";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ParentalConsent() {
  const { update } = useOnboarding();
  const [email, setEmail] = useState("");
  const valid = EMAIL.test(email.trim());

  function onContinue() {
    if (!valid) return;
    update({ parentEmail: email.trim() });
    // Real build: send a verifiable consent request to the parent before any
    // photo capture, and record approval. For now we proceed to intake.
    router.push("/onboarding/intake");
  }

  return (
    <Screen contentStyle={{ paddingTop: spacing.section }}>
      <AppText variant="title">A parent needs to approve</AppText>
      <AppText variant="body" color={colors.inkMuted}>
        Since you&apos;re under 18, we&apos;ll ask a parent or guardian to approve before Pore looks at any
        photos. Enter their email and we&apos;ll send a quick approval request.
      </AppText>

      <TextInput
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="parent@email.com"
        placeholderTextColor={colors.inkMuted}
        style={styles.input}
      />

      <Card>
        <AppText variant="caption" color={colors.inkMuted}>
          We only use this email to confirm consent. Pore never trains on or sells anyone&apos;s data, and
          photos can be deleted anytime.
        </AppText>
      </Card>

      <PrimaryButton label="Send approval request" onPress={onContinue} disabled={!valid} />
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
    fontSize: 17,
    color: colors.ink,
    marginTop: spacing.sm,
  },
});
