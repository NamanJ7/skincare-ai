import { describe, expect, it } from "vitest";

import type { Assessment, AppearanceLevel, ConcernKey, PhotoQuality } from "../types/assessment";
import type { IntakeResponse } from "../types/intake";
import type { ActiveKey, Routine, RoutineStep } from "../types/routine";
import { ESCALATE_AFTER_WEEKS, adaptRoutine, compareAssessments } from "./engine";

const T0 = "2026-01-01T09:00:00.000Z";
const T1 = "2026-03-01T09:00:00.000Z"; // 59 days later

function photo(over: Partial<PhotoQuality> = {}): PhotoQuality {
  return { angle: "front", score: 0.9, flags: [], illuminant: "screen_flash", ...over };
}

function assessment(
  findings: Array<[ConcernKey, AppearanceLevel, number?]>,
  photos: PhotoQuality[] = [photo()],
): Assessment {
  return {
    findings: findings.map(([concern, appearanceLevel, confidence = 0.9]) => ({
      concern,
      present: appearanceLevel !== "none",
      appearanceLevel,
      confidence,
      contributingFactors: [],
      regions: [],
    })),
    escalation: { recommendProfessional: false, reasons: [] },
    summary: "",
    disclaimer: "",
    photoQuality: photos,
    overallConfidence: 0.8,
    limitations: [],
  };
}

function intake(over: Partial<IntakeResponse> = {}): IntakeResponse {
  return {
    age: 28,
    goals: ["acne"],
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

function routine(): Routine {
  return {
    am: [step(1, "cleanser", undefined, 7), step(2, "sunscreen", undefined, 7)],
    pm: [step(1, "cleanser", undefined, 7), step(2, "exfoliant", "salicylic_acid", 3)],
    notes: [],
  };
}

const at = { before: T0, after: T1 };

describe("comparability gate", () => {
  it("refuses to compare when the newer set was shot in ambient light", () => {
    const report = compareAssessments(
      assessment([["acne_like_breakouts", "moderate"]]),
      assessment([["acne_like_breakouts", "mild"]], [photo({ illuminant: "ambient" })]),
      at,
    );
    expect(report.comparable).toBe(false);
    expect(report.concerns).toHaveLength(0);
    expect(report.blockedReason).toContain("screen flash");
  });

  it("refuses when the newer photos failed the capture gate", () => {
    const report = compareAssessments(
      assessment([["acne_like_breakouts", "moderate"]]),
      assessment([["acne_like_breakouts", "mild"]], [photo({ flags: ["dark"] })]),
      at,
    );
    expect(report.comparable).toBe(false);
  });

  it("compares when at least one angle is measurable in both sets", () => {
    const report = compareAssessments(
      assessment(
        [["acne_like_breakouts", "moderate"]],
        [photo({ angle: "front" }), photo({ angle: "left", flags: ["dark"] })],
      ),
      assessment(
        [["acne_like_breakouts", "mild"]],
        [photo({ angle: "front" }), photo({ angle: "right" })],
      ),
      at,
    );
    expect(report.comparable).toBe(true);
  });

  it("never claims a direction it is refusing to measure", () => {
    const report = compareAssessments(
      assessment([["acne_like_breakouts", "noticeable"]]),
      assessment([["acne_like_breakouts", "none"]], [photo({ illuminant: "ambient" })]),
      at,
    );
    expect(report.headline).not.toMatch(/better/i);
  });
});

describe("the diff", () => {
  it("reads a drop in band as improvement", () => {
    const report = compareAssessments(
      assessment([["acne_like_breakouts", "noticeable"]]),
      assessment([["acne_like_breakouts", "mild"]]),
      at,
    );
    expect(report.concerns[0]?.direction).toBe("improved");
    expect(report.concerns[0]?.bandDelta).toBe(-2);
  });

  it("reads a rise in band as worse", () => {
    const report = compareAssessments(
      assessment([["irritation_signs", "none"]]),
      assessment([["irritation_signs", "moderate"]]),
      at,
    );
    expect(report.concerns[0]?.direction).toBe("worse");
    expect(report.concerns[0]?.bandDelta).toBe(2);
  });

  it("declines a concern either assessment was unsure about", () => {
    const report = compareAssessments(
      assessment([["uneven_tone", "moderate", 0.4]]),
      assessment([["uneven_tone", "mild", 0.95]]),
      at,
    );
    expect(report.concerns[0]?.direction).toBe("not_comparable");
    expect(report.concerns[0]?.reason).toContain("confident");
  });

  it("declines a concern the newer assessment did not cover", () => {
    const report = compareAssessments(
      assessment([["acne_like_breakouts", "mild"], ["oiliness", "moderate"]]),
      assessment([["acne_like_breakouts", "mild"]]),
      at,
    );
    expect(report.concerns.find((c) => c.concern === "oiliness")?.direction).toBe("not_comparable");
  });

  it("counts elapsed days between the two sessions", () => {
    expect(compareAssessments(assessment([]), assessment([]), at).daysBetween).toBe(59);
  });
});

describe("adaptation — worsening", () => {
  it("eases actives back when irritation is up", () => {
    const report = compareAssessments(
      assessment([["irritation_signs", "none"]]),
      assessment([["irritation_signs", "moderate"]]),
      at,
    );
    const out = adaptRoutine(routine(), report, {
      intake: intake(),
      weeksOnRoutine: 10,
      adherence: 1,
    });
    const acid = [...out.routine.am, ...out.routine.pm].find((s) => s.active === "salicylic_acid");
    expect(acid?.frequencyPerWeek).toBe(2);
    expect(out.adjustments[0]?.action).toBe("deload_on_worsening");
  });

  it("eases back when two separate concerns worsen", () => {
    const report = compareAssessments(
      assessment([["oiliness", "mild"], ["uneven_tone", "mild"]]),
      assessment([["oiliness", "moderate"], ["uneven_tone", "moderate"]]),
      at,
    );
    const out = adaptRoutine(routine(), report, {
      intake: intake(),
      weeksOnRoutine: 10,
      adherence: 1,
    });
    expect(out.adjustments[0]?.action).toBe("deload_on_worsening");
  });

  it("does not act on a single worsening concern", () => {
    const report = compareAssessments(
      assessment([["oiliness", "mild"]]),
      assessment([["oiliness", "moderate"]]),
      at,
    );
    const out = adaptRoutine(routine(), report, {
      intake: intake(),
      weeksOnRoutine: 2,
      adherence: 1,
    });
    expect(out.adjustments[0]?.action).not.toBe("deload_on_worsening");
  });

  it("points at a professional rather than reducing below once a week", () => {
    const gentle: Routine = {
      am: [step(1, "sunscreen", undefined, 7)],
      pm: [step(1, "exfoliant", "salicylic_acid", 1)],
      notes: [],
    };
    const report = compareAssessments(
      assessment([["irritation_signs", "none"]]),
      assessment([["irritation_signs", "noticeable"]]),
      at,
    );
    const out = adaptRoutine(gentle, report, {
      intake: intake(),
      weeksOnRoutine: 10,
      adherence: 1,
    });
    expect(out.adjustments[0]?.detail).toContain("pharmacist or doctor");
    const acid = [...out.routine.am, ...out.routine.pm].find((s) => s.active === "salicylic_acid");
    expect(acid?.frequencyPerWeek).toBe(1);
  });
});

describe("adaptation — escalation gates", () => {
  const stalled = () =>
    compareAssessments(
      assessment([["acne_like_breakouts", "moderate"]]),
      assessment([["acne_like_breakouts", "moderate"]]),
      at,
    );

  it("steps one active up when consistent and genuinely stalled", () => {
    const out = adaptRoutine(routine(), stalled(), {
      intake: intake(),
      weeksOnRoutine: ESCALATE_AFTER_WEEKS,
      adherence: 0.95,
    });
    expect(out.adjustments[0]?.action).toBe("escalate_frequency");
    const acid = [...out.routine.am, ...out.routine.pm].find((s) => s.active === "salicylic_acid");
    expect(acid?.frequencyPerWeek).toBe(4);
  });

  it("names adherence rather than escalating a routine that isn't being done", () => {
    const out = adaptRoutine(routine(), stalled(), {
      intake: intake(),
      weeksOnRoutine: ESCALATE_AFTER_WEEKS,
      adherence: 0.4,
    });
    expect(out.adjustments[0]?.action).toBe("adherence_first");
    const acid = [...out.routine.am, ...out.routine.pm].find((s) => s.active === "salicylic_acid");
    expect(acid?.frequencyPerWeek).toBe(3);
  });

  it("does not escalate before the routine has had a fair run", () => {
    const out = adaptRoutine(routine(), stalled(), {
      intake: intake(),
      weeksOnRoutine: 3,
      adherence: 1,
    });
    expect(out.adjustments[0]?.action).toBe("hold_steady");
    expect(out.adjustments[0]?.detail).toContain("eight to twelve weeks");
  });

  it("holds steady while anything is improving", () => {
    const report = compareAssessments(
      assessment([["acne_like_breakouts", "noticeable"]]),
      assessment([["acne_like_breakouts", "mild"]]),
      at,
    );
    const out = adaptRoutine(routine(), report, {
      intake: intake(),
      weeksOnRoutine: 20,
      adherence: 1,
    });
    expect(out.adjustments[0]?.action).toBe("hold_steady");
    const acid = [...out.routine.am, ...out.routine.pm].find((s) => s.active === "salicylic_acid");
    expect(acid?.frequencyPerWeek).toBe(3);
  });

  it("changes nothing when the sets were not comparable", () => {
    const report = compareAssessments(
      assessment([["acne_like_breakouts", "moderate"]]),
      assessment([["acne_like_breakouts", "moderate"]], [photo({ illuminant: "ambient" })]),
      at,
    );
    const out = adaptRoutine(routine(), report, {
      intake: intake(),
      weeksOnRoutine: 30,
      adherence: 1,
    });
    expect(out.adjustments[0]?.action).toBe("insufficient_evidence");
    const acid = [...out.routine.am, ...out.routine.pm].find((s) => s.active === "salicylic_acid");
    expect(acid?.frequencyPerWeek).toBe(3);
  });
});

describe("the safety engine still has the last word", () => {
  it("cannot escalate an active past the pregnancy filter", () => {
    const withRetinoid: Routine = {
      am: [step(1, "sunscreen", undefined, 7)],
      pm: [step(1, "treatment", "retinoid", 3)],
      notes: [],
    };
    const report = compareAssessments(
      assessment([["fine_line_appearance", "moderate"]]),
      assessment([["fine_line_appearance", "moderate"]]),
      at,
    );
    const out = adaptRoutine(withRetinoid, report, {
      intake: intake({ goals: ["fine_lines"], pregnancyOrBreastfeeding: true }),
      weeksOnRoutine: ESCALATE_AFTER_WEEKS,
      adherence: 1,
    });
    // Adaptation proposed a step up; the safety clamp removed it entirely.
    expect([...out.routine.am, ...out.routine.pm].some((s) => s.active === "retinoid")).toBe(false);
    expect(out.safetyAdjustments.some((a) => a.rule === "pregnancy_unsafe_removed")).toBe(true);
  });

  it("cannot escalate a retinoid past its clamped ceiling", () => {
    const withRetinoid: Routine = {
      am: [step(1, "sunscreen", undefined, 7)],
      pm: [step(1, "treatment", "retinoid", 3)],
      notes: [],
    };
    const report = compareAssessments(
      assessment([["texture_congestion", "moderate"]]),
      assessment([["texture_congestion", "moderate"]]),
      at,
    );
    const out = adaptRoutine(withRetinoid, report, {
      intake: intake({ goals: ["texture"], sensitivity: "high" }),
      weeksOnRoutine: ESCALATE_AFTER_WEEKS,
      adherence: 1,
    });
    const retinoid = out.routine.pm.find((s) => s.active === "retinoid");
    // High sensitivity clamps retinoids to 2x/week no matter what we proposed.
    expect(retinoid?.frequencyPerWeek).toBeLessThanOrEqual(2);
  });

  it("always returns a routine with sunscreen, whatever path it took", () => {
    const paths = [
      { weeksOnRoutine: 2, adherence: 1 },
      { weeksOnRoutine: ESCALATE_AFTER_WEEKS, adherence: 0.2 },
      { weeksOnRoutine: ESCALATE_AFTER_WEEKS, adherence: 1 },
    ];
    for (const p of paths) {
      const out = adaptRoutine(
        routine(),
        compareAssessments(
          assessment([["acne_like_breakouts", "moderate"]]),
          assessment([["acne_like_breakouts", "moderate"]]),
          at,
        ),
        { intake: intake(), ...p },
      );
      expect(out.routine.am.some((s) => s.category === "sunscreen")).toBe(true);
    }
  });
});
