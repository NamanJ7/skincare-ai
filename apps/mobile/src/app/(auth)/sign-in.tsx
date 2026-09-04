import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { LegalLinks } from "@/components/legal/LegalLinks";
import { activeRoutine, readJournal } from "@/lib/journal";
import { AppText, Card, PrimaryButton, Screen, TextField, colors, spacing } from "@/theme";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hasRoutine] = useState(() => activeRoutine(readJournal()) !== undefined);
  const valid = EMAIL.test(email.trim()) && password.length >= 6;

  // No backend yet. There is nothing to log in to and nothing to restore — the
  // routine lives on this phone. The screen used to claim otherwise and offer
  // Apple and Google buttons that called this same stub, which reads as working
  // OAuth to anyone who taps one. They are gone until there is an account
  // behind them.
  function onContinue() {
    router.replace(hasRoutine ? "/today" : "/onboarding/age");
  }

  return (
    <Screen contentStyle={{ paddingTop: spacing.xxl }}>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="title">Welcome back</AppText>
        <AppText variant="body" color={colors.inkMuted}>
          {hasRoutine
            ? "Your routine is already on this phone — this just picks it back up."
            : "There's no routine on this phone yet, so signing in will start a new one."}
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
        <PrimaryButton
          label={hasRoutine ? "Open my routine" : "Continue"}
          onPress={onContinue}
          disabled={!valid}
        />
      </View>

      <Card>
        <AppText variant="caption" color={colors.inkMuted}>
          Accounts aren&apos;t switched on yet. Everything Pore knows about you is stored on this
          phone, so there is nothing on a server to sign in to — and nothing to lose if you never
          do.
        </AppText>
      </Card>

      <Pressable
        onPress={() => router.replace("/sign-up")}
        accessibilityRole="link"
        accessibilityLabel="New to Pore? Create an account"
        hitSlop={8}
        style={({ pressed }) => [
          { minHeight: 44, justifyContent: "center", marginTop: spacing.xs },
          pressed && { opacity: 0.6 },
        ]}
      >
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
