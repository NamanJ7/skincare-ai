import { describe, expect, it } from "vitest";

import { ACTIVES } from "../safety/ingredients";
import type { IntakeResponse } from "../types/intake";
import type { ActiveKey, Routine, RoutineStep } from "../types/routine";
import {
  RAMP_WEEKS,
  addDays,
  currentSession,
  daysBetween,
  planDay,
  planWeek,
  rampWeekFor,
  rampWeeksHeld,
  rampedFrequency,
  spreadDays,
  type SkinCheckIn,
} from "./engine";

const START = "2026-01-01";

function intake(over: Partial<IntakeResponse> = {}): IntakeResponse {
  return {
    age: 28,
    goals: ["acne", "texture"],
    skinType: "combination",
    sensitivity: "medium",
    currentProducts: [],
    allergies: [],
    budget: "medium",
    fragrancePreference: "no_preference",
    pregnancyOrBreastfeeding: false,
    skinTone: "medium",
    darkMarkProne: false,
    climate: "temperate",
    ...over,
  };
}

function step(
  order: number,
  category: RoutineStep["category"],
  active: ActiveKey | undefined,
  frequencyPerWeek: number,
): RoutineStep {
  return { order, category, active, frequencyPerWeek, rationale: "because", irritationRisk: "low" };
}

/** A safety-clamped routine: SPF daily, one strong active per session. */
function routine(): Routine {
  return {
    am: [
      step(1, "cleanser", undefined, 7),
      step(2, "serum", "niacinamide", 7),
      step(3, "moisturizer", undefined, 7),
      step(4, "sunscreen", undefined, 7),
    ],
    pm: [
      step(1, "cleanser", undefined, 7),
      step(2, "treatment", "retinoid", 3),
      step(3, "moisturizer", undefined, 7),
    ],
    notes: [],
  };
}

function ctx(on: string, checkIns: SkinCheckIn[] = []) {
  return { startedOn: START, on, checkIns };
}

/** Every day of one cycle, from a given ramp-week offset. */
function cycle(weekOffset: number, checkIns: SkinCheckIn[] = []) {
  return Array.from({ length: 7 }, (_, i) =>
    planDay(routine(), intake(), ctx(addDays(START, weekOffset * 7 + i), checkIns)),
  );
}

describe("date helpers", () => {
  it("adds days across a month boundary", () => {
    expect(addDays("2026-01-30", 3)).toBe("2026-02-02");
  });

  it("adds days across a leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(daysBetween("2028-02-28", "2028-03-01")).toBe(2);
  });

  it("splits the day into a morning and an evening session", () => {
    expect(currentSession(new Date(2026, 0, 1, 7))).toBe("AM");
    expect(currentSession(new Date(2026, 0, 1, 15, 59))).toBe("AM");
    expect(currentSession(new Date(2026, 0, 1, 16))).toBe("PM");
    expect(currentSession(new Date(2026, 0, 1, 23))).toBe("PM");
  });
});

describe("spreadDays", () => {
  it("uses every day at 7x", () => {
    expect(spreadDays(7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("never schedules a 3x/week active on consecutive days", () => {
    const days = spreadDays(3);
    expect(days).toHaveLength(3);
    const gaps = days.slice(1).map((d, i) => d - (days[i] ?? d));
    expect(gaps.every((g) => g > 1)).toBe(true);
  });

  it("spreads 2x/week to opposite ends of the week", () => {
    expect(spreadDays(2)).toEqual([0, 4]);
  });

  it("returns nothing for a zero frequency", () => {
    expect(spreadDays(0)).toEqual([]);
  });
});

describe("ramp", () => {
  it("opens strong actives at one use a week", () => {
    expect(rampedFrequency(step(1, "treatment", "retinoid", 3), 1)).toBe(1);
  });

  it("reaches the target frequency by the final ramp week", () => {
    expect(rampedFrequency(step(1, "treatment", "retinoid", 3), RAMP_WEEKS)).toBe(3);
  });

  it("never exceeds the safety-clamped target", () => {
    for (let w = 1; w <= RAMP_WEEKS + 4; w++) {
      expect(rampedFrequency(step(1, "treatment", "retinoid", 3), w)).toBeLessThanOrEqual(3);
    }
  });

  it("increases monotonically", () => {
    let prev = 0;
    for (let w = 1; w <= RAMP_WEEKS; w++) {
      const f = rampedFrequency(step(1, "treatment", "retinoid", 3), w);
      expect(f).toBeGreaterThanOrEqual(prev);
      prev = f;
    }
  });

  it("does not ramp gentle steps — sunscreen is daily from day one", () => {
    expect(rampedFrequency(step(1, "sunscreen", undefined, 7), 1)).toBe(7);
    expect(rampedFrequency(step(1, "serum", "niacinamide", 7), 1)).toBe(7);
  });

  it("advances a week at a time while the skin stays calm", () => {
    expect(rampWeekFor(ctx(START))).toBe(1);
    expect(rampWeekFor(ctx(addDays(START, 7)))).toBe(2);
    expect(rampWeekFor(ctx(addDays(START, 21)))).toBe(4);
  });

  it("caps at RAMP_WEEKS however long the user has been going", () => {
    expect(rampWeekFor(ctx(addDays(START, 365)))).toBe(RAMP_WEEKS);
  });

  it("holds the ramp for a week the user reported irritation in", () => {
    // Day 3 stung, so week 1 does not count toward the ramp.
    const held = rampWeekFor(ctx(addDays(START, 14), [{ date: addDays(START, 3), feel: "stinging" }]));
    expect(held).toBe(2);
    expect(held).toBeLessThan(rampWeekFor(ctx(addDays(START, 14))));
  });

  it("treats a week with no check-ins as calm rather than punishing silence", () => {
    expect(rampWeekFor(ctx(addDays(START, 14), []))).toBe(3);
  });

  it("clamps to week 1 before the start date", () => {
    expect(rampWeekFor(ctx("2025-12-01"))).toBe(1);
  });
});

/**
 * Holding the ramp is correct behaviour, but a user who silently plateaus at
 * week 2 for a month cannot tell a working safety mechanism from a broken
 * progress bar. These lock in that the hold is counted and said out loud.
 */
describe("a held ramp explains itself", () => {
  const sting = (day: number): SkinCheckIn => ({ date: addDays(START, day), feel: "stinging" });

  function pmNoteIds(on: string, checkIns: SkinCheckIn[]): string[] {
    return planDay(routine(), intake(), ctx(on, checkIns)).pm.notes.map((n) => n.id);
  }

  it("counts nothing held when every week was calm", () => {
    expect(rampWeeksHeld(ctx(addDays(START, 21)))).toBe(0);
    expect(pmNoteIds(addDays(START, 21), [])).not.toContain("ramp_held");
  });

  it("counts each week the user reported irritation in", () => {
    expect(rampWeeksHeld(ctx(addDays(START, 14), [sting(3)]))).toBe(1);
    expect(rampWeeksHeld(ctx(addDays(START, 21), [sting(3), sting(10)]))).toBe(2);
  });

  it("says so on the evening session, naming the week it is stuck on", () => {
    const day = planDay(routine(), intake(), ctx(addDays(START, 14), [sting(3)]));
    const note = day.pm.notes.find((n) => n.id === "ramp_held");
    expect(note).toBeDefined();
    expect(note?.detail).toContain(`week 2 of ${RAMP_WEEKS}`);
  });

  it("stays quiet during a deload — that already explains why tonight is lighter", () => {
    // Stinging yesterday puts today inside the recovery window.
    const on = addDays(START, 15);
    expect(pmNoteIds(on, [sting(3), { date: addDays(START, 14), feel: "stinging" }])).not.toContain(
      "ramp_held",
    );
  });

  it("stays quiet once the ramp is at full strength — nothing is being held", () => {
    // A single early flare cannot keep someone off full strength a year later.
    const on = addDays(START, 365);
    expect(rampWeekFor(ctx(on, [sting(3)]))).toBe(RAMP_WEEKS);
    expect(pmNoteIds(on, [sting(3)])).not.toContain("ramp_held");
  });

  it("reports the same hold count on the week plan", () => {
    const week = planWeek(routine(), intake(), ctx(addDays(START, 14), [sting(3)]));
    expect(week.rampWeeksHeld).toBe(1);
    expect(week.rampWeek).toBe(2);
  });
});

describe("one strong active per calendar day", () => {
  it("never puts two strong actives on the same day", () => {
    const heavy: Routine = {
      am: [step(1, "cleanser", undefined, 7), step(2, "exfoliant", "salicylic_acid", 3), step(3, "sunscreen", undefined, 7)],
      pm: [step(1, "cleanser", undefined, 7), step(2, "treatment", "retinoid", 3)],
      notes: [],
    };
    for (let w = 0; w < RAMP_WEEKS + 2; w++) {
      for (let i = 0; i < 7; i++) {
        const day = planDay(heavy, intake(), ctx(addDays(START, w * 7 + i)));
        const strong = [...day.am.steps, ...day.pm.steps].filter(
          (s) => s.active && ACTIVES[s.active].isStrongActive,
        );
        expect(strong.length).toBeLessThanOrEqual(1);
      }
    }
  });

  it("never drops an active silently — the session that owns it says so", () => {
    // Two daily strong actives cannot both fit one-per-day, so one has to go.
    const heavy: Routine = {
      am: [step(1, "exfoliant", "salicylic_acid", 7), step(2, "sunscreen", undefined, 7)],
      pm: [step(1, "treatment", "retinoid", 7)],
      notes: [],
    };
    const week = Array.from({ length: 7 }, (_, i) =>
      planDay(heavy, intake(), ctx(addDays(START, RAMP_WEEKS * 7 + i))),
    );

    const scheduled = new Set(
      week.flatMap((d) => [...d.am.steps, ...d.pm.steps]).map((s) => s.active),
    );
    const missing = (["salicylic_acid", "retinoid"] as const).filter((a) => !scheduled.has(a));
    expect(missing).toHaveLength(1);

    // Every single day explains the absence, not just the first one.
    for (const day of week) {
      const notes = [...day.am.notes, ...day.pm.notes];
      const dropped = notes.filter((n) => n.id === "day_conflict_dropped");
      expect(dropped).toHaveLength(1);
      expect(dropped[0]?.active).toBe(missing[0]);
    }
  });

  it("reports a dropped active only once, not once per day it could not fit", () => {
    const heavy: Routine = {
      am: [step(1, "exfoliant", "salicylic_acid", 7), step(2, "sunscreen", undefined, 7)],
      pm: [step(1, "treatment", "retinoid", 7)],
      notes: [],
    };
    const day = planDay(heavy, intake(), ctx(addDays(START, RAMP_WEEKS * 7)));
    const all = [...day.am.notes, ...day.pm.notes].filter((n) => n.id === "day_conflict_dropped");
    expect(all).toHaveLength(1);
  });
});

describe("cadence", () => {
  it("delivers the retinoid exactly as often as the ramp allows", () => {
    const days = cycle(0);
    const nights = days.filter((d) => d.pm.steps.some((s) => s.active === "retinoid"));
    expect(nights).toHaveLength(1); // week 1 of the ramp
  });

  it("delivers the full frequency once the ramp completes", () => {
    const days = cycle(RAMP_WEEKS);
    const nights = days.filter((d) => d.pm.steps.some((s) => s.active === "retinoid"));
    expect(nights).toHaveLength(3);
  });

  it("keeps sunscreen in every single morning", () => {
    for (const day of cycle(0)) {
      expect(day.am.steps.some((s) => s.category === "sunscreen")).toBe(true);
    }
  });

  it("renumbers each session so the user sees 1, 2, 3", () => {
    for (const day of cycle(2)) {
      expect(day.pm.steps.map((s) => s.order)).toEqual(day.pm.steps.map((_, i) => i + 1));
    }
  });

  it("names the night after the active anchoring it", () => {
    const days = cycle(RAMP_WEEKS);
    const retinoidNight = days.find((d) => d.pm.anchor === "retinoid");
    expect(retinoidNight?.pm.headline).toBe("Retinoid night");
  });

  it("calls an active-free evening a rest night and says why", () => {
    const days = cycle(0);
    const rest = days.find((d) => d.pm.anchor === undefined);
    expect(rest?.pm.headline).toBe("Rest night");
    expect(rest?.pm.notes.some((n) => n.id === "rest_night")).toBe(true);
  });
});

describe("deload", () => {
  it("pauses strong actives after a single stinging report", () => {
    const stung = [{ date: addDays(START, 1), feel: "stinging" as const }];
    const days = Array.from({ length: 3 }, (_, i) =>
      planDay(routine(), intake(), ctx(addDays(START, 2 + i), stung)),
    );
    for (const day of days) {
      expect(day.pm.steps.some((s) => s.active === "retinoid")).toBe(false);
    }
  });

  it("keeps the barrier steps through a deload", () => {
    const stung = [{ date: START, feel: "stinging" as const }];
    const day = planDay(routine(), intake(), ctx(addDays(START, 1), stung));
    expect(day.pm.steps.some((s) => s.category === "cleanser")).toBe(true);
    expect(day.pm.steps.some((s) => s.category === "moisturizer")).toBe(true);
    expect(day.am.steps.some((s) => s.category === "sunscreen")).toBe(true);
  });

  it("ignores one isolated tight day", () => {
    const week = planWeek(routine(), intake(), ctx(addDays(START, 2), [
      { date: addDays(START, 1), feel: "tight" },
    ]));
    expect(week.deloading).toBe(false);
  });

  it("deloads on a second tight day inside the window", () => {
    const week = planWeek(routine(), intake(), ctx(addDays(START, 4), [
      { date: addDays(START, 1), feel: "tight" },
      { date: addDays(START, 3), feel: "tight" },
    ]));
    expect(week.deloading).toBe(true);
  });

  it("lifts the deload once the recovery window passes", () => {
    const stung = [{ date: START, feel: "stinging" as const }];
    expect(planWeek(routine(), intake(), ctx(addDays(START, 3), stung)).deloading).toBe(true);
    expect(planWeek(routine(), intake(), ctx(addDays(START, 4), stung)).deloading).toBe(false);
  });

  it("renames every session it covers, even one with nothing to pause", () => {
    const stung = [{ date: START, feel: "stinging" as const }];
    const day = planDay(routine(), intake(), ctx(addDays(START, 1), stung));
    expect(day.pm.headline).toBe("Recovery night");
    expect(day.am.headline).toBe("Recovery morning");
  });

  it("explains the pause on a day the active would otherwise have run", () => {
    // Day 6 stung, which both triggers the deload and holds the ramp at week 1,
    // so day 7 is a retinoid night that gets pulled.
    const stung = [{ date: addDays(START, 6), feel: "stinging" as const }];
    const day = planDay(routine(), intake(), ctx(addDays(START, 7), stung));
    expect(day.pm.steps.some((s) => s.active === "retinoid")).toBe(false);
    const note = day.pm.notes.find((n) => n.id === "deload_active");
    expect(note?.detail).toContain("stinging");
    expect(note?.active).toBe("retinoid");
  });
});

describe("planWeek", () => {
  it("returns seven consecutive days starting at the ramp week's first day", () => {
    const week = planWeek(routine(), intake(), ctx(addDays(START, 9)));
    expect(week.days).toHaveLength(7);
    expect(week.days.map((d) => d.date)).toEqual(
      Array.from({ length: 7 }, (_, i) => addDays(START, 7 + i)),
    );
    expect(week.rampWeek).toBe(2);
    expect(week.rampWeeks).toBe(RAMP_WEEKS);
  });

  it("reports how far into the routine each day is", () => {
    const week = planWeek(routine(), intake(), ctx(addDays(START, 9)));
    expect(week.days.map((d) => d.dayIndex)).toEqual([7, 8, 9, 10, 11, 12, 13]);
  });
});
