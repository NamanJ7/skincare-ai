import { describe, expect, it } from "vitest";

import { buildIntake } from "./intake";

describe("buildIntake", () => {
  it("puts the user's primary goal first for routine ranking", () => {
    const intake = buildIntake({
      goals: ["hyperpigmentation", "post_acne_marks"],
      primaryGoal: "post_acne_marks",
    });
    expect(intake.goals).toEqual(["post_acne_marks", "hyperpigmentation"]);
  });

  it("passes every consolidated safety answer to the deterministic engine", () => {
    const intake = buildIntake({
      pregnancyOrBreastfeeding: true,
      usingPrescriptionSkincare: true,
      allergies: ["niacinamide"],
      currentProducts: ["retinoid"],
      fragrancePreference: "fragrance_free",
    });
    expect(intake).toMatchObject({
      pregnancyOrBreastfeeding: true,
      usingPrescriptionSkincare: true,
      allergies: ["niacinamide"],
      currentProducts: ["retinoid"],
      fragrancePreference: "fragrance_free",
    });
  });

  it("keeps prescription mode for legacy profiles that selected a prescription routine", () => {
    expect(buildIntake({ currentRoutine: "prescription" }).usingPrescriptionSkincare).toBe(true);
  });

  it("merges Shelf actives into the routine safety input without duplicates", () => {
    const intake = buildIntake({
      currentProducts: ["retinoid"],
      userProducts: [
        {
          id: "a",
          name: "CeraVe Resurfacing Retinol Serum",
          category: "serum",
          actives: ["retinoid", "niacinamide"],
        },
        {
          id: "b",
          name: "Mystery cream",
          category: "moisturizer",
          ingredientsUnknown: true,
        },
      ],
    });

    expect(intake.currentProducts).toEqual(["retinoid", "niacinamide"]);
  });
});
