/**
 * Turning an arbitrary JSON blob off the disk into a valid `Journal`.
 *
 * This is the one part of the record that genuinely needs defending. The file
 * may have been written by an older build, truncated by a crash mid-write, or
 * carry a `plan` whose server-side shape has since moved. The old behaviour was
 * to throw, catch, and return an empty journal — which silently zeroed the
 * user's streak, baseline and adapted routine with no error anywhere, and then
 * did it again on every subsequent read because the bad file was never
 * replaced.
 *
 * So: never throw, drop only the fields that are actually unreadable, and say
 * whether anything was dropped so the caller can write the repaired file back.
 */

import type { IntakeResponse } from "../types/intake";
import type { PlanResult } from "../types/plan";
import type { Routine } from "../types/routine";
import type { SkinCheckIn, SkinFeel } from "../schedule/engine";
import type { Journal, ReminderSetting, StoredAssessment } from "./types";

const FEELS: SkinFeel[] = ["calm", "tight", "stinging"];
/** `YYYY-MM-DD`. Anything else is not a date we can do day arithmetic on. */
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface HydrateResult {
  journal: Journal;
  /**
   * True when at least one field was unreadable and dropped. The caller should
   * write the result back, so a bad file is repaired once instead of degrading
   * every read forever.
   */
  repaired: boolean;
}

/** A blank record. `startedOn` is the day the routine begins. */
export function emptyJournal(startedOn: string): Journal {
  return { version: 1, startedOn, completed: {}, finished: [], checkIns: [] };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isDate(v: unknown): v is string {
  return typeof v === "string" && DATE.test(v);
}

/** A routine is usable only if both sessions are arrays of step-shaped things. */
function readRoutine(v: unknown): Routine | undefined {
  if (!isObject(v) || !Array.isArray(v.am) || !Array.isArray(v.pm)) return undefined;
  const steps = [...v.am, ...v.pm];
  if (!steps.every((s) => isObject(s) && typeof s.category === "string")) return undefined;
  return {
    am: v.am as Routine["am"],
    pm: v.pm as Routine["pm"],
    notes: Array.isArray(v.notes) ? v.notes.filter((n): n is string => typeof n === "string") : [],
  };
}

/**
 * An assessment is only worth keeping if it has the findings array the compare
 * engine subtracts. A `StoredAssessment` missing its timestamp is useless too —
 * the comparability gate is a function of when the shots were taken.
 */
function readStoredAssessment(v: unknown): StoredAssessment | undefined {
  if (!isObject(v)) return undefined;
  const { sessionId, capturedAt, assessment } = v;
  if (typeof sessionId !== "string" || typeof capturedAt !== "string") return undefined;
  if (!isObject(assessment) || !Array.isArray(assessment.findings)) return undefined;
  return {
    sessionId,
    capturedAt,
    assessment: assessment as unknown as StoredAssessment["assessment"],
  };
}

function readPlan(v: unknown): PlanResult | undefined {
  if (!isObject(v)) return undefined;
  const routine = readRoutine(v.routine);
  if (!routine) return undefined;
  if (!isObject(v.assessment) || !Array.isArray(v.assessment.findings)) return undefined;
  return {
    assessment: v.assessment as unknown as PlanResult["assessment"],
    routine,
    adjustments: Array.isArray(v.adjustments) ? (v.adjustments as PlanResult["adjustments"]) : [],
    // An unrecognised mode is treated as a mock: the honest direction to be
    // wrong in is "we cannot vouch for this reading".
    mode: v.mode === "ai" ? "ai" : "mock",
  };
}

/**
 * Intake is all-or-nothing on purpose. A half-read intake is worse than none:
 * the missing half gets filled with defaults, and the default for
 * `pregnancyOrBreastfeeding` is `false`. Dropping it makes the app say "we
 * never generated a plan" instead of quietly generating an unsafe one.
 */
function readIntake(v: unknown): IntakeResponse | undefined {
  if (!isObject(v)) return undefined;
  if (typeof v.age !== "number" || !Number.isFinite(v.age)) return undefined;
  if (typeof v.pregnancyOrBreastfeeding !== "boolean") return undefined;
  if (typeof v.sensitivity !== "string" || typeof v.skinType !== "string") return undefined;
  if (!Array.isArray(v.goals) || !Array.isArray(v.allergies)) return undefined;
  return v as unknown as IntakeResponse;
}

/**
 * A reminder is dropped whole if any part of it is unreadable. A half-read one
 * would schedule a notification at an hour the user never chose, which is worse
 * than not reminding them at all.
 */
function readReminder(v: unknown): ReminderSetting | undefined {
  if (!isObject(v)) return undefined;
  const { enabled, hour, minute } = v;
  if (typeof enabled !== "boolean") return undefined;
  if (typeof hour !== "number" || !Number.isInteger(hour) || hour < 0 || hour > 23) return undefined;
  if (typeof minute !== "number" || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    return undefined;
  }
  return { enabled, hour, minute };
}

function readCompleted(v: unknown): Record<string, number[]> {
  if (!isObject(v)) return {};
  const out: Record<string, number[]> = {};
  for (const [key, value] of Object.entries(v)) {
    if (!Array.isArray(value)) continue;
    const orders = value.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
    if (orders.length > 0) out[key] = orders;
  }
  return out;
}

function readCheckIns(v: unknown): SkinCheckIn[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (c): c is SkinCheckIn =>
        isObject(c) && isDate(c.date) && FEELS.includes(c.feel as SkinFeel),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Read whatever is on disk into a journal.
 *
 * `fallbackStartedOn` is today's date in the device's timezone, passed in so
 * this stays a pure function of its inputs and can be tested without a clock.
 */
export function hydrateJournal(raw: unknown, fallbackStartedOn: string): HydrateResult {
  if (!isObject(raw)) {
    return { journal: emptyJournal(fallbackStartedOn), repaired: raw !== undefined };
  }

  let repaired = false;
  /** Note a field we were given but could not read. Absent fields are fine. */
  const dropped = (present: unknown, kept: unknown) => {
    if (present !== undefined && kept === undefined) repaired = true;
  };

  const startedOn = isDate(raw.startedOn) ? raw.startedOn : fallbackStartedOn;
  if (raw.startedOn !== undefined && !isDate(raw.startedOn)) repaired = true;

  const intake = readIntake(raw.intake);
  dropped(raw.intake, intake);
  const plan = readPlan(raw.plan);
  dropped(raw.plan, plan);
  const baseline = readStoredAssessment(raw.baseline);
  dropped(raw.baseline, baseline);
  const latest = readStoredAssessment(raw.latest);
  dropped(raw.latest, latest);
  const routine = readRoutine(raw.routine);
  dropped(raw.routine, routine);

  const finished = Array.isArray(raw.finished)
    ? raw.finished.filter((k): k is string => typeof k === "string")
    : [];
  if (raw.finished !== undefined && !Array.isArray(raw.finished)) repaired = true;

  const reminder = readReminder(raw.reminder);
  dropped(raw.reminder, reminder);

  const lastAdaptation = Array.isArray(raw.lastAdaptation)
    ? (raw.lastAdaptation as Journal["lastAdaptation"])
    : undefined;
  dropped(raw.lastAdaptation, lastAdaptation);

  return {
    journal: {
      version: 1,
      startedOn,
      completed: readCompleted(raw.completed),
      finished,
      checkIns: readCheckIns(raw.checkIns),
      intake,
      plan,
      baseline,
      latest,
      routine,
      lastAdaptation,
      reminder,
    },
    repaired,
  };
}
