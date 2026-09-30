/** Behavior-driven routine suggestions. Pure so the priority ladder is exhaustively testable. */
import { ACTIVES, type Routine, type RoutineStep } from "@pore/shared";

import { daysBetween, hasRedFlags, type CheckIn } from "./check-in";
import { stepLabel } from "./labels";
import {
  completedDayCount,
  consistency,
  periodComplete,
  routineStepInstances,
  shiftKey,
  type DateKey,
  type LatestRoutineReaction,
  type RoutineLog,
  type RoutinePeriod,
  type RoutineRevisionKind,
} from "./log";

export type AdjustmentKind = RoutineRevisionKind | "product_maintenance";

export interface RoutineAdjustment {
  kind: AdjustmentKind;
  headline: string;
  body: string;
  cta?: string;
  href?: string;
  /** The period changed when this suggestion is accepted. */
  period?: RoutinePeriod;
}

export interface RoutineAdjustmentContext {
  today: DateKey;
  log: RoutineLog;
  latestCheckIn?: CheckIn;
  routine: Routine;
  escalated: boolean;
  dismissedKinds: AdjustmentKind[];
  /** Supplied by Home for a deterministic "current routine" destination. */
  period?: RoutinePeriod;
  /** Latest post-routine self-report; separate from check-ins and scans. */
  latestRoutineReaction?: LatestRoutineReaction;
}

const RECENT_IRRITATION = new Set(["stinging", "redness", "itching"]);

export function isStrongActiveStep(step: RoutineStep): boolean {
  return !!step.active && !!ACTIVES[step.active]?.isStrongActive;
}

export function missedPeriodCount(log: RoutineLog, today: DateKey): number {
  let missed = 0;
  for (const offset of [-1, -2]) {
    const day = log.days[shiftKey(today, offset)];
    if (!periodComplete(day?.am)) missed += 1;
    if (!periodComplete(day?.pm)) missed += 1;
  }
  return missed;
}

/** Count a step's last three *scheduled* occurrences, not three calendar days. */
export function repeatedSkipStep(
  log: RoutineLog,
  today: DateKey,
  period: RoutinePeriod,
  routine: Routine,
  reason: "not_now" | "ran_out",
): RoutineStep | undefined {
  for (const { key } of routineStepInstances(routine[period])) {
    let scheduled = 0;
    let skipped = 0;
    for (let offset = 1; offset <= 21 && scheduled < 3; offset += 1) {
      const entry = log.days[shiftKey(today, -offset)]?.[period];
      if (!entry?.scheduledStepKeys?.includes(key)) continue;
      scheduled += 1;
      if (entry.skipped?.[key]?.reason === reason) skipped += 1;
    }
    if (scheduled === 3 && skipped >= 2) {
      return routineStepInstances(routine[period]).find((item) => item.key === key)?.step;
    }
  }
  return undefined;
}

export function repeatedNotNowStep(
  log: RoutineLog,
  today: DateKey,
  period: RoutinePeriod,
  routine: Routine,
): RoutineStep | undefined {
  return repeatedSkipStep(log, today, period, routine, "not_now");
}

/** Three recent logged periods with less than half their steps done. */
export function lowCompletionHistory(log: RoutineLog, today: DateKey): boolean {
  const recent = [];
  for (let offset = 1; offset <= 7 && recent.length < 3; offset += 1) {
    const day = log.days[shiftKey(today, -offset)];
    for (const period of ["am", "pm"] as const) {
      const entry = day?.[period];
      if (entry && entry.total > 0) recent.push(entry.done.length / entry.total);
      if (recent.length === 3) break;
    }
  }
  return recent.length === 3 && recent.every((fraction) => fraction < 0.5);
}

function hasLoggedDay(log: RoutineLog, today: DateKey, days = 7): boolean {
  for (let offset = 0; offset < days; offset += 1) {
    const day = log.days[shiftKey(today, -offset)];
    if (day?.am || day?.pm) return true;
  }
  return false;
}

export function routineAdjustment(
  ctx: RoutineAdjustmentContext,
): RoutineAdjustment | null {
  if (
    ctx.escalated ||
    ctx.latestRoutineReaction?.reaction.kind === "serious_reaction"
  ) {
    return null;
  }
  const dismissed = new Set(ctx.dismissedKinds);
  const hasStrongActive = [...ctx.routine.am, ...ctx.routine.pm].some(
    isStrongActiveStep,
  );
  const recent = ctx.latestCheckIn
    ? daysBetween(ctx.latestCheckIn.date, ctx.today)
    : Number.POSITIVE_INFINITY;
  const recentlyIrritated =
    !!ctx.latestCheckIn &&
    recent >= 0 &&
    recent <= 3 &&
    !hasRedFlags(ctx.latestCheckIn) &&
    ctx.latestCheckIn.irritationSigns.some((sign) =>
      RECENT_IRRITATION.has(sign),
    );
  const reactionAge = ctx.latestRoutineReaction
    ? daysBetween(ctx.latestRoutineReaction.date, ctx.today)
    : Number.POSITIVE_INFINITY;
  const recentMildReaction =
    ctx.latestRoutineReaction?.reaction.kind === "mild_irritation" &&
    reactionAge >= 0 &&
    reactionAge <= 3;
  const recentDryReaction =
    ctx.latestRoutineReaction?.reaction.kind === "tight_dry" &&
    reactionAge >= 0 &&
    reactionAge <= 2;

  if (
    !dismissed.has("pause_strong_actives") &&
    recentMildReaction &&
    ctx.latestRoutineReaction?.containedStrongActive
  ) {
    return {
      kind: "pause_strong_actives",
      headline: "Give your skin a quieter few nights",
      body: "You reported mild discomfort after a routine with a strong active. Recovery Mode can pause strong actives for a few nights.",
      cta: "Review Recovery Mode",
      href: "/(tabs)/routine?period=pm",
      period: "pm",
    };
  }

  if (
    !dismissed.has("simplify_today") &&
    (recentDryReaction || recentMildReaction)
  ) {
    const period = ctx.period ?? "pm";
    return {
      kind: "simplify_today",
      headline: "Make your next routine gentler",
      body: recentDryReaction
        ? "You reported that your skin felt a little tight or dry. Minimum Mode can keep the next routine to the essentials."
        : "You reported mild discomfort after your routine. Minimum Mode can keep the next routine simple.",
      cta: "Review Minimum Mode",
      href: `/(tabs)/routine?period=${period}&focus=essentials`,
      period,
    };
  }

  if (
    !dismissed.has("pause_strong_actives") &&
    recentlyIrritated &&
    hasStrongActive
  ) {
    return {
      kind: "pause_strong_actives",
      headline: "Give your skin a quieter few nights",
      body: "Skip the strong actives for a few nights and let moisturizer do the work.",
      cta: "See tonight's routine",
      href: "/(tabs)/routine?period=pm",
      period: "pm",
    };
  }

  const period = ctx.period ?? "pm";
  const periods: RoutinePeriod[] = [period, period === "am" ? "pm" : "am"];
  const ranOut = periods
    .map((candidate) => ({
      period: candidate,
      step: repeatedSkipStep(ctx.log, ctx.today, candidate, ctx.routine, "ran_out"),
    }))
    .find((candidate) => candidate.step);
  if (!dismissed.has("product_maintenance") && ranOut?.step) {
    return {
      kind: "product_maintenance",
      headline: `Check your ${stepLabel(ranOut.step).toLowerCase()} supply`,
      body: `You reported running out of your ${stepLabel(ranOut.step).toLowerCase()} twice in its last three scheduled appearances. Review your products when you are ready.`,
      cta: "Review products",
      href: "/(tabs)/shelf",
    };
  }

  const notNow = periods
    .map((candidate) => ({
      period: candidate,
      step: repeatedNotNowStep(ctx.log, ctx.today, candidate, ctx.routine),
    }))
    .find((candidate) => candidate.step);
  if (
    !dismissed.has("simplify_today") &&
    notNow?.step
  ) {
    return {
      kind: "simplify_today",
      headline: "Keep your routine easier to finish",
      body: `You passed on ${stepLabel(notNow.step).toLowerCase()} twice in its last three scheduled appearances. Minimum Mode can focus on the essentials today.`,
      cta: "Review Minimum Mode",
      href: `/(tabs)/routine?period=${notNow.period}&focus=essentials`,
      period: notNow.period,
    };
  }

  if (
    !dismissed.has("simplify_today") &&
    lowCompletionHistory(ctx.log, ctx.today)
  ) {
    const period = ctx.period ?? "pm";
    return {
      kind: "simplify_today",
      headline: "Make today's routine lighter",
      body: "A shorter routine may be easier to keep. Minimum Mode focuses on the essentials without changing your plan until you choose it.",
      cta: "Review Minimum Mode",
      href: `/(tabs)/routine?period=${period}&focus=essentials`,
      period,
    };
  }

  if (
    !dismissed.has("simplify_today") &&
    missedPeriodCount(ctx.log, ctx.today) >= 2 &&
    completedDayCount(ctx.log, ctx.today, 7) >= 1
  ) {
    const period = ctx.period ?? "pm";
    return {
      kind: "simplify_today",
      headline: "Make today's routine lighter",
      body: "The basics still count. Focus on the essential steps and leave the extras for another day.",
      cta: "Simplify today",
      href: `/(tabs)/routine?period=${period}&focus=essentials`,
      period,
    };
  }

  if (
    !dismissed.has("small_win") &&
    consistency(ctx.log, ctx.today, 7) < 1 / 3 &&
    hasLoggedDay(ctx.log, ctx.today, 7)
  ) {
    return {
      kind: "small_win",
      headline: "One small step is enough",
      body: "Keep the win tiny tonight. Even just cleansing counts.",
      cta: "Take one step",
      href: "/(tabs)/routine?period=pm",
      period: "pm",
    };
  }

  return null;
}
