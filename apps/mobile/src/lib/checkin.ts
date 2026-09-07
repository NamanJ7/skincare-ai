/**
 * When the next check-in is due.
 *
 * Twenty-eight days is not arbitrary and not a growth lever: it is roughly one
 * skin-turnover cycle, it matches the 4-6 week language the routine's own ramp
 * schedules use, and it is the same floor `compareAssessments` refuses to read
 * below. Prompting sooner would invite a comparison the engine would then
 * decline to make.
 */
export const CHECK_IN_DAYS = 28;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days since an ISO timestamp, or null if it can't be read. */
export function daysSince(iso: string, now = Date.now()): number | null {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((now - then) / DAY_MS);
}

/** Days remaining until the next check-in is due; 0 when it already is. */
export function daysUntilCheckIn(lastCheckInAt: string, now = Date.now()): number | null {
  const since = daysSince(lastCheckInAt, now);
  if (since === null) return null;
  return Math.max(0, CHECK_IN_DAYS - since);
}
