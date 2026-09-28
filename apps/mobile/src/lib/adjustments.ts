/** Behavior-driven routine suggestions. Pure so the priority ladder is exhaustively testable. */
import { ACTIVES, type Routine, type RoutineStep } from "@pore/shared";

import { daysBetween, hasRedFlags, type CheckIn } from "./check-in";
import {
  completedDayCount,
  consistency,
  periodComplete,
  shiftKey,
  type DateKey,
  type LatestRoutineReaction,
  type RoutineLog,
  type RoutinePeriod,
  type RoutineRevisionKind,
} from "./log";

export type AdjustmentKind = RoutineRevisionKind;

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
