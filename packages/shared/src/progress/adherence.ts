/**
 * What the user actually did, day by day.
 *
 * Pure logic over a plain log; the mobile app owns the file it lives in. The
 * date arithmetic is the part worth testing — it is not reachable by tapping
 * around, and it is silently wrong in two obvious implementations (see below).
 *
 * This module deliberately does not touch `compareAssessments`. Adherence is
 * context shown NEXT TO a progress comparison, never an input to it: the app
 * cannot observe that a routine caused a change, and folding one into the other
 * would manufacture exactly that claim.
 */
import type { RoutineStep, RoutineTime } from "../types/routine";

/** Completed step keys for one calendar day, per session. */
export interface RoutineDay {
  AM?: string[];
  PM?: string[];
}

export interface RoutineLog {
  version: number;
  /** Local calendar date (`YYYY-MM-DD`) → what was completed that day. */
  days: Record<string, RoutineDay>;
}

export const EMPTY_LOG: RoutineLog = { version: 1, days: {} };

/**
 * A step's identity in the log.
 *
 * Not the array index and not `order`: `renumber()` in the safety engine
 * reassigns both whenever a step is dropped or moved between sessions, so an
 * index-keyed entry would silently start describing a different product the
 * next time the routine is regenerated. Category plus active is stable, and it
 * survives a re-check — if the new routine still has a salicylic exfoliant at
 * night, last week's entries still describe it.
 */
export function stepKey(step: RoutineStep): string {
  return `${step.category}:${step.active ?? "-"}`;
}

/**
 * Local calendar date key.
 *
 * NOT `toISOString().slice(0, 10)`. That is UTC, so a PM routine done at 10pm
 * in UTC-7 would be filed under tomorrow — the user would tick a box and watch
 * it land on the wrong day.
 */
export function dateKey(d: Date = new Date()): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * Move by whole local days.
 *
 * Via the date constructor rather than subtracting 24h in milliseconds: on the
 * two DST boundaries a day is 23 or 25 hours long, and millisecond arithmetic
 * there skips or repeats a calendar date.
 */
function shiftDays(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + delta);
}

function entriesFor(log: RoutineLog, date: string, time: RoutineTime): string[] {
  const day = log.days[date];
  if (!day) return [];
  return day[time] ?? [];
}

/** Whether a step is already ticked for that date and session. */
export function isDone(
  log: RoutineLog,
  date: string,
  time: RoutineTime,
  key: string,
): boolean {
  return entriesFor(log, date, time).includes(key);
}

/** Tick or untick one step. Returns a new log; never mutates the input. */
export function toggleStep(
  log: RoutineLog,
  date: string,
  time: RoutineTime,
  key: string,
): RoutineLog {
  const current = entriesFor(log, date, time);
  const next = current.includes(key)
    ? current.filter((k) => k !== key)
    : [...current, key];
  return {
    ...log,
    days: { ...log.days, [date]: { ...log.days[date], [time]: next } },
  };
}

/**
 * How many of the last `days` days this step was completed, ending at `end`
 * inclusive.
 *
 * A rolling window rather than a calendar week: a Monday reset would show
 * "0 of 3" every Monday to someone perfectly on track.
 */
export function countInWindow(
  log: RoutineLog,
  key: string,
  time: RoutineTime,
  end: Date = new Date(),
  days = 7,
): number {
  let count = 0;
  for (let i = 0; i < days; i++) {
    if (isDone(log, dateKey(shiftDays(end, -i)), time, key)) count++;
  }
  return count;
}

/**
 * Days with anything logged between two check-ins.
 *
 * The span runs from the day AFTER the earlier check-in through the day of the
 * later one, so it lines up with the `daysBetween` that `compareAssessments`
 * reports rather than being off by one against it.
 */
export function daysLoggedBetween(
  log: RoutineLog,
  fromISO: string,
  toISO: string,
): { daysLogged: number; totalDays: number } {
  const from = new Date(fromISO);
  const to = new Date(toISO);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { daysLogged: 0, totalDays: 0 };
  }

  let daysLogged = 0;
  let totalDays = 0;
  const last = dateKey(to);
  for (let cursor = shiftDays(from, 1); ; cursor = shiftDays(cursor, 1)) {
    const key = dateKey(cursor);
    if (cursor.getTime() > to.getTime() && key !== last) break;
    totalDays++;
    const day = log.days[key];
    if ((day?.AM?.length ?? 0) > 0 || (day?.PM?.length ?? 0) > 0) daysLogged++;
    if (key === last) break;
  }
  return { daysLogged, totalDays };
}
