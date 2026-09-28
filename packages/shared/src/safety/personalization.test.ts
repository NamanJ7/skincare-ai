import { describe, expect, it } from "vitest";
import type { IntakeResponse, Routine, RoutineStep } from "../types";
import { applyIntakePreferences } from "./personalization";

function step(
  order: number,
  active?: RoutineStep["active"],
  frequencyPerWeek = 7,
): RoutineStep {
  return {
    order,
    category: active ? "serum" : "moisturizer",
    active,
    frequencyPerWeek,
    rationale: "Original rationale.",
    irritationRisk: "medium",
  };
}

function intake(patch: Partial<IntakeResponse> = {}): IntakeResponse {
  return {
    age: 31,
    goals: ["acne", "dryness"],
    skinType: "dry",
    sensitivity: "medium",
    currentProducts: [],
    allergies: [],
    pregnancyOrBreastfeeding: false,
    routineComplexity: "balanced",
    ...patch,
  };
}

function routine(): Routine {
  return {
    am: [
      { ...step(1), category: "cleanser" },
      step(2, "niacinamide"),
      step(3, "vitamin_c"),
    ],
    pm: [
      { ...step(1, "glycolic_acid", 5), category: "exfoliant" },
      step(2, "retinoid", 3),
      step(3),
    ],
    notes: [],
  };
}

describe("intake personalization", () => {
  it("makes routine complexity a deterministic step cap", () => {
    const minimal = applyIntakePreferences(
      routine(),
      intake({ routineComplexity: "minimal" }),
    );
    const flexible = applyIntakePreferences(
      routine(),
      intake({ routineComplexity: "flexible" }),
    );

    expect(
      [...minimal.routine.am, ...minimal.routine.pm].filter(
        (item) => item.active,
      ),
    ).toHaveLength(1);
    expect(
      [...flexible.routine.am, ...flexible.routine.pm].filter(
        (item) => item.active,
      ),
    ).toHaveLength(3);
    expect(
      minimal.adjustments.some(
        (item) => item.rule === "routine_preference_cap",
      ),
    ).toBe(true);
  });

  it("uses a dry skin answer to slow exfoliating acids and change baseline copy", () => {
    const result = applyIntakePreferences(
      routine(),
      intake({ goals: ["texture"], routineComplexity: "flexible" }),
    );
    const acid = [...result.routine.am, ...result.routine.pm].find(
      (item) => item.active === "glycolic_acid",
    );
    expect(acid?.frequencyPerWeek).toBe(2);
    expect(
      result.routine.am.find((item) => item.category === "cleanser")
        ?.rationale,
    ).toContain("usually feels dry");
  });

  it("carries formulation restrictions and exact-age context into the routine", () => {
    const result = applyIntakePreferences(
      routine(),
      intake({
        age: 22,
        fragrancePreference: "fragrance_free",
        allergyNotes: "Avoid lanolin",
      }),
    );
    expect(result.routine.notes.join(" ")).toContain("fragrance-free");
    expect(result.routine.notes.join(" ")).toContain("Avoid lanolin");
    expect(result.routine.notes.join(" ")).toContain("age is used as context");
  });
});
