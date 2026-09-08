import { describe, expect, it } from "vitest";

import type { RoutineStep } from "../types/routine";
import {
  EMPTY_LOG,
  countInWindow,
  dateKey,
  daysLoggedBetween,
  isDone,
  stepKey,
  toggleStep,
  type RoutineLog,
} from "./adherence";

function step(over: Partial<RoutineStep> = {}): RoutineStep {
  return {
    order: 1,
    category: "exfoliant",
    active: "salicylic_acid",
    frequencyPerWeek: 3,
    rationale: "",
    irritationRisk: "medium",
    ...over,
  };
}

/** Local-time date, so tests read in the same frame the code works in. */
const local = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);

describe("stepKey", () => {
  it("ignores order, so a renumbered routine keeps its history", () => {
    expect(stepKey(step({ order: 1 }))).toBe(stepKey(step({ order: 4 })));
  });

  it("separates steps that differ only by active", () => {
    expect(stepKey(step({ active: "salicylic_acid" }))).not.toBe(
      stepKey(step({ active: "glycolic_acid" })),
    );
  });

  it("separates two inert steps of different categories", () => {
    expect(stepKey(step({ category: "cleanser", active: undefined }))).not.toBe(
      stepKey(step({ category: "moisturizer", active: undefined })),
    );
  });

  it("gives inert steps a stable key rather than one containing undefined", () => {
    const key = stepKey(step({ category: "moisturizer", active: undefined }));
    expect(key).toBe("moisturizer:-");
    expect(key).not.toMatch(/undefined/);
  });
});

describe("dateKey", () => {
  it("uses the local calendar date, not UTC", () => {
    // 10pm local on the 8th. In any timezone behind UTC this instant is already
    // the 9th in UTC — filing a PM routine under tomorrow is the bug.
    expect(dateKey(local(2026, 3, 8, 22))).toBe("2026-03-08");
  });

  it("stays on the local date just before midnight and rolls just after", () => {
    expect(dateKey(new Date(2026, 2, 8, 23, 59, 59))).toBe("2026-03-08");
    expect(dateKey(new Date(2026, 2, 9, 0, 0, 1))).toBe("2026-03-09");
  });

  it("zero-pads months and days", () => {
    expect(dateKey(local(2026, 1, 5))).toBe("2026-01-05");
  });
});

describe("toggleStep / isDone", () => {
  it("ticks, unticks, and never mutates the input", () => {
    const a = toggleStep(EMPTY_LOG, "2026-03-08", "PM", "exfoliant:salicylic_acid");
    expect(isDone(a, "2026-03-08", "PM", "exfoliant:salicylic_acid")).toBe(true);
    expect(EMPTY_LOG.days).toEqual({});

    const b = toggleStep(a, "2026-03-08", "PM", "exfoliant:salicylic_acid");
    expect(isDone(b, "2026-03-08", "PM", "exfoliant:salicylic_acid")).toBe(false);
    expect(isDone(a, "2026-03-08", "PM", "exfoliant:salicylic_acid")).toBe(true);
  });

  it("keeps AM and PM apart on the same day", () => {
    const log = toggleStep(EMPTY_LOG, "2026-03-08", "AM", "cleanser:-");
    expect(isDone(log, "2026-03-08", "AM", "cleanser:-")).toBe(true);
    expect(isDone(log, "2026-03-08", "PM", "cleanser:-")).toBe(false);
  });

  it("preserves the other session when writing one", () => {
    let log = toggleStep(EMPTY_LOG, "2026-03-08", "AM", "cleanser:-");
    log = toggleStep(log, "2026-03-08", "PM", "treatment:retinoid");
    expect(isDone(log, "2026-03-08", "AM", "cleanser:-")).toBe(true);
    expect(isDone(log, "2026-03-08", "PM", "treatment:retinoid")).toBe(true);
  });
});

describe("countInWindow", () => {
  const key = "exfoliant:salicylic_acid";
  function logOn(dates: string[]): RoutineLog {
    return dates.reduce((l, d) => toggleStep(l, d, "PM", key), EMPTY_LOG);
  }

  it("counts only days inside the window", () => {
    const log = logOn(["2026-03-08", "2026-03-06", "2026-03-02"]);
    expect(countInWindow(log, key, "PM", local(2026, 3, 8))).toBe(3);
  });

  it("includes the day exactly 6 days back and excludes 7 days back", () => {
    expect(countInWindow(logOn(["2026-03-02"]), key, "PM", local(2026, 3, 8))).toBe(1);
    expect(countInWindow(logOn(["2026-03-01"]), key, "PM", local(2026, 3, 8))).toBe(0);
  });

  it("counts across a month boundary", () => {
    const log = logOn(["2026-02-28", "2026-03-01"]);
    expect(countInWindow(log, key, "PM", local(2026, 3, 2))).toBe(2);
  });

  it("does not count the same step logged in the other session", () => {
    const log = toggleStep(EMPTY_LOG, "2026-03-08", "AM", key);
    expect(countInWindow(log, key, "PM", local(2026, 3, 8))).toBe(0);
  });

  it("is 0 for an empty log", () => {
    expect(countInWindow(EMPTY_LOG, key, "PM", local(2026, 3, 8))).toBe(0);
  });

  it("survives a log with junk in it", () => {
    const junk = { version: 1, days: { "2026-03-08": {} } } as RoutineLog;
    expect(countInWindow(junk, key, "PM", local(2026, 3, 8))).toBe(0);
  });
});

describe("daysLoggedBetween", () => {
  it("spans the day after the earlier check-in through the later one", () => {
    const r = daysLoggedBetween(EMPTY_LOG, local(2026, 3, 1).toISOString(), local(2026, 3, 31).toISOString());
    expect(r.totalDays).toBe(30);
    expect(r.daysLogged).toBe(0);
  });

  it("counts a day with anything logged in either session, once", () => {
    let log = toggleStep(EMPTY_LOG, "2026-03-02", "AM", "cleanser:-");
    log = toggleStep(log, "2026-03-02", "PM", "treatment:retinoid");
    log = toggleStep(log, "2026-03-05", "PM", "treatment:retinoid");
    const r = daysLoggedBetween(log, local(2026, 3, 1).toISOString(), local(2026, 3, 31).toISOString());
    expect(r.daysLogged).toBe(2);
    expect(r.totalDays).toBe(30);
  });

  it("ignores days outside the span", () => {
    const log = toggleStep(EMPTY_LOG, "2026-03-01", "PM", "treatment:retinoid");
    const r = daysLoggedBetween(log, local(2026, 3, 1).toISOString(), local(2026, 3, 10).toISOString());
    expect(r.daysLogged).toBe(0);
  });

  it("is zero-length when both check-ins are the same day", () => {
    const iso = local(2026, 3, 1).toISOString();
    expect(daysLoggedBetween(EMPTY_LOG, iso, iso)).toEqual({ daysLogged: 0, totalDays: 0 });
  });

  it("returns zeroes rather than throwing on an unreadable date", () => {
    expect(daysLoggedBetween(EMPTY_LOG, "nope", local(2026, 3, 1).toISOString())).toEqual({
      daysLogged: 0,
      totalDays: 0,
    });
  });

  it("counts a span crossing a year boundary", () => {
    const r = daysLoggedBetween(EMPTY_LOG, local(2025, 12, 20).toISOString(), local(2026, 1, 10).toISOString());
    expect(r.totalDays).toBe(21);
  });
});
