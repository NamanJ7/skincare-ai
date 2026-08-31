/**
 * Deterministic progress engine — the third code-not-prompt layer.
 *
 * The safety engine decides what belongs in a routine. The cadence engine
 * decides what happens tonight. This one answers the question that decides
 * whether anyone is still here in twelve weeks: **is this actually working?**
 *
 * The central design decision is what we do NOT do. We never show a model the
 * before and after photos and ask whether the skin improved. A model handed a
 * before-and-after will always find a story, and a skincare app that
 * confabulates progress is worse than one that says nothing. Instead each
 * session gets its own blind `Assessment` from the existing pipeline, and the
 * two are subtracted here, in arithmetic. The model never knows it is being
 * compared, so it cannot flatter us.
 *
 * That only works if the two photos are actually comparable, which is why the
 * capture flow was built as an instrument: quality-gated, and tagged with the
 * illuminant it was shot under. Two photos under different light are not a
 * measurement, they are two photos. When that is the case this engine refuses
 * to report a delta and says exactly why — the refusal is the feature.
 */
import type { Assessment, ConcernKey, AppearanceLevel, PhotoQuality } from "../types/assessment";
import type { IntakeResponse } from "../types/intake";
import type { ActiveKey, Routine } from "../types/routine";
import { applySafetyRules, type SafetyAdjustment } from "../safety/engine";
import { ACTIVES, activeRelevanceScore } from "../safety/ingredients";

/** Below this, the model is guessing and the band is not evidence. */
const MIN_CONFIDENCE = 0.6;

/** Weeks of a genuinely unchanged concern before we consider stepping up. */
export const ESCALATE_AFTER_WEEKS = 8;

/**
 * Fraction of scheduled sessions actually completed, below which "it isn't
 * working" is not a routine problem. Escalating actives for someone who is
 * doing half the routine adds irritation, not results.
 */
const ADHERENCE_FLOOR = 0.7;

/** Ordinal scale. The bands are ordered, so they subtract. */
const BAND: Record<AppearanceLevel, number> = { none: 0, mild: 1, moderate: 2, noticeable: 3 };

export type ProgressDirection = "improved" | "unchanged" | "worse" | "not_comparable";

export interface ConcernProgress {
  concern: ConcernKey;
  direction: ProgressDirection;
  /** Band movement; negative means improved. Absent when not comparable. */
  bandDelta?: number;
  before?: AppearanceLevel;
  after?: AppearanceLevel;
  /** Why we decline to call it, when `not_comparable`. */
  reason?: string;
}

export interface ProgressReport {
  /** Whole days between the two capture sessions. */
  daysBetween: number;
  /** False when the two sessions cannot be fairly compared at all. */
  comparable: boolean;
  /** Plain language, shown verbatim, when `comparable` is false. */
  blockedReason?: string;
  concerns: ConcernProgress[];
  headline: string;
}

/* --------------------------------------------------------- comparability */

/**
 * A photo is measurable only if the capture gate passed it AND it was lit by
 * the screen flash. Ambient light is not repeatable, so an ambient shot can be
 * shown to the user but never subtracted from another one.
 */
function isMeasurable(photo: PhotoQuality): boolean {
  return photo.flags.length === 0 && photo.illuminant === "screen_flash";
}

/** Angles where BOTH sessions produced a measurable photo. */
function comparableAngles(before: Assessment, after: Assessment): string[] {
  const ok = (a: Assessment) => new Set(a.photoQuality.filter(isMeasurable).map((p) => p.angle));
  const first = ok(before);
  return [...ok(after)].filter((angle) => first.has(angle));
}

function daysBetweenIso(before: string, after: string): number {
  const day = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  return Math.round((day(after) - day(before)) / 86_400_000);
}

/* -------------------------------------------------------------- the diff */

function directionFor(delta: number): ProgressDirection {
  if (delta < 0) return "improved";
  if (delta > 0) return "worse";
  return "unchanged";
}

/**
 * Subtract two blind assessments.
 *
 * `before.capturedAt` / `after.capturedAt` are the session timestamps; the
 * assessments themselves carry no date.
 */
export function compareAssessments(
  before: Assessment,
  after: Assessment,
  capturedAt: { before: string; after: string },
): ProgressReport {
  const daysBetween = daysBetweenIso(capturedAt.before, capturedAt.after);
  const angles = comparableAngles(before, after);

  if (angles.length === 0) {
    return {
      daysBetween,
      comparable: false,
      blockedReason:
        "These two sets weren't shot under the same conditions, so putting a number on the difference would be guesswork. Take your next set with the screen flash on, in the same spot, and we can measure it properly.",
      concerns: [],
      headline: "Not enough to compare fairly",
    };
  }

  const byKey = new Map(after.findings.map((f) => [f.concern, f]));
  const concerns: ConcernProgress[] = [];

  for (const first of before.findings) {
    const second = byKey.get(first.concern);
    if (!second) {
      concerns.push({
        concern: first.concern,
        direction: "not_comparable",
        reason: "This wasn't assessed in the newer set.",
      });
      continue;
    }
    if (first.confidence < MIN_CONFIDENCE || second.confidence < MIN_CONFIDENCE) {
      concerns.push({
        concern: first.concern,
        direction: "not_comparable",
        before: first.appearanceLevel,
        after: second.appearanceLevel,
        reason: "We weren't confident enough about this one in both sets to call a change.",
      });
      continue;
    }
    const bandDelta = BAND[second.appearanceLevel] - BAND[first.appearanceLevel];
    concerns.push({
      concern: first.concern,
      direction: directionFor(bandDelta),
      bandDelta,
      before: first.appearanceLevel,
      after: second.appearanceLevel,
    });
  }

  return { daysBetween, comparable: true, concerns, headline: headlineFor(concerns, daysBetween) };
}

function headlineFor(concerns: ConcernProgress[], daysBetween: number): string {
  const improved = concerns.filter((c) => c.direction === "improved").length;
  const worse = concerns.filter((c) => c.direction === "worse").length;
  const weeks = Math.max(1, Math.round(daysBetween / 7));

  if (improved === 0 && worse === 0) return `Holding steady after ${weeks} weeks`;
  if (worse === 0) return `${improved} ${improved === 1 ? "thing looks" : "things look"} better`;
  if (improved === 0) return `${worse} ${worse === 1 ? "thing looks" : "things look"} worse`;
  return `${improved} better, ${worse} worse`;
}

/* -------------------------------------------------------- adaptation */

export type ProgressActionId =
  | "hold_steady"
  | "escalate_frequency"
  | "deload_on_worsening"
  | "adherence_first"
  | "insufficient_evidence";

export interface ProgressAdjustment {
  action: ProgressActionId;
  active?: ActiveKey;
  detail: string;
}

export interface AdaptationInput {
  intake: IntakeResponse;
  /** Whole weeks the user has been on this routine. */
  weeksOnRoutine: number;
  /** Fraction of scheduled sessions actually completed, 0..1. */
  adherence: number;
}

export interface AdaptationResult {
  routine: Routine;
  adjustments: ProgressAdjustment[];
  /** Whatever the safety clamp had to correct afterwards. Usually empty. */
  safetyAdjustments: SafetyAdjustment[];
}

function strongSteps(routine: Routine) {
  return [...routine.am, ...routine.pm].filter(
    (s) => s.active !== undefined && ACTIVES[s.active].isStrongActive,
  );
}

/**
 * Turn a measurement into a routine change.
 *
 * The ordering is the safety argument. Worsening is acted on before anything
 * else and can only ever reduce. Escalation sits behind two gates — real
 * adherence and real time on the routine — because "it isn't working" almost
 * always means "it isn't being done", and answering that with a stronger acid
 * is how people end up with a damaged barrier and a story about how skincare
 * ruined their skin.
 *
 * The result is always run back through `applySafetyRules`, so this function
 * proposes and the safety engine still disposes. It cannot raise a frequency
 * past a cap, reintroduce an allergen, or survive a pregnancy filter — the same
 * relationship the LLM has with the safety layer.
 */
export function adaptRoutine(
  routine: Routine,
  report: ProgressReport,
  input: AdaptationInput,
): AdaptationResult {
  const adjustments: ProgressAdjustment[] = [];
  const next: Routine = {
    am: routine.am.map((s) => ({ ...s })),
    pm: routine.pm.map((s) => ({ ...s })),
    notes: [...routine.notes],
  };

  const irritationWorse = report.concerns.some(
    (c) => c.concern === "irritation_signs" && c.direction === "worse",
  );
  const worseCount = report.concerns.filter((c) => c.direction === "worse").length;

  // 1. Worsening always wins, and always reduces. This runs even when the
  //    sessions are only partly comparable — a signal to back off is allowed to
  //    act on weaker evidence than a signal to push harder.
  if (irritationWorse || worseCount >= 2) {
    let reduced = false;
    for (const step of strongSteps(next)) {
      if (step.frequencyPerWeek > 1) {
        step.frequencyPerWeek -= 1;
        reduced = true;
        adjustments.push({
          action: "deload_on_worsening",
          active: step.active,
          detail: `Eased ${ACTIVES[step.active as ActiveKey].short} back to ${step.frequencyPerWeek}x a week — ${
            irritationWorse
              ? "your skin is showing more signs of irritation than last time"
              : "more than one thing looked worse than last time"
          }, and the fix for that is less, not more.`,
        });
      }
    }
    if (!reduced) {
      adjustments.push({
        action: "deload_on_worsening",
        detail:
          "Things look worse than last time and your actives are already at their gentlest setting. Worth checking in with a pharmacist or doctor rather than pushing further.",
      });
    }
    return finish(next, adjustments, input);
  }

  if (!report.comparable) {
    adjustments.push({
      action: "insufficient_evidence",
      detail:
        "We're leaving your routine exactly as it is. We couldn't measure a fair change between these two sets, and changing what you put on your face on the strength of a guess isn't something we'll do.",
    });
    return finish(next, adjustments, input);
  }

  const measured = report.concerns.filter((c) => c.direction !== "not_comparable");
  const improved = measured.filter((c) => c.direction === "improved");
  const stalled = measured.length > 0 && improved.length === 0;

  // 2. It's working. The correct action is to not touch it.
  if (improved.length > 0) {
    adjustments.push({
      action: "hold_steady",
      detail: `${improved.length === 1 ? "Something is" : `${improved.length} things are`} moving in the right direction, so nothing changes this month. Adding more when a routine is working is the most common way people undo their own progress.`,
    });
    return finish(next, adjustments, input);
  }

  // 3. Genuinely stalled — but check the honest explanation first.
  if (stalled && input.weeksOnRoutine >= ESCALATE_AFTER_WEEKS) {
    if (input.adherence < ADHERENCE_FLOOR) {
      adjustments.push({
        action: "adherence_first",
        detail: `You've completed about ${Math.round(input.adherence * 100)}% of your sessions. Before we make anything stronger, the routine you already have deserves a fair run — that's a bigger lever than any ingredient we could add.`,
      });
      return finish(next, adjustments, input);
    }

    // One step up, on the single active most relevant to the user's goals.
    const candidates = strongSteps(next).sort(
      (a, b) =>
        activeRelevanceScore(b.active as ActiveKey, input.intake.goals) -
        activeRelevanceScore(a.active as ActiveKey, input.intake.goals),
    );
    const target = candidates[0];
    if (target) {
      target.frequencyPerWeek += 1;
      adjustments.push({
        action: "escalate_frequency",
        active: target.active,
        detail: `${ACTIVES[target.active as ActiveKey].short} goes to ${target.frequencyPerWeek}x a week. You've been consistent for ${input.weeksOnRoutine} weeks and nothing has moved, which is the one situation where asking a bit more of your skin is the right call.`,
      });
    } else {
      adjustments.push({
        action: "insufficient_evidence",
        detail:
          "Nothing has moved in a while, but your routine has no strong active to step up. A pharmacist or doctor is a better next step than anything we can change here.",
      });
    }
    return finish(next, adjustments, input);
  }

  adjustments.push({
    action: "hold_steady",
    detail: stalled
      ? `Nothing has shifted yet. Most actives need eight to twelve weeks before there is anything to see, and you're ${input.weeksOnRoutine} weeks in — this is normal, not a stall.`
      : "Nothing measurable has changed, so your routine stays as it is.",
  });
  return finish(next, adjustments, input);
}

/**
 * Every path out of `adaptRoutine` goes through here, so no proposal can ever
 * skip the safety clamp.
 */
function finish(
  routine: Routine,
  adjustments: ProgressAdjustment[],
  input: AdaptationInput,
): AdaptationResult {
  const clamped = applySafetyRules(routine, input.intake);
  return { routine: clamped.routine, adjustments, safetyAdjustments: clamped.adjustments };
}
