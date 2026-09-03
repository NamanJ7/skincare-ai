import { router } from "expo-router";
import { useState } from "react";
import { Pressable } from "react-native";

import { useOnboarding } from "@/state/onboarding";
import { AppText, Card, PrimaryButton, Screen, TextField, colors, spacing } from "@/theme";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ParentalConsent() {
  const { update } = useOnboarding();
  const [email, setEmail] = useState("");
  const valid = EMAIL.test(email.trim());

  function onContinue() {
    if (!valid) return;
    update({ parentEmail: email.trim() });
    router.push("/onboarding/photo");
  }

  return (
    <Screen contentStyle={{ paddingTop: spacing.section }}>
      <AppText variant="title">Tell a parent or guardian</AppText>
      {/*
        This screen used to say a parent "needs to approve before Pore looks at
        any photos", then proceed to the camera on any valid-looking email —
        no request sent, no approval recorded. Verifiable consent is a real
        build, not a text field, so until it exists the screen says what it
        actually does.
      */}
      <AppText variant="body" color={colors.inkMuted}>
        Since you&apos;re under 18, we ask you to bring a parent or guardian in before you start.
        We&apos;ll send them a note about what Pore does with your photos.
      </AppText>

      <TextField
        label="Parent or guardian email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="parent@email.com"
      />

      <Card>
        <AppText variant="caption" color={colors.inkMuted}>
          This email is only ever used to tell them about Pore. Your photos stay on your phone, are
          sent only for your own analysis, and are never stored on our servers. Pore never trains on
          or sells anyone&apos;s data.
        </AppText>
        <Pressable
          onPress={() => router.push("/legal/privacy")}
          accessibilityRole="link"
          accessibilityLabel="Read the Privacy Policy"
          hitSlop={8}
          style={({ pressed }) => [
            { minHeight: 44, justifyContent: "center" },
            pressed && { opacity: 0.6 },
          ]}
        >
          <AppText variant="caption" color={colors.primary}>
            Read the Privacy Policy
          </AppText>
        </Pressable>
      </Card>

      <PrimaryButton label="Continue to the photos" onPress={onContinue} disabled={!valid} />
    </Screen>
  );
}
