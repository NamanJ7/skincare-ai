/**
 * Deterministic comparison of two check-ins.
 *
 * This is the part of progress that is CODE, not a prompt — the same reason the
 * safety engine is. A comparison that answers differently each time it runs
 * cannot be tested, cannot be explained to the user, and cannot be trusted with
 * a sentence as consequential as "this looks better than last month".
 *
 * The bias throughout is toward refusing to answer. Two photo sessions a week
 * apart, or lit differently, or read with low confidence, produce a difference
 * in `appearanceLevel` that is noise — and noise rendered as progress is worse
 * than silence, because the user acts on it. Every gate below returns
 * `comparable: false` with no changes at all, so a caller cannot accidentally
 * render a claim the data does not support.
 */
import type {
  Assessment,
  AppearanceLevel,
  ConcernFinding,
  ConcernKey,
} from "../types/assessment";

/** Ordinal rank for the four appearance bands. Higher = more visible. */
const APPEARANCE_RANK: Record<AppearanceLevel, number> = {
  none: 0,
  mild: 1,
  moderate: 2,
  noticeable: 3,
};

/**
 * How far apart two check-ins must be before a difference means anything.
 *
 * Skin turnover runs about four weeks, and the routine's own ramp copy talks in
 * terms of 4-6 weeks. Below this, we are reading the difference between two
 * Tuesdays.
 */
export const MIN_DAYS_BETWEEN = 28;

/**
 * Confidence floor, matching the boundary the app already calls "Low
 * confidence" when it reports a single assessment. A read we would hedge on its
 * own does not become solid by being subtracted from another one.
 */
export const MIN_CONFIDENCE = 0.5;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Descriptive, not evaluative. "less_visible" rather than "improved", and
 * "more_visible" rather than "worse" — the app describes appearance and does
 * not grade the user's face.
 */
export type ChangeDirection = "less_visible" | "steady" | "more_visible" | "unclear";

export interface ConcernChange {
  concern: ConcernKey;
  direction: ChangeDirection;
  from: AppearanceLevel;
  to: AppearanceLevel;
  /** Set only when direction is "unclear" — why we will not call it. */
  caveat?: string;
}

export interface ProgressReport {
  /** False when these two check-ins cannot honestly be compared at all. */
  comparable: boolean;
  /** Why not. Present exactly when `comparable` is false. */
  reason?: string;
  daysBetween: number;
  /** Always empty when `comparable` is false. */
  changes: ConcernChange[];
  /** Plain-language and always literally true. Safe to render unconditionally. */
  summary: string;
}

/**
 * The lighting a whole check-in was shot under.
 *
 * "mixed" matters: three photos in one session under two different illuminants
 * are not a controlled capture, whatever the individual shots claim.
 */
function illuminantOf(a: Assessment): "screen_flash" | "ambient" | "mixed" | "unknown" {
  const seen = new Set(a.photoQuality.map((p) => p.illuminant));
  if (seen.size === 0) return "unknown";
  if (seen.size > 1) return "mixed";
  return seen.has("screen_flash") ? "screen_flash" : "ambient";
}

function findingFor(a: Assessment, concern: ConcernKey): ConcernFinding | undefined {
  return a.findings.find((f) => f.concern === concern);
}

/** Concerns worth reporting: anything either check-in actually saw. */
function concernsInPlay(before: Assessment, after: Assessment): ConcernKey[] {
  const keys = new Set<ConcernKey>();
  for (const f of [...before.findings, ...after.findings]) {
    if (f.present || APPEARANCE_RANK[f.appearanceLevel] > 0) keys.add(f.concern);
  }
  return [...keys];
}

function notComparable(daysBetween: number, reason: string): ProgressReport {
  return { comparable: false, reason, daysBetween, changes: [], summary: reason };
}

function summarise(changes: ConcernChange[]): string {
  const less = changes.filter((c) => c.direction === "less_visible").length;
  const more = changes.filter((c) => c.direction === "more_visible").length;
  const unclear = changes.filter((c) => c.direction === "unclear").length;

  if (changes.length === 0) {
    return "Nothing stood out in either check-in to compare.";
  }
  const parts: string[] = [];
  if (less > 0) parts.push(`${less} ${less === 1 ? "looks" : "look"} less visible`);
  if (more > 0) parts.push(`${more} ${more === 1 ? "looks" : "look"} more visible`);
  if (parts.length === 0) {
    return unclear === changes.length
      ? "These photos were not clear enough to call any of it either way."
      : "Everything we compared looks about the same as last time.";
  }
  const tail = unclear > 0 ? `, and ${unclear} we can't call either way` : "";
  return `Of what we compared, ${parts.join(" and ")}${tail}. The rest looks about the same.`;
}

/**
 * Compare an earlier check-in against a later one.
 *
 * `beforeAt` / `afterAt` are ISO timestamps — the check-in dates, not the
 * assessment's own internals, which carry no time of their own.
 */
export function compareAssessments(
  before: Assessment,
  beforeAt: string,
  after: Assessment,
  afterAt: string,
): ProgressReport {
  const beforeMs = new Date(beforeAt).getTime();
  const afterMs = new Date(afterAt).getTime();

  if (Number.isNaN(beforeMs) || Number.isNaN(afterMs)) {
    return notComparable(0, "We couldn't read when these check-ins were taken.");
  }
  if (afterMs < beforeMs) {
    return notComparable(0, "These check-ins arrived out of order, so we're not comparing them.");
  }

  // Floor, not round: a check-in 27.9 days on is still inside the window.
  const daysBetween = Math.floor((afterMs - beforeMs) / DAY_MS);

  if (daysBetween < MIN_DAYS_BETWEEN) {
    return notComparable(
      daysBetween,
      `These check-ins are ${daysBetween} ${daysBetween === 1 ? "day" : "days"} apart. ` +
        "Skin takes about four weeks to show a change, so there isn't much to read yet.",
    );
  }

  // Only screen-flash captures share a known illuminant, and only those are
  // comparable across sessions. Two sessions lit by whatever the room had can
  // differ purely because one was nearer a window.
  const beforeLight = illuminantOf(before);
  const afterLight = illuminantOf(after);
  if (beforeLight !== "screen_flash" || afterLight !== "screen_flash") {
    return notComparable(
      daysBetween,
      "These two sets of photos weren't taken under the same light, so a side-by-side " +
        "look is fair but comparing levels wouldn't be.",
    );
  }

  if (before.overallConfidence < MIN_CONFIDENCE || after.overallConfidence < MIN_CONFIDENCE) {
    return notComparable(
      daysBetween,
      "One of these check-ins was a low-confidence read, so comparing the two would " +
        "overstate what we can see.",
    );
  }

  const changes: ConcernChange[] = [];
  for (const concern of concernsInPlay(before, after)) {
    const b = findingFor(before, concern);
    const a = findingFor(after, concern);

    if (!b || !a) {
      const missing = b ? "later" : "earlier";
      changes.push({
        concern,
        direction: "unclear",
        from: b?.appearanceLevel ?? "none",
        to: a?.appearanceLevel ?? "none",
        caveat: `The ${missing} check-in didn't assess this one.`,
      });
      continue;
    }

    if (b.confidence < MIN_CONFIDENCE || a.confidence < MIN_CONFIDENCE) {
      const which =
        b.confidence < MIN_CONFIDENCE && a.confidence < MIN_CONFIDENCE
          ? "Neither check-in was"
          : b.confidence < MIN_CONFIDENCE
            ? "The earlier check-in wasn't"
            : "The later check-in wasn't";
      changes.push({
        concern,
        direction: "unclear",
        from: b.appearanceLevel,
        to: a.appearanceLevel,
        caveat: `${which} confident enough about this to compare.`,
      });
      continue;
    }

    const delta = APPEARANCE_RANK[a.appearanceLevel] - APPEARANCE_RANK[b.appearanceLevel];
    changes.push({
      concern,
      direction: delta < 0 ? "less_visible" : delta > 0 ? "more_visible" : "steady",
      from: b.appearanceLevel,
      to: a.appearanceLevel,
    });
  }

  return { comparable: true, daysBetween, changes, summary: summarise(changes) };
}
