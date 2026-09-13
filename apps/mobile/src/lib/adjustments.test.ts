import { describe, expect, it } from "vitest";
import type { Routine, RoutineStep } from "@pore/shared";

import {
  isStrongActiveStep,
  missedPeriodCount,
  routineAdjustment,
  type AdjustmentKind,
  type RoutineAdjustmentContext,
} from "./adjustments";
import type { CheckIn, IrritationSign } from "./check-in";
import { emptyLog, type RoutineLog } from "./log";

const TODAY = "2026-07-10";

function step(active?: RoutineStep["active"]): RoutineStep {
  return {
    order: 1,
    category: active ? "treatment" : "cleanser",
    active,
    frequencyPerWeek: 7,
    rationale: "test",
    irritationRisk: "low",
  };
}

const STRONG: Routine = { am: [step()], pm: [step("retinoid")], notes: [] };
const GENTLE: Routine = { am: [step()], pm: [step("niacinamide")], notes: [] };

function checkIn(signs: IrritationSign[], date = TODAY): CheckIn {
  return {
    date,
    createdAt: `${date}T12:00:00.000Z`,
    skinFeel: 3,
    breakouts: "few",
    irritationSigns: signs,
    followedRoutine: "most",
  };
}

function completed(log: RoutineLog, date: string, period: "am" | "pm" = "am"): RoutineLog {
  log.days[date] = { ...log.days[date], [period]: { done: ["cleanser:base"], total: 1 } };
  return log;
}

function context(patch: Partial<RoutineAdjustmentContext> = {}): RoutineAdjustmentContext {
  return {
    today: TODAY,
    log: emptyLog(),
    routine: STRONG,
    escalated: false,
    dismissedKinds: [],
    period: "am",
    ...patch,
  };
}

describe("routineAdjustment priority", () => {
  it("suppresses every suggestion during escalation", () => {
    const log = completed(emptyLog(), TODAY);
    expect(
      routineAdjustment(context({ escalated: true, log, latestCheckIn: checkIn(["stinging"]) })),
    ).toBeNull();
  });

  for (const sign of ["stinging", "redness", "itching"] as IrritationSign[]) {
    it(`suggests pausing strong actives for ${sign}`, () => {
      expect(routineAdjustment(context({ latestCheckIn: checkIn([sign]) }))?.kind).toBe(
        "pause_strong_actives",
      );
    });
  }

  it("does not pause for dryness alone or a red-flag entry", () => {
    expect(routineAdjustment(context({ latestCheckIn: checkIn(["dryness_flaking"]) }))).toBeNull();
    expect(routineAdjustment(context({ latestCheckIn: checkIn(["burning"]) }))).toBeNull();
  });

  it("falls through when there is no strong active or the check-in is stale", () => {
    const log = completed(emptyLog(), TODAY);
    expect(
      routineAdjustment(context({ routine: GENTLE, log, latestCheckIn: checkIn(["redness"]) }))?.kind,
    ).toBe("simplify_today");
    expect(
      routineAdjustment(
        context({ log, latestCheckIn: checkIn(["stinging"], "2026-07-06") }),
      )?.kind,
    ).toBe("simplify_today");
  });

  it("pausing strong actives outranks simplification", () => {
    const log = completed(emptyLog(), TODAY);
    expect(
      routineAdjustment(context({ log, latestCheckIn: checkIn(["stinging"]) }))?.kind,
    ).toBe("pause_strong_actives");
  });
});

describe("simplify_today", () => {
  it("triggers at exactly two missed closed-day periods", () => {
    const log = completed(completed(emptyLog(), "2026-07-09", "am"), "2026-07-09", "pm");
    expect(missedPeriodCount(log, TODAY)).toBe(2);
    expect(routineAdjustment(context({ log }))?.kind).toBe("simplify_today");
  });

  it("does not trigger with one missed period", () => {
    let log = completed(emptyLog(), "2026-07-09", "am");
    log = completed(log, "2026-07-09", "pm");
    log = completed(log, "2026-07-08", "am");
    expect(missedPeriodCount(log, TODAY)).toBe(1);
    expect(routineAdjustment(context({ log }))?.kind).not.toBe("simplify_today");
  });

  it("never fires for an empty brand-new log", () => {
    expect(routineAdjustment(context())).toBeNull();
  });
});

describe("small_win", () => {
  it("fires below one-third consistency but not at the exact boundary", () => {
    const below = completed(completed(emptyLog(), TODAY), "2026-07-09");
    const dismissed: AdjustmentKind[] = ["pause_strong_actives", "simplify_today"];
    expect(routineAdjustment(context({ log: below, dismissedKinds: dismissed }))?.kind).toBe(
      "small_win",
    );

    const boundary = completed(completed(emptyLog(), TODAY), "2026-07-09");
    boundary.days["2026-07-08"] = { am: { done: ["one"], total: 3 } };
    expect(routineAdjustment(context({ log: boundary, dismissedKinds: dismissed }))).toBeNull();
  });
});

describe("dismissal fallthrough", () => {
  it("falls from pause to simplify, then to small win, then null", () => {
    const log = completed(emptyLog(), TODAY);
    const latestCheckIn = checkIn(["stinging"]);
    expect(
      routineAdjustment(context({ log, latestCheckIn, dismissedKinds: ["pause_strong_actives"] }))
        ?.kind,
    ).toBe("simplify_today");
    expect(
      routineAdjustment(
        context({
          log,
          latestCheckIn,
          dismissedKinds: ["pause_strong_actives", "simplify_today"],
        }),
      )?.kind,
    ).toBe("small_win");
    expect(
      routineAdjustment(
        context({
          log,
          latestCheckIn,
          dismissedKinds: ["pause_strong_actives", "simplify_today", "small_win"],
        }),
      ),
    ).toBeNull();
  });
});

describe("isStrongActiveStep", () => {
  it("uses the shared active classification", () => {
    expect(isStrongActiveStep(step("retinoid"))).toBe(true);
    expect(isStrongActiveStep(step("salicylic_acid"))).toBe(true);
    expect(isStrongActiveStep(step("niacinamide"))).toBe(false);
    expect(isStrongActiveStep(step())).toBe(false);
  });
});
