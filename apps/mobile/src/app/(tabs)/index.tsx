/**
 * Today answers four questions in order: what matters, what routine is due,
 * how the journey is going, and when the next check-in happens.
 */
import { router } from "expo-router";
import { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { AdjustmentCard } from "@/components/AdjustmentCard";
import { DailyActionCard } from "@/components/DailyActionCard";
import { Disclaimer } from "@/components/Disclaimer";
import { EscalationCard } from "@/components/EscalationCard";
import { TodayRoutineCard } from "@/components/TodayRoutineCard";
import {
  isStrongActiveStep,
  routineAdjustment,
  type AdjustmentKind,
} from "@/lib/adjustments";
import { isCurrentScanAnalysis } from "@/lib/analysis-status";
import { track } from "@/lib/analytics";
import { daysBetween } from "@/lib/check-in";
import { activePeriod, dailyAction } from "@/lib/daily-action";
import { scanAccess } from "@/lib/gate";
import { deriveJourney } from "@/lib/journey";
import {
  periodComplete,
  routineStepInstances,
  shiftKey,
  todayKey,
  weekDays,
  type WeekDay,
} from "@/lib/log";
import { scanEntryHref } from "@/lib/nav";
import { routineFor } from "@/lib/plan";
import {
  resolvedSchedule,
  routineFingerprint,
  scheduledStepInstances,
} from "@/lib/routine-schedule";
import { routineSessionExpired } from "@/lib/routine-session";
import { deriveSkinStatus, type SkinStatusResult } from "@/lib/skin-status";
import { redFlags } from "@/lib/trends";
import { useCheckIns } from "@/state/check-ins";
import { useEntitlement } from "@/state/entitlement";
import { useOnboarding } from "@/state/onboarding";
import { useReminders } from "@/state/reminders";
import { useRoutineLog } from "@/state/routine-log";
import { useScanHistory } from "@/state/scan-history";
import {
  AppText,
  Callout,
  Enter,
  NavRow,
  Screen,
  SectionHeader,
  WeekStrip,
  spacing,
  useThemeColors,
} from "@/theme";

function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function currentGuidance(
  status: SkinStatusResult,
  hasCheckIn: boolean,
): string {
  if (!hasCheckIn) {
    return "It is still too early to determine whether this routine is helping.";
  }
  switch (status.status) {
    case "improving":
      return "Your recent check-ins suggest your skin felt calmer. Keep the routine steady.";
    case "rebuilding":
      return "Your latest check-in suggests more discomfort. Keep today simple.";
    case "stabilizing":
      return "Your recent check-ins were similar. Staying steady is useful information.";
    case "needs_check_in":
      return "Your last check-in is a week old. A new check-in will add better context.";
    default:
      return "You have a baseline. We need another check-in before describing a change.";
  }
}

/** One glanceable line under the week strip: lead with a real streak if there is one. */
function weekSummary(streak: number, cells: WeekDay[]): string {
  const complete = cells.filter((cell) => cell.complete).length;
  if (streak >= 2) return `${streak}-day streak · ${complete} of 7 this week`;
  return `${complete} of 7 routine days this week`;
}

function dateFromKey(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export default function TodayTab() {
  const colors = useThemeColors();
  const { data } = useOnboarding();
  const { dayLog, streak, log, toggle, ensureSchedule } = useRoutineLog();
  const { checkIns, latest, due, daysUntilDue } = useCheckIns();
  const { history } = useScanHistory();
  const { entitlement } = useEntitlement();
  const { prefs: reminderPrefs } = useReminders();

  const now = new Date();
  const today = todayKey(now);
  const { routine } = useMemo(
    () => routineFor(data, log.revision, today),
    [data, log.revision, today],
  );
  const currentDay = dayLog(today);
  const defaultPeriod = activePeriod(
    now.getHours(),
    periodComplete(currentDay?.am),
  );
  const fingerprint = routineFingerprint(routine, data.profileRevision ?? 0);
  const schedule = resolvedSchedule(log.schedule, fingerprint, today);
  useEffect(() => {
    void ensureSchedule(fingerprint, today);
  }, [ensureSchedule, fingerprint, today]);
  const resumable =
    log.activeSession &&
    log.activeSession.routineFingerprint === fingerprint &&
    !routineSessionExpired(log.activeSession, now)
      ? log.activeSession
      : undefined;
  const period = resumable?.period ?? defaultPeriod;
  const routineDate = resumable?.date ?? today;
  const allInstances = routineStepInstances(routine[period]);
  const steps = resumable
    ? allInstances.filter((item) => resumable.stepKeys.includes(item.key))
    : scheduledStepInstances(routine, period, schedule, today);
  const done = dayLog(routineDate)?.[period]?.done ?? [];
  const scheduledRoutine = {
    ...routine,
    am: scheduledStepInstances(routine, "am", schedule, today).map(
      (item) => item.step,
    ),
    pm: scheduledStepInstances(routine, "pm", schedule, today).map(
      (item) => item.step,
    ),
  };

  const currentAssessment = isCurrentScanAnalysis(data)
    ? data.plan?.assessment
    : undefined;
  const flags = redFlags(latest, currentAssessment);
  const status = deriveSkinStatus(checkIns, today);
  const dismissedKinds =
    reminderPrefs.dismissed?.date === today
      ? (reminderPrefs.dismissed.kinds.filter((kind) =>
          ["pause_strong_actives", "simplify_today", "small_win"].includes(
            kind,
          ),
        ) as AdjustmentKind[])
      : [];
  const adjustment = routineAdjustment({
    today,
    log,
    latestCheckIn: latest,
    routine: scheduledRoutine,
    escalated: flags.escalate,
    dismissedKinds,
    period,
  });
  const hasStrongActives = [...routine.am, ...routine.pm].some(
    isStrongActiveStep,
  );

  const access = scanAccess(entitlement, data, history, today);
  const scanHref = access.allowed
    ? scanEntryHref(data, "rescan")
    : access.reason === "plus_required"
      ? "/paywall?feature=rescan"
      : "/(tabs)/scan";
  const analyzedDates = history.scans
    .filter((scan) => scan.analyzed)
    .map((scan) => scan.date);
  const latestAnalyzedDate =
    analyzedDates[analyzedDates.length - 1] ??
    (data.scannedAt ? todayKey(new Date(data.scannedAt)) : undefined);
  const action = dailyAction({
    now,
    checkInDue: due,
    firstCheckIn: checkIns.entries.length === 0,
    day: currentDay,
    routine,
    streak,
    lastPhotoDaysAgo: latestAnalyzedDate
      ? daysBetween(latestAnalyzedDate, today)
      : null,
    shelfEmpty: (data.userProducts ?? []).length === 0,
    scanHref,
  });
  const journey = useMemo(
    () => deriveJourney({ log, checkIns, scans: history, today }),
    [checkIns, history, log, today],
  );
  const weekCells = weekDays(log, today);
  const nextCheckInKey = shiftKey(today, daysUntilDue);
  const nextCheckIn = dateFromKey(nextCheckInKey).toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
    },
  );
  const dateLabel = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <Screen contentStyle={styles.screen}>
      <Enter index={0} style={styles.headerCopy}>
        <AppText variant="titleSans">{greeting(now.getHours())}</AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          {dateLabel}
        </AppText>
      </Enter>

      <Enter index={1}>
        {adjustment ? (
          <AdjustmentCard adjustment={adjustment} today={today} />
        ) : (
          <Callout
            tone="info"
            icon="compass-outline"
            title="Here is what matters today"
          >
            <AppText variant="body" color={colors.textPrimary}>
              {currentGuidance(status, checkIns.entries.length > 0)}
            </AppText>
          </Callout>
        )}
      </Enter>

      {flags.escalate ? (
        <EscalationCard
          reasons={flags.reasons}
          hasStrongActives={hasStrongActives}
        />
      ) : null}

      <Enter index={2}>
        <TodayRoutineCard
          title={
            action.kind === "routine"
              ? action.title
              : period === "am"
                ? "This morning’s routine"
                : "Tonight’s routine"
          }
          period={period}
          steps={steps}
          done={done}
          onToggle={(item, willCompletePeriod) => {
            const key = item.key;
            track("routine_step_toggled", {
              period,
              step_index: item.index + 1,
              checked: !done.includes(key),
              surface: "today",
            });
            if (willCompletePeriod) {
              track("routine_period_completed", {
                period,
                step_count: steps.length,
                surface: "today",
              });
            }
            void toggle(
              period,
              key,
              steps.length,
              routineDate,
              steps.map((candidate) => candidate.key),
            );
          }}
          startRoutineLabel={
            resumable
              ? "Resume routine"
              : `Start ${period === "am" ? "morning" : "evening"} routine`
          }
          onStartRoutine={() =>
            router.push({
              pathname: "/routine-session",
              params: { period, source: "home" },
            })
          }
          onViewRoutine={() => router.push(`/(tabs)/routine?period=${period}`)}
        />
      </Enter>

      {action.kind !== "routine" && action.kind !== "done" ? (
        <Enter index={3}>
          <DailyActionCard action={action} />
        </Enter>
      ) : null}

      <Enter index={4}>
        <SectionHeader title="Skin journey" />
        <NavRow
          title={
            journey.dayNumber
              ? `Journey day ${journey.dayNumber}`
              : "Your journey can start today"
          }
          detail={
            journey.dayNumber
              ? `${journey.completedRoutineDays} routine ${
                  journey.completedRoutineDays === 1 ? "day" : "days"
                } completed`
              : "Complete a routine, scan, or check-in to create your first point."
          }
          accessibilityLabel="Open Skin Journey"
          onPress={() => router.push("/(tabs)/progress")}
        />
        <View style={styles.weekProgress}>
          <WeekStrip days={weekCells} />
          <AppText variant="caption" color={colors.textSecondary}>
            {weekSummary(streak, weekCells)}
          </AppText>
        </View>
      </Enter>

      <Enter index={5}>
        <NavRow
          overline="NEXT CHECK-IN"
          title={due ? "Ready now" : nextCheckIn}
          detail={
            due
              ? "A short check-in adds how your skin feels."
              : `${daysUntilDue} ${daysUntilDue === 1 ? "day" : "days"} from now.`
          }
          onPress={due ? () => router.push("/check-in") : undefined}
        />
      </Enter>

      <Disclaimer />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: spacing.lg, gap: spacing.lg },
  headerCopy: { gap: spacing.xxs, flexShrink: 1 },
  weekProgress: { gap: spacing.sm, paddingTop: spacing.sm },
});
