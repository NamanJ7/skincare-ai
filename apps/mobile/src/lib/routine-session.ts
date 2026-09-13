/** Pure persisted-state transitions for Guided Routine Mode. */
import {
  type ActiveRoutineSession,
  type DateKey,
  type PeriodLog,
  type RoutineLog,
  type RoutinePeriod,
  type RoutineSessionSource,
  type RoutineStepSkipReason,
} from "./log";

export const ROUTINE_SESSION_RESUME_MS = 6 * 60 * 60 * 1000;

export interface StartRoutineSessionInput {
  id: string;
  date: DateKey;
  period: RoutinePeriod;
  source: RoutineSessionSource;
  routineFingerprint: string;
  stepKeys: string[];
  startedAt: string;
}

export function routineSessionExpired(
  session: ActiveRoutineSession,
  now = new Date(),
): boolean {
  const started = Date.parse(session.startedAt);
  return (
    !Number.isFinite(started) ||
    now.getTime() - started > ROUTINE_SESSION_RESUME_MS
  );
}

export function sessionPeriod(log: RoutineLog): PeriodLog | undefined {
  const session = log.activeSession;
  return session ? log.days[session.date]?.[session.period] : undefined;
}

export function periodResolved(period: PeriodLog | undefined): boolean {
  if (!period?.scheduledStepKeys || period.scheduledStepKeys.length === 0)
    return false;
  return period.scheduledStepKeys.every(
    (key) => period.done.includes(key) || !!period.skipped?.[key],
  );
}

export function startRoutineSession(
  log: RoutineLog,
  input: StartRoutineSessionInput,
): RoutineLog {
  const day = log.days[input.date] ?? {};
  const current = day[input.period];
  const done = current?.done ?? [];
  const skipped = current?.skipped ?? {};
  const period: PeriodLog = {
    done,
    total: input.stepKeys.length,
    scheduledStepKeys: input.stepKeys,
    ...(Object.keys(skipped).length > 0 ? { skipped } : {}),
    startedAt: current?.startedAt ?? input.startedAt,
    source: "guided",
  };
  return {
    ...log,
    days: {
      ...log.days,
      [input.date]: { ...day, [input.period]: period },
    },
    activeSession: {
      id: input.id,
      date: input.date,
      period: input.period,
      source: input.source,
      routineFingerprint: input.routineFingerprint,
      stepKeys: input.stepKeys,
      currentIndex: firstUnresolvedIndex(input.stepKeys, period),
      startedAt: input.startedAt,
      updatedAt: input.startedAt,
    },
  };
}

export function firstUnresolvedIndex(
  stepKeys: string[],
  period: PeriodLog | undefined,
): number {
  const index = stepKeys.findIndex(
    (key) => !period?.done.includes(key) && !period?.skipped?.[key],
  );
  return index < 0 ? stepKeys.length : index;
}

export function setSessionIndex(
  log: RoutineLog,
  index: number,
  updatedAt: string,
): RoutineLog {
  const session = log.activeSession;
  if (!session) return log;
  return {
    ...log,
    activeSession: {
      ...session,
      currentIndex: Math.max(
        0,
        Math.min(session.stepKeys.length, Math.floor(index)),
      ),
      updatedAt,
    },
  };
}

export function recordSessionDone(
  log: RoutineLog,
  key: string,
  nextIndex: number,
  updatedAt: string,
): RoutineLog {
  const session = log.activeSession;
  if (!session || !session.stepKeys.includes(key)) return log;
  const day = log.days[session.date] ?? {};
  const current = day[session.period] ?? {
    done: [],
    total: session.stepKeys.length,
    scheduledStepKeys: session.stepKeys,
    startedAt: session.startedAt,
    source: "guided" as const,
  };
  const skipped = { ...(current.skipped ?? {}) };
  delete skipped[key];
  const period: PeriodLog = {
    ...current,
    done: current.done.includes(key) ? current.done : [...current.done, key],
    ...(Object.keys(skipped).length > 0 ? { skipped } : { skipped: undefined }),
  };
  return setSessionIndex(
    {
      ...log,
      days: {
        ...log.days,
        [session.date]: { ...day, [session.period]: period },
      },
    },
    nextIndex,
    updatedAt,
  );
}

export function recordSessionSkip(
  log: RoutineLog,
  key: string,
  reason: RoutineStepSkipReason,
  nextIndex: number,
  updatedAt: string,
): RoutineLog {
  const session = log.activeSession;
  if (!session || !session.stepKeys.includes(key)) return log;
  const day = log.days[session.date] ?? {};
  const current = day[session.period] ?? {
    done: [],
    total: session.stepKeys.length,
    scheduledStepKeys: session.stepKeys,
    startedAt: session.startedAt,
    source: "guided" as const,
  };
  const period: PeriodLog = {
    ...current,
    done: current.done.filter((candidate) => candidate !== key),
    skipped: {
      ...(current.skipped ?? {}),
      [key]: { reason, recordedAt: updatedAt },
    },
  };
  return setSessionIndex(
    {
      ...log,
      days: {
        ...log.days,
        [session.date]: { ...day, [session.period]: period },
      },
    },
    nextIndex,
    updatedAt,
  );
}

export function finishRoutineSession(
  log: RoutineLog,
  completedAt: string,
): RoutineLog {
  const session = log.activeSession;
  const period = sessionPeriod(log);
  if (!session || !periodResolved(period)) return log;
  const day = log.days[session.date] ?? {};
  return {
    ...log,
    days: {
      ...log.days,
      [session.date]: {
        ...day,
        [session.period]: { ...period, completedAt, source: "guided" },
      },
    },
    activeSession: undefined,
  };
}

export function abandonRoutineSession(log: RoutineLog): RoutineLog {
  return log.activeSession ? { ...log, activeSession: undefined } : log;
}
