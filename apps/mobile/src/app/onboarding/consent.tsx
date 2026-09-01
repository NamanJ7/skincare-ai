import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput } from "react-native";

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
    // photo capture, and record approval. For now we proceed to capture.
    router.push("/onboarding/photo");
  }

  return (
    <Screen contentStyle={{ paddingTop: spacing.section }}>
      <AppText variant="title">A parent needs to approve</AppText>
      <AppText variant="body" color={colors.inkMuted}>
        Since you&apos;re under 18, a parent or guardian needs to approve before Pore looks at any
        photos. Add their email so we can reach them for approval.
      </AppText>

      <TextInput
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="parent@email.com"
        accessibilityLabel="Parent or guardian's email address"
        placeholderTextColor={colors.inkMuted}
        style={styles.input}
      />

      <Card>
        <AppText variant="caption" color={colors.inkMuted}>
          We only use this email to confirm consent. Pore never trains on or sells anyone&apos;s data.
          Photos stay on your phone and are never saved on our servers.
        </AppText>
        <Pressable
          onPress={() => router.push("/legal/privacy")}
          accessibilityRole="link"
          accessibilityLabel="Read the Privacy Policy"
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}
        >
          <AppText variant="caption" color={colors.primary}>
            Read the Privacy Policy
          </AppText>
        </Pressable>
      </Card>

      <PrimaryButton label="Continue" onPress={onContinue} disabled={!valid} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: { minHeight: 44, justifyContent: "center" },
  pressed: { opacity: 0.6 },
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
