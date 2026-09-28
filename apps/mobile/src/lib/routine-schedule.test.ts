import { describe, expect, it } from "vitest";
import type { Routine, RoutineStep } from "@pore/shared";

import { routineStepInstances } from "./log";
import {
  WEEKLY_OFFSETS,
  isStepScheduled,
  nextScheduledDate,
  normalizedWeeklyFrequency,
  routineFingerprint,
  scheduleOffset,
  scheduledStepInstances,
} from "./routine-schedule";

function step(
  frequencyPerWeek: number,
  active?: RoutineStep["active"],
): RoutineStep {
  return {
    order: 1,
    category: active ? "treatment" : "cleanser",
    active,
    frequencyPerWeek,
    rationale: "test",
    irritationRisk: active ? "high" : "low",
  };
}

describe("routine scheduling", () => {
  it("uses the approved offsets for every weekly frequency", () => {
    for (let frequency = 1; frequency <= 7; frequency += 1) {
      const due = Array.from({ length: 14 }, (_, day) =>
        isStepScheduled(
          step(frequency),
          "2026-09-07",
          `2026-09-${String(7 + day).padStart(2, "0")}`,
        ),
      );
      expect(due.slice(0, 7).filter(Boolean)).toHaveLength(frequency);
      expect(due.slice(7)).toEqual(due.slice(0, 7));
      expect(WEEKLY_OFFSETS[frequency]).toHaveLength(frequency);
    }
  });

  it("keeps one-to-three-times weekly strong steps non-consecutive", () => {
    for (const frequency of [1, 2, 3]) {
      const offsets = WEEKLY_OFFSETS[frequency];
      for (let index = 1; index < offsets.length; index += 1) {
        expect(offsets[index] - offsets[index - 1]).toBeGreaterThan(1);
      }
      expect(7 + offsets[0] - offsets[offsets.length - 1]).toBeGreaterThan(1);
    }
  });

  it("uses UTC calendar math through DST and year boundaries", () => {
    expect(scheduleOffset("2026-03-07", "2026-03-08")).toBe(1);
    expect(scheduleOffset("2026-12-31", "2027-01-01")).toBe(1);
    expect(scheduleOffset("2028-02-28", "2028-02-29")).toBe(1);
  });

  it("normalizes unsafe or malformed frequencies conservatively", () => {
    expect(normalizedWeeklyFrequency(0)).toBe(1);
    expect(normalizedWeeklyFrequency(Number.NaN)).toBe(1);
    expect(normalizedWeeklyFrequency(3.4)).toBe(3);
    expect(normalizedWeeklyFrequency(20)).toBe(7);
  });

  it("keeps legacy keys for first occurrences and suffixes duplicates", () => {
    const instances = routineStepInstances([step(7), step(7), step(7)]);
    expect(instances.map(({ key }) => key)).toEqual([
      "cleanser:base",
      "cleanser:base#2",
      "cleanser:base#3",
    ]);
  });

  it("fingerprints structure and profile revision but not display copy", () => {
    const routine: Routine = {
      am: [step(7)],
      pm: [step(2, "retinoid")],
      notes: [],
    };
    const original = routineFingerprint(routine, 1);
    const copyChanged = {
      ...routine,
      pm: [{ ...routine.pm[0], rationale: "new explanation" }],
    };
    expect(routineFingerprint(copyChanged, 1)).toBe(original);
    expect(routineFingerprint(routine, 2)).not.toBe(original);
    expect(
      routineFingerprint({ ...routine, pm: [step(3, "retinoid")] }, 1),
    ).not.toBe(original);
  });

  it("returns only due instances and the next due date", () => {
    const routine: Routine = {
      am: [step(7), step(2, "retinoid")],
      pm: [],
      notes: [],
    };
    const schedule = { fingerprint: "test", anchorDate: "2026-09-07" };
    expect(
      scheduledStepInstances(routine, "am", schedule, "2026-09-08").map(
        ({ key }) => key,
      ),
    ).toEqual(["cleanser:base"]);
    expect(nextScheduledDate(routine.am[1], schedule, "2026-09-08")).toBe(
      "2026-09-10",
    );
  });
});
