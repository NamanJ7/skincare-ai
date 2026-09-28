import { describe, expect, it } from "vitest";

import type { IntakeResponse, Routine } from "@pore/shared";

import type { UserProduct } from "./profile";
import { shelfVerdict } from "./shelf";

function intake(patch: Partial<IntakeResponse> = {}): IntakeResponse {
  return {
    age: 25,
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
    ...patch,
  };
}

/** A plan whose only session irritant is a PM retinoid. */
const planWithRetinoid: Routine = {
  am: [
    { order: 1, category: "cleanser", frequencyPerWeek: 7, rationale: "", irritationRisk: "low" },
  ],
  pm: [
    {
      order: 1,
      category: "treatment",
      active: "retinoid",
      frequencyPerWeek: 3,
      rationale: "",
      irritationRisk: "high",
    },
  ],
  notes: [],
};

const gentlePlan: Routine = {
  am: [
    {
      order: 1,
      category: "serum",
      active: "niacinamide",
      frequencyPerWeek: 7,
      rationale: "",
      irritationRisk: "low",
    },
  ],
  pm: [],
  notes: [],
};

function product(patch: Partial<UserProduct> = {}): UserProduct {
  return { id: "p1", name: "Test product", category: "serum", ...patch };
}

describe("shelfVerdict", () => {
  it("marks products with no tagged actives as unrated, never earned", () => {
    const verdict = shelfVerdict(product({ category: "moisturizer" }), planWithRetinoid, intake());
    expect(verdict.status).toBe("unrated");
    expect(verdict.label).toBe("Not rated yet");
    expect(verdict.reasons[0]).toContain("Tag this product's ingredients");
  });

  it("uses softer copy when the user said they don't know the ingredients", () => {
    const verdict = shelfVerdict(
      product({ category: "moisturizer", ingredientsUnknown: true }),
      planWithRetinoid,
      intake(),
    );
    expect(verdict.status).toBe("unrated");
    expect(verdict.reasons[0]).toContain("weren't sure");
  });

  it("lets gentle actives earn a spot", () => {
    const verdict = shelfVerdict(product({ actives: ["hyaluronic_acid"] }), gentlePlan, intake());
    expect(verdict.status).toBe("earned");
  });

  it("pauses anything on the allergy list", () => {
    const verdict = shelfVerdict(
      product({ actives: ["niacinamide"] }),
      gentlePlan,
      intake({ allergies: ["niacinamide"] }),
    );
    expect(verdict.status).toBe("pause");
  });

  it("pauses pregnancy-avoid actives", () => {
    const verdict = shelfVerdict(
      product({ actives: ["retinoid"] }),
      gentlePlan,
      intake({ pregnancyOrBreastfeeding: true }),
    );
    expect(verdict.status).toBe("pause");
  });

  it("pauses a second session irritant when the plan already has one", () => {
    const verdict = shelfVerdict(product({ actives: ["glycolic_acid"] }), planWithRetinoid, intake());
    expect(verdict.status).toBe("pause");
    expect(verdict.reasons[0]).toContain("Retinoid");
  });

  it("pauses strong new actives on often-sensitive skin", () => {
    const verdict = shelfVerdict(
      product({ actives: ["glycolic_acid"] }),
      gentlePlan,
      intake({ sensitivity: "high" }),
    );
    expect(verdict.status).toBe("pause");
  });

  it("marks a duplicate of a plan active as use-carefully", () => {
    const verdict = shelfVerdict(product({ actives: ["retinoid"] }), planWithRetinoid, intake());
    expect(verdict.status).toBe("careful");
    expect(verdict.reasons[0]).toContain("double up");
  });

  it("marks high-irritation actives as use-carefully", () => {
    const verdict = shelfVerdict(product({ actives: ["benzoyl_peroxide"] }), gentlePlan, intake());
    expect(verdict.status).toBe("careful");
  });

  it("lets pause outrank careful when a product has both", () => {
    const verdict = shelfVerdict(
      product({ actives: ["retinoid", "glycolic_acid"] }),
      planWithRetinoid,
      intake(),
    );
    expect(verdict.status).toBe("pause");
  });
});

describe("unknown active keys from a server plan", () => {
  // `routine.am/pm[].active` is model output. A plan naming an ingredient this
  // build doesn't ship used to throw on `ACTIVES[key].isExfoliatingAcid`,
  // taking down the Routine tab and the Products section with it.
  const planWithUnknownActive = {
    am: [],
    pm: [
      {
        order: 1,
        category: "treatment",
        active: "tretinoin_0_5",
        frequencyPerWeek: 3,
        rationale: "",
        irritationRisk: "high",
      },
    ],
    notes: [],
  } as unknown as Routine;

  it("does not throw when a plan step names an unknown active", () => {
    const product: UserProduct = {
      id: "p1",
      name: "BHA Liquid",
      category: "serum",
      actives: ["salicylic_acid"],
      addedAt: "2026-07-27T00:00:00.000Z",
    };
    expect(() =>
      shelfVerdict(product, planWithUnknownActive, intake()),
    ).not.toThrow();
  });

  it("treats the unknown active as not an irritant rather than guessing", () => {
    const product: UserProduct = {
      id: "p2",
      name: "BHA Liquid",
      category: "serum",
      actives: ["salicylic_acid"],
      addedAt: "2026-07-27T00:00:00.000Z",
    };
    // The unknown key contributes no irritant, so it can neither crash the
    // verdict nor invent a stacking conflict against an ingredient we can't read.
    const verdict = shelfVerdict(product, planWithUnknownActive, intake());
    expect(verdict.reasons.length).toBeGreaterThan(0);
    expect(
      verdict.reasons.some((reason) => reason.includes("tretinoin_0_5")),
    ).toBe(false);
  });
});
