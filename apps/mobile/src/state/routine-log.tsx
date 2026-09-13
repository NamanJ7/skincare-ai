/** Persisted per-day routine check-off log + derived streak/consistency. */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Routine } from "@pore/shared";

import {
  consistency,
  emptyLog,
  normalizeLog,
  streakFrom,
  todayKey,
  toggleStep,
  withRoutineRevision,
  withStepOwnership,
  type DateKey,
  type DayLog,
  type RoutineRevision,
  type RoutineLog,
  type RoutinePeriod,
  type RoutineSessionSource,
  type RoutineStepSkipReason,
} from "@/lib/log";
import {
  abandonRoutineSession,
  finishRoutineSession,
  recordSessionDone,
  recordSessionSkip,
  routineSessionExpired,
  setSessionIndex,
  startRoutineSession,
} from "@/lib/routine-session";
import { remove, save } from "@/lib/storage";

interface RoutineLogContextValue {
  log: RoutineLog;
  toggle: (
    period: RoutinePeriod,
    stepKey: string,
    total: number,
    date?: DateKey,
    scheduledStepKeys?: string[],
  ) => Promise<boolean>;
  ensureSchedule: (
    fingerprint: string,
    anchorDate: DateKey,
  ) => Promise<boolean>;
  startSession: (input: {
    date: DateKey;
    period: RoutinePeriod;
    source: RoutineSessionSource;
    routineFingerprint: string;
    stepKeys: string[];
  }) => Promise<boolean>;
  resumeSession: () => boolean;
  setStepDone: (stepKey: string, nextIndex: number) => Promise<boolean>;
  skipStep: (
    stepKey: string,
    reason: RoutineStepSkipReason,
    nextIndex: number,
  ) => Promise<boolean>;
  goToSessionStep: (index: number) => Promise<boolean>;
  finishSession: () => Promise<boolean>;
  abandonExpiredSession: (now?: Date) => Promise<boolean>;
  abandonSession: () => Promise<boolean>;
  acceptRevision: (revision: RoutineRevision, revisedRoutine?: Routine) => void;
  markStepNotOwned: (stepKey: string) => void;
  clearStepOwnership: (stepKey: string) => void;
  dayLog: (date: DateKey) => DayLog | undefined;
  streak: number;
  consistency7d: number;
  clear: () => void;
}

const RoutineLogContext = createContext<RoutineLogContextValue | null>(null);

export function RoutineLogProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: RoutineLog;
}) {
  // Normalize before first render: `log.days[today]` and the date-walking
  // streak helpers both assume well-formed keys.
  const [log, setLog] = useState<RoutineLog>(() =>
    initial ? normalizeLog(initial) : emptyLog(),
  );
  const logRef = useRef(log);

  const commit = useCallback(
    async (
      transform: (current: RoutineLog) => RoutineLog,
    ): Promise<boolean> => {
      const previous = logRef.current;
      const next = transform(previous);
      if (next === previous) return true;
      logRef.current = next;
      setLog(next);
      const persisted = await save("log", next);
      if (!persisted && logRef.current === next) {
        logRef.current = previous;
        setLog(previous);
      }
      return persisted;
    },
    [],
  );

  const value = useMemo<RoutineLogContextValue>(() => {
    const today = todayKey();
    return {
      log,
      toggle: (period, key, total, date = todayKey(), scheduledStepKeys) =>
        commit((current) =>
          toggleStep(
            current,
            date,
            period,
            key,
            total,
            scheduledStepKeys,
            new Date().toISOString(),
          ),
        ),
      ensureSchedule: (fingerprint, anchorDate) =>
        commit((current) =>
          current.schedule?.fingerprint === fingerprint
            ? current
            : { ...current, schedule: { fingerprint, anchorDate } },
        ),
      startSession: ({
        date,
        period,
        source,
        routineFingerprint,
        stepKeys,
      }) => {
        const startedAt = new Date().toISOString();
        return commit((current) =>
          startRoutineSession(current, {
            id: `${date}-${period}-${Date.now()}`,
            date,
            period,
            source,
            routineFingerprint,
            stepKeys,
            startedAt,
          }),
        );
      },
      resumeSession: () =>
        !!log.activeSession && !routineSessionExpired(log.activeSession),
      setStepDone: (key, nextIndex) =>
        commit((current) =>
          recordSessionDone(current, key, nextIndex, new Date().toISOString()),
        ),
      skipStep: (key, reason, nextIndex) =>
        commit((current) =>
          recordSessionSkip(
            current,
            key,
            reason,
            nextIndex,
            new Date().toISOString(),
          ),
        ),
      goToSessionStep: (index) =>
        commit((current) =>
          setSessionIndex(current, index, new Date().toISOString()),
        ),
      finishSession: () =>
        commit((current) =>
          finishRoutineSession(current, new Date().toISOString()),
        ),
      abandonExpiredSession: (now = new Date()) =>
        commit((current) =>
          current.activeSession &&
          routineSessionExpired(current.activeSession, now)
            ? abandonRoutineSession(current)
            : current,
        ),
      abandonSession: () => commit(abandonRoutineSession),
      acceptRevision: (revision, revisedRoutine) => {
        void commit((current) =>
          withRoutineRevision(current, revision, revisedRoutine),
        );
      },
      markStepNotOwned: (key) => {
        void commit((current) => withStepOwnership(current, key, "not_owned"));
      },
      clearStepOwnership: (key) => {
        void commit((current) => withStepOwnership(current, key, undefined));
      },
      dayLog: (date) => log.days[date],
      streak: streakFrom(log, today),
      consistency7d: consistency(log, today, 7),
      clear: () => {
        remove("log");
        const next = emptyLog();
        logRef.current = next;
        setLog(next);
      },
    };
  }, [commit, log]);

  return (
    <RoutineLogContext.Provider value={value}>
      {children}
    </RoutineLogContext.Provider>
  );
}

export function useRoutineLog(): RoutineLogContextValue {
  const ctx = useContext(RoutineLogContext);
  if (!ctx)
    throw new Error("useRoutineLog must be used within a RoutineLogProvider");
  return ctx;
}
