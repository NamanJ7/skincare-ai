/**
 * Pore Skin Story — connects an honest scan- or answer-based read directly to
 * the safety-adjusted routine the user can follow today.
 */
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import type { ConcernKey, ThemeColors } from "@pore/shared";
import { EscalationCard } from "@/components/EscalationCard";
import { MascotCompanion } from "@/components/mascot/MascotCompanion";
import {
  EvidenceLabel,
  PoreLens,
  PriorityStoryCard,
} from "@/components/results";
import { answersOnlyReason } from "@/lib/analysis-status";
import { track } from "@/lib/analytics";
import { activePeriod } from "@/lib/daily-action";
import { scanAccess } from "@/lib/gate";
import { periodComplete, todayKey } from "@/lib/log";
import { scanEntryHref } from "@/lib/nav";
import { photoUri } from "@/lib/photos";
import { routineFor } from "@/lib/plan";
import {
  buildResults,
  canOfferGuidedScan,
  currentScanDate,
  currentScanFrontPhotoName,
  routinePeriodForSupport,
  routineSupportForConcern,
} from "@/lib/results";
import { latestAnalyzedScan } from "@/lib/scan-history";
import { useEntitlement } from "@/state/entitlement";
import { useOnboarding } from "@/state/onboarding";
import { useRoutineLog } from "@/state/routine-log";
import { useScanHistory } from "@/state/scan-history";
import {
  AppText,
  Callout,
  Enter,
  PrimaryButton,
  Screen,
  SectionHeader,
  TextButton,
  spacing,
  useThemeColors,
} from "@/theme";

export default function ResultsScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data } = useOnboarding();
  const { history } = useScanHistory();
  const { entitlement } = useEntitlement();
  const { log, dayLog } = useRoutineLog();

  const view = useMemo(() => buildResults(data, colors), [colors, data]);
  const fromScan = view.source === "scan";
  const reason = answersOnlyReason(data);
  const scanEvidenceAvailable = canOfferGuidedScan(data);
  const failed =
    reason === "quality_failed" ||
    reason === "analysis_failed" ||
    reason === "analysis_timeout" ||
    reason === "analysis_unconfigured";

  const today = todayKey();
  const routineResult = useMemo(
    () => routineFor(data, log.revision, today),
    [data, log.revision, today],
  );
  const preferredPeriod = activePeriod(
    new Date().getHours(),
    periodComplete(dayLog(today)?.am),
  );
  const stories = useMemo(
    () =>
      view.priorities.map((priority) => {
        const support = routineSupportForConcern(
          priority.concern,
          routineResult.routine,
        );
        return {
          priority,
          support,
          period: routinePeriodForSupport(support, preferredPeriod),
        };
      }),
    [preferredPeriod, routineResult.routine, view.priorities],
  );

  const [selectedConcern, setSelectedConcern] = useState<
    ConcernKey | undefined
  >(() => view.priorities[0]?.concern);
  const [expandedConcern, setExpandedConcern] = useState<
    ConcernKey | undefined
  >(() => view.priorities[0]?.concern);
  useEffect(() => {
    setSelectedConcern((current) =>
      view.priorities.some((priority) => priority.concern === current)
        ? current
        : view.priorities[0]?.concern,
    );
    setExpandedConcern((current) =>
      current &&
      view.priorities.some((priority) => priority.concern === current)
        ? current
        : view.priorities[0]?.concern,
    );
  }, [view.priorities]);

  const selectedStory =
    stories.find((story) => story.priority.concern === selectedConcern) ??
    stories[0];
  const selectedRank = selectedStory
    ? stories.indexOf(selectedStory) + 1
    : undefined;

  const scanDate = currentScanDate(data);
  const frontPhotoName = useMemo(
    () => currentScanFrontPhotoName(data, history),
    [data, history],
  );
  const frontPhotoUri = frontPhotoName
    ? (photoUri(frontPhotoName) ?? undefined)
    : undefined;
  const markers = stories.flatMap((story, index) => {
    const region = story.priority.observedRegions[0];
    return region
      ? [
          {
            rank: index + 1,
            title: story.priority.title,
            region,
          },
        ]
      : [];
  });

  // A failed current attempt may retain an older plan for continuity. We may
  // mention it, but never reuse its assessment or photo as current evidence.
  const lastAnalyzed =
    !fromScan && failed ? latestAnalyzedScan(history) : undefined;
  const access = scanAccess(entitlement, data, history);
  const rescanHref = access.allowed
    ? scanEntryHref(data, "rescan")
    : access.reason === "plus_required"
      ? "/paywall?feature=rescan"
      : "/(tabs)/scan";

  useEffect(() => {
    track("results_viewed", { source: view.source, analysis_failed: failed });
  }, [failed, view.source]);

  function openRoutine(concern?: ConcernKey) {
    const story =
      stories.find((candidate) => candidate.priority.concern === concern) ??
      selectedStory;
    const period = story?.period ?? preferredPeriod;
    router.push({
      pathname: "/(tabs)/routine",
      params: {
        period,
        ...(story ? { priority: story.priority.concern } : {}),
      },
    });
  }

  return (
    <Screen contentStyle={styles.screenContent}>
      <Enter index={0} style={styles.heading}>
        <AppText variant="overline" color={colors.actionPrimary}>
          YOUR PORE SKIN STORY
        </AppText>
        <AppText variant="title">
          {fromScan ? "What Pore noticed" : "Your plan, made clear"}
        </AppText>
        <EvidenceLabel source={view.source} />
        {scanDate ? (
          <AppText variant="caption" color={colors.textSecondary}>
            Scan from {formatScanDate(scanDate)}
          </AppText>
        ) : null}
        <AppText variant="body" color={colors.textPrimary}>
          {view.summary}
        </AppText>
      </Enter>

      <Enter index={1}>
        <PoreLens
          source={view.source}
          photoUri={frontPhotoUri}
          markers={markers}
          selectedRank={selectedRank}
          hasPriorities={view.priorities.length > 0}
          scanEvidenceAvailable={scanEvidenceAvailable}
          onSelect={(rank) => {
            const priority = stories[rank - 1]?.priority;
            if (priority) {
              setSelectedConcern(priority.concern);
              setExpandedConcern(priority.concern);
            }
          }}
        />
      </Enter>

      {view.escalate ? (
        <EscalationCard reasons={view.reasons} reasonSource="scan" />
      ) : null}

      {view.priorities.length > 0 ? (
        <View style={styles.prioritySection}>
          <SectionHeader title="Your priorities" />
          <View style={styles.storyList}>
            {stories.map((story, index) => {
              const selected = story === selectedStory;
              const expanded = story.priority.concern === expandedConcern;
              return (
                <Enter key={story.priority.concern} index={2 + index}>
                  <PriorityStoryCard
                    priority={story.priority}
                    rank={index + 1}
                    selected={selected}
                    expanded={expanded}
                    scanBased={fromScan}
                    support={story.support}
                    supportPeriod={story.period}
                    onSelect={() => {
                      setSelectedConcern(story.priority.concern);
                      setExpandedConcern((current) =>
                        current === story.priority.concern
                          ? undefined
                          : story.priority.concern,
                      );
                    }}
                    onOpenRoutine={() => openRoutine(story.priority.concern)}
                  />
                </Enter>
              );
            })}
          </View>
        </View>
      ) : null}

      {view.readNote ? (
        <View style={styles.readNoteRow}>
          {!fromScan ? (
            <MascotCompanion
              state={failed ? "caution" : "observing"}
              size="sm"
              still={failed}
              accessibilityLabel={
                failed
                  ? "Pore companion explains that this result uses your answers because the scan was not verified"
                  : "Pore companion explains this answer-based result"
              }
              style={styles.readNoteMascot}
            />
          ) : null}
          <Callout
            tone={fromScan && view.priorities.length === 0 ? "success" : "info"}
            icon={fromScan ? "eye-outline" : "camera-outline"}
            title={fromScan ? "About this read" : "Visual evidence is optional"}
            style={styles.readNoteCallout}
          >
            <AppText variant="caption" color={colors.textPrimary}>
              {view.readNote}
            </AppText>
          </Callout>
        </View>
      ) : null}

      {lastAnalyzed ? (
        <AppText variant="caption" color={colors.textSecondary}>
          Your last completed scan was on{" "}
          {formatScanDate(new Date(lastAnalyzed.createdAt))}. You can revisit it
          in Progress; this read stays based on your answers.
        </AppText>
      ) : null}

      <View style={styles.actions}>
        <PrimaryButton
          label={primaryRoutineLabel(
            selectedStory?.period ?? preferredPeriod,
            preferredPeriod,
          )}
          onPress={() => openRoutine(selectedStory?.priority.concern)}
        />
        {scanEvidenceAvailable ? (
          <TextButton
            label={scanActionLabel({
              fromScan,
              failed,
              hasScan: !!data.scannedAt,
              access,
            })}
            onPress={() => router.push(rescanHref)}
          />
        ) : null}
      </View>

      <AppText
        variant="caption"
        color={colors.textSecondary}
        style={styles.disclaimer}
      >
        {view.disclaimer}
      </AppText>
    </Screen>
  );
}

function primaryRoutineLabel(
  period: "am" | "pm",
  preferred: "am" | "pm",
): string {
  if (period !== preferred) {
    return period === "am" ? "View my morning plan" : "View tonight's plan";
  }
  return period === "am" ? "Start my morning plan" : "Start tonight's plan";
}

function scanActionLabel({
  fromScan,
  failed,
  hasScan,
  access,
}: {
  fromScan: boolean;
  failed: boolean;
  hasScan: boolean;
  access: ReturnType<typeof scanAccess>;
}): string {
  if (access.reason === "cadence_wait") {
    return `Next guided scan in ${access.daysUntilAvailable} ${
      access.daysUntilAvailable === 1 ? "day" : "days"
    }`;
  }
  if (access.reason === "first_weekly_comparison") {
    return "Take my weekly comparison";
  }
  if (failed) return "Retake the scan when ready";
  if (fromScan || hasScan) return "Scan again when ready";
  return "Add visual evidence with a guided scan";
}

function formatScanDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screenContent: {
      paddingTop: spacing.lg,
      gap: spacing.lg,
    },
    heading: { gap: spacing.xs },
    prioritySection: { gap: spacing.sm },
    storyList: {
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    readNoteRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    readNoteMascot: { flexShrink: 0 },
    readNoteCallout: { flex: 1 },
    actions: { gap: spacing.xxs, marginTop: spacing.xs },
    disclaimer: { textAlign: "center" },
  });
}
