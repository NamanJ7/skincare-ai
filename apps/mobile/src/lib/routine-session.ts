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

/**
 * How far in the future a session's start may sit before it counts as expired.
 * A clock set backwards otherwise leaves negative elapsed time, which never
 * crosses the resume window, so the session would resume forever. The slack
 * absorbs ordinary network time corrections without expiring a live session.
 */
export const ROUTINE_SESSION_CLOCK_SKEW_MS = 5 * 60 * 1000;

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
  if (!Number.isFinite(started)) return true;
  const elapsed = now.getTime() - started;
  return (
    elapsed > ROUTINE_SESSION_RESUME_MS ||
    elapsed < -ROUTINE_SESSION_CLOCK_SKEW_MS
  );
}

/**
 * What opening Guided Mode should do, given what is already persisted.
 *
 * - `expire`: the active session is past its resume window; close it without
 *   recording completion.
 * - `switch`: the caller asked for a specific period (a reminder tap, an
 *   explicit button) and a different period is live. Closing the live session
 *   loses nothing, since its outcomes are stored per step in the day log, and
 *   the notified routine starts. No chooser: two live sessions only overlap at
 *   the edges of the resume window, and a dialog on a cold-start tap costs
 *   more than it saves.
 * - `resume`: continue the live session. This includes a PM session that has
 *   crossed midnight, which stays on its original date.
 * - `completed`: this period was already finished today; show a quiet
 *   completed state instead of a second session over the same steps.
 * - `none`: nothing is scheduled for this period today.
 * - `start`: begin a new session.
 */
export type RoutineSessionEntry =
  | "expire"
  | "switch"
  | "resume"
  | "completed"
  | "none"
  | "start";

export function routineSessionEntry(input: {
  session: ActiveRoutineSession | undefined;
  requested: RoutinePeriod;
  explicit: boolean;
  todayPeriod: PeriodLog | undefined;
  dueCount: number;
  now: Date;
}): RoutineSessionEntry {
  const { session } = input;
  if (session) {
    if (routineSessionExpired(session, input.now)) return "expire";
    if (input.explicit && session.period !== input.requested) return "switch";
    return "resume";
  }
  if (input.todayPeriod?.completedAt) return "completed";
  return input.dueCount === 0 ? "none" : "start";
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
