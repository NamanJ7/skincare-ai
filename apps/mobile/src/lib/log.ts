/**
 * Routine completion log: pure data + math, no React. Dates are LOCAL
 * "YYYY-MM-DD" keys (a routine done at 11pm belongs to that calendar day, so
 * never derive keys via toISOString(), which is UTC).
 */
import type { Routine, RoutineStep } from "@pore/shared";

export type RoutinePeriod = "am" | "pm";
export type DateKey = string;

export type RoutineSessionSource = "home" | "routine" | "reminder";
export type RoutineStepSkipReason =
  | "not_owned"
  | "ran_out"
  | "skin_sensitive"
  | "not_now";

export interface RoutineStepSkip {
  reason: RoutineStepSkipReason;
  recordedAt: string;
}

export interface PeriodLog {
  /** Step keys checked off. */
  done: string[];
  /**
   * Step count of the plan at logging time. Snapshotting keeps historical
   * completion fractions correct even after a re-scan changes the plan.
   */
  total: number;
  /** Exact scheduled step instances for this date and period. */
  scheduledStepKeys?: string[];
  /** Explicit skips never count as completion. */
  skipped?: Record<string, RoutineStepSkip>;
  startedAt?: string;
  /** Set when every scheduled step has an explicit done/skip outcome. */
  completedAt?: string;
  source?: "guided" | "quick";
}

export interface DayLog {
  am?: PeriodLog;
  pm?: PeriodLog;
}

export type RoutineRevisionKind =
  | "pause_strong_actives"
  | "simplify_today"
  | "small_win";

/** A user-accepted, visible routine change rather than a decorative card. */
export interface RoutineRevision {
  kind: RoutineRevisionKind;
  acceptedAt: string;
  effectiveDate: DateKey;
  period?: RoutinePeriod;
  reason: string;
}

export type StepOwnership = "not_owned";

export interface RoutineLog {
  days: Record<DateKey, DayLog>;
  revision?: RoutineRevision;
  /** Stable routine step key -> explicit ownership answer. */
  stepOwnership?: Record<string, StepOwnership>;
  schedule?: RoutineSchedule;
  activeSession?: ActiveRoutineSession;
}

export interface RoutineSchedule {
  fingerprint: string;
  anchorDate: DateKey;
}

export interface ActiveRoutineSession {
  id: string;
  date: DateKey;
  period: RoutinePeriod;
  source: RoutineSessionSource;
  routineFingerprint: string;
  stepKeys: string[];
  /** `stepKeys.length` is the review screen after every step has an outcome. */
  currentIndex: number;
  startedAt: string;
  updatedAt: string;
}

export const emptyLog = (): RoutineLog => ({ days: {} });

function normalizePeriod(value: unknown): PeriodLog | undefined {
  if (!value || typeof value !== "object") return undefined;
  const { done, total } = value as { done?: unknown; total?: unknown };
  if (
    !Array.isArray(done) ||
    typeof total !== "number" ||
    !Number.isFinite(total)
  ) {
    return undefined;
  }
  const period: PeriodLog = {
    done: done.filter((key): key is string => typeof key === "string"),
    total: Math.max(0, Math.floor(total)),
  };
  const raw = value as Partial<PeriodLog>;
  if (Array.isArray(raw.scheduledStepKeys)) {
    period.scheduledStepKeys = raw.scheduledStepKeys.filter(
      (key): key is string => typeof key === "string",
    );
  }
  if (raw.skipped && typeof raw.skipped === "object") {
    const skipped: Record<string, RoutineStepSkip> = {};
    for (const [key, entry] of Object.entries(raw.skipped)) {
      if (!entry || typeof entry !== "object") continue;
      const candidate = entry as Partial<RoutineStepSkip>;
      if (
        typeof candidate.recordedAt === "string" &&
        ["not_owned", "ran_out", "skin_sensitive", "not_now"].includes(
          candidate.reason ?? "",
        )
      ) {
        skipped[key] = candidate as RoutineStepSkip;
      }
    }
    if (Object.keys(skipped).length > 0) period.skipped = skipped;
  }
  if (typeof raw.startedAt === "string") period.startedAt = raw.startedAt;
  if (typeof raw.completedAt === "string") period.completedAt = raw.completedAt;
  if (raw.source === "guided" || raw.source === "quick") {
    period.source = raw.source;
  }
  return period;
}

function normalizeSchedule(value: unknown): RoutineSchedule | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<RoutineSchedule>;
  return typeof candidate.fingerprint === "string" &&
    candidate.fingerprint.length > 0 &&
    isDateKey(candidate.anchorDate)
    ? {
        fingerprint: candidate.fingerprint,
        anchorDate: candidate.anchorDate,
      }
    : undefined;
}

function normalizeActiveSession(
  value: unknown,
): ActiveRoutineSession | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Partial<ActiveRoutineSession>;
  if (
    typeof candidate.id !== "string" ||
    candidate.id.length === 0 ||
    !isDateKey(candidate.date) ||
    (candidate.period !== "am" && candidate.period !== "pm") ||
    !["home", "routine", "reminder"].includes(candidate.source ?? "") ||
    typeof candidate.routineFingerprint !== "string" ||
    candidate.routineFingerprint.length === 0 ||
    !Array.isArray(candidate.stepKeys) ||
    candidate.stepKeys.length === 0 ||
    !candidate.stepKeys.every((key) => typeof key === "string") ||
    new Set(candidate.stepKeys).size !== candidate.stepKeys.length ||
    typeof candidate.currentIndex !== "number" ||
    !Number.isFinite(candidate.currentIndex) ||
    typeof candidate.startedAt !== "string" ||
    !Number.isFinite(Date.parse(candidate.startedAt)) ||
    typeof candidate.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(candidate.updatedAt))
  ) {
    return undefined;
  }
  return {
    id: candidate.id,
    date: candidate.date,
    period: candidate.period,
    source: candidate.source as RoutineSessionSource,
    routineFingerprint: candidate.routineFingerprint,
    stepKeys: candidate.stepKeys,
    currentIndex: Math.max(
      0,
      Math.min(candidate.stepKeys.length, Math.floor(candidate.currentIndex)),
    ),
    startedAt: candidate.startedAt,
    updatedAt: candidate.updatedAt,
  };
}

/**
 * Coerce a stored or cloud-restored log (written by an older build, or absent
 * entirely) into the current shape. Same contract as `normalizeProfile`: keep
 * everything recognizable, drop what isn't.
 *
 * Malformed day keys are dropped rather than kept, because `shiftKey` cannot
 * walk backward from one — the streak/lapse helpers below all iterate by date.
 */
export function normalizeLog(value: unknown): RoutineLog {
  if (!value || typeof value !== "object") return emptyLog();
  const stored = value as Partial<RoutineLog>;
  const days: Record<DateKey, DayLog> = {};
  if (stored.days && typeof stored.days === "object") {
    for (const [key, day] of Object.entries(stored.days)) {
      if (!isDateKey(key) || !day || typeof day !== "object") continue;
      const am = normalizePeriod((day as DayLog).am);
      const pm = normalizePeriod((day as DayLog).pm);
      if (am || pm)
        days[key] = { ...(am ? { am } : {}), ...(pm ? { pm } : {}) };
    }
  }
  const log: RoutineLog = { days };
  if (stored.revision && typeof stored.revision === "object") {
    log.revision = stored.revision;
  }
  if (stored.stepOwnership && typeof stored.stepOwnership === "object") {
    log.stepOwnership = stored.stepOwnership;
  }
  const schedule = normalizeSchedule(stored.schedule);
  if (schedule) log.schedule = schedule;
  const activeSession = normalizeActiveSession(stored.activeSession);
  if (activeSession) log.activeSession = activeSession;
  return log;
}

export function todayKey(now = new Date()): DateKey {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Stable identity for a step across plan regenerations.
 *
 * Deliberately excludes `order`. Two inert steps of the same category in one
 * period (a double cleanse, a second moisturizer) do collide here, sharing a
 * React key and a check-off — but adding `order` to disambiguate them would
 * break the stability this key exists to provide: every stored completion is
 * keyed this way, so it would orphan the user's whole history, and any plan
 * regeneration that reorders a step would orphan it again. Fixing the collision
 * needs an occurrence suffix applied only on an actual duplicate, plus a
 * migration for existing logs.
 */
export function stepKey(step: RoutineStep): string {
  return `${step.category}:${step.active ?? "base"}`;
}

export interface RoutineStepInstance {
  step: RoutineStep;
  key: string;
  index: number;
}

/**
 * Stable, occurrence-aware identities for a whole period. The first occurrence
 * deliberately keeps the legacy key so existing completion history remains
 * attached after this migration.
 */
export function routineStepInstances(
  steps: readonly RoutineStep[],
): RoutineStepInstance[] {
  const occurrences = new Map<string, number>();
  return steps.map((step, index) => {
    const base = stepKey(step);
    const occurrence = (occurrences.get(base) ?? 0) + 1;
    occurrences.set(base, occurrence);
    return {
      step,
      index,
      key: occurrence === 1 ? base : `${base}#${occurrence}`,
    };
  });
}

/** Immutably toggle one step's checked state for a given day + period. */
export function toggleStep(
  log: RoutineLog,
  date: DateKey,
  period: RoutinePeriod,
  key: string,
  total: number,
  scheduledStepKeys?: string[],
  updatedAt?: string,
): RoutineLog {
  const day = log.days[date] ?? {};
  const current = day[period] ?? { done: [], total };
  const wasDone = current.done.includes(key);
  const done = wasDone
    ? current.done.filter((k) => k !== key)
    : [...current.done, key];
  const skipped = { ...(current.skipped ?? {}) };
  if (!wasDone) delete skipped[key];
  const keys = scheduledStepKeys ?? current.scheduledStepKeys;
  const fullyDone =
    !!keys &&
    keys.length > 0 &&
    keys.every((candidate) => done.includes(candidate));
  const nextPeriod: PeriodLog = {
    ...current,
    done,
    total: keys?.length ?? total,
    ...(keys ? { scheduledStepKeys: keys } : {}),
    ...(Object.keys(skipped).length > 0 ? { skipped } : { skipped: undefined }),
    ...(updatedAt
      ? {
          source: "quick" as const,
          startedAt: current.startedAt ?? updatedAt,
          completedAt: fullyDone ? updatedAt : undefined,
        }
      : {}),
  };
  return {
    ...log,
    days: {
      ...log.days,
      [date]: { ...day, [period]: nextPeriod },
    },
  };
}

export function withRoutineRevision(
  log: RoutineLog,
  revision: RoutineRevision,
  revisedRoutine?: Routine,
): RoutineLog {
  if (!revisedRoutine) return { ...log, revision };
  const day = log.days[revision.effectiveDate];
  if (!day) return { ...log, revision };

  const reconcile = (period: RoutinePeriod): PeriodLog | undefined => {
    const current = day[period];
    if (!current) return undefined;
    const valid = new Set(
      routineStepInstances(revisedRoutine[period]).map(({ key }) => key),
    );
    const scheduledStepKeys = current.scheduledStepKeys?.filter((key) =>
      valid.has(key),
    );
    const skipped = Object.fromEntries(
      Object.entries(current.skipped ?? {}).filter(([key]) => valid.has(key)),
    );
    return {
      ...current,
      done: current.done.filter((key) => valid.has(key)),
      total: scheduledStepKeys?.length ?? valid.size,
      ...(scheduledStepKeys ? { scheduledStepKeys } : {}),
      ...(Object.keys(skipped).length > 0
        ? { skipped }
        : { skipped: undefined }),
    };
  };
  return {
    ...log,
    revision,
    days: {
      ...log.days,
      [revision.effectiveDate]: {
        ...day,
        ...(day.am ? { am: reconcile("am") } : {}),
        ...(day.pm ? { pm: reconcile("pm") } : {}),
      },
    },
  };
}

export function withStepOwnership(
  log: RoutineLog,
  key: string,
  ownership: StepOwnership | undefined,
): RoutineLog {
  const stepOwnership = { ...(log.stepOwnership ?? {}) };
  if (ownership) stepOwnership[key] = ownership;
  else delete stepOwnership[key];
  return {
    ...log,
    ...(Object.keys(stepOwnership).length > 0
      ? { stepOwnership }
      : { stepOwnership: undefined }),
  };
}

export function periodComplete(p?: PeriodLog): boolean {
  if (!p || p.total <= 0) return false;
  if (p.scheduledStepKeys?.length) {
    return p.scheduledStepKeys.every((key) => p.done.includes(key));
  }
  return p.done.length >= p.total;
}

/** Fraction of logged steps done across whichever periods have entries. */
export function dayFraction(d?: DayLog): number {
  if (!d) return 0;
  const periods = [d.am, d.pm].filter(
    (p): p is PeriodLog => !!p && p.total > 0,
  );
  if (periods.length === 0) return 0;
  const done = periods.reduce(
    (n, p) =>
      n +
      Math.min(
        p.scheduledStepKeys?.length
          ? p.scheduledStepKeys.filter((key) => p.done.includes(key)).length
          : p.done.length,
        p.total,
      ),
    0,
  );
  const total = periods.reduce((n, p) => n + p.total, 0);
  return done / total;
}

/** True for a well-formed local "YYYY-MM-DD" key that names a real date. */
export function isDateKey(value: unknown): value is DateKey {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(y, m - 1, d);
  // Rejects overflow like "2026-02-31", which Date would silently roll forward.
  return (
    date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
    date.getDate() === d
  );
}

export function shiftKey(date: DateKey, days: number): DateKey {
  // A malformed key must not become another malformed key: `todayKey` of an
  // Invalid Date yields "NaN-NaN-NaN", which shiftKey then maps to itself —
  // a fixed point that turns the walk-backward loops below into infinite ones.
  if (!isDateKey(date)) return date;
  const [y, m, d] = date.split("-").map(Number);
  return todayKey(new Date(y, m - 1, d + days));
}

function dayComplete(d?: DayLog): boolean {
  return !!d && (periodComplete(d.am) || periodComplete(d.pm));
}

/**
 * Consecutive days (walking backward) with at least one fully-completed
 * period. An incomplete *today* doesn't zero the streak — it just isn't
 * counted yet.
 */
export function streakFrom(log: RoutineLog, today: DateKey): number {
  let streak = 0;
  let cursor = dayComplete(log.days[today]) ? today : shiftKey(today, -1);
  while (dayComplete(log.days[cursor])) {
    streak += 1;
    const next = shiftKey(cursor, -1);
    // shiftKey is identity on an unparseable key, so a stored key like
    // "NaN-NaN-NaN" would otherwise spin here forever and freeze the JS thread.
    if (next === cursor) break;
    cursor = next;
  }
  return streak;
}

/**
 * Yesterday's routine was missed, but some day in the prior week was done —
 * a lapsed (not brand-new) user, who gets recovery copy instead of shame.
 */
export function missedYesterday(log: RoutineLog, today: DateKey): boolean {
  if (dayComplete(log.days[shiftKey(today, -1)])) return false;
  for (let i = 2; i <= 8; i++) {
    if (dayComplete(log.days[shiftKey(today, -i)])) return true;
  }
  return false;
}

/** Days in the trailing window with at least one fully-completed period. */
export function completedDayCount(
  log: RoutineLog,
  today: DateKey,
  days = 7,
): number {
  let count = 0;
  for (let i = 0; i < days; i++) {
    if (dayComplete(log.days[shiftKey(today, -i)])) count += 1;
  }
  return count;
}

/** Mean dayFraction over the trailing window (unlogged days count as 0). */
export function consistency(log: RoutineLog, today: DateKey, days = 7): number {
  let sum = 0;
  for (let i = 0; i < days; i++) {
    sum += dayFraction(log.days[shiftKey(today, -i)]);
  }
  return sum / days;
}

/** One cell of the trailing-week consistency strip. */
export interface WeekDay {
  dateKey: DateKey;
  /** True for the rightmost cell (today). */
  isToday: boolean;
  /** At least one period was fully completed that day. */
  complete: boolean;
}

/**
 * The trailing 7 days ending today, oldest → newest, for the `WeekStrip`
 * visual. Uses the same "at least one completed period" rule as the streak and
 * `completedDayCount`, so the strip and the "N of 7 this week" caption agree.
 */
export function weekDays(log: RoutineLog, today: DateKey, days = 7): WeekDay[] {
  const cells: WeekDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dateKey = shiftKey(today, -i);
    cells.push({
      dateKey,
      isToday: i === 0,
      complete: dayComplete(log.days[dateKey]),
    });
  }
  return cells;
}
