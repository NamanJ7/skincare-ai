import { LegalLinks } from "@/components/legal/LegalLinks";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { hasStoredPlan } from "@/lib/plan";
import { AppText, Card, GhostButton, PrimaryButton, Screen, TextField, colors, spacing } from "@/theme";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const valid = EMAIL.test(email.trim()) && password.length >= 6;
  // Accounts are still a stub, so a "log in" can only restore what this phone
  // already has. Checked once on mount: the answer cannot change while the
  // screen is open.
  const [saved] = useState(hasStoredPlan);

  // Without a saved routine there is nothing to return to, so start one rather
  // than dropping the user on a plan and a set of findings that aren't theirs.
  function onContinue() {
    if (saved) router.replace("/today");
    else router.replace("/onboarding/age");
  }

  return (
    <Screen contentStyle={{ paddingTop: spacing.xxl }}>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="title">Welcome back</AppText>
        <AppText variant="body" color={colors.inkMuted}>
          {saved
            ? "Log in to pick up your routine and progress."
            : "Your routine is saved on the phone that made it."}
        </AppText>
      </View>

      {!saved && (
        <Card>
          <AppText variant="caption" color={colors.inkMuted}>
            There&apos;s no saved routine on this phone yet. Accounts that sync across devices
            aren&apos;t live — continuing will start a new scan.
          </AppText>
        </Card>
      )}

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
          placeholder="Your password"
        />
        <PrimaryButton label={saved ? "Log in" : "Start a new scan"} onPress={onContinue} disabled={!valid} />
      </View>

      <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
        <AppText variant="caption" color={colors.inkMuted} style={{ textAlign: "center" }}>
          or continue with
        </AppText>
        <GhostButton label="Continue with Apple" onPress={onContinue} />
        <GhostButton label="Continue with Google" onPress={onContinue} />
      </View>

      <Pressable onPress={() => router.replace("/sign-up")} style={{ marginTop: spacing.md }}>
        <AppText variant="caption" color={colors.inkMuted} style={{ textAlign: "center" }}>
          New to Pore?{" "}
          <AppText variant="caption" color={colors.primary}>
            Create an account
          </AppText>
        </AppText>
      </Pressable>

      <LegalLinks />
    </Screen>
  );
}
