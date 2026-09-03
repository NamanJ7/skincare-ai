import { describe, expect, it } from "vitest";

import { emptyJournal, hydrateJournal } from "./hydrate";
import type { Journal } from "./types";
import type { IntakeResponse } from "../types/intake";
import type { PlanResult } from "../types/plan";
import type { Routine } from "../types/routine";

const TODAY = "2026-03-01";

function intake(over: Partial<IntakeResponse> = {}): IntakeResponse {
  return {
    age: 24,
    goals: ["acne"],
    skinType: "combination",
    sensitivity: "high",
    currentProducts: [],
    allergies: [],
    budget: "medium",
    fragrancePreference: "no_preference",
    pregnancyOrBreastfeeding: true,
    skinTone: "brown",
    darkMarkProne: true,
    climate: "temperate",
    ...over,
  };
}

function routine(): Routine {
  return {
    am: [
      {
        order: 1,
        category: "cleanser",
        frequencyPerWeek: 7,
        rationale: "Start clean.",
        irritationRisk: "low",
      },
    ],
    pm: [
      {
        order: 1,
        category: "treatment",
        active: "retinoid",
        frequencyPerWeek: 2,
        rationale: "Texture.",
        irritationRisk: "high",
      },
    ],
    notes: ["Patch-test."],
  };
}

function plan(): PlanResult {
  return {
    assessment: {
      findings: [],
      summary: "s",
      limitations: [],
      photoQuality: [],
      overallConfidence: 0.8,
      escalation: { recommendProfessional: false, reasons: [] },
    } as unknown as PlanResult["assessment"],
    routine: routine(),
    adjustments: [],
    mode: "ai",
  };
}

function full(): Journal {
  return {
    version: 1,
    startedOn: "2026-01-15",
    completed: { "2026-01-15:PM": [1, 2] },
    finished: ["2026-01-15:PM"],
    checkIns: [{ date: "2026-01-15", feel: "calm" }],
    intake: intake(),
    plan: plan(),
    baseline: {
      sessionId: "s1",
      capturedAt: "2026-01-15T10:00:00.000Z",
      assessment: plan().assessment,
    },
    routine: routine(),
    lastAdaptation: [],
  };
}

describe("hydrateJournal", () => {
  it("round-trips a complete journal through JSON without repair", () => {
    const original = full();
    const { journal, repaired } = hydrateJournal(JSON.parse(JSON.stringify(original)), TODAY);

    expect(repaired).toBe(false);
    expect(journal).toEqual(original);
  });

  // The whole point of W1: a restart must not lose the routine the user is on.
  it("preserves the plan's routine and the pregnancy flag across a round trip", () => {
    const { journal } = hydrateJournal(JSON.parse(JSON.stringify(full())), TODAY);

    expect(journal.plan?.routine.pm[0]?.active).toBe("retinoid");
    expect(journal.intake?.pregnancyOrBreastfeeding).toBe(true);
    expect(journal.intake?.sensitivity).toBe("high");
  });

  it("returns an empty journal for a missing file without flagging repair", () => {
    expect(hydrateJournal(undefined, TODAY)).toEqual({
      journal: emptyJournal(TODAY),
      repaired: false,
    });
  });

  it("flags repair for a non-object blob, so the bad file gets rewritten", () => {
    for (const blob of ["truncated{", 42, null, [1, 2, 3]]) {
      const { journal, repaired } = hydrateJournal(blob, TODAY);
      expect(repaired).toBe(true);
      expect(journal).toEqual(emptyJournal(TODAY));
    }
  });

  it("keeps the tick-offs when only the plan is unreadable", () => {
    const { journal, repaired } = hydrateJournal(
      { ...full(), plan: { routine: { am: "nope" } } },
      TODAY,
    );

    expect(repaired).toBe(true);
    expect(journal.plan).toBeUndefined();
    // A server shape change must not cost the user their streak.
    expect(journal.finished).toEqual(["2026-01-15:PM"]);
    expect(journal.completed).toEqual({ "2026-01-15:PM": [1, 2] });
    expect(journal.startedOn).toBe("2026-01-15");
  });

  // A half-read intake is worse than none: the missing half is filled with
  // defaults, and the default for pregnancyOrBreastfeeding is false.
  it("drops a partial intake entirely rather than half-reading it", () => {
    const { journal, repaired } = hydrateJournal(
      { ...full(), intake: { age: 24, goals: ["acne"] } },
      TODAY,
    );

    expect(repaired).toBe(true);
    expect(journal.intake).toBeUndefined();
  });

  it("treats an unrecognised plan mode as a mock", () => {
    const { journal } = hydrateJournal(
      { ...full(), plan: { ...plan(), mode: "something_new" } },
      TODAY,
    );

    expect(journal.plan?.mode).toBe("mock");
  });

  it("falls back to today when startedOn is missing or malformed", () => {
    expect(hydrateJournal({ completed: {} }, TODAY).journal.startedOn).toBe(TODAY);

    const bad = hydrateJournal({ startedOn: "15/01/2026" }, TODAY);
    expect(bad.journal.startedOn).toBe(TODAY);
    expect(bad.repaired).toBe(true);
  });

  it("discards malformed check-ins and sorts the survivors", () => {
    const { journal } = hydrateJournal(
      {
        checkIns: [
          { date: "2026-02-02", feel: "tight" },
          { date: "nope", feel: "calm" },
          { date: "2026-02-01", feel: "burning" },
          { date: "2026-01-31", feel: "stinging" },
        ],
      },
      TODAY,
    );

    expect(journal.checkIns).toEqual([
      { date: "2026-01-31", feel: "stinging" },
      { date: "2026-02-02", feel: "tight" },
    ]);
  });

  it("drops empty and non-numeric completed entries", () => {
    const { journal } = hydrateJournal(
      { completed: { "2026-02-01:AM": [], "2026-02-01:PM": [1, "2", null, 3] } },
      TODAY,
    );

    expect(journal.completed).toEqual({ "2026-02-01:PM": [1, 3] });
  });
});
