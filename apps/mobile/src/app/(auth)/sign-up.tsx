import { Redirect, router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { BrandMark } from "@/components/BrandMark";
import { BACKEND_CONFIGURED } from "@/lib/backend/supabase";
import { useOnboarding } from "@/state/onboarding";
import { useSession } from "@/state/session";
import {
  AppText,
  Callout,
  PrimaryButton,
  Screen,
  TextButton,
  TextField,
  spacing,
  useThemeColors,
} from "@/theme";

function SignUpForm() {
  const colors = useThemeColors();
  const { data } = useOnboarding();
  const { signUp, signInWithApple, appleAvailable } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const continueHref = data.onboardingComplete ? "/(tabs)" : "/onboarding/age";

  async function submit() {
    if (busy) return;
    setError(null);
    if (!email.trim()) {
      setError("Enter an email address.");
      return;
    }
    if (password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }
    setBusy(true);
    const outcome = await signUp(email, password);
    setBusy(false);
    if (outcome.ok) {
      router.replace(continueHref);
    } else {
      setError(outcome.message);
    }
  }

  async function submitApple() {
    if (busy) return;
    setError(null);
    setBusy(true);
    const outcome = await signInWithApple();
    setBusy(false);
    if (outcome.ok) {
      router.replace(continueHref);
    } else if (!outcome.canceled) {
      setError(outcome.message);
    }
  }

  return (
    <Screen contentStyle={{ paddingTop: spacing.xxl }}>
      <View style={{ alignItems: "center", gap: spacing.xxs }}>
        <BrandMark size={72} />
        <AppText variant="heading" color={colors.actionPrimary}>
          Pore
        </AppText>
      </View>

      <View style={{ gap: spacing.xs }}>
        <AppText variant="title">Create your account</AppText>
        <AppText variant="body" color={colors.textSecondary}>
          An account backs up your routine, scans, and progress so they survive
          a lost phone or reinstall.
        </AppText>
      </View>

      <View style={{ gap: spacing.sm }}>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="you@example.com"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="At least 8 characters"
          onSubmitEditing={submit}
        />
      </View>

      {error ? (
        <Callout tone="caution" title="Could not create account">
          <AppText variant="caption" color={colors.textPrimary}>
            {error}
          </AppText>
        </Callout>
      ) : null}

      <View style={{ gap: spacing.xs, marginTop: spacing.md }}>
        <PrimaryButton
          label={busy ? "Creating account…" : "Create account"}
          onPress={submit}
          disabled={busy}
        />
        {appleAvailable ? (
          <TextButton label="Continue with Apple" onPress={submitApple} />
        ) : null}
        <TextButton
          label="Already have an account? Sign in"
          onPress={() => router.replace("/sign-in")}
        />
        <TextButton label="Back" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

export default function SignUpRoute() {
  // Placeholder builds keep the old behavior: sign-up lands on the honest
  // local-beta explanation.
  if (!BACKEND_CONFIGURED) return <Redirect href="/sign-in" />;
  return <SignUpForm />;
}
