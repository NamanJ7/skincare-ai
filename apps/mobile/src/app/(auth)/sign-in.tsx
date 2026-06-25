import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { AppText, GhostButton, PrimaryButton, Screen, TextField, colors, spacing } from "@/theme";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const valid = EMAIL.test(email.trim()) && password.length >= 6;

  // Increment 1 stub: no backend yet. Returning users will resume at their
  // dashboard once real auth + persistence land (Increment 2). For now, go home.
  function onContinue() {
    router.replace("/today");
  }

  return (
    <Screen contentStyle={{ paddingTop: spacing.xxl }}>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="title">Welcome back</AppText>
        <AppText variant="body" color={colors.inkMuted}>
          Log in to pick up your routine and progress.
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
          placeholder="Your password"
        />
        <PrimaryButton label="Log in" onPress={onContinue} disabled={!valid} />
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
    </Screen>
  );
}
