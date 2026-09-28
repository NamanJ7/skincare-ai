import { Redirect, router, useLocalSearchParams, type Href } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import { ageTierFor } from "@pore/shared";

import { FunnelScreen } from "@/components/FunnelScreen";
import { track } from "@/lib/analytics";
import { PRIVACY_ROUTE } from "@/lib/legal";
import {
  createTeenSelfConsent,
  hasCurrentTeenSelfConsent,
} from "@/lib/youth-consent";
import { useOnboarding } from "@/state/onboarding";
import {
  AppText,
  Callout,
  OptionRow,
  TextButton,
  spacing,
  useThemeColors,
} from "@/theme";
import { safeInternalHref } from "@/lib/route-access";

function safeReturnTo(value: string | undefined): Href {
  return safeInternalHref(value, "/onboarding/goal") as Href;
}

export default function TeenConsent() {
  const colors = useThemeColors();
  const { data, update } = useOnboarding();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const [understood, setUnderstood] = useState(false);
  const [agreed, setAgreed] = useState(false);

  if (data.age === undefined) return <Redirect href="/onboarding/age" />;
  if (ageTierFor(data.age) !== "older_teen") {
    return <Redirect href="/onboarding/age" />;
  }
  if (hasCurrentTeenSelfConsent(data.age, data.teenSelfConsent)) {
    return <Redirect href={safeReturnTo(returnTo)} />;
  }

  const continueToPore = () => {
    if (!understood || !agreed || data.age === undefined) return;
    update({
      teenSelfConsent: createTeenSelfConsent(data.age),
      guardianAuthorization: undefined,
    });
    track("youth_consent_completed", { tier: "16_17", method: "self" });
    router.replace(safeReturnTo(returnTo));
  };

  return (
    <FunnelScreen
      eyebrow="YOUR PRIVACY"
      title="A quick, clear agreement"
      subtitle="Because you’re 16 or 17, you can make your own privacy choice. Here is exactly what Pore does."
      primaryLabel="Agree and continue"
      primaryDisabled={!understood || !agreed}
      onPrimary={continueToPore}
      secondaryLabel="Back to age"
      onSecondary={() => router.replace("/onboarding/age")}
      footnote="You can use answers only. Pore asks again before turning on the camera."
    >
      <Callout tone="info" icon="shield-checkmark-outline" title="In plain language">
        <View style={{ gap: spacing.xs }}>
          <AppText variant="caption" color={colors.textPrimary}>
            Your answers build a cosmetic skincare routine and can be saved on
            this device so Pore remembers your plan.
          </AppText>
          <AppText variant="caption" color={colors.textPrimary}>
            If you choose a scan, Pore processes three face photos to return
            cosmetic observations and keeps copies on this device for progress.
          </AppText>
          <AppText variant="caption" color={colors.textPrimary}>
            Photos are not used to train models. Pore is not medical care, and
            you can skip photos or delete your data in Profile.
          </AppText>
        </View>
      </Callout>

      <View style={{ gap: spacing.sm }}>
        <OptionRow
          multi
          label="I understand what Pore collects and why"
          selected={understood}
          onPress={() => setUnderstood((value) => !value)}
        />
        <OptionRow
          multi
          label="I agree to use Pore with these privacy choices"
          hint="The scan still has its own separate consent"
          selected={agreed}
          onPress={() => setAgreed((value) => !value)}
        />
      </View>
      <TextButton
        label="Read the full Privacy Notice"
        onPress={() => router.push(PRIVACY_ROUTE)}
      />
    </FunnelScreen>
  );
}
