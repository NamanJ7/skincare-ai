/** Persisted reminder preferences plus live OS permission state. */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { AdjustmentKind } from "@/lib/adjustments";
import { getPermissionStatus } from "@/lib/notifications";
import {
  defaultReminderPrefs,
  normalizeReminderPrefs,
  withDismissal,
  type PermissionState,
  type ReminderPrefs,
  type ReminderType,
} from "@/lib/reminders";
import { remove, save } from "@/lib/storage";

interface RemindersContextValue {
  prefs: ReminderPrefs;
  permission: PermissionState;
  setOptIn: (enabled: boolean) => void;
  setTypeEnabled: (type: ReminderType, enabled: boolean) => void;
  setTime: (type: ReminderType, hour: number, minute: number) => void;
  setWeeklyDay: (weekday: number) => void;
  dismissAdjustment: (kind: AdjustmentKind, today: string) => void;
  refreshPermission: () => Promise<PermissionState>;
  clear: () => void;
}

const RemindersContext = createContext<RemindersContextValue | null>(null);

export function RemindersProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: ReminderPrefs;
}) {
  const [prefs, setPrefs] = useState<ReminderPrefs>(() => normalizeReminderPrefs(initial));
  const [permission, setPermission] = useState<PermissionState>("unknown");

  const mutate = useCallback((build: (current: ReminderPrefs) => ReminderPrefs) => {
    setPrefs((current) => {
      const next = normalizeReminderPrefs(build(current));
      save("reminders", next);
      return next;
    });
  }, []);

  const refreshPermission = useCallback(async () => {
    const next = await getPermissionStatus();
    setPermission(next);
    return next;
  }, []);

  const value = useMemo<RemindersContextValue>(
    () => ({
      prefs,
      permission,
      setOptIn: (enabled) => mutate((current) => ({ ...current, optIn: enabled })),
      setTypeEnabled: (type, enabled) =>
        mutate((current) => ({
          ...current,
          optIn: enabled ? true : current.optIn,
          [type]: { ...current[type], enabled },
        })),
      setTime: (type, hour, minute) =>
        mutate((current) => ({
          ...current,
          [type]: { ...current[type], hour, minute },
        })),
      setWeeklyDay: (weekday) =>
        mutate((current) => ({
          ...current,
          weekly: { ...current.weekly, weekday },
        })),
      dismissAdjustment: (kind, today) => mutate((current) => withDismissal(current, today, kind)),
      refreshPermission,
      clear: () => {
        remove("reminders");
        setPrefs(defaultReminderPrefs());
      },
    }),
    [mutate, permission, prefs, refreshPermission],
  );

  return <RemindersContext.Provider value={value}>{children}</RemindersContext.Provider>;
}

export function useReminders(): RemindersContextValue {
  const ctx = useContext(RemindersContext);
  if (!ctx) throw new Error("useReminders must be used within a RemindersProvider");
  return ctx;
}
