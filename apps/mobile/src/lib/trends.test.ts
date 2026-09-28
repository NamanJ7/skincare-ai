import { describe, expect, it } from "vitest";

import { addCheckIn, emptyCheckIns, type CheckIn, type CheckInLog } from "./check-in";
import { emptyLog, type RoutineLog } from "./log";
import { compareCheckIns, consistencyTrend, redFlags, weeklyReport } from "./trends";

function entry(date: string, patch: Partial<CheckIn> = {}): CheckIn {
  return {
    date,
    createdAt: `${date}T12:00:00.000Z`,
    skinFeel: 3,
    breakouts: "few",
    irritationSigns: [],
    followedRoutine: "most",
    ...patch,
  };
}

function checkIns(...entries: CheckIn[]): CheckInLog {
  return entries.reduce(addCheckIn, emptyCheckIns());
}

/** Build a log where each listed day has a fully-completed AM period. */
function logWithCompleteDays(...days: string[]): RoutineLog {
  const log = emptyLog();
  for (const d of days) {
    log.days[d] = { am: { done: ["cleanser:base"], total: 1 } };
  }
  return log;
}

const TODAY = "2026-07-05";
const LAST_WEEK = "2026-06-28";

describe("compareCheckIns", () => {
  it("returns nothing without a previous check-in", () => {
    expect(compareCheckIns(entry(TODAY), undefined)).toEqual([]);
  });

  it("reads breakout direction from the ordinal scale", () => {
    const better = compareCheckIns(
      entry(TODAY, { breakouts: "none" }),
      entry(LAST_WEEK, { breakouts: "several" }),
    );
    expect(better.find((s) => s.key === "breakouts")?.direction).toBe("better");

    const worse = compareCheckIns(
      entry(TODAY, { breakouts: "widespread" }),
      entry(LAST_WEEK, { breakouts: "few" }),
    );
    expect(worse.find((s) => s.key === "breakouts")?.direction).toBe("worse");
  });

  it("treats higher skinFeel as calmer (better)", () => {
    const statements = compareCheckIns(
      entry(TODAY, { skinFeel: 5 }),
      entry(LAST_WEEK, { skinFeel: 2 }),
    );
    expect(statements.find((s) => s.key === "skinFeel")?.direction).toBe("better");
  });

  it("adds an irritation statement only when the sign count moved", () => {
    const moved = compareCheckIns(
      entry(TODAY, { irritationSigns: ["redness", "stinging"] }),
      entry(LAST_WEEK, { irritationSigns: [] }),
    );
    expect(moved.find((s) => s.key === "irritation")?.direction).toBe("worse");

    const swapped = compareCheckIns(
      entry(TODAY, { irritationSigns: ["redness"] }),
      entry(LAST_WEEK, { irritationSigns: ["stinging"] }),
    );
    expect(swapped.find((s) => s.key === "irritation")).toBeUndefined();
  });

  it("reports newly-appeared and cleared signs, capped at two", () => {
    const statements = compareCheckIns(
      entry(TODAY, { irritationSigns: ["redness", "itching", "stinging"] }),
      entry(LAST_WEEK, { irritationSigns: ["dryness_flaking"] }),
    );
    const signs = statements.filter((s) => s.key.startsWith("sign:"));
    expect(signs).toHaveLength(2);
    expect(signs.every((s) => s.direction === "worse")).toBe(true);

    const cleared = compareCheckIns(
      entry(TODAY, { irritationSigns: [] }),
      entry(LAST_WEEK, { irritationSigns: ["redness"] }),
    );
    const clearedSign = cleared.find((s) => s.key === "sign:redness");
    expect(clearedSign?.direction).toBe("better");
  });

  it("fills noticed/why/next on every statement", () => {
    const statements = compareCheckIns(
      entry(TODAY, { breakouts: "widespread", skinFeel: 1, irritationSigns: ["burning"] }),
      entry(LAST_WEEK),
    );
    for (const s of statements) {
      expect(s.noticed.length).toBeGreaterThan(0);
      expect(s.why.length).toBeGreaterThan(0);
      expect(s.next.length).toBeGreaterThan(0);
    }
  });
});

describe("consistencyTrend", () => {
  it("is better when this week beats last week by more than 10 points", () => {
    // This week: 5 complete days; last week: 1.
    const log = logWithCompleteDays(
      "2026-07-05",
      "2026-07-04",
      "2026-07-03",
      "2026-07-02",
      "2026-07-01",
      "2026-06-25",
    );
    expect(consistencyTrend(log, TODAY).direction).toBe("better");
  });

  it("is worse when this week drops by more than 10 points", () => {
    const log = logWithCompleteDays("2026-06-28", "2026-06-27", "2026-06-26", "2026-06-25");
    expect(consistencyTrend(log, TODAY).direction).toBe("worse");
  });

  it("is stable inside the threshold", () => {
    const log = logWithCompleteDays("2026-07-03", "2026-06-26");
    expect(consistencyTrend(log, TODAY).direction).toBe("stable");
  });
});

describe("weeklyReport", () => {
  it("is null with zero check-ins", () => {
    expect(weeklyReport(emptyCheckIns(), emptyLog(), TODAY)).toBeNull();
  });

  it("marks a single check-in as baseline with no comparison statements", () => {
    const report = weeklyReport(checkIns(entry(TODAY)), emptyLog(), TODAY);
    expect(report?.baseline).toBe(true);
    expect(report?.statements.map((s) => s.key)).toEqual(["consistency"]);
  });

  it("counts completed days into the completed line", () => {
    const log = logWithCompleteDays("2026-07-05", "2026-07-04", "2026-07-03");
    const report = weeklyReport(checkIns(entry(TODAY)), log, TODAY);
    expect(report?.completedLine).toBe("You completed your routine 3 of 7 days.");
  });

  it("prioritizes red flags over everything in the recommendation", () => {
    const log = checkIns(
      entry(LAST_WEEK),
      entry(TODAY, { breakouts: "widespread", irritationSigns: ["burning"] }),
    );
    const report = weeklyReport(log, emptyLog(), TODAY);
    expect(report?.recommendation).toContain("professional");
  });

  it("recommends scaling actives back when irritation worsened", () => {
    const log = checkIns(entry(LAST_WEEK), entry(TODAY, { irritationSigns: ["redness", "stinging"] }));
    const report = weeklyReport(log, emptyLog(), TODAY);
    expect(report?.recommendation).toContain("lowest frequency");
  });

  it("recommends stability when something else worsened", () => {
    const log = checkIns(entry(LAST_WEEK, { breakouts: "none" }), entry(TODAY, { breakouts: "several" }));
    const report = weeklyReport(log, emptyLog(), TODAY);
    expect(report?.recommendation).toContain("stable");
  });

  it("celebrates when everything is stable or better", () => {
    const log = checkIns(entry(LAST_WEEK), entry(TODAY));
    const report = weeklyReport(log, emptyLog(), TODAY);
    expect(report?.recommendation).toContain("Keep going");
  });
});

describe("redFlags", () => {
  const assessment = {
    findings: [],
    escalation: { recommendProfessional: true, reasons: ["appears painful"] },
    summary: "",
    disclaimer: "",
  };

  it("merges check-in signs with assessment escalation reasons", () => {
    const result = redFlags(entry(TODAY, { irritationSigns: ["burning"] }), assessment);
    expect(result.escalate).toBe(true);
    expect(result.reasons).toEqual(["burning", "appears painful"]);
  });

  it("does not escalate on ordinary signs without assessment flags", () => {
    const calm = redFlags(entry(TODAY, { irritationSigns: ["redness"] }), undefined);
    expect(calm.escalate).toBe(false);
    expect(calm.reasons).toEqual([]);
  });

  it("escalates from the assessment alone", () => {
    const result = redFlags(undefined, assessment);
    expect(result.escalate).toBe(true);
    expect(result.reasons).toEqual(["appears painful"]);
  });
});
