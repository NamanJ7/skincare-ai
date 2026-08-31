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
}

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
 * Read the journal, creating it on first run.
 *
 * The first read is what sets `startedOn`, so the ramp starts the day the user
 * first opens their routine rather than at some arbitrary epoch.
 */
export function readJournal(): Journal {
  try {
    const f = file();
    if (!f.exists) {
      const fresh = empty();
      writeJournal(fresh);
      return fresh;
    }
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
    };
  } catch {
    return empty();
  }
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

/** Wipe the journal — the "forget me" path, alongside deleting the photos. */
export function deleteJournal(): void {
  const d = dir();
  if (d.exists) d.delete();
}

export type { Journal };
