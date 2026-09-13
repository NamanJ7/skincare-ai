/** Deterministic local weekly scheduling for routine steps. */
import type { Routine, RoutineStep } from "@pore/shared";

import {
  routineStepInstances,
  shiftKey,
  type DateKey,
  type RoutinePeriod,
  type RoutineSchedule,
  type RoutineStepInstance,
} from "./log";

export const WEEKLY_OFFSETS: Record<number, readonly number[]> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 2, 4, 6],
  5: [0, 1, 3, 4, 6],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

export function normalizedWeeklyFrequency(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(7, Math.round(value)));
}

function utcDayNumber(value: DateKey): number {
  const [year, month, day] = value.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function scheduleOffset(anchorDate: DateKey, date: DateKey): number {
  const distance = utcDayNumber(date) - utcDayNumber(anchorDate);
  return ((distance % 7) + 7) % 7;
}

export function isStepScheduled(
  step: RoutineStep,
  anchorDate: DateKey,
  date: DateKey,
): boolean {
  const frequency = normalizedWeeklyFrequency(step.frequencyPerWeek);
  return WEEKLY_OFFSETS[frequency].includes(scheduleOffset(anchorDate, date));
}

export function routineFingerprint(
  routine: Routine,
  profileRevision = 0,
): string {
  const parts = (["am", "pm"] as const).flatMap((period) =>
    routineStepInstances(routine[period]).map(
      ({ key, step }) =>
        `${period}:${key}:${step.category}:${step.active ?? "base"}:${normalizedWeeklyFrequency(
          step.frequencyPerWeek,
        )}`,
    ),
  );
  return `profile:${profileRevision}|${parts.join("|")}`;
}

export function resolvedSchedule(
  current: RoutineSchedule | undefined,
  fingerprint: string,
  today: DateKey,
): RoutineSchedule {
  return current?.fingerprint === fingerprint
    ? current
    : { fingerprint, anchorDate: today };
}

export function scheduledStepInstances(
  routine: Routine,
  period: RoutinePeriod,
  schedule: RoutineSchedule,
  date: DateKey,
): RoutineStepInstance[] {
  return routineStepInstances(routine[period]).filter(({ step }) =>
    isStepScheduled(step, schedule.anchorDate, date),
  );
}

export function nextScheduledDate(
  step: RoutineStep,
  schedule: RoutineSchedule,
  fromDate: DateKey,
): DateKey {
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = shiftKey(fromDate, offset);
    if (isStepScheduled(step, schedule.anchorDate, candidate)) return candidate;
  }
  return fromDate;
}

export function formatNextScheduledDay(date: DateKey, today: DateKey): string {
  if (date === today) return "Scheduled today";
  const [year, month, day] = date.split("-").map(Number);
  const label = new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "short",
  });
  return `Next ${label}`;
}
