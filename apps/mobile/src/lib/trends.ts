/**
 * Trend engine: turns check-ins + the routine log into plain-English weekly
 * statements. Pure, no React. Copy rules (product spec): trend direction
 * language only, never numeric severity from photos; every statement answers
 * noticed / why it matters / what to do next. Routine counts ("5 of 7 days")
 * are allowed because they come from logs, not photos.
 */
import type { Assessment, ConcernKey } from "@pore/shared";

import {
  hasRedFlags,
  latestCheckIn,
  previousCheckIn,
  RED_FLAG_SIGNS,
  type CheckIn,
  type CheckInLog,
  type IrritationSign,
} from "./check-in";
import {
  completedDayCount,
  consistency,
  shiftKey,
  type DateKey,
  type RoutineLog,
} from "./log";

export type TrendDirection = "better" | "stable" | "worse";

export type TrendKey =
  | "breakouts"
  | "skinFeel"
  | "irritation"
  | "consistency"
  | `sign:${IrritationSign}`
  | `scan:${ConcernKey}`;

export interface TrendStatement {
  key: TrendKey;
  direction: TrendDirection;
  /** e.g. "New breakouts: down from last week". */
  headline: string;
  /** What Pore noticed. */
  noticed: string;
  /** Why it matters. */
  why: string;
  /** What to do next. */
  next: string;
}

export interface WeeklyReport {
  /** "You completed your routine 5 of 7 days." */
  completedLine: string;
  /** Ordered: breakouts, skin feel, irritation, changed signs (max 2), consistency. */
  statements: TrendStatement[];
  recommendation: string;
  /** True when only one check-in exists — no comparison copy yet. */
  baseline: boolean;
}

/** Short noun labels for report copy (screens phrase their own questions). */
export const SIGN_LABELS: Record<IrritationSign, string> = {
  redness: "Redness",
  itching: "Itching",
  stinging: "Stinging",
  dryness_flaking: "Dryness & flaking",
  burning: "Burning",
  pain: "Pain to the touch",
  spreading_rash: "A spreading rash",
};

const BREAKOUT_ORDINAL = {
  none: 0,
  few: 1,
  several: 2,
  widespread: 3,
} as const;

function direction(delta: number): TrendDirection {
  if (delta < 0) return "better";
  if (delta > 0) return "worse";
  return "stable";
}

function breakoutsStatement(
  latest: CheckIn,
  previous: CheckIn,
): TrendStatement {
  const dir = direction(
    BREAKOUT_ORDINAL[latest.breakouts] - BREAKOUT_ORDINAL[previous.breakouts],
  );
  const headline =
    dir === "better"
      ? "New breakouts: down from last week"
      : dir === "worse"
        ? "New breakouts: up from last week"
        : "New breakouts: about the same";
  return {
    key: "breakouts",
    direction: dir,
    headline,
    noticed:
      dir === "stable"
        ? "You reported a similar number of new breakouts as last check-in."
        : `You reported ${dir === "better" ? "fewer" : "more"} new breakouts than last check-in.`,
    why:
      dir === "worse"
        ? "A jump in breakouts right after a routine change often points at the change, not your skin."
        : "Breakout trends over weeks say more than any single day.",
    next:
      dir === "worse"
        ? "Don't add anything new this week. Give your current routine time to settle."
        : "Keep your routine steady so the trend keeps going.",
  };
}

function skinFeelStatement(latest: CheckIn, previous: CheckIn): TrendStatement {
  // Higher skinFeel = calmer, so improvement is a positive delta.
  const dir = direction(previous.skinFeel - latest.skinFeel);
  const headline =
    dir === "better"
      ? "Skin comfort: feeling calmer"
      : dir === "worse"
        ? "Skin comfort: feeling more irritated"
        : "Skin comfort: steady";
  return {
    key: "skinFeel",
    direction: dir,
    headline,
    noticed:
      dir === "stable"
        ? "Your skin feels about the same as it did last check-in."
        : `Your skin feels ${dir === "better" ? "calmer" : "less comfortable"} than it did last check-in.`,
    why: "How your skin feels day to day is the earliest signal of whether a routine suits it.",
    next:
      dir === "worse"
        ? "Ease off your strongest active for a few nights and focus on moisturizer."
        : "No changes needed. Comfort like this is what consistency looks like.",
  };
}

function irritationStatement(
  latest: CheckIn,
  previous: CheckIn,
): TrendStatement | null {
  const dir = direction(
    latest.irritationSigns.length - previous.irritationSigns.length,
  );
  if (dir === "stable") return null; // per-sign statements cover swaps
  return {
    key: "irritation",
    direction: dir,
    headline:
      dir === "better"
        ? "Irritation signs: settling down"
        : "Irritation signs: slightly increased",
    noticed: `You reported ${dir === "better" ? "fewer" : "more"} irritation signs than last check-in.`,
    why: "Irritation that builds week over week usually means something in the routine is too strong or too frequent.",
    next:
      dir === "better"
        ? "Keep frequencies where they are. Your skin is telling you the pace works."
        : "Use your actives less often this week and let your skin recover before changing anything else.",
  };
}

function signStatements(latest: CheckIn, previous: CheckIn): TrendStatement[] {
  const appeared = latest.irritationSigns.filter(
    (s) => !previous.irritationSigns.includes(s),
  );
  const cleared = previous.irritationSigns.filter(
    (s) => !latest.irritationSigns.includes(s),
  );
  const statements: TrendStatement[] = [
    ...appeared.map(
      (sign): TrendStatement => ({
        key: `sign:${sign}`,
        direction: "worse",
        headline: `${SIGN_LABELS[sign]}: new this week`,
        noticed: `${SIGN_LABELS[sign]} showed up since your last check-in.`,
        why: "A new sign right after a routine change is worth watching before it builds.",
        next: "Skip your strongest active for a couple of nights and see if it fades.",
      }),
    ),
    ...cleared.map(
      (sign): TrendStatement => ({
        key: `sign:${sign}`,
        direction: "better",
        headline: `${SIGN_LABELS[sign]}: settling down`,
        noticed: `You didn't report ${SIGN_LABELS[sign].toLowerCase()} this time.`,
        why: "Signs clearing on their own is good evidence your current pace suits your skin.",
        next: "Keep doing exactly what you're doing.",
      }),
    ),
  ];
  return statements.slice(0, 2);
}

/** Comparison statements between the two most recent check-ins. */
export function compareCheckIns(
  latest: CheckIn,
  previous: CheckIn | undefined,
): TrendStatement[] {
  if (!previous) return [];
  const statements = [
    breakoutsStatement(latest, previous),
    skinFeelStatement(latest, previous),
  ];
  const irritation = irritationStatement(latest, previous);
  if (irritation) statements.push(irritation);
  statements.push(...signStatements(latest, previous));
  return statements;
}

/** Week-over-week routine consistency from the log (independent of check-ins). */
export function consistencyTrend(
  log: RoutineLog,
  today: DateKey,
): TrendStatement {
  const current = consistency(log, today, 7);
  const prior = consistency(log, shiftKey(today, -7), 7);
  const delta = current - prior;
  const dir: TrendDirection =
    delta > 0.1 ? "better" : delta < -0.1 ? "worse" : "stable";
  return {
    key: "consistency",
    direction: dir,
    headline:
      dir === "better"
        ? "Routine consistency: up from last week"
        : dir === "worse"
          ? "Routine consistency: slipped a little"
          : "Routine consistency: holding steady",
    noticed: `You completed ${Math.round(current * 100)}% of your routine steps this week, vs ${Math.round(prior * 100)}% the week before.`,
    why: "Consistency moves skin more than any single product. Results come from repetition.",
    next:
      dir === "worse"
        ? "Pick the one step you always skip and anchor it to something you already do daily."
        : "Keep the rhythm. This is the part most people get wrong.",
  };
}

/** Full weekly report, or null when there are no check-ins yet. */
export function weeklyReport(
  checkIns: CheckInLog,
  routineLog: RoutineLog,
  today: DateKey,
): WeeklyReport | null {
  const latest = latestCheckIn(checkIns);
  if (!latest) return null;

  const previous = previousCheckIn(checkIns);
  const statements = [
    ...compareCheckIns(latest, previous),
    consistencyTrend(routineLog, today),
  ];
  const anyWorse = statements.some((s) => s.direction === "worse");
  const irritationWorse = statements.some(
    (s) =>
      (s.key === "irritation" || s.key.startsWith("sign:")) &&
      s.direction === "worse",
  );

  const recommendation = hasRedFlags(latest)
    ? "Some of what you reported may be worth a professional look. See the note above."
    : irritationWorse
      ? "Scale your actives back to their lowest frequency this week and let your skin settle."
      : anyWorse
        ? "Keep your routine stable. Changing products now would muddy the signal."
        : "Keep going exactly as you are. Steady weeks like this are what move skin.";

  return {
    completedLine: `You completed your routine ${completedDayCount(routineLog, today, 7)} of 7 days.`,
    statements,
    recommendation,
    baseline: !previous,
  };
}

/**
 * The single statement compact surfaces lead with: anything worsening
 * outranks improvements, which outrank stable.
 */
export function reportHighlight(
  report: WeeklyReport,
): TrendStatement | undefined {
  return (
    report.statements.find((s) => s.direction === "worse") ??
    report.statements.find((s) => s.direction === "better") ??
    report.statements[0]
  );
}

export interface RedFlagResult {
  escalate: boolean;
  /** Plain-English reasons, check-in signs first, then assessment reasons. */
  reasons: string[];
}

/** Merge check-in red flags with the vision assessment's escalation result. */
export function redFlags(
  latest: CheckIn | undefined,
  assessment?: Assessment,
): RedFlagResult {
  const reasons: string[] = [];
  if (latest) {
    for (const sign of latest.irritationSigns) {
      if (RED_FLAG_SIGNS.includes(sign))
        reasons.push(SIGN_LABELS[sign].toLowerCase());
    }
  }
  if (assessment?.escalation.recommendProfessional) {
    reasons.push(...assessment.escalation.reasons);
  }
  return { escalate: reasons.length > 0, reasons };
}
