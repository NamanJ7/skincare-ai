import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { LegalAgreement } from "@/components/legal/LegalLinks";
import { AppText, GhostButton, PrimaryButton, Screen, TextField, colors, spacing } from "@/theme";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const valid = EMAIL.test(email.trim()) && password.length >= 6;

  // Increment 1 stub: no backend yet. Real Supabase email/Apple/Google sign-up
  // replaces this in Increment 2. For now any valid-looking input continues.
  function onContinue() {
    router.push("/onboarding/age");
  }

  return (
    <Screen contentStyle={{ paddingTop: spacing.xxl }}>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="title">Create your account</AppText>
        {/* Was "Save your skin scans and routine, and track your progress over
            time" — a promise about an account backend that does not exist. Your
            routine and photos are genuinely kept, but on this device, so that is
            what it says now. */}
        <AppText variant="body" color={colors.inkMuted}>
          Your routine, photos, and progress stay on this phone. Accounts and syncing across devices
          are coming later.
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

      <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
        <AppText variant="caption" color={colors.inkMuted} style={{ textAlign: "center" }}>
          or continue with
        </AppText>
        <GhostButton label="Continue with Apple" onPress={onContinue} />
        <GhostButton label="Continue with Google" onPress={onContinue} />
      </View>

      <Pressable onPress={() => router.replace("/sign-in")} style={{ marginTop: spacing.md }}>
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
