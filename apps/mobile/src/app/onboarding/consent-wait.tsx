import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import type { ConsentStatus } from "@pore/shared";

import { getConsentStatus, requestConsent } from "@/lib/consent";
import { useOnboarding } from "@/state/onboarding";
import { AppText, Card, PrimaryButton, Screen, colors, spacing } from "@/theme";

const POLL_INTERVAL_MS = 5000;

export default function ConsentWait() {
  const { data, update } = useOnboarding();
  const [status, setStatus] = useState<ConsentStatus | "unreachable">("pending");
  const [resending, setResending] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!data.parentalConsentId) {
      router.replace("/onboarding/consent");
      return;
    }

    let cancelled = false;

    async function poll() {
      const id = data.parentalConsentId;
      if (!id) return;
      const result = await getConsentStatus(id);
      if (cancelled) return;
      setStatus(result ?? "unreachable");
      if (result === "approved") {
        if (pollRef.current) clearInterval(pollRef.current);
        router.replace("/onboarding/intake");
      }
    }

    poll();
    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [data.parentalConsentId]);

  async function onResend() {
    if (!data.parentEmail || resending) return;
    setResending(true);
    const consentId = await requestConsent(data.parentEmail, data.age ?? 16);
    setResending(false);
    if (consentId) {
      update({ parentalConsentId: consentId });
      setStatus("pending");
    }
  }

  return (
    <Screen contentStyle={{ paddingTop: spacing.section }}>
      <AppText variant="title">Waiting for approval</AppText>
      <AppText variant="body" color={colors.inkMuted}>
        We emailed {data.parentEmail} an approval link. This screen updates automatically once
        they respond — you don&apos;t need to do anything else.
      </AppText>

      <Card>
        {status === "pending" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <ActivityIndicator color={colors.primary} />
            <AppText variant="body" color={colors.ink}>
              Waiting for your parent or guardian…
            </AppText>
          </View>
        ) : null}
        {status === "denied" ? (
          <AppText variant="body" color={colors.escalate}>
            Your parent or guardian declined this request, so Pore can&apos;t continue with photos
            right now.
          </AppText>
        ) : null}
        {status === "unreachable" ? (
          <AppText variant="body" color={colors.escalate}>
            Couldn&apos;t reach the server to check approval status. We&apos;ll keep retrying.
          </AppText>
        ) : null}
      </Card>

      <PrimaryButton
        label={resending ? "Resending…" : "Resend approval email"}
        onPress={onResend}
        disabled={resending || status === "approved"}
      />
    </Screen>
  );
}
