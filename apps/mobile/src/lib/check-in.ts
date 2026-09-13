/**
 * Weekly check-in data: pure types + math, no React. Check-ins are the app's
 * honest data source for trend language — self-reported feel, never inferred
 * severity. One entry per LOCAL calendar day; a same-day re-entry replaces.
 */
import { todayKey, type DateKey } from "./log";

/** 1 = irritated/uncomfortable … 5 = calm & comfortable. */
export type SkinFeel = 1 | 2 | 3 | 4 | 5;

export type BreakoutsLevel = "none" | "few" | "several" | "widespread";

export type IrritationSign =
  | "redness"
  | "itching"
  | "stinging"
  | "dryness_flaking"
  | "burning"
  | "pain"
  | "spreading_rash";

/** How much of the routine the user feels they followed since last time. */
export type AdherenceFeel = "all" | "most" | "some" | "barely";

export interface CheckIn {
  date: DateKey;
  createdAt: string;
  skinFeel: SkinFeel;
  breakouts: BreakoutsLevel;
  /** Empty array = none reported. */
  irritationSigns: IrritationSign[];
  followedRoutine: AdherenceFeel;
  /**
   * RELATIVE file name under the photos/ dir (e.g. "checkin-17517...jpg").
   * Never an absolute URI — iOS app-container paths change across updates.
   */
  photoName?: string;
  note?: string;
}

/** Entries kept sorted ascending by date. */
export interface CheckInLog {
  entries: CheckIn[];
}

export const emptyCheckIns = (): CheckInLog => ({ entries: [] });

/**
 * Coerce a stored or cloud-restored log into the current shape. Without this,
 * a `{}` payload (older build, partial cloud write) reaches `entries.length` at
 * first render of every tab. Entries missing the fields the trend math reads
 * are dropped rather than defaulted — an invented check-in would be a lie.
 */
export function normalizeCheckIns(value: unknown): CheckInLog {
  if (!value || typeof value !== "object") return emptyCheckIns();
  const raw = (value as Partial<CheckInLog>).entries;
  if (!Array.isArray(raw)) return emptyCheckIns();
  const entries = raw.filter((entry): entry is CheckIn => {
    if (!entry || typeof entry !== "object") return false;
    const e = entry as Partial<CheckIn>;
    return (
      typeof e.date === "string" &&
      typeof e.createdAt === "string" &&
      typeof e.skinFeel === "number" &&
      typeof e.breakouts === "string" &&
      Array.isArray(e.irritationSigns)
    );
  });
  entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { entries };
}

/**
 * Ceiling for the optional free-text note.
 *
 * Enforced here rather than only on the TextField because every note ends up in
 * AsyncStorage and then, verbatim, in `checkins.payload` jsonb — which has no
 * length constraint of its own — and pushCheckins re-uploads the entire entries
 * array on every sync, so one pasted megabyte is re-sent on every mutation
 * thereafter. 500 matches the analogous allergy-notes bound the server already
 * applies in apps/web/lib/intake-guard.ts.
 */
export const MAX_NOTE_LENGTH = 500;

/** Immutably add an entry; an entry for the same date replaces the old one. */
export function addCheckIn(log: CheckInLog, entry: CheckIn): CheckInLog {
  const capped: CheckIn =
    entry.note && entry.note.length > MAX_NOTE_LENGTH
      ? { ...entry, note: entry.note.slice(0, MAX_NOTE_LENGTH) }
      : entry;
  const entries = [...log.entries.filter((e) => e.date !== capped.date), capped];
  entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { entries };
}

export function latestCheckIn(log: CheckInLog): CheckIn | undefined {
  return log.entries[log.entries.length - 1];
}

export function previousCheckIn(log: CheckInLog): CheckIn | undefined {
  return log.entries[log.entries.length - 2];
}

/** Whole days from a to b (positive when b is later). Local-calendar safe. */
export function daysBetween(a: DateKey, b: DateKey): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const ms = new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime();
  return Math.round(ms / 86_400_000);
}

export const CHECK_IN_CADENCE_DAYS = 7;

/**
 * Due immediately when there is no self-report yet (the initial scan remains
 * the visual baseline), then every 7 days from the latest entry.
 */
export function checkInDue(log: CheckInLog, today: DateKey = todayKey()): boolean {
  const latest = latestCheckIn(log);
  if (!latest) return true;
  return daysBetween(latest.date, today) >= CHECK_IN_CADENCE_DAYS;
}

/** 0 when due now. */
export function daysUntilDue(log: CheckInLog, today: DateKey = todayKey()): number {
  const latest = latestCheckIn(log);
  if (!latest) return 0;
  return Math.max(0, CHECK_IN_CADENCE_DAYS - daysBetween(latest.date, today));
}

/** Signs that warrant a calm "consider professional care" nudge. */
export const RED_FLAG_SIGNS: IrritationSign[] = ["burning", "pain", "spreading_rash"];

export function hasRedFlags(entry?: CheckIn): boolean {
  return !!entry && entry.irritationSigns.some((s) => RED_FLAG_SIGNS.includes(s));
}
