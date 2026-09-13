/** Persisted weekly check-ins + derived due state. */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import {
  addCheckIn,
  checkInDue,
  daysUntilDue,
  emptyCheckIns,
  latestCheckIn,
  normalizeCheckIns,
  type CheckIn,
  type CheckInLog,
} from "@/lib/check-in";
import { todayKey, type DateKey } from "@/lib/log";
import { remove, save } from "@/lib/storage";

interface CheckInsContextValue {
  checkIns: CheckInLog;
  add: (entry: Omit<CheckIn, "date" | "createdAt">, date?: DateKey) => void;
  latest: CheckIn | undefined;
  due: boolean;
  daysUntilDue: number;
  clear: () => void;
}

const CheckInsContext = createContext<CheckInsContextValue | null>(null);

export function CheckInsProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: CheckInLog;
}) {
  // Normalize before first render: `checkIns.entries.length` is read by the
  // Home tab, and a `{}` payload from an older build would throw there.
  const [checkIns, setCheckIns] = useState<CheckInLog>(() =>
    initial ? normalizeCheckIns(initial) : emptyCheckIns(),
  );

  const value = useMemo<CheckInsContextValue>(
    () => ({
      checkIns,
      add: (entry, date = todayKey()) =>
        setCheckIns((prev) => {
          const next = addCheckIn(prev, { ...entry, date, createdAt: new Date().toISOString() });
          save("checkins", next);
          return next;
        }),
      latest: latestCheckIn(checkIns),
      due: checkInDue(checkIns),
      daysUntilDue: daysUntilDue(checkIns),
      clear: () => {
        remove("checkins");
        setCheckIns(emptyCheckIns());
      },
    }),
    [checkIns],
  );

  return <CheckInsContext.Provider value={value}>{children}</CheckInsContext.Provider>;
}

export function useCheckIns(): CheckInsContextValue {
  const ctx = useContext(CheckInsContext);
  if (!ctx) throw new Error("useCheckIns must be used within a CheckInsProvider");
  return ctx;
}
