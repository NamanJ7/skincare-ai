import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput } from "react-native";

import { requestConsent } from "@/lib/consent";
import { useOnboarding } from "@/state/onboarding";
import { AppText, Card, PrimaryButton, Screen, colors, radius, spacing } from "@/theme";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ParentalConsent() {
  const { data, update } = useOnboarding();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const valid = EMAIL.test(email.trim());

  async function onContinue() {
    if (!valid || sending) return;
    const parentEmail = email.trim();
    setSending(true);
    setError(false);
    const consentId = await requestConsent(parentEmail, data.age ?? 16);
    setSending(false);
    if (!consentId) {
      setError(true);
      return;
    }
    update({ parentEmail, parentalConsentId: consentId });
    router.push("/onboarding/consent-wait");
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

      {error ? (
        <AppText variant="caption" color={colors.escalate}>
          Couldn&apos;t send the approval request. Check your connection and try again.
        </AppText>
      ) : null}

      <PrimaryButton
        label={sending ? "Sending…" : "Send for approval"}
        onPress={onContinue}
        disabled={!valid || sending}
      />
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
