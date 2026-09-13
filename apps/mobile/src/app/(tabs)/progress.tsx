/**
 * Progress is a Skin Journey, not a score. Behavior, visual observations, and
 * self-reported experience stay in separate, clearly sourced sections.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { ThemeColors } from "@pore/shared";

import { CheckInDueCard } from "@/components/CheckInDueCard";
import { CompareView } from "@/components/CompareView";
import { Disclaimer } from "@/components/Disclaimer";
import { EscalationCard } from "@/components/EscalationCard";
import { JourneyPath } from "@/components/journey/JourneyPath";
import { PhotoTimeline } from "@/components/PhotoTimeline";
import { TrendRow } from "@/components/TrendRow";
import { UpsellCallout } from "@/components/UpsellCallout";
import { isCurrentScanAnalysis } from "@/lib/analysis-status";
import { track } from "@/lib/analytics";
import { confirm } from "@/lib/dialogs";
import { canViewWeeklyReport, isPremium, scanAccess } from "@/lib/gate";
import { deriveJourney } from "@/lib/journey";
import { todayKey, weekDays } from "@/lib/log";
import { scanEntryHref } from "@/lib/nav";
import { photoTimeline, type TimelineEntry } from "@/lib/photo-timeline";
import {
  compareAnalyzedScans,
  scanConditionsAreComparable,
  scanTrendStatements,
} from "@/lib/scan-compare";
import { deriveSkinStatus } from "@/lib/skin-status";
import { redFlags, reportHighlight, weeklyReport } from "@/lib/trends";
import { useCheckIns } from "@/state/check-ins";
import { useEntitlement } from "@/state/entitlement";
import { useOnboarding } from "@/state/onboarding";
import { useRoutineLog } from "@/state/routine-log";
import { useScanHistory } from "@/state/scan-history";
import {
  AppText,
  Callout,
  Enter,
  Screen,
  SectionHeader,
  TextButton,
  WeekStrip,
  iconSize,
  spacing,
  touchTarget,
  useThemeColors,
} from "@/theme";

export default function ProgressTab() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data, update } = useOnboarding();
  const { log } = useRoutineLog();
  const { checkIns, latest, due, daysUntilDue } = useCheckIns();
  const { history, remove: removeScan } = useScanHistory();
  const { entitlement } = useEntitlement();

  const premium = isPremium(entitlement);
  const today = todayKey();
  const access = scanAccess(entitlement, data, history, today);
  const scanHref = access.allowed
    ? scanEntryHref(data, "rescan")
    : access.reason === "plus_required"
      ? "/paywall?feature=rescan"
      : "/(tabs)/scan";

  const report = weeklyReport(checkIns, log, today);
  const currentAssessment = isCurrentScanAnalysis(data)
    ? data.plan?.assessment
    : undefined;
  const flags = redFlags(latest, currentAssessment);
  const status = deriveSkinStatus(checkIns, today);
  const highlight = report ? reportHighlight(report) : undefined;
  const weekCells = weekDays(log, today);
  const weekComplete = weekCells.filter((cell) => cell.complete).length;
  const firstTime = checkIns.entries.length === 0;
  const journey = useMemo(
    () => deriveJourney({ log, checkIns, scans: history, today }),
    [checkIns, history, log, today],
  );

  const timeline = photoTimeline(history, checkIns);
  const comparison = useMemo(() => compareAnalyzedScans(history), [history]);
  const scanTrends = useMemo(
    () => (comparison ? scanTrendStatements(comparison) : null),
    [comparison],
  );
  const [selected, setSelected] = useState<number | null>(null);
  const selectedIndex =
    timeline.length === 0
      ? -1
      : Math.min(selected ?? timeline.length - 1, timeline.length - 1);
  const baselineEntry = timeline[0];
  const selectedEntry =
    selectedIndex >= 0 ? timeline[selectedIndex] : undefined;
  const reliability = comparisonReliability(
    baselineEntry,
    selectedEntry,
    history.scans,
  );

  const confirmDeleteSelectedScan = async () => {
    if (!selectedEntry || selectedEntry.source !== "scan") return;
    const record = history.scans.find(
      (scan) => scan.createdAt === selectedEntry.createdAt,
    );
    if (!record) return;
    const confirmed = await confirm({
      title: "Delete this scan?",
      message:
        "This removes all saved angles and the derived scan result from this device. This cannot be undone.",
      confirmLabel: "Delete scan",
      destructive: true,
    });
    if (!confirmed) return;

    const currentScanId =
      data.analysisStatus?.kind === "scan_analyzed"
        ? data.analysisStatus.scanId
        : data.plan?.scanId;
    const latestAnalyzed = [...history.scans]
      .reverse()
      .find((scan) => scan.analyzed);
    const removesCurrent = record.scanId
      ? record.scanId === currentScanId
      : record.analyzed && latestAnalyzed?.createdAt === record.createdAt;
    removeScan(record.createdAt);
    if (removesCurrent) {
      update({
        plan: undefined,
        scannedAt: undefined,
        analysisStatus: { kind: "none" },
      });
    }
    track("scan_deleted", {
      analyzed: record.analyzed === true,
      angle_count: record.photoNames.length,
    });
    setSelected(null);
  };

  const compareCopy =
    "This side-by-side view is a visual diary. It does not prove what caused a visible difference.";

  return (
    <Screen contentStyle={styles.screen}>
      <Enter index={0} style={styles.heading}>
        <AppText variant="titleSans">Skin Journey</AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          A timeline of what you did, what Pore could compare, and how your skin
          felt.
        </AppText>
      </Enter>

      {flags.escalate ? <EscalationCard reasons={flags.reasons} /> : null}

      <Enter index={1}>
        <JourneyPath summary={journey} />
      </Enter>

      <Enter index={2}>
        <SectionHeader title="Routine consistency" />
        <View style={styles.laneIntro}>
          <View style={[styles.laneDot, styles.behaviorDot]} />
          <AppText variant="caption" color={colors.textSecondary}>
            Based only on routines you marked complete.
          </AppText>
        </View>
        <AppText variant="headline">
          {weekComplete} of 7 routine days this week
        </AppText>
        <View style={styles.weekStripWrap}>
          <WeekStrip days={weekCells} />
        </View>
        <AppText variant="caption" color={colors.textSecondary}>
          A missed day stays neutral. Restart with the next routine that fits
          your day.
        </AppText>
      </Enter>

      <Enter index={3}>
        <SectionHeader
          title="Visual observations"
          action={
            timeline.length > 0
              ? access.reason === "plus_required"
                ? "Continue with Plus"
                : access.allowed
                  ? "New scan"
                  : undefined
              : undefined
          }
          onAction={() => router.push(scanHref)}
        />
        <View style={styles.laneIntro}>
          <View style={[styles.laneDot, styles.observationDot]} />
          <AppText variant="caption" color={colors.textSecondary}>
            Appearance from saved photos; never a diagnosis or proof of cause.
          </AppText>
        </View>

        {access.reason === "cadence_wait" ? (
          <AppText variant="caption" color={colors.textSecondary}>
            Your next standardized scan opens in {access.daysUntilAvailable}{" "}
            {access.daysUntilAvailable === 1 ? "day" : "days"}. Weekly spacing
            makes comparisons easier to interpret.
          </AppText>
        ) : null}

        {timeline.length === 0 ? (
          <Callout tone="info" icon="camera-outline" title="No photos yet">
            <AppText variant="caption" color={colors.textPrimary}>
              Your first guided scan can become Day 1. Nothing will be compared
              until a later photo exists.
            </AppText>
            <TextButton
              label={data.scannedAt ? "Re-scan my skin" : "Start my first scan"}
              onPress={() => router.push(scanHref)}
            />
          </Callout>
        ) : (
          <View style={styles.visualStack}>
            {timeline.length >= 2 && baselineEntry && selectedEntry ? (
              <>
                <CompareView
                  baseline={baselineEntry}
                  selected={selectedEntry}
                  copy={compareCopy}
                />
                <Callout tone={reliability.tone} title={reliability.title}>
                  <AppText variant="caption" color={colors.textPrimary}>
                    {reliability.body}
                  </AppText>
                </Callout>
              </>
            ) : (
              <Callout tone="info" title="Not enough information yet">
                <AppText variant="caption" color={colors.textPrimary}>
                  Day 1 is saved. Add one later photo before trying to compare.
                </AppText>
              </Callout>
            )}

            {scanTrends && scanTrends.length > 0 ? (
              <View style={styles.trends}>
                <AppText variant="headline">Analyzed scan observations</AppText>
                {comparison ? (
                  <AppText variant="caption" color={colors.textSecondary}>
                    {formatCreatedAt(comparison.baselineCreatedAt)} to{" "}
                    {formatCreatedAt(comparison.latestCreatedAt)}. This block
                    compares those analyzed scans and does not change when you
                    select another photo above.
                  </AppText>
                ) : null}
                {scanTrends.map((statement) => (
                  <TrendRow key={statement.key} statement={statement} />
                ))}
              </View>
            ) : timeline.length >= 2 ? (
              <Callout tone="info" title="No comparable scan read yet">
                <AppText variant="caption" color={colors.textPrimary}>
                  Pore needs two successfully analyzed guided scans before
                  describing what appears different or unchanged.
                </AppText>
              </Callout>
            ) : null}

            <PhotoTimeline
              entries={timeline}
              selectedIndex={selectedIndex}
              onSelect={setSelected}
            />
            {selectedEntry?.source === "scan" ? (
              <TextButton
                label="Delete selected scan"
                tone={colors.error}
                onPress={() => void confirmDeleteSelectedScan()}
              />
            ) : null}
          </View>
        )}

        {!premium && access.analyzedCount >= 2 ? (
          <View style={styles.upsell}>
            <AppText variant="caption" color={colors.textSecondary}>
              Your first scan comparison is included with Free and stays yours.
            </AppText>
            <UpsellCallout feature="rescan" />
          </View>
        ) : null}
      </Enter>

      <Enter index={4}>
        <SectionHeader title="How it felt" />
        <View style={styles.laneIntro}>
          <View style={[styles.laneDot, styles.selfReportDot]} />
          <AppText variant="caption" color={colors.textSecondary}>
            Based on what you reported in check-ins.
          </AppText>
        </View>
        {due || !report ? (
          <CheckInDueCard firstTime={firstTime} />
        ) : !canViewWeeklyReport(entitlement, checkIns.entries.length) ? (
          <UpsellCallout feature="weekly_report" />
        ) : (
          <Pressable
            onPress={() => router.push("/report")}
            accessibilityRole="button"
            accessibilityLabel="Open weekly skin experience report"
            style={({ pressed }) => [
              styles.reportRow,
              pressed && styles.rowPressed,
            ]}
          >
            <View style={styles.reportCopy}>
              <AppText variant="headline">Your weekly report</AppText>
              {report.baseline ? (
                <AppText variant="body" color={colors.textSecondary}>
                  Baseline saved. Your next check-in can add a self-reported
                  comparison.
                </AppText>
              ) : highlight ? (
                <AppText variant="body">{highlight.headline}</AppText>
              ) : null}
              <AppText variant="caption" color={colors.textSecondary}>
                Self-reported status: {status.label.toLowerCase()} · Next
                check-in in {daysUntilDue} {daysUntilDue === 1 ? "day" : "days"}
              </AppText>
            </View>
            <Ionicons
              name="chevron-forward"
              size={iconSize.sm}
              color={colors.textSecondary}
            />
          </Pressable>
        )}
        {__DEV__ ? (
          <TextButton
            label="Check in again (dev)"
            onPress={() => router.push("/check-in")}
          />
        ) : null}
      </Enter>

      <Disclaimer />
    </Screen>
  );
}

function comparisonReliability(
  baseline: TimelineEntry | undefined,
  selected: TimelineEntry | undefined,
  scans: ReturnType<typeof useScanHistory>["history"]["scans"],
): {
  tone: "info" | "caution";
  title: string;
  body: string;
} {
  if (!baseline || !selected) {
    return {
      tone: "info",
      title: "Not enough information yet",
      body: "Two photos are needed before Pore can discuss comparison quality.",
    };
  }
  const baselineScan =
    baseline.source === "scan"
      ? scans.find((scan) => scan.createdAt === baseline.createdAt)
      : undefined;
  const selectedScan =
    selected.source === "scan"
      ? scans.find((scan) => scan.createdAt === selected.createdAt)
      : undefined;
  if (baselineScan?.analyzed && selectedScan?.analyzed) {
    if (
      scanConditionsAreComparable(
        baselineScan.comparisonMetadata,
        selectedScan.comparisonMetadata,
      )
    ) {
      return {
        tone: "info",
        title: "Capture conditions match closely enough to compare",
        body: "Both photos passed the same lighting, angle, and framing checks, so a visible difference is more likely to be real.",
      };
    }
    return {
      tone: "caution",
      title: "Capture checks passed; the cross-scan match is not verified",
      body: "These photos were captured under different enough lighting or angle conditions that Pore can't confirm the match, so review visible differences cautiously.",
    };
  }
  if (baseline.source === "check_in" || selected.source === "check_in") {
    return {
      tone: "caution",
      title: "This comparison may be unreliable",
      body: "Check-in photos do not use the guided scan’s blur, lighting, distance, and pose gates.",
    };
  }
  return {
    tone: "caution",
    title: "We could not verify both photos for analysis",
    body: "Use this as a visual diary only. A new guided scan is needed for a stronger comparison.",
  };
}

function formatCreatedAt(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  screen: { paddingTop: spacing.lg, gap: spacing.xl },
  heading: { gap: spacing.xxs },
  laneIntro: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  laneDot: { width: 10, height: 10, borderRadius: 5 },
  weekStripWrap: { paddingVertical: spacing.xs },
  behaviorDot: { backgroundColor: colors.actionPrimary },
  observationDot: { backgroundColor: colors.info },
  selfReportDot: { backgroundColor: colors.warning },
  visualStack: { gap: spacing.md },
  trends: {
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  upsell: { gap: spacing.sm, marginTop: spacing.md },
  reportRow: {
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  reportCopy: { flex: 1, gap: spacing.xs },
  rowPressed: { backgroundColor: colors.successSoft },
  });
}
