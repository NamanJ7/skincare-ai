import { describe, expect, it } from "vitest";
import type { Routine, RoutineStep } from "@pore/shared";

import {
  isStrongActiveStep,
  missedPeriodCount,
  repeatedNotNowStep,
  lowCompletionHistory,
  routineAdjustment,
  type AdjustmentKind,
  type RoutineAdjustmentContext,
} from "./adjustments";
import type { CheckIn, IrritationSign } from "./check-in";
import {
  emptyLog,
  type LatestRoutineReaction,
  type RoutineLog,
  type RoutineReactionKind,
} from "./log";

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
const GENTLE: Routine = { am: [step()], pm: [step(), step("niacinamide")], notes: [] };

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

function completed(
  log: RoutineLog,
  date: string,
  period: "am" | "pm" = "am",
): RoutineLog {
  log.days[date] = {
    ...log.days[date],
    [period]: { done: ["cleanser:base"], total: 1 },
  };
  return log;
}

function context(
  patch: Partial<RoutineAdjustmentContext> = {},
): RoutineAdjustmentContext {
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

function reaction(
  kind: RoutineReactionKind,
  containedStrongActive = false,
  date = TODAY,
): LatestRoutineReaction {
  return {
    date,
    period: "pm",
    reaction: { kind, recordedAt: `${date}T20:00:00.000Z` },
    containedStrongActive,
  };
}

describe("post-routine reaction priority", () => {
  it("stores comfortable without creating a suggestion", () => {
    expect(
      routineAdjustment(
        context({ latestRoutineReaction: reaction("comfortable") }),
      ),
    ).toBeNull();
  });

  it("makes Minimum Mode eligible after tight or dry discomfort", () => {
    expect(
      routineAdjustment(
        context({ latestRoutineReaction: reaction("tight_dry") }),
      )?.kind,
    ).toBe("simplify_today");
  });

  it("prioritizes Recovery Mode for mild discomfort with a strong active", () => {
    expect(
      routineAdjustment(
        context({
          latestRoutineReaction: reaction("mild_irritation", true),
        }),
      )?.kind,
    ).toBe("pause_strong_actives");
  });

  it("uses Minimum Mode for mild discomfort without a strong active", () => {
    expect(
      routineAdjustment(
        context({ latestRoutineReaction: reaction("mild_irritation") }),
      )?.kind,
    ).toBe("simplify_today");
  });

  it("suppresses routine coaching for a serious self-report", () => {
    const log = completed(emptyLog(), TODAY);
    expect(
      routineAdjustment(
        context({
          log,
          latestRoutineReaction: reaction("serious_reaction", true),
        }),
      ),
    ).toBeNull();
  });

  it("expires reaction eligibility at the calendar-day boundaries", () => {
    expect(
      routineAdjustment(
        context({
          latestRoutineReaction: reaction("tight_dry", false, "2026-07-07"),
        }),
      ),
    ).toBeNull();
    expect(
      routineAdjustment(
        context({
          latestRoutineReaction: reaction(
            "mild_irritation",
            true,
            "2026-07-06",
          ),
        }),
      ),
    ).toBeNull();
  });
});

describe("routineAdjustment priority", () => {
  it("suppresses every suggestion during escalation", () => {
    const log = completed(emptyLog(), TODAY);
    expect(
      routineAdjustment(
        context({ escalated: true, log, latestCheckIn: checkIn(["stinging"]) }),
      ),
    ).toBeNull();
  });

  for (const sign of ["stinging", "redness", "itching"] as IrritationSign[]) {
    it(`suggests pausing strong actives for ${sign}`, () => {
      expect(
        routineAdjustment(context({ latestCheckIn: checkIn([sign]) }))?.kind,
      ).toBe("pause_strong_actives");
    });
  }

  it("does not pause for dryness alone or a red-flag entry", () => {
    expect(
      routineAdjustment(
        context({ latestCheckIn: checkIn(["dryness_flaking"]) }),
      ),
    ).toBeNull();
    expect(
      routineAdjustment(context({ latestCheckIn: checkIn(["burning"]) })),
    ).toBeNull();
  });

  it("falls through when there is no strong active or the check-in is stale", () => {
    const log = completed(emptyLog(), TODAY);
    expect(
      routineAdjustment(
        context({ routine: GENTLE, log, latestCheckIn: checkIn(["redness"]) }),
      )?.kind,
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
      routineAdjustment(context({ log, latestCheckIn: checkIn(["stinging"]) }))
        ?.kind,
    ).toBe("pause_strong_actives");
  });
});

describe("simplify_today", () => {
  it("recognizes two not-now skips across three scheduled occurrences", () => {
    const log = emptyLog();
    for (const [date, skipped] of [["2026-07-07", false], ["2026-07-08", true], ["2026-07-09", true]] as const) {
      log.days[date] = { pm: {
        done: skipped ? [] : ["cleanser:base"], total: 1,
        scheduledStepKeys: ["cleanser:base"],
        ...(skipped ? { skipped: { "cleanser:base": { reason: "not_now" as const, recordedAt: `${date}T20:00:00Z` } } } : {}),
      } };
    }
    expect(repeatedNotNowStep(log, TODAY, "pm", GENTLE)?.category).toBe("cleanser");
    expect(routineAdjustment(context({ log, routine: GENTLE, period: "pm" }))?.kind).toBe("simplify_today");
  });

  it("does not treat ran-out products as adherence skips", () => {
    const log = emptyLog();
    for (const date of ["2026-07-07", "2026-07-08", "2026-07-09"]) {
      log.days[date] = { pm: {
        done: [], total: 1, scheduledStepKeys: ["cleanser:base"],
        skipped: { "cleanser:base": { reason: "ran_out", recordedAt: `${date}T20:00:00Z` } },
      } };
    }
    expect(repeatedNotNowStep(log, TODAY, "pm", GENTLE)).toBeUndefined();
    expect(routineAdjustment(context({ log, routine: GENTLE, period: "pm" }))?.kind).toBe("product_maintenance");
  });

  it("requires three actually logged low-completion periods", () => {
    const log = emptyLog();
    for (const date of ["2026-07-07", "2026-07-08", "2026-07-09"]) {
      log.days[date] = { pm: { done: [], total: 3, scheduledStepKeys: ["a", "b", "c"] } };
    }
    expect(lowCompletionHistory(log, TODAY)).toBe(true);
    expect(lowCompletionHistory(emptyLog(), TODAY)).toBe(false);
  });
  it("triggers at exactly two missed closed-day periods", () => {
    const log = completed(
      completed(emptyLog(), "2026-07-09", "am"),
      "2026-07-09",
      "pm",
    );
    expect(missedPeriodCount(log, TODAY)).toBe(2);
    expect(routineAdjustment(context({ log }))?.kind).toBe("simplify_today");
  });

  it("does not trigger with one missed period", () => {
    let log = completed(emptyLog(), "2026-07-09", "am");
    log = completed(log, "2026-07-09", "pm");
    log = completed(log, "2026-07-08", "am");
    expect(missedPeriodCount(log, TODAY)).toBe(1);
    expect(routineAdjustment(context({ log }))?.kind).not.toBe(
      "simplify_today",
    );
  });

  it("never fires for an empty brand-new log", () => {
    expect(routineAdjustment(context())).toBeNull();
  });
});

describe("small_win", () => {
  it("fires below one-third consistency but not at the exact boundary", () => {
    const below = completed(completed(emptyLog(), TODAY), "2026-07-09");
    const dismissed: AdjustmentKind[] = [
      "pause_strong_actives",
      "simplify_today",
    ];
    expect(
      routineAdjustment(context({ log: below, dismissedKinds: dismissed }))
        ?.kind,
    ).toBe("small_win");

    const boundary = completed(completed(emptyLog(), TODAY), "2026-07-09");
    boundary.days["2026-07-08"] = { am: { done: ["one"], total: 3 } };
    expect(
      routineAdjustment(context({ log: boundary, dismissedKinds: dismissed })),
    ).toBeNull();
  });
});

describe("dismissal fallthrough", () => {
  it("falls from pause to simplify, then to small win, then null", () => {
    const log = completed(emptyLog(), TODAY);
    const latestCheckIn = checkIn(["stinging"]);
    expect(
      routineAdjustment(
        context({
          log,
          latestCheckIn,
          dismissedKinds: ["pause_strong_actives"],
        }),
      )?.kind,
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
          dismissedKinds: [
            "pause_strong_actives",
            "simplify_today",
            "small_win",
          ],
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
