/** Pure reminder preferences and scheduling shapes. Native adaptation lives in notifications.ts. */
export type ReminderType = "am" | "pm" | "weekly" | "sunscreen";

export interface TimePref {
  enabled: boolean;
  hour: number;
  minute: number;
}

export interface WeeklyPref extends TimePref {
  /** 1 = Sunday ... 7 = Saturday, matching Expo's notification trigger convention. */
  weekday: number;
}

export interface ReminderDismissal {
  date: string;
  kinds: string[];
}

export interface ReminderPrefs {
  optIn: boolean;
  am: TimePref;
  pm: TimePref;
  weekly: WeeklyPref;
  sunscreen: TimePref;
  dismissed?: ReminderDismissal;
}

export type PermissionState = "unknown" | "undetermined" | "granted" | "denied";
export type ReminderPlatform = "ios" | "android";

export interface ReminderContent {
  title: string;
  body: string;
  data: { type: ReminderType };
}

export type ReminderTrigger =
  | { type: "daily"; hour: number; minute: number }
  | { type: "weekly"; weekday: number; hour: number; minute: number }
  | { type: "calendar"; weekday: number; hour: number; minute: number; repeats: true };

export interface ReminderRequest {
  identifier: string;
  type: ReminderType;
  content: ReminderContent;
  trigger: ReminderTrigger;
}

export const REMINDER_TYPES: readonly ReminderType[] = ["am", "pm", "weekly", "sunscreen"];

export function defaultReminderPrefs(): ReminderPrefs {
  return {
    optIn: false,
    am: { enabled: true, hour: 8, minute: 0 },
    pm: { enabled: true, hour: 21, minute: 0 },
    weekly: { enabled: true, weekday: 1, hour: 18, minute: 0 },
    sunscreen: { enabled: false, hour: 12, minute: 0 },
  };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, Math.round(value)))
    : fallback;
}

function normalizeTime(value: unknown, fallback: TimePref): TimePref {
  const raw = record(value);
  if (!raw) return { ...fallback };
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : fallback.enabled,
    hour: boundedNumber(raw.hour, fallback.hour, 0, 23),
    minute: boundedNumber(raw.minute, fallback.minute, 0, 59),
  };
}

/** Tolerates partial or legacy storage without ever letting invalid trigger values escape. */
export function normalizeReminderPrefs(value: unknown): ReminderPrefs {
  const fallback = defaultReminderPrefs();
  const raw = record(value);
  if (!raw) return fallback;

  const weeklyRaw = record(raw.weekly);
  const weeklyTime = normalizeTime(raw.weekly, fallback.weekly);
  const dismissedRaw = record(raw.dismissed);
  const dismissed =
    typeof dismissedRaw?.date === "string" && Array.isArray(dismissedRaw.kinds)
      ? {
          date: dismissedRaw.date,
          kinds: Array.from(
            new Set(dismissedRaw.kinds.filter((kind): kind is string => typeof kind === "string")),
          ),
        }
      : undefined;

  return {
    optIn: typeof raw.optIn === "boolean" ? raw.optIn : fallback.optIn,
    am: normalizeTime(raw.am, fallback.am),
    pm: normalizeTime(raw.pm, fallback.pm),
    weekly: {
      ...weeklyTime,
      weekday: boundedNumber(weeklyRaw?.weekday, fallback.weekly.weekday, 1, 7),
    },
    sunscreen: normalizeTime(raw.sunscreen, fallback.sunscreen),
    ...(dismissed ? { dismissed } : {}),
  };
}

export function reminderIdentifier(type: ReminderType): string {
  return `reminder:${type}`;
}

export const ALL_REMINDER_IDENTIFIERS = REMINDER_TYPES.map(reminderIdentifier);

export function reminderContent(type: ReminderType): ReminderContent {
  const copy: Record<ReminderType, Omit<ReminderContent, "data">> = {
    am: { title: "A gentle start", body: "Your morning routine is ready when you are." },
    pm: {
      title: "A calm close to the day",
      body: "A few evening steps can keep your routine moving.",
    },
    weekly: {
      title: "How has your skin felt?",
      body: "Your weekly check-in takes about a minute.",
    },
    sunscreen: {
      title: "A little sunscreen check",
      body: "If you are outdoors, it may be time to reapply.",
    },
  };
  return { ...copy[type], data: { type } };
}

export function reminderTrigger(
  type: ReminderType,
  prefs: ReminderPrefs,
  platform: ReminderPlatform,
): ReminderTrigger {
  if (type === "weekly") {
    const { weekday, hour, minute } = prefs.weekly;
    return platform === "ios"
      ? { type: "calendar", weekday, hour, minute, repeats: true }
      : { type: "weekly", weekday, hour, minute };
  }
  const { hour, minute } = prefs[type];
  return { type: "daily", hour, minute };
}

export function effectiveReminders(
  prefs: ReminderPrefs,
  permissionGranted: boolean,
  platform: ReminderPlatform = "ios",
): ReminderRequest[] {
  if (!prefs.optIn || !permissionGranted) return [];
  return REMINDER_TYPES.filter((type) => prefs[type].enabled).map((type) => ({
    identifier: reminderIdentifier(type),
    type,
    content: reminderContent(type),
    trigger: reminderTrigger(type, prefs, platform),
  }));
}

export function parseReminderTap(data: unknown): ReminderType | null {
  const raw = record(data);
  return REMINDER_TYPES.includes(raw?.type as ReminderType) ? (raw?.type as ReminderType) : null;
}

export function reminderHref(type: ReminderType): string {
  if (type === "am" || type === "pm") return `/(tabs)/routine?period=${type}`;
  if (type === "weekly") return "/check-in";
  return "/(tabs)";
}

/** Index 0 is intentionally blank so stored weekday numbers can index directly. */
export const WEEKDAY_LABELS = ["", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function formatReminderTime(hour: number, minute: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const clockHour = hour % 12 || 12;
  return `${clockHour}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function isDismissed(prefs: ReminderPrefs, today: string, kind: string): boolean {
  return prefs.dismissed?.date === today && prefs.dismissed.kinds.includes(kind);
}

/** A new calendar day replaces the old record, keeping dismissal storage self-pruning. */
export function withDismissal(prefs: ReminderPrefs, today: string, kind: string): ReminderPrefs {
  const kinds = prefs.dismissed?.date === today ? prefs.dismissed.kinds : [];
  return {
    ...prefs,
    dismissed: { date: today, kinds: kinds.includes(kind) ? kinds : [...kinds, kind] },
  };
}
