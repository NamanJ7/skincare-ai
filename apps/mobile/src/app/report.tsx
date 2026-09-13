/**
 * Weekly report — the brand-moment answer to "is my skin actually getting
 * better?" One consistency line, the status change, one insight, one focus.
 * Everything comes from what the user logged and reported, never inferred
 * severity.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

import { EscalationCard } from "@/components/EscalationCard";
import { TrendRow } from "@/components/TrendRow";
import { UpsellCallout } from "@/components/UpsellCallout";
import { canViewWeeklyReport, isPremium } from "@/lib/gate";
import { track } from "@/lib/analytics";
import { completedDayCount, todayKey } from "@/lib/log";
import { STATUS_LABELS, statusFromPair } from "@/lib/skin-status";
import { redFlags, reportHighlight, weeklyReport } from "@/lib/trends";
import { useCheckIns } from "@/state/check-ins";
import { useEntitlement } from "@/state/entitlement";
import { useOnboarding } from "@/state/onboarding";
import { useRoutineLog } from "@/state/routine-log";
import {
  AppText,
  PrimaryButton,
  ProgressBar,
  Screen,
  SectionHeader,
  spacing,
  useThemeColors,
} from "@/theme";

export default function WeeklyReportScreen() {
  const colors = useThemeColors();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { checkIns, latest, daysUntilDue } = useCheckIns();
  const { log } = useRoutineLog();
  const { data } = useOnboarding();
  const { entitlement } = useEntitlement();
  const premium = isPremium(entitlement);
  const report = weeklyReport(checkIns, log, todayKey());
  const reportAllowed = canViewWeeklyReport(
    entitlement,
    checkIns.entries.length,
  );

  useEffect(() => {
    if (reportAllowed && report) {
      track("weekly_report_viewed", {
        baseline: report.baseline,
        check_in_count: checkIns.entries.length,
        free_first_comparison: !premium && !report.baseline,
      });
    }
  }, [checkIns.entries.length, premium, report?.baseline, reportAllowed]);

  // Proof comes first: Free can view the baseline and first comparison. Later
  // adaptive reports deep-link to the contextual Plus surface.
  if (!reportAllowed) {
    return <Redirect href="/paywall?feature=weekly_report" />;
  }

  const today = todayKey();
  if (!report) {
    // No check-in yet — someone deep-linked here; there is nothing to show.
    return <Redirect href="/(tabs)" />;
  }

  const flags = redFlags(latest, data.plan?.assessment);
  const highlight = reportHighlight(report);
  const weekDays = completedDayCount(log, today, 7);

  // The status change needs two comparison pairs, i.e. three check-ins.
  const entries = checkIns.entries;
  const current = statusFromPair(
    entries[entries.length - 1],
    entries[entries.length - 2],
  );
  const previous =
    entries.length >= 3
      ? statusFromPair(entries[entries.length - 2], entries[entries.length - 3])
      : undefined;

  return (
    <Screen contentStyle={{ paddingTop: spacing.xxl }}>
      <AppText variant="overline" color={colors.actionPrimary}>
        WEEKLY REPORT
      </AppText>
      <AppText variant="title">Your week with Pore</AppText>

      {flags.escalate ? <EscalationCard reasons={flags.reasons} /> : null}

      <SectionHeader title="Consistency" />
      <AppText variant="body" color={colors.textPrimary}>
        {report.completedLine}
      </AppText>
      <ProgressBar value={weekDays / 7} />

      {!report.baseline ? (
        <>
          <SectionHeader title="Skin status" />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
            }}
          >
            {previous ? (
              <>
                <AppText variant="bodyStrong" color={colors.textSecondary}>
                  {STATUS_LABELS[previous]}
                </AppText>
                <Ionicons
                  name="arrow-forward"
                  size={16}
                  color={colors.textSecondary}
                />
              </>
            ) : null}
            <AppText variant="bodyStrong" color={colors.actionPrimary}>
              {STATUS_LABELS[current]}
            </AppText>
          </View>
        </>
      ) : null}

      {highlight ? (
        <>
          <SectionHeader title="Main insight" />
          <TrendRow statement={highlight} />
        </>
      ) : null}

      <SectionHeader title="Next week's focus" />
      <AppText variant="body" color={colors.textPrimary}>
        {report.recommendation}
      </AppText>
      <AppText variant="caption" color={colors.textSecondary}>
        Next report in {daysUntilDue} {daysUntilDue === 1 ? "day" : "days"}.
      </AppText>

      <View style={{ marginTop: spacing.md }}>
        <PrimaryButton
          label="Done"
          onPress={() => {
            // Reached from the check-in flow, `back()` would land on a check-in
            // step whose draft was already cleared, and its guard bounces the
            // user to check-in step 1 — so leave to Progress explicitly.
            if (from === "check-in") router.replace("/(tabs)/progress");
            else router.back();
          }}
        />
      </View>

      {!premium && !report.baseline ? (
        <>
          <AppText variant="caption" color={colors.textSecondary}>
            This first weekly comparison is included with Free and stays yours.
          </AppText>
          <UpsellCallout feature="weekly_report" />
        </>
      ) : null}

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
