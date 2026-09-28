import Ionicons from "@expo/vector-icons/Ionicons";
import { Redirect, router, type Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import type { ThemeColors } from "@pore/shared";

import { MascotCompanion } from "@/components/mascot/MascotCompanion";
import { track } from "@/lib/analytics";
import { activePeriod } from "@/lib/daily-action";
import { funnelProgress } from "@/lib/funnel-progress";
import { scanEntryHref } from "@/lib/nav";
import { nextRequiredOnboardingHref } from "@/lib/onboarding-flow";
import {
  buildOnboardingValueModel,
  type OnboardingValueModel,
  type PorePathCheckpoint,
} from "@/lib/onboarding-value";
import { useOnboarding } from "@/state/onboarding";
import {
  AppText,
  Callout,
  Card,
  Chip,
  Divider,
  PrimaryButton,
  ProgressBar,
  Screen,
  TextButton,
  borderWidth,
  radius,
  spacing,
  useThemeColors,
} from "@/theme";

export default function PreviewRoute() {
  const { data } = useOnboarding();
  const required = nextRequiredOnboardingHref(data);
  if (required) return <Redirect href={required as Href} />;
  return <PorePathPreview />;
}

function PorePathPreview() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data } = useOnboarding();
  const [answersExpanded, setAnswersExpanded] = useState(false);
  const model = useMemo(
    () => buildOnboardingValueModel(data, new Date()),
    [data],
  );
  const progress = funnelProgress("plan");

  useEffect(() => {
    track("results_viewed", {
      context: "onboarding_pore_path",
      source: model.source.kind === "scan_and_answers" ? "scan" : "answers",
    });
    track("onboarding_step_viewed", { step_id: "plan" });
  }, [model.source.kind]);

  function startRoutine() {
    const period = activePeriod(new Date().getHours(), false);
    track("onboarding_step_completed", { step_id: "plan" });
    router.push({ pathname: "/onboarding/notifications", params: { period } });
  }

  return (
    <Screen contentStyle={styles.screen}>
      <ProgressBar value={progress.step / progress.total} from={progress.from} />

      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <AppText variant="overline" color={colors.actionPrimary}>
            {model.goalHero.eyebrow}
          </AppText>
          <AppText variant="title">{model.goalHero.title}</AppText>
          <AppText variant="body" color={colors.textSecondary}>
            {model.goalHero.detail}
          </AppText>
          <View style={styles.sourceRow}>
            <Chip
              label={model.source.label}
              selected
              tone={
                model.source.kind === "scan_and_answers"
                  ? "lavender"
                  : "primary"
              }
            />
            <AppText
              variant="caption"
              color={colors.textSecondary}
              style={styles.sourceCopy}
            >
              {model.source.detail}
            </AppText>
          </View>
        </View>
        <MascotCompanion
          state={model.escalation ? "caution" : "celebrating"}
          size="md"
          accessibilityLabel={
            model.escalation
              ? "Pore companion recommends a professional check"
              : "Pore companion presenting your personalized path"
          }
        />
      </View>

      <SectionTitle
        eyebrow="YOUR FOCUS"
        title="Priorities, in order"
        detail="Your first priority leads. Supporting concerns stay visible without competing for attention."
      />
      <View style={styles.priorityGrid}>
        {model.priorities.map((priority) => (
          <Card key={`${priority.rank}-${priority.title}`} elevated style={styles.priorityCard}>
            <View style={styles.priorityHeader}>
              <View style={styles.rankCircle}>
                <AppText variant="label" color={colors.onBrandAccent}>
                  {priority.rank}
                </AppText>
              </View>
              <AppText variant="headline" style={{ flex: 1 }}>
                {priority.title}
              </AppText>
              {priority.evidence === "scan" ? (
                <Ionicons
                  name="scan-outline"
                  size={20}
                  color={colors.actionPrimary}
                  accessibilityLabel="From current scan"
                />
              ) : null}
            </View>
            {priority.appearanceLabel ? (
              <View style={styles.tagRow}>
                <Chip label={priority.appearanceLabel} />
                {priority.confidenceLabel ? (
                  <Chip label={priority.confidenceLabel} tone="lavender" />
                ) : null}
              </View>
            ) : null}
            <AppText variant="caption" color={colors.textPrimary}>
              {priority.detail}
            </AppText>
            {priority.regionLabel ? (
              <AppText variant="caption" color={colors.actionPrimary}>
                {priority.regionLabel}
              </AppText>
            ) : null}
            <AppText variant="caption" color={colors.textSecondary}>
              {priority.outlook}
            </AppText>
          </Card>
        ))}
      </View>
      {model.priorityNote ? (
        <Callout tone="info" title="About this photo read">
          <AppText variant="caption" color={colors.textPrimary}>
            {model.priorityNote}
          </AppText>
        </Callout>
      ) : null}

      <Card elevated style={styles.pathCard}>
        <SectionTitle
          eyebrow="PLANNED CHECKPOINTS"
          title="Your Pore Path"
          detail="These are actions and check-ins—not a predicted result or guaranteed timeline."
        />
        <CheckpointPath checkpoints={model.checkpoints} />
      </Card>

      <SectionTitle
        eyebrow="DAILY RECOMMENDATION"
        title="Your plan at a glance"
        detail="Everything here comes from the final safety-adjusted routine."
      />
      <DailyPlan model={model} />

      <SectionTitle
        eyebrow="KEEP IT PRACTICAL"
        title={model.escalation ? "What to do next" : "How to meet your goal"}
      />
      <View style={styles.actionList}>
        {model.actions.map((action, index) => (
          <View key={action.id} style={styles.actionRow}>
            <View style={styles.actionIcon}>
              <Ionicons
                name={
                  index === 0
                    ? "flag-outline"
                    : index === 1
                      ? "shield-checkmark-outline"
                      : "calendar-outline"
                }
                size={20}
                color={colors.actionPrimary}
                accessible={false}
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyStrong">{action.title}</AppText>
              <AppText variant="caption" color={colors.textSecondary}>
                {action.detail}
              </AppText>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.safetyStack}>
        {model.safetyHighlights.map((highlight) => (
          <Callout
            key={highlight.id}
            tone={highlight.tone}
            icon={
              highlight.tone === "escalate"
                ? "medkit-outline"
                : "shield-checkmark-outline"
            }
            title={highlight.title}
          >
            <AppText variant="caption" color={colors.textPrimary}>
              {highlight.detail}
            </AppText>
          </Callout>
        ))}
      </View>

      <Card elevated style={styles.whyCard}>
        <SectionTitle
          eyebrow="WHY PORE"
          title="Less guessing. More structure."
        />
        <View style={styles.comparisonHead}>
          <AppText variant="label" color={colors.textSecondary} style={styles.compareColumn}>
            ON YOUR OWN
          </AppText>
          <AppText variant="label" color={colors.actionPrimary} style={styles.compareColumn}>
            WITH PORE
          </AppText>
        </View>
        {model.comparisonRows.map((row, index) => (
          <View key={row.id}>
            {index > 0 ? <Divider /> : null}
            <View style={styles.comparisonRow}>
              <View style={[styles.compareColumn, styles.compareCell]}>
                <Ionicons
                  name="remove-circle-outline"
                  size={18}
                  color={colors.textSecondary}
                  accessible={false}
                />
                <AppText variant="caption" color={colors.textSecondary} style={{ flex: 1 }}>
                  {row.without}
                </AppText>
              </View>
              <View style={[styles.compareColumn, styles.compareCell]}>
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={colors.actionPrimary}
                  accessible={false}
                />
                <AppText variant="caption" color={colors.textPrimary} style={{ flex: 1 }}>
                  {row.withPore}
                </AppText>
              </View>
            </View>
          </View>
        ))}
      </Card>

      <Card style={styles.infoCard}>
        <Pressable
          onPress={() => setAnswersExpanded((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel={answersExpanded ? "Collapse your information" : "Review and edit your information"}
          accessibilityState={{ expanded: answersExpanded }}
          style={({ pressed }) => [styles.infoHeader, pressed && { opacity: 0.72 }]}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="headline">Your information</AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              Review every answer and change anything that no longer fits.
            </AppText>
          </View>
          <Ionicons
            name={answersExpanded ? "chevron-up" : "chevron-down"}
            size={20}
            color={colors.actionPrimary}
            accessible={false}
          />
        </Pressable>
        {answersExpanded ? (
          <View style={styles.answerList}>
            {model.answerRows.map((row, index) => (
              <View key={row.screen}>
                {index > 0 ? <Divider /> : null}
                <Pressable
                  onPress={() =>
                    router.push(
                      `/onboarding/${row.screen}?edit=1&returnTo=${encodeURIComponent("/onboarding/preview")}` as Href,
                    )
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${row.label}. Current answer: ${row.value}`}
                  style={({ pressed }) => [styles.answerRow, pressed && { opacity: 0.72 }]}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="bodyStrong">{row.label}</AppText>
                    <AppText variant="caption" color={colors.textSecondary}>
                      {row.value}
                    </AppText>
                  </View>
                  <AppText variant="label" color={colors.actionPrimary}>Edit</AppText>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      {model.source.rescanRecommended ? (
        <Callout tone="info" icon="refresh-outline" title="Your answers changed">
          <AppText variant="caption" color={colors.textPrimary}>
            Older scan conclusions are hidden. Your routine is already rebuilt from your current answers; re-scan only if you want fresh photo insights.
          </AppText>
          <View style={{ alignItems: "flex-start" }}>
            <TextButton
              label="Refresh with a guided scan"
              onPress={() => router.push(scanEntryHref(data, "onboarding") as Href)}
            />
          </View>
        </Callout>
      ) : null}

      <PrimaryButton label="Start my routine" onPress={startRoutine} />
      <AppText variant="caption" color={colors.textSecondary} style={styles.disclaimer}>
        {model.disclaimer}
      </AppText>
    </Screen>
  );
}

function SectionTitle({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
}) {
  const colors = useThemeColors();
  return (
    <View style={{ gap: spacing.xxs }}>
      <AppText variant="overline" color={colors.actionPrimary}>{eyebrow}</AppText>
      <AppText variant="heading">{title}</AppText>
      {detail ? (
        <AppText variant="caption" color={colors.textSecondary}>{detail}</AppText>
      ) : null}
    </View>
  );
}

function CheckpointPath({ checkpoints }: { checkpoints: PorePathCheckpoint[] }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reduceMotion = useReducedMotion();
  const draw = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    draw.value = reduceMotion
      ? 1
      : withTiming(1, { duration: 720, easing: Easing.out(Easing.cubic) });
  }, [draw, reduceMotion]);

  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: draw.value }],
  }));

  return (
    <View style={styles.timeline}>
      <View importantForAccessibility="no" style={styles.timelineTrack} />
      <Animated.View importantForAccessibility="no" style={[styles.timelineFill, lineStyle]} />
      {checkpoints.map((checkpoint, index) => (
        <View
          key={checkpoint.id}
          style={styles.checkpoint}
          accessible
          accessibilityLabel={`${checkpoint.label}, ${checkpoint.accessibilityDate}. ${checkpoint.title}. ${checkpoint.detail}`}
        >
          <View
            style={[
              styles.checkpointDot,
              checkpoint.state === "current" && styles.checkpointDotCurrent,
            ]}
          >
            <AppText
              variant="label"
              color={
                checkpoint.state === "current"
                  ? colors.onBrandAccent
                  : colors.actionPrimary
              }
            >
              {index + 1}
            </AppText>
          </View>
          <View style={styles.checkpointCopy}>
            <View style={styles.checkpointLabelRow}>
              <AppText variant="bodyStrong">{checkpoint.label}</AppText>
              <AppText variant="caption" color={colors.actionPrimary}>
                {checkpoint.dateLabel}
              </AppText>
            </View>
            <AppText variant="bodyStrong">{checkpoint.title}</AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              {checkpoint.detail}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

function DailyPlan({ model }: { model: OnboardingValueModel }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const periods = [model.dailyPlan.am, model.dailyPlan.pm];
  return (
    <View style={styles.dailyGrid}>
      {periods.map((period) => (
        <Card key={period.period} elevated style={styles.dailyCard}>
          <View style={styles.dailyIcon}>
            <Ionicons
              name={period.period === "am" ? "sunny-outline" : "moon-outline"}
              size={22}
              color={colors.actionPrimary}
              accessible={false}
            />
          </View>
          <AppText variant="headline">{period.label}</AppText>
          <AppText variant="stat" color={colors.actionPrimary}>
            {period.stepCount}
          </AppText>
          <AppText variant="caption" color={colors.textSecondary}>
            {period.stepCount === 1 ? "step" : "steps"}
          </AppText>
          <View style={{ gap: spacing.xxs }}>
            {period.keySteps.map((step) => (
              <AppText key={step} variant="caption" color={colors.textPrimary}>
                • {step}
              </AppText>
            ))}
          </View>
        </Card>
      ))}
      <Card style={styles.dailyWideCard}>
        <View style={styles.dailyWideRow}>
          <Ionicons
            name="calendar-outline"
            size={22}
            color={colors.actionPrimary}
            accessible={false}
          />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyStrong">{model.dailyPlan.nextCheckIn.label}</AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              {model.dailyPlan.nextCheckIn.dateLabel} · {model.dailyPlan.nextCheckIn.detail}
            </AppText>
          </View>
        </View>
        {model.dailyPlan.spf ? (
          <View style={styles.dailyWideRow}>
            <Ionicons
              name="sunny-outline"
              size={22}
              color={colors.actionPrimary}
              accessible={false}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyStrong">{model.dailyPlan.spf.label}</AppText>
              <AppText variant="caption" color={colors.textSecondary}>
                {model.dailyPlan.spf.frequency} · {model.dailyPlan.spf.detail}
              </AppText>
            </View>
          </View>
        ) : null}
        {model.dailyPlan.activeGuidance.map((active) => (
          <View key={`${active.period}-${active.label}`} style={styles.dailyWideRow}>
            <Ionicons
              name="water-outline"
              size={22}
              color={colors.actionPrimary}
              accessible={false}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyStrong">{active.label}</AppText>
              <AppText variant="caption" color={colors.textSecondary}>
                {active.period} · {active.frequency}{active.ramp ? ` · ${active.ramp}` : ""}
              </AppText>
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { paddingTop: spacing.md, gap: spacing.lg },
    hero: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    heroCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
    sourceRow: { gap: spacing.xs, alignItems: "flex-start" },
    sourceCopy: { flexShrink: 1 },
    priorityGrid: { gap: spacing.sm },
    priorityCard: { gap: spacing.sm },
    priorityHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    rankCircle: {
      width: 30,
      height: 30,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.actionPrimary,
    },
    tagRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    pathCard: { gap: spacing.md },
    timeline: { position: "relative", gap: spacing.md },
    timelineTrack: {
      position: "absolute",
      top: 20,
      bottom: 20,
      left: 19,
      width: borderWidth.emphasis,
      backgroundColor: colors.border,
    },
    timelineFill: {
      position: "absolute",
      top: 20,
      bottom: 20,
      left: 19,
      width: borderWidth.emphasis,
      backgroundColor: colors.actionPrimary,
      transformOrigin: "top",
    },
    checkpoint: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start" },
    checkpointDot: {
      zIndex: 1,
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceElevated,
      borderWidth: borderWidth.emphasis,
      borderColor: colors.actionPrimary,
    },
    checkpointDotCurrent: { backgroundColor: colors.actionPrimary },
    checkpointCopy: {
      flex: 1,
      gap: 2,
      padding: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: borderWidth.hairline,
      borderColor: colors.border,
    },
    checkpointLabelRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: spacing.xs,
    },
    dailyGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    dailyCard: { flexGrow: 1, flexBasis: "46%", minWidth: 145, gap: spacing.xxs },
    dailyIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.infoSoft,
    },
    dailyWideCard: { width: "100%", gap: spacing.sm },
    dailyWideRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
    actionList: {
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceElevated,
      borderWidth: borderWidth.hairline,
      borderColor: colors.border,
    },
    actionRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
    actionIcon: {
      width: 38,
      height: 38,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.successSoft,
    },
    safetyStack: { gap: spacing.sm },
    whyCard: { gap: spacing.md },
    comparisonHead: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    comparisonRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
    },
    compareColumn: { flexGrow: 1, flexBasis: "44%", minWidth: 120 },
    compareCell: { flexDirection: "row", alignItems: "flex-start", gap: spacing.xs },
    infoCard: { gap: spacing.sm },
    infoHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    answerList: { gap: 0 },
    answerRow: {
      minHeight: 62,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    disclaimer: { textAlign: "center", paddingHorizontal: spacing.md },
  });
}
