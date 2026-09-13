/** Persisted per-day routine check-off log + derived streak/consistency. */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
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
} from "@/lib/log";
import { remove, save } from "@/lib/storage";

interface RoutineLogContextValue {
  log: RoutineLog;
  toggle: (period: RoutinePeriod, stepKey: string, total: number, date?: DateKey) => void;
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

  const value = useMemo<RoutineLogContextValue>(() => {
    const today = todayKey();
    return {
      log,
      toggle: (period, key, total, date = todayKey()) =>
        setLog((prev) => {
          const next = toggleStep(prev, date, period, key, total);
          save("log", next);
          return next;
        }),
      acceptRevision: (revision, revisedRoutine) =>
        setLog((prev) => {
          const next = withRoutineRevision(prev, revision, revisedRoutine);
          save("log", next);
          return next;
        }),
      markStepNotOwned: (key) =>
        setLog((prev) => {
          const next = withStepOwnership(prev, key, "not_owned");
          save("log", next);
          return next;
        }),
      clearStepOwnership: (key) =>
        setLog((prev) => {
          const next = withStepOwnership(prev, key, undefined);
          save("log", next);
          return next;
        }),
      dayLog: (date) => log.days[date],
      streak: streakFrom(log, today),
      consistency7d: consistency(log, today, 7),
      clear: () => {
        remove("log");
        setLog(emptyLog());
      },
    };
  }, [log]);

  return <RoutineLogContext.Provider value={value}>{children}</RoutineLogContext.Provider>;
}

export function useRoutineLog(): RoutineLogContextValue {
  const ctx = useContext(RoutineLogContext);
  if (!ctx) throw new Error("useRoutineLog must be used within a RoutineLogProvider");
  return ctx;
}
