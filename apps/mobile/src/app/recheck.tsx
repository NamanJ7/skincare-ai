/**
 * The returning user's questionnaire: one question.
 *
 * Everything else about someone's skin — goals, type, sensitivity, tone — is
 * already on the device from their last check-in, and re-asking it every month
 * is the friction that would kill the habit this screen exists to build.
 *
 * Pregnancy and breastfeeding is the exception, and it is not a preference. The
 * safety engine treats it as a hard filter that strips retinoids and
 * hydroquinone outright, and unlike the rest it genuinely changes between
 * check-ins. Running a months-old answer through that filter is not a shortcut
 * worth taking.
 */
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { buildIntake } from "@/lib/intake";
import { useGeneratePlan } from "@/lib/useGeneratePlan";
import { useOnboarding } from "@/state/onboarding";
import {
  AppText,
  Card,
  Chip,
  GhostButton,
  PrimaryButton,
  Screen,
  colors,
  spacing,
} from "@/theme";

export default function Recheck() {
  const { data } = useOnboarding();
  const { analyzing, error, generate } = useGeneratePlan();
  const [pregnant, setPregnant] = useState<boolean | null>(
    data.pregnancyOrBreastfeeding ?? null,
  );

  async function build() {
    if (pregnant === null) return;
    const intake = buildIntake({ ...data, pregnancyOrBreastfeeding: pregnant });
    if (await generate(intake)) router.replace("/today");
  }

  return (
    <Screen contentStyle={{ paddingTop: spacing.lg }}>
      <AppText variant="label" color={colors.primary}>
        CHECK-IN
      </AppText>
      <AppText variant="title">One quick question</AppText>
      <AppText variant="body" color={colors.inkMuted}>
        We kept the rest of your answers from last time.
      </AppText>

      <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
        <AppText variant="heading">Are you pregnant or breastfeeding?</AppText>
        <AppText variant="caption" color={colors.inkMuted}>
          Some ingredients are best avoided — we&apos;ll adjust automatically.
        </AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs }}>
          <Chip label="Yes" selected={pregnant === true} onPress={() => setPregnant(true)} />
          <Chip label="No" selected={pregnant === false} onPress={() => setPregnant(false)} />
        </View>
      </View>

      {analyzing ? (
        <View style={{ alignItems: "center", gap: spacing.sm, marginTop: spacing.lg }}>
          <ActivityIndicator color={colors.primary} />
          <AppText variant="caption" color={colors.inkMuted}>
            Reading your skin and updating your routine…
          </AppText>
        </View>
      ) : (
        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          {error ? (
            <Card>
              <AppText variant="bodyStrong" color={colors.escalate}>
                We couldn&apos;t update your routine
              </AppText>
              <AppText variant="caption" color={colors.inkMuted}>
                {error} Your new photos are saved on this phone, and your previous routine is
                still here — nothing was lost.
              </AppText>
            </Card>
          ) : null}
          <PrimaryButton
            label={error ? "Try again" : "Update my routine"}
            onPress={build}
            disabled={pregnant === null}
          />
          <GhostButton label="Back" onPress={() => router.back()} />
        </View>
      )}
    </Screen>
  );
}
