/** Routine and Products share one destination so the plan stays easy to scan. */
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type {
  ConcernKey,
  ProductCategory,
  RoutineTime,
  ThemeColors,
} from "@pore/shared";
import { Disclaimer } from "@/components/Disclaimer";
import { ProductsSection } from "@/components/ProductsSection";
import { RoutineComplete } from "@/components/RoutineComplete";
import {
  RoutineReactionSheet,
  routineReactionLabel,
} from "@/components/RoutineReactionSheet";
import { RoutineStepCard } from "@/components/RoutineStepCard";
import { isStrongActiveStep } from "@/lib/adjustments";
import { isCurrentScanAnalysis } from "@/lib/analysis-status";
import { track } from "@/lib/analytics";
import { CONCERN_LABELS } from "@/lib/labels";
import {
  missedYesterday,
  routineReactionPending,
  routineStepInstances,
  shiftKey,
  todayKey,
  type RoutinePeriod,
} from "@/lib/log";
import {
  routineFor,
  routineShelfAssignments,
  routineSourceNote,
} from "@/lib/plan";
import type { UserProductCategory } from "@/lib/profile";
import {
  formatNextScheduledDay,
  nextScheduledDate,
  resolvedSchedule,
  routineFingerprint,
  scheduledStepInstances,
} from "@/lib/routine-schedule";
import { routineSessionExpired } from "@/lib/routine-session";
import { routineSupportForConcern } from "@/lib/results";
import { useAcceptRevision } from "@/lib/use-accept-revision";
import { useOnboarding } from "@/state/onboarding";
import { useRoutineLog } from "@/state/routine-log";
import {
  AppText,
  Callout,
  Card,
  Divider,
  Enter,
  PrimaryButton,
  Screen,
  Segmented,
  TextButton,
  iconSize,
  radius,
  spacing,
  touchTarget,
  useCelebration,
  useThemeColors,
} from "@/theme";

type RoutineSection = "routine" | "products";

export default function RoutineTab() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{
    period?: string;
    focus?: string;
    priority?: string;
    section?: string;
  }>();
  const priority = isConcernKey(params.priority) ? params.priority : undefined;
  const { data } = useOnboarding();
  const { toggle, dayLog, streak, log, markStepNotOwned, ensureSchedule } =
    useRoutineLog();
  const acceptRevision = useAcceptRevision();

  const defaultPeriod: RoutinePeriod = new Date().getHours() < 12 ? "am" : "pm";
  const [period, setPeriod] = useState<RoutinePeriod>(
    params.period === "am" || params.period === "pm"
      ? params.period
      : defaultPeriod,
  );
  const [section, setSection] = useState<RoutineSection>(
    params.section === "products" ? "products" : "routine",
  );
  const [reactionOpen, setReactionOpen] = useState(false);

  useEffect(() => {
    if (params.period === "am" || params.period === "pm") {
      setPeriod(params.period);
    }
  }, [params.period]);

  useEffect(() => {
    setSection(params.section === "products" ? "products" : "routine");
  }, [params.section]);

  useEffect(() => {
    track("routine_viewed", { period, section });
  }, [period, section]);

  const today = todayKey();
  const { routine, adjustments, revision } = useMemo(
    () => routineFor(data, log.revision, today),
    [data, log.revision, today],
  );
  const shelfAssignments = useMemo(
    () => routineShelfAssignments(data, routine),
    [data, routine],
  );
  const prioritySupport = useMemo(
    () => (priority ? routineSupportForConcern(priority, routine) : []),
    [priority, routine],
  );
  const steps = routine[period];
  const instances = routineStepInstances(steps);
  const fingerprint = routineFingerprint(routine, data.profileRevision ?? 0);
  const schedule = resolvedSchedule(log.schedule, fingerprint, today);
  const scheduled = scheduledStepInstances(routine, period, schedule, today);
  const scheduledKeys = scheduled.map((item) => item.key);
  const dueKeys = new Set(scheduledKeys);
  const resumable =
    log.activeSession &&
    log.activeSession.routineFingerprint === fingerprint &&
    !routineSessionExpired(log.activeSession)
      ? log.activeSession
      : undefined;
  useEffect(() => {
    void ensureSchedule(fingerprint, today);
  }, [ensureSchedule, fingerprint, today]);
  const time: RoutineTime = period === "am" ? "AM" : "PM";
  const currentPeriodLog = dayLog(today)?.[period];
  const done = currentPeriodLog?.done ?? [];
  const essentialsFocus = params.focus === "essentials";
  const priorityLabel = priority ? CONCERN_LABELS[priority] : undefined;
  const supportedStepKeys = new Set(
    prioritySupport
      .filter((support) => support.period === period)
      .map((support) => support.key),
  );
  const currentSupportCount = supportedStepKeys.size;
  const otherPeriod: RoutinePeriod = period === "am" ? "pm" : "am";
  const otherSupportCount = prioritySupport.filter(
    (support) => support.period === otherPeriod,
  ).length;

  const complete =
    scheduledKeys.length > 0 &&
    scheduledKeys.every((key) => done.includes(key));
  const celebrate = useCelebration(period, complete);

  const lapsed = missedYesterday(log, today) && streak === 0;
  const stepActives = new Set(steps.map((step) => step.active).filter(Boolean));
  const general = adjustments.filter(
    (adjustment) =>
      !adjustment.active ||
      !stepActives.has(adjustment.active) ||
      (adjustment.time && adjustment.time !== time),
  );
  const goodToKnow = [
    ...routine.notes,
    ...general.map((adjustment) => adjustment.detail),
  ].filter((item, index, all) => all.indexOf(item) === index);
  const minimumModeOn = revision?.kind === "simplify_today";
  const recoveryModeOn = revision?.kind === "pause_strong_actives";
  const revisionModeOn = revision !== undefined;
  const assessmentWarning = data.plan?.assessment.escalation;

  return (
    <Screen contentStyle={styles.screen}>
      <Enter index={0} style={styles.heading}>
        <AppText variant="titleSans">Routine</AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          Follow today’s plan or review the products that support it.
        </AppText>
      </Enter>

      <Segmented
        options={[
          { value: "routine", label: "Routine" },
          { value: "products", label: "Products" },
        ]}
        value={section}
        onChange={setSection}
      />

      {section === "products" ? (
        <ProductsSection showDisclaimer={false} />
      ) : (
        <>
          <View style={styles.sourceRow}>
            <AppText
              variant="caption"
              color={colors.textSecondary}
              style={styles.sourceCopy}
            >
              {routineSourceNote(data)}
            </AppText>
            <Pressable
              onPress={() => router.push("/edit-profile")}
              accessibilityRole="button"
              accessibilityLabel="Edit routine answers"
              style={styles.smallAction}
            >
              <AppText variant="label" color={colors.actionPrimary}>
                Edit answers
              </AppText>
            </Pressable>
          </View>

          {revision || essentialsFocus ? (
            <Callout
              tone="info"
              title={
                revision?.kind === "pause_strong_actives"
                  ? "Recovery mode is on"
                  : "Minimum Mode is on"
              }
            >
              <AppText variant="caption" color={colors.textPrimary}>
                {revision?.reason ??
                  "Only the essential steps are highlighted today."}
              </AppText>
              <AppText variant="caption" color={colors.textSecondary}>
                Your saved routine is unchanged.
              </AppText>
              {goodToKnow.map((note) => (
                <AppText
                  key={note}
                  variant="caption"
                  color={colors.textPrimary}
                >
                  • {note}
                </AppText>
              ))}
            </Callout>
          ) : null}

          {lapsed ? (
            <AppText variant="caption" color={colors.actionPrimary}>
              One missed day does not reset your progress.
            </AppText>
          ) : null}

          <View style={styles.minimumMode}>
            <View style={styles.minimumIcon}>
              <Ionicons
                name="leaf-outline"
                size={iconSize.md}
                color={colors.actionPrimary}
              />
            </View>
            <View style={styles.minimumCopy}>
              <AppText variant="bodyStrong">Minimum Mode</AppText>
              <AppText variant="caption" color={colors.textSecondary}>
                {recoveryModeOn
                  ? "Recovery mode is already keeping strong actives out while your skin settles."
                  : revisionModeOn
                    ? "A lighter version of your plan is already active today."
                    : "Keep only the essentials for today without changing your saved plan."}
              </AppText>
            </View>
            {revisionModeOn ? (
              <AppText variant="label" color={colors.actionPrimary}>
                {recoveryModeOn
                  ? "RECOVERY ON"
                  : minimumModeOn
                    ? "ON TODAY"
                    : "LIGHTER DAY"}
              </AppText>
            ) : (
              <TextButton
                label="Use today"
                onPress={() =>
                  acceptRevision({
                    kind: "simplify_today",
                    period,
                    effectiveDate: today,
                    reason:
                      "Minimum Mode keeps today’s routine to the essentials.",
                  })
                }
              />
            )}
          </View>

          <Segmented
            options={[
              { value: "am", label: "Morning" },
              { value: "pm", label: "Evening" },
            ]}
            value={period}
            onChange={setPeriod}
          />

          {scheduledKeys.length > 0 && !complete ? (
            <PrimaryButton
              label={
                resumable
                  ? "Resume routine"
                  : `Start ${period === "am" ? "morning" : "evening"} routine`
              }
              onPress={() =>
                router.push({
                  pathname: "/routine-session",
                  params: { period, source: "routine" },
                })
              }
            />
          ) : null}

          {priorityLabel ? (
            <View style={styles.priorityNote}>
              <Ionicons
                name="information-circle-outline"
                size={iconSize.sm}
                color={colors.info}
              />
              <AppText
                variant="caption"
                color={colors.textSecondary}
                style={styles.priorityCopy}
              >
                {currentSupportCount > 0
                  ? `${currentSupportCount} ${
                      currentSupportCount === 1 ? "step is" : "steps are"
                    } marked for ${priorityLabel.toLowerCase()} support.`
                  : otherSupportCount > 0
                    ? `Supporting ${
                        otherSupportCount === 1 ? "step is" : "steps are"
                      } in the ${
                        otherPeriod === "am" ? "morning" : "evening"
                      } routine.`
                    : `No current step maps safely to ${priorityLabel.toLowerCase()}, so nothing was added just to fill the plan.`}
              </AppText>
            </View>
          ) : null}

          <Card elevated style={styles.stepsCard}>
            {instances.map(({ step, key, index }, visibleIndex) => {
              const scheduledToday = dueKeys.has(key);
              const supportsPriority = supportedStepKeys.has(
                `${period}:${key}`,
              );
              const willCompletePeriod =
                scheduledToday &&
                !done.includes(key) &&
                scheduledKeys.every(
                  (candidate) => candidate === key || done.includes(candidate),
                );
              return (
                <View key={key}>
                  {visibleIndex > 0 ? <Divider /> : null}
                  <RoutineStepCard
                    step={step}
                    product={shelfAssignments[period][index]}
                    focusState={
                      essentialsFocus
                        ? isStrongActiveStep(step)
                          ? "resting"
                          : "essential"
                        : undefined
                    }
                    supportLabel={supportsPriority ? priorityLabel : undefined}
                    checked={done.includes(key)}
                    scheduledToday={scheduledToday}
                    scheduleLabel={
                      scheduledToday
                        ? "Scheduled today"
                        : formatNextScheduledDay(
                            nextScheduledDate(
                              step,
                              schedule,
                              shiftKey(today, 1),
                            ),
                            today,
                          )
                    }
                    willCompletePeriod={willCompletePeriod}
                    onToggle={() => {
                      track("routine_step_toggled", {
                        period,
                        step_index: index + 1,
                        checked: !done.includes(key),
                        surface: "routine",
                      });
                      if (willCompletePeriod) {
                        track("routine_period_completed", {
                          period,
                          step_count: scheduledKeys.length,
                          surface: "routine",
                        });
                      }
                      void (async () => {
                        const persisted = await toggle(
                          period,
                          key,
                          scheduledKeys.length,
                          today,
                          scheduledKeys,
                        );
                        if (
                          persisted &&
                          willCompletePeriod &&
                          routineReactionPending(currentPeriodLog)
                        ) {
                          setReactionOpen(true);
                        }
                      })();
                    }}
                    adjustments={adjustments.filter(
                      (adjustment) =>
                        adjustment.active &&
                        adjustment.active === step.active &&
                        (!adjustment.time || adjustment.time === time),
                    )}
                    notOwned={
                      !shelfAssignments[period][index] &&
                      log.stepOwnership?.[key] === "not_owned"
                    }
                    onNotOwned={
                      shelfAssignments[period][index]
                        ? undefined
                        : () => markStepNotOwned(key)
                    }
                    onAlreadyUse={
                      shelfAssignments[period][index]
                        ? undefined
                        : () => {
                            const category = shelfCategoryFor(step.category);
                            router.push(
                              `/add-product?category=${category}&stepKey=${encodeURIComponent(
                                key,
                              )}`,
                            );
                          }
                    }
                  />
                </View>
              );
            })}
          </Card>

          {complete ? (
            <View style={styles.completionBlock}>
              <RoutineComplete
                celebrate={celebrate}
                streak={streak}
                body={
                  period === "am"
                    ? "Your evening routine will be ready later."
                    : undefined
                }
              />
              {currentPeriodLog?.reaction ? (
                <View style={styles.reactionResponse}>
                  <AppText variant="caption" color={colors.textSecondary}>
                    You reported:{" "}
                    {routineReactionLabel(currentPeriodLog.reaction.kind)}.
                  </AppText>
                  <TextButton
                    label="Change response"
                    onPress={() => setReactionOpen(true)}
                  />
                </View>
              ) : currentPeriodLog?.reactionDismissedAt ? (
                <TextButton
                  label="Add how your skin felt"
                  onPress={() => setReactionOpen(true)}
                />
              ) : null}
            </View>
          ) : null}

          <View style={styles.supportActions}>
            <TextButton
              label="Report irritation"
              tone={colors.warning}
              onPress={() => router.push("/check-in")}
            />
          </View>

          {goodToKnow.length > 0 && !revision && !essentialsFocus ? (
            <Callout tone="info" title="Good to know">
              {goodToKnow.map((note) => (
                <AppText
                  key={note}
                  variant="caption"
                  color={colors.textPrimary}
                >
                  • {note}
                </AppText>
              ))}
            </Callout>
          ) : null}

          {assessmentWarning?.recommendProfessional ? (
            <Callout tone="escalate" title="Worth checking with a professional">
              <AppText variant="caption" color={colors.textPrimary}>
                {isCurrentScanAnalysis(data)
                  ? "Your current scan included a concern that Pore cannot diagnose."
                  : data.scannedAt
                    ? `Your last completed scan from ${new Date(
                        data.scannedAt,
                      ).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })} included a concern that Pore cannot diagnose.`
                    : "Some of what you reported may need care beyond Pore."}
              </AppText>
            </Callout>
          ) : null}

          <Disclaimer />
        </>
      )}
      <RoutineReactionSheet
        visible={reactionOpen}
        date={today}
        period={period}
        source="quick"
        onClose={() => setReactionOpen(false)}
      />
    </Screen>
  );
}

const ROUTINE_TO_SHELF_CATEGORY: Record<ProductCategory, UserProductCategory> =
  {
    cleanser: "cleanser",
    moisturizer: "moisturizer",
    sunscreen: "sunscreen",
    serum: "serum",
    treatment: "serum",
    exfoliant: "toner",
    spot_treatment: "serum",
  };

function shelfCategoryFor(category: ProductCategory): UserProductCategory {
  return ROUTINE_TO_SHELF_CATEGORY[category];
}

const CONCERN_KEYS = [
  "acne_like_breakouts",
  "oiliness",
  "dryness_flaking",
  "texture_congestion",
  "uneven_tone",
  "dark_spot_appearance",
  "redness_appearance",
  "fine_line_appearance",
  "irritation_signs",
] as const satisfies readonly ConcernKey[];

const CONCERN_KEY_SET: ReadonlySet<string> = new Set(CONCERN_KEYS);

function isConcernKey(value: unknown): value is ConcernKey {
  return typeof value === "string" && CONCERN_KEY_SET.has(value);
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { paddingTop: spacing.lg, gap: spacing.lg },
    heading: { gap: spacing.xxs },
    sourceRow: {
      minHeight: touchTarget.min,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    sourceCopy: { flex: 1 },
    smallAction: {
      minHeight: touchTarget.min,
      justifyContent: "center",
      paddingHorizontal: spacing.xs,
    },
    minimumMode: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    minimumIcon: {
      width: touchTarget.min,
      height: touchTarget.min,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.pill,
      backgroundColor: colors.disabledSurface,
    },
    minimumCopy: { flex: 1, gap: spacing.xxs },
    stepsCard: { gap: 0, paddingVertical: spacing.xs },
    completionBlock: { alignItems: "center", gap: spacing.xxs },
    reactionResponse: { alignItems: "center", gap: spacing.xxs },
    supportActions: {
      flexDirection: "row",
      justifyContent: "flex-start",
    },
    priorityNote: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.xs,
    },
    priorityCopy: { flex: 1 },
  });
}
