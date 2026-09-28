import { router } from "expo-router";
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

/**
 * With no backend configured, this build keeps the honest placeholder: Pore
 * will not pretend to verify credentials it cannot use.
 */
function SignInUnavailable() {
  const colors = useThemeColors();
  const { data } = useOnboarding();
  const continueHref = data.onboardingComplete
    ? "/(tabs)"
    : data.plan || data.analysisStatus
      ? "/onboarding/preview"
      : "/onboarding/age";

  return (
    <Screen contentStyle={{ paddingTop: spacing.xxl }}>
      <View style={{ alignItems: "center", gap: spacing.xxs }}>
        <BrandMark size={72} />
        <AppText variant="heading" color={colors.actionPrimary}>
          Pore
        </AppText>
      </View>

      <View style={{ gap: spacing.xs }}>
        <AppText variant="title">Account sync is not enabled yet</AppText>
        <AppText variant="body" color={colors.textSecondary}>
          Account sign-in is not connected in this build, so Pore will not
          pretend to verify credentials or accept a password it cannot use.
        </AppText>
      </View>

      <Callout tone="info" title="Continue privately on this device">
        <AppText variant="caption" color={colors.textPrimary}>
          Your assessment and routine are saved locally. They will not sync to another phone in this build.
        </AppText>
      </Callout>

      <View style={{ gap: spacing.xs, marginTop: spacing.md }}>
        <PrimaryButton
          label={data.onboardingComplete ? "Continue on this device" : "Start on this device"}
          onPress={() => router.replace(continueHref)}
        />
        <TextButton label="Back" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

function SignInForm() {
  const colors = useThemeColors();
  const { data } = useOnboarding();
  const { signIn, signInWithApple, appleAvailable, resetPassword } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const continueHref = data.onboardingComplete ? "/(tabs)" : "/onboarding/age";

  async function submit() {
    if (busy) return;
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    const outcome = await signIn(email, password);
    setBusy(false);
    if (outcome.ok) {
      router.replace(continueHref);
    } else {
      setError(outcome.message);
    }
  }

  async function forgotPassword() {
    if (busy) return;
    setError(null);
    setNotice(null);
    if (!email.trim()) {
      setError("Enter your email address first, then tap Forgot password.");
      return;
    }
    setBusy(true);
    const outcome = await resetPassword(email);
    setBusy(false);
    // Deliberately identical whether or not the address has an account: the
    // response must not tell an attacker which emails are registered.
    if (outcome.ok) {
      setNotice(
        "If that email has a Pore account, a reset link is on its way. Check your inbox and spam folder.",
      );
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
        <AppText variant="title">Welcome back</AppText>
        <AppText variant="body" color={colors.textSecondary}>
          Sign in to restore your routine, scans, and progress on this device.
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
          autoComplete="current-password"
          textContentType="password"
          placeholder="Your password"
          onSubmitEditing={submit}
        />
      </View>

      <TextButton label="Forgot password?" onPress={forgotPassword} />

      {error ? (
        <Callout tone="caution" title="Could not sign in">
          <AppText variant="caption" color={colors.textPrimary}>
            {error}
          </AppText>
        </Callout>
      ) : null}

      {notice ? (
        <Callout tone="info" title="Check your email">
          <AppText variant="caption" color={colors.textPrimary}>
            {notice}
          </AppText>
        </Callout>
      ) : null}

      <View style={{ gap: spacing.xs, marginTop: spacing.md }}>
        <PrimaryButton
          label={busy ? "Signing in…" : "Sign in"}
          onPress={submit}
          disabled={busy}
        />
        {appleAvailable ? (
          <TextButton label="Sign in with Apple" onPress={submitApple} />
        ) : null}
        <TextButton
          label="New to Pore? Create an account"
          onPress={() => router.replace("/sign-up")}
        />
        <TextButton label="Back" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

export default function SignInRoute() {
  if (!BACKEND_CONFIGURED) return <SignInUnavailable />;
  return <SignInForm />;
}
