/**
 * Deterministic cadence engine.
 *
 * The safety engine answers "what belongs in this routine, and how often".
 * This one answers the question the user actually faces every night: **which of
 * those steps do I do RIGHT NOW?**
 *
 * That gap is where routines die. A plan that says "retinoid 3x/week" hands the
 * user seven decisions a week, and the two most common ways skincare goes wrong
 * — stacking two strong actives on the same night, and going too hard in week
 * one — are both decisions we can simply make for them.
 *
 * Like `applySafetyRules`, this is CODE, not a prompt. It guarantees:
 *
 *   1. Each step's weekly frequency is spread evenly across the 7-day cycle,
 *      so a 3x/week active never lands on two nights in a row.
 *   2. At most one strong active per CALENDAR DAY — the safety engine caps per
 *      session, but AM acid + PM retinoid is still one over-exfoliated face.
 *   3. Strong actives ramp from a single weekly use up to their target
 *      frequency over `RAMP_WEEKS`, and a week only advances the ramp if the
 *      user's skin stayed calm through it.
 *   4. A report of irritation automatically deloads the routine: strong actives
 *      pause, barrier steps stay, and the ramp holds where it is.
 *
 * Every departure from the nominal plan is recorded as a `ScheduleNote`, so the
 * UI can always say *why* tonight looks like this — the same audit-trail
 * contract as `SafetyAdjustment`.
 */
import { ACTIVES, activeRelevanceScore, type ActiveMeta } from "../safety/ingredients";
import type { IntakeResponse } from "../types/intake";
import type { ActiveKey, Routine, RoutineStep, RoutineTime } from "../types/routine";

/** How many weeks a strong active takes to reach its target frequency. */
export const RAMP_WEEKS = 6;

/** How the user's skin felt after a session. The whole feedback loop, one tap. */
export type SkinFeel = "calm" | "tight" | "stinging";

export interface SkinCheckIn {
  /** Calendar date of the report, `YYYY-MM-DD`. */
  date: string;
  feel: SkinFeel;
}

export type ScheduleNoteId =
  | "ramp_building"
  | "ramp_held"
  | "deload_active"
  | "day_conflict_deferred"
  | "day_conflict_dropped"
  | "rest_night";

export interface ScheduleNote {
  id: ScheduleNoteId;
  active?: ActiveKey;
  /** Plain language, shown to the user verbatim. */
  detail: string;
}

export interface SessionPlan {
  time: RoutineTime;
  /** Exactly what to do now, in order. Already renumbered. */
  steps: RoutineStep[];
  /** Two or three words for the top of the screen — "Retinoid night". */
  headline: string;
  /** The one strong active anchoring this session, if any. */
  anchor?: ActiveKey;
  notes: ScheduleNote[];
}

export interface DayPlan {
  /** `YYYY-MM-DD`. */
  date: string;
  /** Whole days since `startedOn`; never negative. */
  dayIndex: number;
  am: SessionPlan;
  pm: SessionPlan;
  /** The day's single strong active, across both sessions. */
  anchor?: ActiveKey;
}

export interface WeekPlan {
  /** 1-based, capped at `RAMP_WEEKS`. Weeks with irritation do not advance it. */
  rampWeek: number;
  rampWeeks: number;
  /** Weeks the ramp declined to advance because the user reported irritation. */
  rampWeeksHeld: number;
  /** True if strong actives are currently paused for recovery. */
  deloading: boolean;
  /** Last date (inclusive) the deload covers, when `deloading`. */
  deloadUntil?: string;
  /** Seven consecutive days, starting at the current ramp week's first day. */
  days: DayPlan[];
}

export interface ScheduleContext {
  /** Date the routine started, `YYYY-MM-DD`. */
  startedOn: string;
  /** Date being planned, `YYYY-MM-DD`. */
  on: string;
  /** Everything the user has told us about how their skin felt. */
  checkIns?: SkinCheckIn[];
}

/* ------------------------------------------------------------------ dates */

const DAY_MS = 86_400_000;

/**
 * Parse `YYYY-MM-DD` at UTC midnight. Dates in this module are calendar days,
 * never instants — going through UTC keeps arithmetic free of timezone and DST
 * drift, so `addDays` is always exactly one day.
 */
function parseDay(date: string): number {
  const [y = 1970, m = 1, d = 1] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function formatDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return formatDay(parseDay(date) + days * DAY_MS);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseDay(to) - parseDay(from)) / DAY_MS);
}

/** Today as a calendar date in the device's own timezone, not UTC. */
export function today(now: Date = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/**
 * Which session the user is standing in. The cutover is late afternoon: before
 * it, "today" still means the morning routine; after it, the evening one.
 */
export function currentSession(now: Date = new Date()): RoutineTime {
  return now.getHours() < 16 ? "AM" : "PM";
}

/* ------------------------------------------------------------------ cadence */

/**
 * Which days of a 7-day cycle a step lands on, spread as evenly as the
 * frequency allows. 3x/week → days 0, 2, 5 — never two in a row.
 */
export function spreadDays(frequencyPerWeek: number): number[] {
  const f = Math.max(0, Math.min(7, Math.round(frequencyPerWeek)));
  if (f === 0) return [];
  const days = new Set<number>();
  for (let i = 0; i < f; i++) days.add(Math.round((i * 7) / f) % 7);
  return [...days].sort((a, b) => a - b);
}

function metaOf(active: ActiveKey | undefined): ActiveMeta | undefined {
  return active ? ACTIVES[active] : undefined;
}

function isStrong(step: RoutineStep): boolean {
  return metaOf(step.active)?.isStrongActive === true;
}

/**
 * Target frequency scaled to the ramp week. Strong actives open at a single
 * weekly use and climb to their full frequency by `RAMP_WEEKS`; everything else
 * (cleanser, moisturiser, SPF, gentle actives) runs at full frequency from day
 * one, because there is nothing to acclimatise to.
 */
export function rampedFrequency(step: RoutineStep, rampWeek: number): number {
  if (!isStrong(step)) return step.frequencyPerWeek;
  const target = step.frequencyPerWeek;
  const scaled = Math.ceil((target * Math.min(rampWeek, RAMP_WEEKS)) / RAMP_WEEKS);
  return Math.max(1, Math.min(target, scaled));
}

/* ------------------------------------------------------------------ feedback */

/**
 * How long a report of irritation pauses strong actives, counted in days after
 * the report itself.
 */
const DELOAD_DAYS: Record<Exclude<SkinFeel, "calm">, number> = { stinging: 3, tight: 2 };

/** A run of "tight" days means something; one does not. */
const TIGHT_WINDOW_DAYS = 5;
const TIGHT_REPORTS_TO_DELOAD = 2;

interface Deload {
  from: string;
  until: string;
  reason: Exclude<SkinFeel, "calm">;
}

/**
 * Every recovery window the check-ins imply.
 *
 * A single "stinging" is enough on its own — that is the skin saying stop. A
 * single "tight" is not; skin is tight for a hundred reasons. Two inside
 * `TIGHT_WINDOW_DAYS` is a pattern, and gets a shorter pause.
 */
function deloadsFrom(checkIns: SkinCheckIn[]): Deload[] {
  const sorted = [...checkIns].sort((a, b) => a.date.localeCompare(b.date));
  const windows: Deload[] = [];

  for (const [i, entry] of sorted.entries()) {
    if (entry.feel === "stinging") {
      windows.push({
        from: addDays(entry.date, 1),
        until: addDays(entry.date, DELOAD_DAYS.stinging),
        reason: "stinging",
      });
      continue;
    }
    if (entry.feel !== "tight") continue;
    const recentTight = sorted
      .slice(0, i + 1)
      .filter((c) => c.feel === "tight" && daysBetween(c.date, entry.date) < TIGHT_WINDOW_DAYS);
    if (recentTight.length >= TIGHT_REPORTS_TO_DELOAD) {
      windows.push({
        from: addDays(entry.date, 1),
        until: addDays(entry.date, DELOAD_DAYS.tight),
        reason: "tight",
      });
    }
  }
  return windows;
}

function activeDeload(checkIns: SkinCheckIn[], on: string): Deload | undefined {
  const covering = deloadsFrom(checkIns).filter((w) => w.from <= on && on <= w.until);
  if (covering.length === 0) return undefined;
  // Overlapping windows extend each other; the latest end date wins.
  return covering.reduce((a, b) => (b.until > a.until ? b : a));
}

/**
 * Which ramp week the user is actually in.
 *
 * Elapsed time alone would push someone toward daily retinoid while their skin
 * is protesting, so a week only counts if the user reported nothing worse than
 * "calm" during it. A quiet week (no reports at all) advances normally — we ask
 * for feedback, we do not punish its absence.
 */
export interface RampState {
  /** 1-based ramp week, capped at `RAMP_WEEKS`. */
  week: number;
  /**
   * How many elapsed weeks did NOT advance the ramp because the user reported
   * something worse than `calm` during them.
   *
   * Holding the ramp is the right behaviour and it is why this engine exists,
   * but doing it silently is not: a user stuck at week 2 for a month has no way
   * to tell a working safety mechanism from a broken progress bar. This count is
   * what lets the UI say so out loud.
   */
  held: number;
}

function rampState(ctx: ScheduleContext): RampState {
  const elapsed = Math.max(0, daysBetween(ctx.startedOn, ctx.on));
  const completedWeeks = Math.floor(elapsed / 7);
  const checkIns = ctx.checkIns ?? [];

  let week = 1;
  let held = 0;
  for (let w = 0; w < completedWeeks && week < RAMP_WEEKS; w++) {
    const from = addDays(ctx.startedOn, w * 7);
    const to = addDays(ctx.startedOn, w * 7 + 6);
    const flared = checkIns.some((c) => c.date >= from && c.date <= to && c.feel !== "calm");
    if (flared) held++;
    else week++;
  }
  return { week, held };
}

export function rampWeekFor(ctx: ScheduleContext): number {
  return rampState(ctx).week;
}

/** Weeks the ramp was held back by a report of irritation. See `RampState.held`. */
export function rampWeeksHeld(ctx: ScheduleContext): number {
  return rampState(ctx).held;
}

/* ------------------------------------------------------------------ planning */

interface Placement {
  step: RoutineStep;
  time: RoutineTime;
  /** Days of the cycle (0-6) this step is scheduled on. */
  days: Set<number>;
}

/**
 * Lay the whole 7-day cycle out at once.
 *
 * Resolving a single day in isolation cannot honour "one strong active per
 * day" — you have to see the neighbours to know where a bumped active should
 * go. So the cycle is the unit of planning, and a single day is a lookup.
 */
function placeSteps(
  routine: Routine,
  intake: IntakeResponse,
  rampWeek: number,
): { placements: Placement[]; notes: Map<number, ScheduleNote[]> } {
  const notes = new Map<number, ScheduleNote[]>();
  const addNote = (day: number, note: ScheduleNote) => {
    notes.set(day, [...(notes.get(day) ?? []), note]);
  };

  const all: Array<{ step: RoutineStep; time: RoutineTime }> = [
    ...routine.am.map((step) => ({ step, time: "AM" as const })),
    ...routine.pm.map((step) => ({ step, time: "PM" as const })),
  ];

  // Strong actives are phase-shifted away from each other before the conflict
  // pass runs, so in the common case there is nothing left to resolve.
  const strong = all
    .filter((s) => isStrong(s.step))
    .sort((a, b) => {
      const sa = activeRelevanceScore(a.step.active as ActiveKey, intake.goals);
      const sb = activeRelevanceScore(b.step.active as ActiveKey, intake.goals);
      if (sa !== sb) return sb - sa;
      return (a.step.active ?? "").localeCompare(b.step.active ?? "");
    });

  const placements: Placement[] = [];
  const claimed = new Map<number, ActiveKey>();

  for (const [i, entry] of strong.entries()) {
    const freq = rampedFrequency(entry.step, rampWeek);
    if (freq < entry.step.frequencyPerWeek) {
      addNote(-1, {
        id: "ramp_building",
        active: entry.step.active,
        detail: `${metaOf(entry.step.active)?.short ?? "This step"} is at ${freq}x this week, building to ${entry.step.frequencyPerWeek}x by week ${RAMP_WEEKS}.`,
      });
    }
    const offset = Math.round((i * 7) / Math.max(1, strong.length));
    const wanted = spreadDays(freq).map((d) => (d + offset) % 7);

    const days = new Set<number>();
    let dropped = false;
    for (const day of wanted) {
      // One strong active per calendar day. If the slot is taken, walk forward
      // to the next free day rather than doubling up.
      let target = day;
      let hops = 0;
      while (claimed.has(target) && hops < 7) {
        target = (target + 1) % 7;
        hops++;
      }
      if (claimed.has(target)) {
        dropped = true;
        continue;
      }
      if (target !== day) {
        addNote(target, {
          id: "day_conflict_deferred",
          active: entry.step.active,
          detail: `${metaOf(entry.step.active)?.short ?? "This step"} moved to its own day — ${metaOf(claimed.get(day))?.short ?? "another strong active"} already had that one, and two strong actives in a day is how skin gets over-exfoliated.`,
        });
      }
      claimed.set(target, entry.step.active as ActiveKey);
      days.add(target);
    }
    if (dropped) {
      // Once per active, not once per day it could not fit. A step disappearing
      // from the routine with no explanation is exactly the kind of silence
      // that makes people stop trusting the plan.
      addNote(-1, {
        id: "day_conflict_dropped",
        active: entry.step.active,
        detail: days.size
          ? `${metaOf(entry.step.active)?.short ?? "This step"} runs less often than planned this week — every other day already has a strong active on it.`
          : `${metaOf(entry.step.active)?.short ?? "This step"} sits out this week — your other strong actives already fill the calendar, and doubling up is what over-exfoliates skin.`,
      });
    }
    placements.push({ step: entry.step, time: entry.time, days });
  }

  for (const entry of all) {
    if (isStrong(entry.step)) continue;
    placements.push({
      step: entry.step,
      time: entry.time,
      days: new Set(spreadDays(entry.step.frequencyPerWeek)),
    });
  }

  return { placements, notes };
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Weekday name for a calendar date — used for headers, not for scheduling. */
export function weekdayName(date: string): string {
  return DAY_NAMES[new Date(parseDay(date)).getUTCDay()] ?? "";
}

function buildSession(
  time: RoutineTime,
  placements: Placement[],
  cycleDay: number,
  deload: Deload | undefined,
  cycleNotes: ScheduleNote[],
): SessionPlan {
  const steps: RoutineStep[] = [];
  const pulled: ActiveKey[] = [];
  let anchor: ActiveKey | undefined;

  for (const p of placements) {
    if (p.time !== time || !p.days.has(cycleDay)) continue;
    if (deload && isStrong(p.step)) {
      if (p.step.active) pulled.push(p.step.active);
      continue;
    }
    if (isStrong(p.step)) anchor = p.step.active;
    steps.push({ ...p.step });
  }

  steps.sort((a, b) => a.order - b.order);
  steps.forEach((s, i) => {
    s.order = i + 1;
  });

  const notes: ScheduleNote[] = [];
  if (deload) {
    // A deload renames the session, so it always has to explain itself — even
    // on a day that had no strong active to pull. A headline the user cannot
    // account for is worse than no headline at all.
    notes.push({ id: "deload_active", active: pulled[0], detail: deloadDetail(deload, pulled, time) });
  } else {
    // Only speak about actives that are actually on this list. Repeating "your
    // retinoid is ramping" on six consecutive rest nights trains the user to
    // stop reading.
    // ...with one exception: an active that could not be scheduled at all is
    // never on tonight's list by definition, so it is reported by the session
    // that owns it instead.
    const tonight = new Set(steps.map((s) => s.active).filter((a): a is ActiveKey => a !== undefined));
    const owned = new Set(
      placements.filter((p) => p.time === time && p.step.active).map((p) => p.step.active as ActiveKey),
    );
    notes.push(
      ...cycleNotes.filter((n) =>
        n.active === undefined
          ? false
          : n.id === "day_conflict_dropped"
            ? owned.has(n.active)
            : tonight.has(n.active),
      ),
    );
    if (time === "PM" && !anchor) {
      notes.push({
        id: "rest_night",
        detail:
          "No strong active tonight. Off nights are when your skin actually rebuilds — this is the plan working, not a gap in it.",
      });
    }
  }

  return { time, steps, headline: headlineFor(time, anchor, deload), anchor, notes };
}

/**
 * Why the routine is holding back, and — the question the user actually has —
 * when it stops. `until` is the last day covered, so the return day is the one
 * after it.
 */
function deloadDetail(deload: Deload, pulled: ActiveKey[], time: RoutineTime): string {
  const back = weekdayName(addDays(deload.until, 1));
  const cause =
    deload.reason === "stinging"
      ? "you told us your skin was stinging, and pushing through that is how a barrier breaks"
      : "your skin felt tight more than once this week";
  const name = pulled[0] ? ACTIVES[pulled[0]].short : undefined;

  return name
    ? `${name} comes back on ${back} — ${cause}.`
    : `Your strong actives are on hold until ${back} — ${cause}. Cleansing and moisturising is the whole job ${time === "AM" ? "this morning" : "tonight"}.`;
}

function headlineFor(
  time: RoutineTime,
  anchor: ActiveKey | undefined,
  deload: Deload | undefined,
): string {
  if (deload) return time === "AM" ? "Recovery morning" : "Recovery night";
  if (anchor) return `${ACTIVES[anchor].short} ${time === "AM" ? "morning" : "night"}`;
  return time === "AM" ? "Morning" : "Rest night";
}

/** The full plan for one calendar day. */
export function planDay(
  routine: Routine,
  intake: IntakeResponse,
  ctx: ScheduleContext,
): DayPlan {
  const { week: rampWeek, held } = rampState(ctx);
  const deload = activeDeload(ctx.checkIns ?? [], ctx.on);
  const { placements, notes } = placeSteps(routine, intake, rampWeek);

  const dayIndex = Math.max(0, daysBetween(ctx.startedOn, ctx.on));
  const cycleDay = dayIndex % 7;
  const cycleNotes = [...(notes.get(-1) ?? []), ...(notes.get(cycleDay) ?? [])];

  const am = buildSession("AM", placements, cycleDay, deload, cycleNotes);
  const pm = buildSession("PM", placements, cycleDay, deload, cycleNotes);

  // A held ramp is reported on the evening session, where the strong actives
  // live. Not during a deload: the deload note already explains why tonight is
  // lighter, and two explanations for one thing is how a user learns to skip
  // both. Not at full strength either, since there is nothing left to hold.
  if (held > 0 && !deload && rampWeek < RAMP_WEEKS) {
    pm.notes.push({
      id: "ramp_held",
      detail: `You're still on week ${rampWeek} of ${RAMP_WEEKS}. We held the pace back ${held === 1 ? "a week" : `${held} weeks`} because your skin wasn't calm — it only moves up after a week that goes smoothly, and that is the routine working rather than stalling.`,
    });
  }

  return { date: ctx.on, dayIndex, am, pm, anchor: am.anchor ?? pm.anchor };
}

/**
 * The current ramp week laid out day by day — what the week strip renders.
 * Starts on the day the current 7-day cycle began, so "week 3 of 6" means the
 * same thing on the strip as it does in the ramp.
 */
export function planWeek(
  routine: Routine,
  intake: IntakeResponse,
  ctx: ScheduleContext,
): WeekPlan {
  const dayIndex = Math.max(0, daysBetween(ctx.startedOn, ctx.on));
  const weekStart = addDays(ctx.startedOn, Math.floor(dayIndex / 7) * 7);
  const deload = activeDeload(ctx.checkIns ?? [], ctx.on);

  const { week, held } = rampState(ctx);

  return {
    rampWeek: week,
    rampWeeks: RAMP_WEEKS,
    rampWeeksHeld: held,
    deloading: deload !== undefined,
    deloadUntil: deload?.until,
    days: Array.from({ length: 7 }, (_, i) =>
      planDay(routine, intake, { ...ctx, on: addDays(weekStart, i) }),
    ),
  };
}
