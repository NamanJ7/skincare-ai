import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { LegalAgreement } from "@/components/legal/LegalLinks";
import { AppText, Card, PrimaryButton, Screen, TextField, colors, spacing } from "@/theme";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const valid = EMAIL.test(email.trim()) && password.length >= 6;

  // No backend yet, so this creates nothing. The copy used to promise "save
  // your skin scans and routine, and track your progress over time" — an
  // account, a server and a sync, none of which exist. What is actually true is
  // better for this product anyway, so it says that instead.
  function onContinue() {
    router.push("/onboarding/age");
  }

  return (
    <Screen contentStyle={{ paddingTop: spacing.xxl }}>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="title">Create your account</AppText>
        <AppText variant="body" color={colors.inkMuted}>
          Your routine, your photos and your record all stay on this phone. Nothing is uploaded to
          an account.
        </AppText>
      </View>

      <View style={{ gap: spacing.md, marginTop: spacing.md }}>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="you@email.com"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="At least 6 characters"
        />
        <PrimaryButton label="Create account" onPress={onContinue} disabled={!valid} />
      </View>

      <Card>
        <AppText variant="caption" color={colors.inkMuted}>
          Accounts aren&apos;t switched on yet, so this doesn&apos;t create one — it just gets you
          to the setup. When sign-in does land, it will be so you can move to a new phone, never so
          we can hold your photos.
        </AppText>
      </Card>

      <Pressable
        onPress={() => router.replace("/sign-in")}
        accessibilityRole="link"
        accessibilityLabel="Already have an account? Log in"
        hitSlop={8}
        style={({ pressed }) => [
          { minHeight: 44, justifyContent: "center", marginTop: spacing.xs },
          pressed && { opacity: 0.6 },
        ]}
      >
        <AppText variant="caption" color={colors.inkMuted} style={{ textAlign: "center" }}>
          Already have an account?{" "}
          <AppText variant="caption" color={colors.primary}>
            Log in
          </AppText>
        </AppText>
      </Pressable>

      <LegalAgreement />
    </Screen>
  );
}
