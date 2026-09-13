import { describe, expect, it } from "vitest";

import type { Assessment, Routine, RoutineStep } from "@pore/shared";

import type { PlanResult } from "./api";
import {
  activeRoutineRevision,
  routineFor,
  routineShelfAssignments,
  routineSourceNote,
} from "./plan";
import { normalizeProfile } from "./profile";
import type { OnboardingData } from "@/state/onboarding";

function assessment(): Assessment {
  return {
    findings: [],
    escalation: { recommendProfessional: false, reasons: [] },
    summary: "",
    disclaimer: "",
  };
}

function plan(scanId?: string): PlanResult {
  return {
    mode: "ai",
    routine: { am: [], pm: [], notes: [] },
    adjustments: [],
    assessment: assessment(),
    ...(scanId ? { scanId } : {}),
  };
}

const AT = "2026-07-11T00:00:00.000Z";

function step(
  order: number,
  category: RoutineStep["category"],
  active?: RoutineStep["active"],
): RoutineStep {
  return {
    order,
    category,
    active,
    frequencyPerWeek: 7,
    rationale: "Test step.",
    irritationRisk: "low",
  };
}

describe("routineSourceNote", () => {
  it("credits the scan when the current analysis is valid", () => {
    const data: OnboardingData = {
      plan: plan("scan-1"),
      scannedAt: AT,
      analysisStatus: {
        kind: "scan_analyzed",
        scanId: "scan-1",
        analyzedAt: AT,
      },
    };
    expect(routineSourceNote(data)).toBe("Based on your scan and answers.");
  });

  it("dates a kept prior scan after a failed rescan (never implies fresh analysis)", () => {
    const data: OnboardingData = {
      plan: plan("scan-1"),
      scannedAt: AT,
      analysisStatus: {
        kind: "answers_only",
        reason: "analysis_failed",
        attemptedAt: AT,
      },
    };
    const note = routineSourceNote(data);
    expect(note).toContain("your last scan on");
    expect(note).toContain("and your answers");
  });

  it("credits only the answers when there is no plan", () => {
    expect(routineSourceNote({})).toBe(
      "Based on your answers. Add a clear scan to sharpen this.",
    );
  });
});

describe("routineFor", () => {
  it("builds a different answer-only target when the ranked goal changes", () => {
    const acne = routineFor({
      age: 24,
      goals: ["acne"],
      primaryGoal: "acne",
      sensitivity: "medium",
      routineComplexity: "minimal",
    }).routine;
    const dryness = routineFor({
      age: 24,
      goals: ["dryness"],
      primaryGoal: "dryness",
      sensitivity: "medium",
      routineComplexity: "minimal",
    }).routine;

    // Gentle actives, because nothing has looked at this skin yet: the
    // answer-only routine still tracks the ranked goal, it just cannot reach
    // for salicylic acid or benzoyl peroxide on a stated goal alone.
    expect(
      [...acne.am, ...acne.pm].some((item) => item.active === "azelaic_acid"),
    ).toBe(true);
    expect(
      [...dryness.am, ...dryness.pm].some(
        (item) => item.active === "hyaluronic_acid",
      ),
    ).toBe(true);
  });

  it("never introduces a strong active without a scan to justify it", () => {
    const answersOnly = routineFor({
      age: 24,
      goals: ["acne", "texture", "fine_lines"],
      primaryGoal: "acne",
      sensitivity: "low",
      routineComplexity: "flexible",
    });
    const actives = [...answersOnly.routine.am, ...answersOnly.routine.pm]
      .map((item) => item.active)
      .filter(Boolean);

    // Goals alone used to be enough to hand out retinoid and benzoyl peroxide,
    // which made a FAILED scan a softer gate than a passed one.
    expect(actives).not.toContain("retinoid");
    expect(actives).not.toContain("benzoyl_peroxide");
    expect(actives).not.toContain("salicylic_acid");
    expect(actives).not.toContain("mandelic_acid");
    expect(
      answersOnly.adjustments.some(
        (adjustment) => adjustment.rule === "unverified_evidence_capped",
      ),
    ).toBe(true);
    expect(answersOnly.routine.notes.join(" ")).toContain(
      "Strong active treatments wait for a scan",
    );
    // Still a usable routine, not an empty one.
    expect(
      answersOnly.routine.am.some((item) => item.category === "sunscreen"),
    ).toBe(true);
  });

  it("turns routine complexity into a real optional-step limit", () => {
    // Goals whose actives are all gentle, so this measures the complexity cap
    // rather than the separate no-strong-active-without-a-scan rule.
    const base: OnboardingData = {
      age: 32,
      goals: ["post_acne_marks", "hyperpigmentation", "dryness"],
      sensitivity: "low",
    };
    const minimal = routineFor({
      ...base,
      routineComplexity: "minimal",
    }).routine;
    const flexible = routineFor({
      ...base,
      routineComplexity: "flexible",
    }).routine;
    const count = (routine: Routine) =>
      [...routine.am, ...routine.pm].filter((item) => item.active).length;

    expect(count(minimal)).toBe(1);
    expect(count(flexible)).toBeGreaterThan(count(minimal));
  });

  it("uses skin type, exact age, fragrance, and other restrictions in visible guidance", () => {
    const result = routineFor({
      age: 22,
      goals: ["texture"],
      skinType: "dry",
      sensitivity: "low",
      routineComplexity: "flexible",
      allergies: ["fragrance"],
      fragrancePreference: "fragrance_free",
      allergyNotes: "Avoid lanolin",
    }).routine;

    // The dry-skin exfoliating-acid clamp is exercised in
    // packages/shared/src/safety/personalization.test.ts; on this answer-only
    // path no exfoliating acid exists to clamp.
    expect(
      result.am.find((item) => item.category === "cleanser")?.rationale,
    ).toContain("usually feels dry");
    expect(result.notes.join(" ")).toContain("age is used as context");
    expect(result.notes.join(" ")).toContain("fragrance-free");
    expect(result.notes.join(" ")).toContain("Avoid lanolin");
  });

  it("rechecks a generated plan when a Shelf product changes the safety input", () => {
    const generated = plan();
    generated.routine = {
      am: [],
      pm: [step(1, "exfoliant", "salicylic_acid")],
      notes: [],
    };
    const result = routineFor({
      plan: generated,
      sensitivity: "high",
      goals: ["acne"],
      userProducts: [
        {
          id: "retinol",
          catalogId: "cerave-resurfacing-retinol-serum",
          name: "CeraVe Resurfacing Retinol Serum",
          category: "serum",
          actives: ["retinoid"],
          pausedAt: "2026-07-11T09:00:00.000Z",
        },
      ],
    });

    expect(
      result.routine.pm.some((item) => item.active === "salicylic_acid"),
    ).toBe(false);
    expect(
      result.adjustments.some((item) => item.rule === "sensitivity_active_cap"),
    ).toBe(true);
  });

  it("applies an accepted irritation pause for three days and keeps the reason", () => {
    const generated = plan();
    generated.routine = {
      am: [step(1, "cleanser")],
      pm: [
        step(1, "cleanser"),
        step(2, "treatment", "retinoid"),
        step(3, "moisturizer"),
      ],
      notes: [],
    };
    const revision = {
      kind: "pause_strong_actives" as const,
      acceptedAt: "2026-07-10T12:00:00.000Z",
      effectiveDate: "2026-07-10",
      period: "pm" as const,
      reason: "Let your skin settle.",
    };
    const during = routineFor({ plan: generated }, revision, "2026-07-12");
    expect(during.routine.pm.some((item) => item.active === "retinoid")).toBe(
      false,
    );
    expect(during.revision?.reason).toBe("Let your skin settle.");
    expect(activeRoutineRevision(revision, "2026-07-13")).toBeUndefined();
  });

  it("turns a small-win revision into one real step for the selected period", () => {
    const generated = plan();
    generated.routine = {
      am: [],
      pm: [step(1, "cleanser"), step(2, "moisturizer")],
      notes: [],
    };
    const result = routineFor(
      { plan: generated },
      {
        kind: "small_win",
        acceptedAt: "2026-07-10T12:00:00.000Z",
        effectiveDate: "2026-07-10",
        period: "pm",
        reason: "One step is enough.",
      },
      "2026-07-10",
    );
    expect(result.routine.pm).toHaveLength(1);
  });

  it("keeps Minimum Mode to cleanser, moisturizer, and sunscreen essentials", () => {
    const generated = plan();
    generated.routine = {
      am: [
        step(1, "cleanser"),
        step(2, "serum", "niacinamide"),
        step(3, "moisturizer"),
        step(4, "sunscreen"),
      ],
      pm: [
        step(1, "cleanser"),
        step(2, "serum", "hyaluronic_acid"),
        step(3, "moisturizer"),
      ],
      notes: [],
    };
    const result = routineFor(
      { plan: generated },
      {
        kind: "simplify_today",
        acceptedAt: "2026-07-10T12:00:00.000Z",
        effectiveDate: "2026-07-10",
        period: "pm",
        reason: "Keep only the essentials.",
      },
      "2026-07-10",
    );

    expect(result.routine.pm.map((item) => item.category)).toEqual([
      "cleanser",
      "moisturizer",
    ]);
  });
});

describe("routineShelfAssignments", () => {
  const routine: Routine = {
    am: [step(1, "cleanser")],
    pm: [step(1, "treatment", "retinoid")],
    notes: [],
  };

  it("places compatible owned catalog products into matching routine steps", () => {
    const assignments = routineShelfAssignments(
      {
        userProducts: [
          {
            id: "cleanser",
            catalogId: "cerave-hydrating-facial-cleanser",
            name: "CeraVe Hydrating Facial Cleanser",
            category: "cleanser",
            actives: ["ceramides", "hyaluronic_acid"],
          },
          {
            id: "retinol",
            catalogId: "cerave-resurfacing-retinol-serum",
            name: "CeraVe Resurfacing Retinol Serum",
            category: "serum",
            actives: ["retinoid"],
          },
        ],
      },
      routine,
    );

    expect(assignments.am[0]?.id).toBe("cleanser");
    expect(assignments.pm[0]?.id).toBe("retinol");
  });

  it("does not place unknown, unsafe, or user-paused products into routine steps", () => {
    const assignments = routineShelfAssignments(
      {
        allergies: ["retinoid"],
        userProducts: [
          {
            id: "unknown-cleanser",
            name: "Mystery cleanser",
            category: "cleanser",
            ingredientsUnknown: true,
          },
          {
            id: "paused-cleanser",
            name: "Gentle cleanser",
            category: "cleanser",
            pausedAt: "2026-07-11T09:00:00.000Z",
          },
          {
            id: "avoid-retinol",
            catalogId: "cerave-resurfacing-retinol-serum",
            name: "CeraVe Resurfacing Retinol Serum",
            category: "serum",
            actives: ["retinoid"],
          },
        ],
      },
      routine,
    );

    expect(assignments.am[0]).toBeUndefined();
    expect(assignments.pm[0]).toBeUndefined();
  });
});

describe("paused product normalization", () => {
  it("preserves valid pause timestamps and drops malformed values", () => {
    const normalized = normalizeProfile({
      userProducts: [
        {
          id: "paused",
          name: "Paused cleanser",
          category: "cleanser",
          pausedAt: "2026-07-11T09:00:00.000Z",
        },
        {
          id: "invalid",
          name: "Invalid pause",
          category: "cleanser",
          pausedAt: 123,
        },
      ],
    });

    expect(normalized.userProducts?.[0]?.pausedAt).toBe(
      "2026-07-11T09:00:00.000Z",
    );
    expect(normalized.userProducts?.[1]?.pausedAt).toBeUndefined();
  });
});
