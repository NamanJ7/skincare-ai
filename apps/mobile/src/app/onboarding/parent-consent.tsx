import { Redirect, router, useLocalSearchParams, type Href } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";

import { ageTierFor } from "@pore/shared";

import { FunnelScreen } from "@/components/FunnelScreen";
import { track } from "@/lib/analytics";
import { createGuardianCredential, isGuardianPin } from "@/lib/guardian-pin";
import { PRIVACY_ROUTE } from "@/lib/legal";
import {
  createGuardianAuthorization,
  hasCurrentGuardianAuthorization,
} from "@/lib/youth-consent";
import { useOnboarding } from "@/state/onboarding";
import {
  AppText,
  Callout,
  OptionRow,
  TextField,
  TextButton,
  spacing,
  useThemeColors,
} from "@/theme";
import { safeInternalHref } from "@/lib/route-access";

function safeReturnTo(value: string | undefined): Href {
  return safeInternalHref(value, "/onboarding/goal") as Href;
}

export default function ParentConsent() {
  const colors = useThemeColors();
  const { data, update } = useOnboarding();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const [birthYear, setBirthYear] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isGuardian, setIsGuardian] = useState(false);
  const [authorizes, setAuthorizes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adultYearLimit = new Date().getFullYear() - 18;
  const validAdultYear = useMemo(() => {
    const year = Number(birthYear);
    return Number.isInteger(year) && year >= 1900 && year <= adultYearLimit;
  }, [adultYearLimit, birthYear]);
  const validPin = isGuardianPin(pin) && pin === confirmPin;
  const canAuthorize =
    validAdultYear && validPin && isGuardian && authorizes && !saving;

  if (data.age === undefined) return <Redirect href="/onboarding/age" />;
  if (ageTierFor(data.age) !== "young_teen") {
    return <Redirect href="/onboarding/age" />;
  }
  if (
    hasCurrentGuardianAuthorization(data.age, data.guardianAuthorization)
  ) {
    return <Redirect href={safeReturnTo(returnTo)} />;
  }

  const authorize = async () => {
    if (!canAuthorize || data.age === undefined) return;
    setSaving(true);
    setError(null);
    try {
      const credential = await createGuardianCredential(pin);
      update({
        guardianAuthorization: createGuardianAuthorization(
          data.age,
          credential,
        ),
        teenSelfConsent: undefined,
      });
      track("youth_consent_completed", {
        tier: "13_15",
        method: "adult_attestation_with_device_pin",
      });
      router.replace(safeReturnTo(returnTo));
    } catch {
      setError("Pore could not save the guardian authorization. Please try again.");
      setSaving(false);
    }
  };

  return (
    <FunnelScreen
      eyebrow="PARENT OR GUARDIAN"
      title="Please hand the phone to an adult"
      subtitle="A parent or legal guardian must authorize Pore before a 13–15-year-old creates a skin profile or uses face-photo analysis."
      primaryLabel="Authorize Pore"
      primaryLoading={saving}
      primaryDisabled={!canAuthorize}
      onPrimary={() => void authorize()}
      secondaryLabel="Back to age"
      onSecondary={() => router.replace("/onboarding/age")}
      footnote="The birth year is checked on this screen and is not saved."
    >
      <Callout tone="info" icon="shield-checkmark-outline" title="What you are authorizing">
        <View style={{ gap: spacing.xs }}>
          <AppText variant="caption" color={colors.textPrimary}>
            Pore may save skincare answers on this device to personalize a
            cosmetic routine.
          </AppText>
          <AppText variant="caption" color={colors.textPrimary}>
            If the young person separately chooses a scan, Pore may process three
            face photos for cosmetic observations and progress comparisons.
          </AppText>
          <AppText variant="caption" color={colors.textPrimary}>
            Photos are not used for model training. The scan can be skipped, and
            all app data can be deleted from Profile.
          </AppText>
        </View>
      </Callout>

      <View style={{ gap: spacing.sm }}>
        <TextField
          label="Your birth year"
          value={birthYear}
          onChangeText={(value) => setBirthYear(value.replace(/\D/g, "").slice(0, 4))}
          placeholder="YYYY"
          keyboardType="number-pad"
          maxLength={4}
        />
        <TextField
          label="Create a 4-digit guardian PIN"
          value={pin}
          onChangeText={(value) => setPin(value.replace(/\D/g, "").slice(0, 4))}
          placeholder="••••"
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
        />
        <TextField
          label="Confirm guardian PIN"
          value={confirmPin}
          onChangeText={(value) =>
            setConfirmPin(value.replace(/\D/g, "").slice(0, 4))
          }
          placeholder="••••"
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
        />
        <AppText variant="caption" color={colors.textSecondary}>
          Pore stores a one-way protected PIN check, not the PIN itself. The PIN
          can be used to confirm future parent-only actions on this device.
        </AppText>
      </View>

      <View style={{ gap: spacing.sm }}>
        <OptionRow
          multi
          label="I am their parent or legal guardian and I am at least 18"
          selected={isGuardian}
          onPress={() => setIsGuardian((value) => !value)}
        />
        <OptionRow
          multi
          label="I authorize the profile and optional photo uses described above"
          hint="The young person will still choose whether to scan"
          selected={authorizes}
          onPress={() => setAuthorizes((value) => !value)}
        />
      </View>

      <TextButton
        label="Read the full Privacy Notice"
        onPress={() => router.push(PRIVACY_ROUTE)}
      />

      {!validAdultYear && birthYear.length === 4 ? (
        <AppText variant="caption" color={colors.error}>
          The authorizing parent or guardian must be at least 18.
        </AppText>
      ) : null}
      {pin.length === 4 && confirmPin.length === 4 && pin !== confirmPin ? (
        <AppText variant="caption" color={colors.error}>
          The two PIN entries do not match.
        </AppText>
      ) : null}
      {error ? (
        <AppText variant="caption" color={colors.error}>
          {error}
        </AppText>
      ) : null}
    </FunnelScreen>
  );
}
