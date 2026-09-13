/**
 * Check-in complete: a calm completion moment. First entries get a
 * "saved, come back next week" framing; repeat entries hand off to the
 * weekly report instead of duplicating it here.
 */
import { Redirect, router } from "expo-router";
import { View } from "react-native";

import { EscalationCard } from "@/components/EscalationCard";
import { canViewWeeklyReport } from "@/lib/gate";
import { todayKey } from "@/lib/log";
import { redFlags, weeklyReport } from "@/lib/trends";
import { useCheckIns } from "@/state/check-ins";
import { useEntitlement } from "@/state/entitlement";
import { useOnboarding } from "@/state/onboarding";
import { useRoutineLog } from "@/state/routine-log";
import {
  AppText,
  Card,
  PrimaryButton,
  Screen,
  spacing,
  useThemeColors,
} from "@/theme";

export default function CheckInSummary() {
  const colors = useThemeColors();
  const { checkIns, latest } = useCheckIns();
  const { log } = useRoutineLog();
  const { data } = useOnboarding();
  const { entitlement } = useEntitlement();

  const report = weeklyReport(checkIns, log, todayKey());
  if (!report) {
    // No saved check-in — someone deep-linked here; restart the flow.
    return <Redirect href="/check-in" />;
  }

  const flags = redFlags(latest, data.plan?.assessment);
  const reportAllowed = canViewWeeklyReport(
    entitlement,
    checkIns.entries.length,
  );

  return (
    <Screen contentStyle={{ paddingTop: spacing.section }}>
      <AppText variant="overline" color={colors.actionPrimary}>
        {report.baseline ? "FIRST CHECK-IN SAVED" : "CHECK-IN COMPLETE"}
      </AppText>
      <AppText variant="title">
        {report.baseline
          ? "How your skin feels is saved"
          : reportAllowed
            ? "Your weekly report is ready"
            : "Your check-in is saved"}
      </AppText>

      {flags.escalate ? <EscalationCard reasons={flags.reasons} /> : null}

      {report.baseline ? (
        <Card style={{ gap: spacing.sm }}>
          <AppText variant="body" color={colors.textPrimary}>
            Day 1 stays your visual baseline. Next week, Pore can compare what
            you report.
          </AppText>
          <AppText variant="body" color={colors.textSecondary}>
            {report.completedLine}
          </AppText>
        </Card>
      ) : (
        <AppText variant="body" color={colors.textSecondary}>
          {reportAllowed
            ? "What changed, what held steady, and what to do next."
            : "Your answers stay saved. Continued adaptive reports are part of Pore Plus."}
        </AppText>
      )}

      <View style={{ marginTop: spacing.md }}>
        <PrimaryButton
          label={
            report.baseline
              ? "See my progress"
              : reportAllowed
                ? "See my weekly report"
                : "Continue reports with Plus"
          }
          onPress={() =>
            router.replace(
              report.baseline
                ? "/(tabs)/progress"
                : reportAllowed
                  ? // `from` tells the report to exit to Progress rather than
                    // back into this (now-cleared) check-in stack.
                    "/report?from=check-in"
                  : "/paywall?feature=weekly_report",
            )
          }
        />
      </View>

      <AppText
        variant="caption"
        color={colors.textSecondary}
        style={{ textAlign: "center" }}
      >
        Based on what you reported. Cosmetic guidance only.
      </AppText>
    </Screen>
  );
}
