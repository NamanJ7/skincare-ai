import { describe, expect, it } from "vitest";

import {
  completedDayCount,
  consistency,
  dayFraction,
  emptyLog,
  isDateKey,
  normalizeLog,
  periodComplete,
  shiftKey,
  stepKey,
  streakFrom,
  todayKey,
  toggleStep,
  weekDays,
  withRoutineRevision,
  withStepOwnership,
  type RoutineLog,
} from "./log";

/** Build a log where each listed day has a fully-completed AM period. */
function logWithCompleteDays(...days: string[]): RoutineLog {
  const log = emptyLog();
  for (const d of days) {
    log.days[d] = { am: { done: ["cleanser:base"], total: 1 } };
  }
  return log;
}

describe("todayKey", () => {
  it("uses the local calendar date, not UTC", () => {
    // 23:30 local on Jan 1 — toISOString() would already be Jan 2 in negative-
    // offset zones (or still Jan 1 in positive ones); local getters never shift.
    const lateNight = new Date(2026, 0, 1, 23, 30);
    expect(todayKey(lateNight)).toBe("2026-01-01");
  });

  it("pads month and day", () => {
    expect(todayKey(new Date(2026, 2, 5))).toBe("2026-03-05");
  });
});

describe("stepKey", () => {
  it("keys by category and active, with a base fallback", () => {
    expect(
      stepKey({
        order: 1,
        category: "serum",
        active: "niacinamide",
        frequencyPerWeek: 7,
        rationale: "",
        irritationRisk: "low",
      }),
    ).toBe("serum:niacinamide");
    expect(
      stepKey({
        order: 1,
        category: "cleanser",
        frequencyPerWeek: 7,
        rationale: "",
        irritationRisk: "low",
      }),
    ).toBe("cleanser:base");
  });
});

describe("toggleStep", () => {
  it("adds then removes a step, keeping the total snapshot", () => {
    let log = toggleStep(emptyLog(), "2026-07-03", "am", "cleanser:base", 3);
    expect(log.days["2026-07-03"].am).toEqual({
      done: ["cleanser:base"],
      total: 3,
    });

    log = toggleStep(log, "2026-07-03", "am", "cleanser:base", 3);
    expect(log.days["2026-07-03"].am).toEqual({ done: [], total: 3 });
  });

  it("keeps the total from first logging even if the plan changed since", () => {
    let log = toggleStep(
      emptyLog(),
      "2026-07-03",
      "pm",
      "treatment:retinoid",
      4,
    );
    // Re-scan shrank the plan to 2 steps; the day's snapshot stays at 4.
    log = toggleStep(log, "2026-07-03", "pm", "moisturizer:base", 4);
    expect(log.days["2026-07-03"].pm?.total).toBe(4);
  });

  it("does not mutate the previous log", () => {
    const before = emptyLog();
    toggleStep(before, "2026-07-03", "am", "cleanser:base", 1);
    expect(before.days).toEqual({});
  });

  it("preserves active revisions and ownership preferences", () => {
    const before: RoutineLog = {
      days: {},
      revision: {
        kind: "pause_strong_actives",
        acceptedAt: "2026-07-03T12:00:00.000Z",
        effectiveDate: "2026-07-03",
        reason: "Pause strong actives while skin settles.",
      },
      stepOwnership: { "serum:niacinamide": "not_owned" },
    };

    const next = toggleStep(before, "2026-07-03", "am", "cleanser:base", 2);

    expect(next.revision).toEqual(before.revision);
    expect(next.stepOwnership).toEqual(before.stepOwnership);
    expect(next.days["2026-07-03"].am?.done).toEqual(["cleanser:base"]);
  });

  it("uses scheduled totals and makes quick completion resumable by Guided Mode", () => {
    const at = "2026-07-03T08:00:00.000Z";
    const keys = ["cleanser:base", "sunscreen:base"];
    let log = toggleStep(
      emptyLog(),
      "2026-07-03",
      "am",
      keys[0],
      keys.length,
      keys,
      at,
    );
    expect(log.days["2026-07-03"].am).toMatchObject({
      done: [keys[0]],
      total: 2,
      scheduledStepKeys: keys,
      source: "quick",
      startedAt: at,
    });
    log = toggleStep(log, "2026-07-03", "am", keys[1], 2, keys, at);
    expect(log.days["2026-07-03"].am?.completedAt).toBe(at);
    expect(periodComplete(log.days["2026-07-03"].am)).toBe(true);
  });

  it("replaces a saved skip when quick check marks that step done", () => {
    const before: RoutineLog = {
      days: {
        "2026-07-03": {
          pm: {
            done: [],
            total: 1,
            scheduledStepKeys: ["cleanser:base"],
            skipped: {
              "cleanser:base": {
                reason: "not_now",
                recordedAt: "2026-07-03T20:00:00.000Z",
              },
            },
          },
        },
      },
    };
    const next = toggleStep(
      before,
      "2026-07-03",
      "pm",
      "cleanser:base",
      1,
      ["cleanser:base"],
      "2026-07-03T20:05:00.000Z",
    );
    expect(next.days["2026-07-03"].pm?.done).toEqual(["cleanser:base"]);
    expect(next.days["2026-07-03"].pm?.skipped).toBeUndefined();
  });
});

describe("routine preferences", () => {
  it("persists an accepted revision without changing completion history", () => {
    const before = logWithCompleteDays("2026-07-10");
    const next = withRoutineRevision(before, {
      kind: "simplify_today",
      acceptedAt: "2026-07-10T12:00:00.000Z",
      effectiveDate: "2026-07-10",
      period: "pm",
      reason: "Keep the basics today.",
    });
    expect(next.revision?.kind).toBe("simplify_today");
    expect(next.days).toEqual(before.days);
    expect(before.revision).toBeUndefined();
  });

  it("reconciles today's completion snapshot with the accepted routine", () => {
    const before = emptyLog();
    before.days["2026-07-10"] = {
      pm: {
        done: ["cleanser:base", "treatment:retinoid"],
        total: 3,
      },
    };
    const next = withRoutineRevision(
      before,
      {
        kind: "pause_strong_actives",
        acceptedAt: "2026-07-10T12:00:00.000Z",
        effectiveDate: "2026-07-10",
        reason: "Pause the active.",
      },
      {
        am: [],
        pm: [
          {
            order: 1,
            category: "cleanser",
            frequencyPerWeek: 7,
            rationale: "",
            irritationRisk: "low",
          },
          {
            order: 2,
            category: "moisturizer",
            frequencyPerWeek: 7,
            rationale: "",
            irritationRisk: "low",
          },
        ],
        notes: [],
      },
    );
    expect(next.days["2026-07-10"].pm).toEqual({
      done: ["cleanser:base"],
      total: 2,
    });
  });

  it("records and clears an explicit not-owned answer", () => {
    const marked = withStepOwnership(
      emptyLog(),
      "serum:vitamin_c",
      "not_owned",
    );
    expect(marked.stepOwnership?.["serum:vitamin_c"]).toBe("not_owned");
    expect(
      withStepOwnership(marked, "serum:vitamin_c", undefined).stepOwnership,
    ).toBeUndefined();
  });
});

describe("periodComplete / dayFraction", () => {
  it("is complete only when every logged step is done", () => {
    expect(periodComplete({ done: ["a"], total: 2 })).toBe(false);
    expect(periodComplete({ done: ["a", "b"], total: 2 })).toBe(true);
    expect(periodComplete(undefined)).toBe(false);
  });

  it("uses exact scheduled keys instead of unrelated historical done keys", () => {
    expect(
      periodComplete({
        done: ["old:a", "old:b"],
        total: 1,
        scheduledStepKeys: ["current:a"],
      }),
    ).toBe(false);
    expect(
      dayFraction({
        am: {
          done: ["old:a", "current:a"],
          total: 2,
          scheduledStepKeys: ["current:a", "current:b"],
        },
      }),
    ).toBe(0.5);
  });

  it("averages across whichever periods have entries", () => {
    expect(dayFraction({ am: { done: ["a"], total: 2 } })).toBe(0.5);
    expect(
      dayFraction({
        am: { done: ["a", "b"], total: 2 },
        pm: { done: [], total: 2 },
      }),
    ).toBe(0.5);
    expect(dayFraction(undefined)).toBe(0);
  });
});

describe("streakFrom", () => {
  it("counts consecutive complete days ending today", () => {
    const log = logWithCompleteDays("2026-07-01", "2026-07-02", "2026-07-03");
    expect(streakFrom(log, "2026-07-03")).toBe(3);
  });

  it("does not zero the streak when today is not done yet", () => {
    const log = logWithCompleteDays("2026-07-01", "2026-07-02");
    expect(streakFrom(log, "2026-07-03")).toBe(2);
  });

  it("breaks on a gap day", () => {
    const log = logWithCompleteDays("2026-06-30", "2026-07-02", "2026-07-03");
    expect(streakFrom(log, "2026-07-03")).toBe(2);
  });

  it("walks correctly across a month boundary", () => {
    const log = logWithCompleteDays("2026-06-29", "2026-06-30", "2026-07-01");
    expect(streakFrom(log, "2026-07-01")).toBe(3);
  });

  it("ignores partially-completed days", () => {
    const log = logWithCompleteDays("2026-07-02");
    log.days["2026-07-03"] = { am: { done: ["a"], total: 2 } };
    expect(streakFrom(log, "2026-07-03")).toBe(1);
  });
});

describe("shiftKey", () => {
  it("shifts across month boundaries in both directions", () => {
    expect(shiftKey("2026-07-01", -1)).toBe("2026-06-30");
    expect(shiftKey("2026-06-30", 1)).toBe("2026-07-01");
  });
});

describe("completedDayCount", () => {
  it("counts fully-completed days inside the window only", () => {
    const log = logWithCompleteDays("2026-07-03", "2026-07-01", "2026-06-01");
    expect(completedDayCount(log, "2026-07-03", 7)).toBe(2);
  });

  it("ignores partially-completed days", () => {
    const log = logWithCompleteDays("2026-07-02");
    log.days["2026-07-03"] = { am: { done: ["a"], total: 2 } };
    expect(completedDayCount(log, "2026-07-03", 7)).toBe(1);
  });
});

describe("consistency", () => {
  it("averages day fractions over the window, missing days as zero", () => {
    const log = logWithCompleteDays("2026-07-03", "2026-07-02");
    // 2 full days out of 7 → 2/7.
    expect(consistency(log, "2026-07-03", 7)).toBeCloseTo(2 / 7);
  });

  it("ignores days outside the window", () => {
    const log = logWithCompleteDays("2026-06-01");
    expect(consistency(log, "2026-07-03", 7)).toBe(0);
  });
});

describe("weekDays", () => {
  it("returns the trailing seven days oldest-first ending today", () => {
    const cells = weekDays(emptyLog(), "2026-07-10");
    expect(cells).toHaveLength(7);
    expect(cells[0].dateKey).toBe("2026-07-04");
    expect(cells[6].dateKey).toBe("2026-07-10");
    expect(cells[6].isToday).toBe(true);
    expect(cells.filter((c) => c.isToday)).toHaveLength(1);
  });

  it("marks only fully-completed days complete, agreeing with completedDayCount", () => {
    const log = logWithCompleteDays("2026-07-10", "2026-07-08");
    log.days["2026-07-09"] = { am: { done: ["a"], total: 2 } };
    const cells = weekDays(log, "2026-07-10");
    const complete = cells.filter((c) => c.complete);
    expect(complete.map((c) => c.dateKey)).toEqual([
      "2026-07-08",
      "2026-07-10",
    ]);
    expect(complete).toHaveLength(completedDayCount(log, "2026-07-10", 7));
  });

  it("walks across a month boundary", () => {
    const cells = weekDays(emptyLog(), "2026-07-02");
    expect(cells[0].dateKey).toBe("2026-06-26");
    expect(cells[6].dateKey).toBe("2026-07-02");
  });
});

describe("malformed date keys cannot hang the app", () => {
  // `shiftKey` used to map an unparseable key to "NaN-NaN-NaN", which then
  // mapped to itself — a fixed point that turned streakFrom's walk-backward
  // loop into an infinite one, freezing the JS thread rather than crashing.
  it("shiftKey is stable on an unparseable key instead of producing NaN", () => {
    expect(shiftKey("not-a-date", -1)).toBe("not-a-date");
    expect(shiftKey("NaN-NaN-NaN", -1)).toBe("NaN-NaN-NaN");
    expect(shiftKey("2026-13-45", -1)).toBe("2026-13-45");
  });

  it("shiftKey still walks real dates, including across month ends", () => {
    expect(shiftKey("2026-07-01", -1)).toBe("2026-06-30");
    expect(shiftKey("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("isDateKey rejects overflow dates that Date would roll forward", () => {
    expect(isDateKey("2026-07-27")).toBe(true);
    expect(isDateKey("2026-02-31")).toBe(false);
    expect(isDateKey("NaN-NaN-NaN")).toBe(false);
    expect(isDateKey(undefined)).toBe(false);
  });

  it("streakFrom terminates when a stored day key is malformed", () => {
    const log = emptyLog();
    log.days["NaN-NaN-NaN"] = { am: { done: ["cleanser:base"], total: 1 } };
    expect(streakFrom(log, "NaN-NaN-NaN")).toBe(1);
  });
});

describe("normalizeLog", () => {
  // A `{}` payload from an older build or a partial cloud restore used to reach
  // `log.days[today]` at first render of every tab.
  it("returns an empty log for payloads that are not a log", () => {
    expect(normalizeLog({}).days).toEqual({});
    expect(normalizeLog(null).days).toEqual({});
    expect(normalizeLog({ days: "nope" }).days).toEqual({});
  });

  it("drops malformed day keys and malformed periods", () => {
    const out = normalizeLog({
      days: {
        "2026-07-27": { am: { done: ["cleanser:base"], total: 1 } },
        "NaN-NaN-NaN": { am: { done: [], total: 1 } },
        "2026-02-31": { am: { done: [], total: 1 } },
        "2026-07-26": { am: { done: "not-an-array", total: 1 } },
      },
    });
    expect(Object.keys(out.days)).toEqual(["2026-07-27"]);
  });

  it("keeps recognizable revision and ownership records", () => {
    const out = normalizeLog({
      days: {},
      stepOwnership: { "treatment:retinoid": "not_owned" },
    });
    expect(out.stepOwnership).toEqual({ "treatment:retinoid": "not_owned" });
  });
});
