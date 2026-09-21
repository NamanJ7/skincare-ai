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
  assessmentHistory,
  baselineOf,
  latestOf,
  recordInHistory,
  today,
  type ProgressAdjustment,
  type Routine,
  type RoutineTime,
  type SkinCheckIn,
  type SkinFeel,
  type StoredAssessment,
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
   * Every blind assessment ever taken, oldest first.
   *
   * This used to be two slots — a write-once `baseline` and a `latest` that each
   * new capture overwrote — which meant a third set of photos destroyed the
   * second and the middle of a long routine was simply gone. `assessmentHistory`
   * in @pore/shared migrates the old shape on read; see `readJournal`.
   *
   * The comparison still uses exactly two of these. Keeping the rest costs a few
   * KB and is the only way a trend over more than two points is ever possible.
   */
  assessments: StoredAssessment[];
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

export type { StoredAssessment };

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
  return { version: 1, startedOn: today(), completed: {}, finished: [], checkIns: [], assessments: [] };
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
      // Migrated on every read rather than in a one-shot upgrade step: this is
      // the only reader, the function is pure and tested, and an install that
      // never opens the app again is not left holding a shape nothing understands.
      assessments: assessmentHistory(parsed as Parameters<typeof assessmentHistory>[0]),
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
 * Sessions completed between two calendar dates, inclusive.
 *
 * This replaced a consecutive-day streak, which was the one gamified element in
 * the app and was quietly arguing with the rest of it. The correct thing to do
 * on a night your skin is stinging is to stop — the cadence engine will pull the
 * actives for three days by itself — and an unbroken chain punishes exactly that
 * behaviour. A count over a window rewards showing up without making a skipped
 * night feel like a loss.
 */
export function sessionsBetween(journal: Journal, from: string, to: string): number {
  return journal.finished.filter((key) => {
    const day = key.split(":")[0] ?? "";
    return day >= from && day <= to;
  }).length;
}

/**
 * File away one session's blind assessment.
 *
 * The first one ever recorded is the baseline and is never displaced —
 * comparing against a moving zero would let slow drift disappear. Ordering and
 * the same-session replace rule both live in `recordInHistory`, which is tested
 * in @pore/shared.
 */
export function recordAssessment(entry: StoredAssessment): Journal {
  const journal = readJournal();
  journal.assessments = recordInHistory(journal.assessments, entry);
  writeJournal(journal);
  return journal;
}

/** The first reading ever taken — the zero every measurement subtracts from. */
export function baselineAssessment(journal: Journal): StoredAssessment | undefined {
  return baselineOf(journal.assessments);
}

/** The most recent reading, once there is more than the baseline. */
export function latestAssessment(journal: Journal): StoredAssessment | undefined {
  return latestOf(journal.assessments);
}

/**
 * Persist a routine on its own, with no adaptation attached.
 *
 * Used when the answers change rather than the skin: re-running
 * `applySafetyRules` against an edited intake produces a `SafetyAdjustment[]`,
 * not a `ProgressAdjustment[]`, so it must not be squeezed through
 * `saveAdaptation` — `lastAdaptation` is what `/compare` shows as "what changed
 * because of your photos", and a pregnancy edit is not that.
 */
export function saveRoutine(routine: Routine): Journal {
  const journal = readJournal();
  journal.routine = routine;
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
 * Replace the whole journal with one read from elsewhere.
 *
 * The restore half of `backup.ts`, and the only writer that does not start from
 * `readJournal()`. Exported rather than inlined there so every write to this
 * file still goes through the one function that owns the directory, the
 * best-effort contract and the atomicity of the replace.
 */
export function writeJournalRaw(journal: Journal): void {
  writeJournal(journal);
}

/** Wipe the journal — the "forget me" path, alongside deleting the photos. */
export function deleteJournal(): void {
  const d = dir();
  if (d.exists) d.delete();
}

export type { Journal };
