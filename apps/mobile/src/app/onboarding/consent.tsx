import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";

import { requestParentalConsent, verifyParentalConsent } from "@/lib/api";
import { useOnboarding } from "@/state/onboarding";
import { AppText, Card, GhostButton, PrimaryButton, Screen, colors, radius, spacing } from "@/theme";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_LENGTH = 6;

/** `ada@example.com` -> `a••@example.com`. Enough to recognise, not enough to be a record. */
function mask(email: string): string {
  const [name = "", domain = ""] = email.split("@");
  const head = name.slice(0, 1);
  return `${head}${"•".repeat(Math.max(2, name.length - 1))}@${domain}`;
}

/**
 * Real parental consent for 16-17 year olds.
 *
 * This screen used to collect a parent's address, write it to local state and
 * continue straight to the camera — no email sent, nothing verified, nothing
 * recorded. It read as a gate and was not one.
 *
 * Now nothing advances until a parent has actually received the email and read
 * the code back. Every failure path stays on this screen: an unreachable server,
 * an unconfigured mailer and a wrong code all leave `parentalConsent` unset,
 * and `onboarding/photo` refuses to open the camera without it.
 */
export default function ParentalConsent() {
  const { data, update } = useOnboarding();
  const age = data.age === 17 ? 17 : 16;

  const [email, setEmail] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const emailValid = EMAIL.test(email.trim());
  const codeValid = code.trim().length === CODE_LENGTH;

  async function onSend() {
    if (!emailValid || busy) return;
    setBusy(true);
    setError("");
    const result = await requestParentalConsent(email.trim(), age);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setToken(result.token);
  }

  async function onVerify() {
    if (!codeValid || !token || busy) return;
    setBusy(true);
    setError("");
    const result = await verifyParentalConsent(token, code.trim());
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "That code is not right.");
      return;
    }
    // The only place approval is ever recorded, and only after the server said so.
    update({
      parentalConsent: { approvedAt: new Date().toISOString(), parentEmailMasked: mask(email.trim()) },
    });
    router.push("/onboarding/photo");
  }

  return (
    <Screen contentStyle={{ paddingTop: spacing.section }}>
      <AppText variant="title">A parent needs to approve</AppText>

      {token === null ? (
        <>
          <AppText variant="body" color={colors.inkMuted}>
            Since you&apos;re under 18, a parent or guardian has to approve before Pore takes any
            photos. Enter their email and we&apos;ll send them a link.
          </AppText>

          <TextInput
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setError("");
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            placeholder="parent@email.com"
            accessibilityLabel="Parent or guardian's email address"
            placeholderTextColor={colors.inkMuted}
            style={styles.input}
          />

          <Card>
            <AppText variant="caption" color={colors.inkMuted}>
              We use this address once, to ask for approval. Pore never trains on or sells
              anyone&apos;s data. Your photos are kept on your phone; each one is sent to our server
              and passed to Anthropic to build your routine, and is not stored there.
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

          <PrimaryButton
            label={busy ? "Sending…" : "Send approval email"}
            onPress={onSend}
            disabled={!emailValid || busy}
          />
        </>
      ) : (
        <>
          <AppText variant="body" color={colors.inkMuted}>
            We emailed {mask(email.trim())}. When they approve, they&apos;ll see a
            {` ${CODE_LENGTH}`}-character code. Enter it here. The link stops working after 24
            hours.
          </AppText>

          <TextInput
            value={code}
            onChangeText={(t) => {
              setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH));
              setError("");
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!busy}
            placeholder="ABC234"
            accessibilityLabel="Approval code from your parent or guardian"
            placeholderTextColor={colors.inkMuted}
            style={[styles.input, styles.code]}
            maxLength={CODE_LENGTH}
          />

          <PrimaryButton
            label={busy ? "Checking…" : "Continue"}
            onPress={onVerify}
            disabled={!codeValid || busy}
          />
          <GhostButton
            label="Use a different email"
            onPress={() => {
              setToken(null);
              setCode("");
              setError("");
            }}
          />
        </>
      )}

      {busy ? <ActivityIndicator color={colors.primary} /> : null}

      {error ? (
        <View accessibilityLiveRegion="polite">
          <AppText variant="caption" color={colors.escalate}>
            {error}
          </AppText>
        </View>
      ) : null}
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
  code: { fontSize: 26, letterSpacing: 6, textAlign: "center", fontWeight: "600" },
});
