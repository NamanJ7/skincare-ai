/**
 * The routine journal — what the user actually did, and how their skin felt.
 *
 * This is the memory that makes the cadence engine reactive instead of static.
 * It lives entirely on this device, in the app's own document directory, next
 * to the photos and under the same promise: nothing here is uploaded.
 *
 * Storage is deliberately dumb (one small JSON file, synchronous reads) and
 * every write is best-effort. Losing a check-off should never break a session —
 * the worst case is the user re-taps a step.
 *
 * Known limitation: expo-file-system's Directory/File API is native-only, so on
 * the Expo *web* target every read throws and is caught, and the app behaves as
 * a permanently fresh install. That is fine for web as a development target and
 * would not be fine if Pore ever shipped a web build — it would need a storage
 * adapter here first. The unit tests cover this module against an in-memory
 * stand-in (src/test/expo-file-system.ts) precisely because the browser cannot.
 */
import { Directory, File, Paths } from "expo-file-system";
import {
  today,
  type Assessment,
  type ProgressAdjustment,
  type Routine,
  type RoutineTime,
  type SkinCheckIn,
  type SkinFeel,
} from "@pore/shared";
// Type-only, so this never becomes a runtime import cycle with the provider
// that reads and writes through these functions.
import type { PlanResult } from "./api";
import type { OnboardingData } from "@/state/onboarding";

const DIR_NAME = "journal";
const FILE_NAME = "journal.json";

interface Journal {
  version: 1;
  /** Date the routine began — the origin the whole ramp is measured from. */
  startedOn: string;
  /** `"YYYY-MM-DD:PM"` → step orders the user has checked off. */
  completed: Record<string, number[]>;
  /** `"YYYY-MM-DD:PM"` for sessions completed end to end. Drives the streak. */
  finished: string[];
  checkIns: SkinCheckIn[];
  /**
   * The first assessment, kept forever — it is the zero the whole product
   * measures against. Nothing overwrites it but a full erase.
   */
  baseline?: StoredAssessment;
  /** The most recent re-assessment. Two points is the whole comparison. */
  latest?: StoredAssessment;
  /**
   * The routine as it stands after any progress adaptation. Absent until the
   * first re-assessment, at which point it takes over from the plan the server
   * generated at signup.
   */
  routine?: Routine;
  /**
   * What the progress engine changed at the last re-assessment, and why.
   *
   * Stored rather than recomputed on render: `adaptRoutine` is a proposal
   * against a routine, so running it again on its own output would step the
   * same active up a second time. It runs once, when a measurement lands.
   */
  lastAdaptation?: ProgressAdjustment[];
  /**
   * The onboarding answers, kept so they survive the app being closed.
   *
   * These are load-bearing for safety, not convenience: `buildIntake` fills
   * defaults for anything missing, and one of those defaults is
   * `pregnancyOrBreastfeeding: false`. Holding the answers in memory only meant
   * a restart silently turned the pregnancy filter off for someone who had told
   * us they were pregnant.
   */
  intake?: PersistedIntake;
  /** The generated assessment + safety-clamped routine from signup. */
  plan?: PlanResult;
}

/**
 * The onboarding answers as they go to disk.
 *
 * `photos` is stripped: `CapturedPhoto.data` is a base64 JPEG held in memory
 * for the duration of one /api/plan request, and the JPEGs themselves already
 * live in `skin-photos/`. Writing them here would add megabytes to a file we
 * read synchronously on every screen focus, to store a second copy of something
 * we already have. `plan` is stripped because it has its own field above.
 */
export type PersistedIntake = Omit<OnboardingData, "photos" | "plan">;

/** One capture session's blind assessment, tagged with when it was taken. */
export interface StoredAssessment {
  sessionId: string;
  capturedAt: string;
  assessment: Assessment;
}

function sessionKey(date: string, time: RoutineTime): string {
  return `${date}:${time}`;
}

function dir(): Directory {
  return new Directory(Paths.document, DIR_NAME);
}

function file(): File {
  return new File(dir(), FILE_NAME);
}

function empty(): Journal {
  return { version: 1, startedOn: today(), completed: {}, finished: [], checkIns: [] };
}

/**
 * Read the journal, defaulting every field on first run.
 *
 * Reading deliberately does not write. An earlier version persisted a fresh
 * journal here, which anchored `startedOn` to whenever the file first happened
 * to be read — so someone who opened the app, looked around, and finished
 * onboarding five days later started their six-week ramp already five days in.
 * `startedOn` is now anchored by the first real write instead, which is either
 * the plan landing (`saveOnboarding`) or the first step ticked off.
 */
export function readJournal(): Journal {
  try {
    const f = file();
    if (!f.exists) return empty();
    const parsed = JSON.parse(f.textSync()) as Partial<Journal>;
    return {
      version: 1,
      startedOn: parsed.startedOn ?? today(),
      completed: parsed.completed ?? {},
      finished: parsed.finished ?? [],
      checkIns: parsed.checkIns ?? [],
      baseline: parsed.baseline,
      latest: parsed.latest,
      routine: parsed.routine,
      lastAdaptation: parsed.lastAdaptation,
      intake: parsed.intake,
      plan: parsed.plan,
    };
  } catch {
    return empty();
  }
}

/**
 * Persist the onboarding answers, and the plan once it exists.
 *
 * Called on every `update()` from the onboarding provider, so a half-finished
 * questionnaire survives the app being closed mid-flow as readily as a
 * finished one.
 */
export function saveOnboarding(data: OnboardingData): Journal {
  const journal = readJournal();
  const { photos: _photos, plan, ...answers } = data;
  journal.intake = answers;
  if (plan) journal.plan = plan;
  writeJournal(journal);
  return journal;
}

function writeJournal(journal: Journal): void {
  try {
    const d = dir();
    if (!d.exists) d.create({ intermediates: true });
    const f = file();
    if (f.exists) f.delete();
    f.create();
    f.write(JSON.stringify(journal));
  } catch {
    // A dropped write costs one re-tap, never the session.
  }
}

/** Step orders already checked off for a session. */
export function completedSteps(journal: Journal, date: string, time: RoutineTime): number[] {
  return journal.completed[sessionKey(date, time)] ?? [];
}

/**
 * Toggle one step, and record the session as finished once every step is done.
 *
 * `totalSteps` comes from the screen because only the screen knows what the
 * cadence engine put on tonight's list — the journal deliberately stores what
 * happened, not what was planned.
 */
export function toggleStep(
  date: string,
  time: RoutineTime,
  order: number,
  totalSteps: number,
): Journal {
  const journal = readJournal();
  const key = sessionKey(date, time);
  const current = journal.completed[key] ?? [];
  const next = current.includes(order)
    ? current.filter((o) => o !== order)
    : [...current, order].sort((a, b) => a - b);

  journal.completed[key] = next;
  const complete = totalSteps > 0 && next.length >= totalSteps;
  journal.finished = journal.finished.filter((k) => k !== key);
  if (complete) journal.finished.push(key);

  writeJournal(journal);
  return journal;
}

/** Record how the skin felt. One tap, and it is what drives the next deload. */
export function recordCheckIn(date: string, feel: SkinFeel): Journal {
  const journal = readJournal();
  journal.checkIns = [...journal.checkIns.filter((c) => c.date !== date), { date, feel }].sort(
    (a, b) => a.date.localeCompare(b.date),
  );
  writeJournal(journal);
  return journal;
}

export function checkInFor(journal: Journal, date: string): SkinFeel | undefined {
  return journal.checkIns.find((c) => c.date === date)?.feel;
}

/**
 * Consecutive days ending today on which at least one session was completed.
 *
 * Today being unfinished does not break the streak — it has not happened yet.
 * The count starts from yesterday in that case, so the number never drops just
 * because the user opened the app in the morning.
 */
export function streakDays(journal: Journal, on: string = today()): number {
  const days = new Set(journal.finished.map((k) => k.split(":")[0]));
  let count = 0;
  let cursor = days.has(on) ? on : shiftDay(on, -1);
  while (days.has(cursor)) {
    count++;
    cursor = shiftDay(cursor, -1);
  }
  return count;
}

function shiftDay(date: string, delta: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

/**
 * File away one session's blind assessment.
 *
 * The first one ever recorded becomes the baseline and is never replaced —
 * comparing against a moving zero would let slow drift disappear. Everything
 * after it lands in `latest`.
 */
export function recordAssessment(entry: StoredAssessment): Journal {
  const journal = readJournal();
  if (!journal.baseline) journal.baseline = entry;
  else journal.latest = entry;
  writeJournal(journal);
  return journal;
}

/**
 * Persist the outcome of one progress adaptation: the routine it produced and
 * the reasons it gives the user. Written together because they describe the
 * same event and must never drift apart.
 */
export function saveAdaptation(routine: Routine, adjustments: ProgressAdjustment[]): Journal {
  const journal = readJournal();
  journal.routine = routine;
  journal.lastAdaptation = adjustments;
  writeJournal(journal);
  return journal;
}

/** Whole weeks since the routine started. */
export function weeksOnRoutine(journal: Journal, on: string = today()): number {
  return Math.max(0, Math.floor(daysSince(journal.startedOn, on) / 7));
}

/**
 * Roughly what share of scheduled sessions actually got done, 0..1.
 *
 * Two sessions a day is the denominator. It is a blunt measure, and it is
 * deliberately blunt: it only ever gates whether we are allowed to make a
 * routine *stronger*, so erring toward "not enough evidence" is the safe
 * direction to be wrong in.
 */
export function adherenceRate(journal: Journal, on: string = today()): number {
  const days = Math.max(1, daysSince(journal.startedOn, on));
  return Math.min(1, journal.finished.length / (days * 2));
}

function daysSince(from: string, to: string): number {
  const day = (d: string) => Date.parse(`${d}T00:00:00Z`);
  return Math.max(0, Math.round((day(to) - day(from)) / 86_400_000));
}

/**
 * How many distinct days the journal actually holds anything for. Drives the
 * "your routine record" disclosure, so it counts what is stored rather than
 * how long ago the routine started.
 */
export function recordedDays(journal: Journal): number {
  const days = new Set<string>();
  for (const key of Object.keys(journal.completed)) {
    if ((journal.completed[key] ?? []).length > 0) days.add(key.split(":")[0] ?? key);
  }
  for (const c of journal.checkIns) days.add(c.date);
  return days.size;
}

/**
 * Erase what the user did, keeping the routine they did it with.
 *
 * This is what the "Erase my routine record" control on /plan actually
 * promises: the tick-offs and check-ins go, the routine stays, and the ramp
 * restarts from today. It is a narrower operation than `deleteJournal`, which
 * removes the answers and the plan as well.
 *
 * Splitting the two matters more now that the journal holds the routine: wiping
 * the whole file behind a button labelled "your routine stays" would take the
 * routine with it.
 */
export function eraseRecord(): Journal {
  const journal = readJournal();
  journal.completed = {};
  journal.finished = [];
  journal.checkIns = [];
  journal.startedOn = today();
  writeJournal(journal);
  return journal;
}

/**
 * Whether this device already has a routine to go back to.
 *
 * Drives the launch redirect: a returning user should land on today's session,
 * not on the marketing splash they already said yes to.
 */
export function hasRoutine(journal: Journal = readJournal()): boolean {
  return Boolean(journal.routine ?? journal.plan?.routine);
}

/**
 * Wipe the journal — the "forget me" path, alongside deleting the photos.
 *
 * Deliberately the one function here that throws instead of swallowing. Every
 * other write is best-effort because losing a tick-off costs a re-tap; an erase
 * that quietly fails would tell someone their record was gone when it is still
 * on the phone. The caller (`plan.tsx`) catches this and says so.
 */
export function deleteJournal(): void {
  const d = dir();
  if (d.exists) d.delete();
}

export type { Journal };
