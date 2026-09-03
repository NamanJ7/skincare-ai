/**
 * The routine journal — what the user was told to do, what they actually did,
 * and how their skin felt.
 *
 * This is the only memory the product has. It lives entirely on this device, in
 * the app's own document directory, next to the photos and under the same
 * promise: nothing here is uploaded.
 *
 * This module is deliberately only I/O and small queries. The interesting part
 * — turning whatever is on disk into a valid `Journal` — is a pure function in
 * `@pore/shared` (`hydrateJournal`), where it is tested.
 *
 * Storage is dumb on purpose (one small JSON file, synchronous reads) and every
 * write is best-effort. Losing a check-off should never break a session — the
 * worst case is the user re-taps a step.
 */
import { Directory, File, Paths } from "expo-file-system";
import {
  emptyJournal,
  hydrateJournal,
  today,
  type IntakeResponse,
  type Journal,
  type PlanResult,
  type ProgressAdjustment,
  type Routine,
  type RoutineTime,
  type SkinFeel,
  type StoredAssessment,
} from "@pore/shared";

const DIR_NAME = "journal";
const FILE_NAME = "journal.json";

function sessionKey(date: string, time: RoutineTime): string {
  return `${date}:${time}`;
}

function dir(): Directory {
  return new Directory(Paths.document, DIR_NAME);
}

function file(): File {
  return new File(dir(), FILE_NAME);
}

/**
 * Read the journal, creating it on first run.
 *
 * The first read is what sets `startedOn`, so the ramp starts the day the user
 * first opens their routine rather than at some arbitrary epoch.
 *
 * A file we could only partly read is repaired immediately. The old behaviour
 * was to return an empty journal and leave the bad file in place, which meant
 * the user's streak and baseline appeared to vanish on every subsequent read,
 * forever, with no error anywhere.
 */
export function readJournal(): Journal {
  try {
    const f = file();
    if (!f.exists) {
      const fresh = emptyJournal(today());
      writeJournal(fresh);
      return fresh;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(f.textSync()) as unknown;
    } catch {
      raw = "unparseable";
    }
    const { journal, repaired } = hydrateJournal(raw, today());
    if (repaired) writeJournal(journal);
    return journal;
  } catch {
    return emptyJournal(today());
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

/**
 * Commit the plan generated at signup, along with the answers it was built
 * from.
 *
 * Both are needed: the safety engine re-runs against the intake on every
 * render, so a stored routine without its intake would be recomputed from
 * defaults — including `pregnancyOrBreastfeeding: false`.
 *
 * Writing a plan also resets `startedOn`. The ramp is measured from that date,
 * and a user who erased their record and started again would otherwise inherit
 * the old origin and land on week 4 of a brand new routine.
 */
export function savePlan(intake: IntakeResponse, plan: PlanResult): Journal {
  const journal = readJournal();
  journal.intake = intake;
  journal.plan = plan;
  journal.startedOn = today();
  // A new plan supersedes any adaptation made against the old one.
  journal.routine = undefined;
  journal.lastAdaptation = undefined;
  writeJournal(journal);
  return journal;
}

/** The routine the user is actually on: adapted if there is one, else the plan's. */
export function activeRoutine(journal: Journal): Routine | undefined {
  return journal.routine ?? journal.plan?.routine;
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

  if (next.length > 0) journal.completed[key] = next;
  else delete journal.completed[key];
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
 * Erase what the user *did* — tick-offs, check-ins, and every assessment — while
 * keeping the routine they are on.
 *
 * This is what "erase my routine record" has always promised ("your routine
 * stays, but it restarts its six-week ramp from today"). It became a real
 * distinction once the plan moved into this file: a blanket delete would now
 * take the routine with it and quietly make the promise false.
 */
export function eraseRecord(): Journal {
  const previous = readJournal();
  const fresh = emptyJournal(today());
  fresh.intake = previous.intake;
  fresh.plan = previous.plan;
  writeJournal(fresh);
  return fresh;
}

/** Wipe everything — the "forget me" path, alongside deleting the photos. */
export function deleteJournal(): void {
  const d = dir();
  if (d.exists) d.delete();
}

export type { Journal, StoredAssessment };
