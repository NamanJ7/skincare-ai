import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import type { ThemeColors } from "@pore/shared";
import { RoutineComplete } from "@/components/RoutineComplete";
import { activePeriod } from "@/lib/daily-action";
import { track } from "@/lib/analytics";
import { frequencyLabel, stepLabel } from "@/lib/labels";
import {
  periodComplete,
  routineStepInstances,
  todayKey,
  type RoutinePeriod,
  type RoutineSessionSource,
  type RoutineStepSkipReason,
} from "@/lib/log";
import { routineFor, routineShelfAssignments } from "@/lib/plan";
import { PRODUCT_IMAGES } from "@/lib/product-images";
import {
  resolvedSchedule,
  routineFingerprint,
  scheduledStepInstances,
} from "@/lib/routine-schedule";
import { routineSessionExpired } from "@/lib/routine-session";
import { USAGE } from "@/lib/usage";
import { useOnboarding } from "@/state/onboarding";
import { useRoutineLog } from "@/state/routine-log";
import {
  AppText,
  Callout,
  Card,
  GhostButton,
  PrimaryButton,
  ProgressBar,
  Screen,
  TextButton,
  radius,
  spacing,
  touchTarget,
  useThemeColors,
} from "@/theme";

const SKIP_REASONS: readonly {
  reason: RoutineStepSkipReason;
  label: string;
}[] = [
  { reason: "not_owned", label: "I don’t have this" },
  { reason: "ran_out", label: "I ran out" },
  { reason: "skin_sensitive", label: "My skin feels sensitive" },
  { reason: "not_now", label: "Not this time" },
];

interface CompletionSummary {
  completed: number;
  total: number;
  full: boolean;
}

export default function RoutineSessionScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ period?: string; source?: string }>();
  const { data } = useOnboarding();
  const {
    log,
    streak,
    ensureSchedule,
    startSession,
    setStepDone,
    skipStep,
    goToSessionStep,
    finishSession,
    abandonExpiredSession,
    abandonSession,
    markStepNotOwned,
  } = useRoutineLog();
  const [skipOpen, setSkipOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [completion, setCompletion] = useState<CompletionSummary>();
  const initializationRef = useRef("");
  const resumedRef = useRef("");
  const endingRef = useRef(false);

  const now = new Date();
  const today = todayKey(now);
  const requestedPeriod: RoutinePeriod =
    params.period === "am" || params.period === "pm"
      ? params.period
      : activePeriod(now.getHours(), periodComplete(log.days[today]?.am));
  const source: RoutineSessionSource =
    params.source === "routine" || params.source === "reminder"
      ? params.source
      : "home";
  const session = log.activeSession;
  const sessionDate = session?.date ?? today;
  const period = session?.period ?? requestedPeriod;
  const { routine, adjustments } = useMemo(
    () => routineFor(data, log.revision, sessionDate),
    [data, log.revision, sessionDate],
  );
  const fingerprint = routineFingerprint(routine, data.profileRevision ?? 0);
  const schedule = resolvedSchedule(log.schedule, fingerprint, today);
  const due = scheduledStepInstances(routine, requestedPeriod, schedule, today);
  const allInstances = routineStepInstances(routine[period]);
  const sessionSteps = session
    ? session.stepKeys
        .map((key) => allInstances.find((item) => item.key === key))
        .filter((item): item is (typeof allInstances)[number] => !!item)
    : due;
  const periodLog = session
    ? log.days[session.date]?.[session.period]
    : undefined;
  const shelfAssignments = useMemo(
    () => routineShelfAssignments(data, routine),
    [data, routine],
  );
  const stale =
    !!session &&
    (session.routineFingerprint !== fingerprint ||
      sessionSteps.length !== session.stepKeys.length);

  useEffect(() => {
    if (completion || stale || endingRef.current) return;
    const key = session?.id ?? `${today}:${requestedPeriod}:${fingerprint}`;
    if (initializationRef.current === key) return;
    initializationRef.current = key;

    async function initialize() {
      if (session) {
        if (routineSessionExpired(session)) {
          const persisted = await abandonExpiredSession();
          if (!persisted) {
            setSaveError(true);
            initializationRef.current = "";
            return;
          }
          track("routine_session_abandoned", {
            period: session.period,
            source: session.source,
            scheduled_count: session.stepKeys.length,
          });
          return;
        }
        if (resumedRef.current !== session.id) {
          resumedRef.current = session.id;
          track("routine_session_resumed", {
            period: session.period,
            source: session.source,
            step_index: session.currentIndex + 1,
            scheduled_count: session.stepKeys.length,
          });
        }
        return;
      }
      if (due.length === 0) return;
      const scheduleSaved = await ensureSchedule(fingerprint, today);
      if (!scheduleSaved) {
        setSaveError(true);
        initializationRef.current = "";
        return;
      }
      const started = await startSession({
        date: today,
        period: requestedPeriod,
        source,
        routineFingerprint: fingerprint,
        stepKeys: due.map((item) => item.key),
      });
      if (!started) {
        setSaveError(true);
        initializationRef.current = "";
        return;
      }
      track("routine_session_started", {
        period: requestedPeriod,
        source,
        scheduled_count: due.length,
      });
    }
    void initialize();
  }, [
    abandonExpiredSession,
    completion,
    due,
    ensureSchedule,
    fingerprint,
    requestedPeriod,
    session,
    source,
    stale,
    startSession,
    today,
  ]);

  const failSave = () => {
    setSaveError(true);
    setSaving(false);
  };

  if (completion) {
    return (
      <Screen contentStyle={styles.screen}>
        {completion.full ? (
          <RoutineComplete celebrate streak={streak} />
        ) : (
          <View style={styles.completion} accessibilityLiveRegion="polite">
            <Ionicons
              name="checkmark-circle"
              size={42}
              color={colors.success}
            />
            <AppText variant="headline" style={styles.centered}>
              Routine saved · {completion.completed} of {completion.total} steps
              completed
            </AppText>
            <AppText
              variant="caption"
              color={colors.textSecondary}
              style={styles.centered}
            >
              Skipped steps were saved without counting as completed.
            </AppText>
          </View>
        )}
        <PrimaryButton
          label="Back to Home"
          onPress={() => router.replace("/(tabs)")}
        />
      </Screen>
    );
  }

  if (stale && session) {
    return (
      <Screen contentStyle={styles.screen}>
        <Callout
          tone="caution"
          title="Your routine changed while this session was paused"
        >
          <AppText variant="caption" color={colors.textPrimary}>
            Steps already recorded today are still saved. Start again to use the
            current guidance.
          </AppText>
        </Callout>
        {saveError ? <SaveError /> : null}
        <PrimaryButton
          label="Start updated routine"
          loading={saving}
          onPress={async () => {
            setSaving(true);
            setSaveError(false);
            const abandoned = await abandonSession();
            if (!abandoned) return failSave();
            track("routine_session_abandoned", {
              period: session.period,
              source: session.source,
              scheduled_count: session.stepKeys.length,
            });
            initializationRef.current = "";
            setSaving(false);
          }}
        />
        <TextButton
          label="Back to Home"
          onPress={() => router.replace("/(tabs)")}
        />
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen contentStyle={styles.screen}>
        <SessionHeader onClose={() => router.replace("/(tabs)")} />
        {saveError ? <SaveError /> : null}
        {due.length === 0 ? (
          <Callout title="Nothing scheduled right now" tone="info">
            <AppText variant="caption" color={colors.textPrimary}>
              Your full plan is still available in the Routine tab.
            </AppText>
          </Callout>
        ) : (
          <AppText variant="body" color={colors.textSecondary}>
            Preparing today’s routine…
          </AppText>
        )}
        <TextButton
          label="Back to Home"
          onPress={() => router.replace("/(tabs)")}
        />
      </Screen>
    );
  }

  const activeSession = session;
  const currentIndex = activeSession.currentIndex;
  const current = sessionSteps[currentIndex];
  const completedCount = session.stepKeys.filter((key) =>
    periodLog?.done.includes(key),
  ).length;
  const skippedCount = session.stepKeys.filter(
    (key) => periodLog?.skipped?.[key],
  ).length;
  const resolvedCount = completedCount + skippedCount;

  async function updateIndex(index: number) {
    setSaveError(false);
    const persisted = await goToSessionStep(index);
    if (!persisted) setSaveError(true);
  }

  async function markDone() {
    if (!current) return;
    setSaving(true);
    setSaveError(false);
    const persisted = await setStepDone(current.key, currentIndex + 1);
    if (!persisted) return failSave();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    track("routine_session_step_completed", {
      period,
      source: activeSession.source,
      step_index: currentIndex + 1,
      scheduled_count: activeSession.stepKeys.length,
    });
    setSaving(false);
  }

  async function chooseSkip(reason: RoutineStepSkipReason) {
    if (!current) return;
    setSkipOpen(false);
    setSaving(true);
    setSaveError(false);
    Haptics.selectionAsync().catch(() => {});
    if (reason === "not_owned") markStepNotOwned(current.key);
    const persisted = await skipStep(current.key, reason, currentIndex + 1);
    if (!persisted) return failSave();
    track("routine_session_step_skipped", {
      period,
      source: activeSession.source,
      step_index: currentIndex + 1,
      scheduled_count: activeSession.stepKeys.length,
    });
    setSaving(false);
  }

  async function finish() {
    endingRef.current = true;
    setSaving(true);
    setSaveError(false);
    const full = completedCount === activeSession.stepKeys.length;
    const persisted = await finishSession();
    if (!persisted) {
      endingRef.current = false;
      return failSave();
    }
    if (full) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    }
    track("routine_session_finished", {
      period,
      source: activeSession.source,
      scheduled_count: activeSession.stepKeys.length,
      completed_count: completedCount,
      skipped_count: skippedCount,
      elapsed_duration_ms: Math.max(
        0,
        Date.now() - Date.parse(activeSession.startedAt),
      ),
    });
    setCompletion({
      completed: completedCount,
      total: activeSession.stepKeys.length,
      full,
    });
    setSaving(false);
  }

  if (!current) {
    return (
      <Screen contentStyle={styles.screen}>
        <SessionHeader onClose={() => router.replace("/(tabs)")} />
        <View
          accessible
          accessibilityLabel={`${resolvedCount} of ${session.stepKeys.length} steps resolved`}
        >
          <AppText variant="overline" color={colors.textSecondary}>
            REVIEW
          </AppText>
          <AppText variant="titleSans">Routine ready to save</AppText>
          <AppText variant="body" color={colors.textSecondary}>
            {completedCount} completed · {skippedCount} skipped
          </AppText>
        </View>
        <ProgressBar value={1} />
        {saveError ? <SaveError /> : null}
        <PrimaryButton
          label="Finish routine"
          loading={saving}
          onPress={finish}
        />
        {skippedCount > 0 ? (
          <GhostButton
            label="Review skipped steps"
            onPress={() => {
              const firstSkipped = session.stepKeys.findIndex(
                (key) => !!periodLog?.skipped?.[key],
              );
              void updateIndex(firstSkipped < 0 ? 0 : firstSkipped);
            }}
          />
        ) : null}
        <TextButton
          label="Back"
          onPress={() =>
            void updateIndex(Math.max(0, session.stepKeys.length - 1))
          }
        />
      </Screen>
    );
  }

  const { step } = current;
  const product = shelfAssignments[period][current.index];
  const usage = USAGE[step.category];
  const relevantAdjustments = adjustments.filter(
    (adjustment) =>
      adjustment.active === step.active &&
      (!adjustment.time || adjustment.time === (period === "am" ? "AM" : "PM")),
  );
  const currentSkipped = periodLog?.skipped?.[current.key];

  return (
    <Screen contentStyle={styles.screen}>
      <SessionHeader onClose={() => router.replace("/(tabs)")} />
      <View
        style={styles.progressCopy}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`Step ${currentIndex + 1} of ${session.stepKeys.length}`}
        accessibilityValue={{
          min: 1,
          max: session.stepKeys.length,
          now: currentIndex + 1,
        }}
      >
        <AppText variant="label" color={colors.textSecondary}>
          Step {currentIndex + 1} of {session.stepKeys.length}
        </AppText>
        <ProgressBar value={(currentIndex + 1) / session.stepKeys.length} />
      </View>

      <Card elevated style={styles.stepCard}>
        {product?.catalogId && PRODUCT_IMAGES[product.catalogId] ? (
          <Image
            source={PRODUCT_IMAGES[product.catalogId]}
            contentFit="contain"
            style={styles.productImage}
            accessibilityLabel={`${product.name} product image`}
          />
        ) : null}
        <View
          style={styles.stepHeading}
          accessible
          accessibilityLabel={`Step ${currentIndex + 1} of ${session.stepKeys.length}. ${stepLabel(step)}. ${product?.name ?? "No product mapped"}. Scheduled today. ${currentSkipped ? "Skipped" : periodLog?.done.includes(current.key) ? "Done" : "Not completed"}.`}
        >
          <AppText variant="overline" color={colors.textSecondary}>
            {frequencyLabel(step).toUpperCase()}
          </AppText>
          <AppText variant="titleSans">{stepLabel(step)}</AppText>
          <AppText variant="bodyStrong" color={colors.actionPrimary}>
            {product?.name ?? "No product mapped yet"}
          </AppText>
        </View>
        <View style={styles.detailBlock}>
          <AppText variant="label" color={colors.textSecondary}>
            HOW TO USE IT
          </AppText>
          <AppText variant="body">
            {usage.amount}. {usage.note}
          </AppText>
        </View>
        <View style={styles.detailBlock}>
          <AppText variant="label" color={colors.textSecondary}>
            WHY IT’S HERE
          </AppText>
          <AppText variant="body">{step.rationale}</AppText>
        </View>
        {step.rampSchedule ? (
          <View style={styles.detailBlock}>
            <AppText variant="label" color={colors.textSecondary}>
              RAMP GUIDANCE
            </AppText>
            <AppText variant="body">{step.rampSchedule}</AppText>
          </View>
        ) : null}
        {step.irritationRisk === "high" || relevantAdjustments.length > 0 ? (
          <Callout tone="caution" title="Safety note">
            {step.irritationRisk === "high" ? (
              <AppText variant="caption" color={colors.textPrimary}>
                This is a stronger step. Follow the ramp guidance and stop if
                discomfort develops.
              </AppText>
            ) : null}
            {relevantAdjustments.map((adjustment) => (
              <AppText
                key={adjustment.detail}
                variant="caption"
                color={colors.textPrimary}
              >
                {adjustment.detail}
              </AppText>
            ))}
          </Callout>
        ) : null}
        {currentSkipped ? (
          <Callout tone="info" title="This step is currently skipped">
            <AppText variant="caption" color={colors.textPrimary}>
              Marking it done will replace the saved skip.
            </AppText>
          </Callout>
        ) : null}
      </Card>

      {saveError ? <SaveError /> : null}
      <PrimaryButton label="Done" loading={saving} onPress={markDone} />
      <GhostButton label="Skip" onPress={() => setSkipOpen(true)} />
      {currentIndex > 0 ? (
        <TextButton
          label="Back"
          onPress={() => void updateIndex(currentIndex - 1)}
        />
      ) : null}

      <Modal
        transparent
        animationType="fade"
        visible={skipOpen}
        onRequestClose={() => setSkipOpen(false)}
      >
        <Pressable style={styles.scrim} onPress={() => setSkipOpen(false)}>
          <Pressable
            style={styles.sheet}
            onPress={(event) => event.stopPropagation()}
          >
            <AppText variant="headline">
              Why are you skipping this step?
            </AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              Choose one. You can return and mark the step done later.
            </AppText>
            {SKIP_REASONS.map((item) => (
              <Pressable
                key={item.reason}
                accessibilityRole="button"
                onPress={() => void chooseSkip(item.reason)}
                style={({ pressed }) => [
                  styles.reason,
                  pressed && styles.reasonPressed,
                ]}
              >
                <AppText variant="bodyStrong">{item.label}</AppText>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textSecondary}
                />
              </Pressable>
            ))}
            <TextButton label="Cancel" onPress={() => setSkipOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function SessionHeader({ onClose }: { onClose: () => void }) {
  const colors = useThemeColors();
  return (
    <View style={stylesStatic.header}>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close routine session"
        hitSlop={8}
        style={stylesStatic.close}
      >
        <Ionicons name="close" size={24} color={colors.textPrimary} />
      </Pressable>
      <View style={stylesStatic.headerCopy}>
        <AppText variant="bodyStrong">Routine Mode</AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          Progress saves automatically.
        </AppText>
      </View>
    </View>
  );
}

function SaveError() {
  const colors = useThemeColors();
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <Callout
        tone="caution"
        title="Pore couldn’t save this change. Try again."
      >
        <AppText variant="caption" color={colors.textPrimary}>
          Keep this screen open, then repeat the action.
        </AppText>
      </Callout>
    </View>
  );
}

const stylesStatic = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  close: {
    width: touchTarget.min,
    minHeight: touchTarget.min,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1, gap: spacing.xxs },
});

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { paddingTop: spacing.md, gap: spacing.lg },
    progressCopy: { gap: spacing.xs },
    stepCard: { gap: spacing.lg },
    stepHeading: { gap: spacing.xxs },
    detailBlock: { gap: spacing.xxs },
    productImage: {
      width: 112,
      height: 112,
      alignSelf: "center",
      borderRadius: radius.md,
      backgroundColor: colors.background,
    },
    completion: {
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.xl,
    },
    centered: { textAlign: "center" },
    scrim: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: colors.overlay,
    },
    sheet: {
      gap: spacing.sm,
      padding: spacing.lg,
      paddingBottom: spacing.xl,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      backgroundColor: colors.surface,
    },
    reason: {
      minHeight: touchTarget.min,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      backgroundColor: colors.background,
    },
    reasonPressed: { opacity: 0.75 },
  });
}
