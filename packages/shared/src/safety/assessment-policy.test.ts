import { describe, expect, it } from "vitest";

import type { Assessment, ConcernKey } from "../types/assessment";
import type { ActiveKey, Routine } from "../types/routine";
import {
  activeSupportsConcern,
  applyAssessmentRoutinePolicy,
} from "./assessment-policy";

const concerns = [
  "acne_like_breakouts",
  "oiliness",
  "dryness_flaking",
  "texture_congestion",
  "uneven_tone",
  "dark_spot_appearance",
  "redness_appearance",
  "fine_line_appearance",
  "irritation_signs",
] as const;

function assessment(overrides: Partial<Assessment> = {}): Assessment {
  return {
    findings: concerns.map((concern) => ({
      concern,
      present: concern === "dryness_flaking",
      appearanceLevel: concern === "dryness_flaking" ? "mild" : "none",
      confidence: concern === "dryness_flaking" ? 0.9 : 0.95,
      contributingFactors: [],
      regions: concern === "dryness_flaking" ? ["cheeks"] : [],
      regionDetail:
        concern === "dryness_flaking"
          ? [{ region: "cheeks", appearanceLevel: "mild" as const }]
          : [],
      observedInPoses: concern === "dryness_flaking" ? (["front"] as const).slice() : [],
    })),
    escalation: { recommendProfessional: false, reasons: [] },
    summary: "",
    disclaimer: "",
    ...overrides,
  };
}

const routine = (): Routine => ({
  am: [
    {
      order: 1,
      category: "serum",
      active: "hyaluronic_acid",
      frequencyPerWeek: 7,
      rationale: "",
      irritationRisk: "low",
    },
  ],
  pm: [
    {
      order: 1,
      category: "spot_treatment",
      active: "benzoyl_peroxide",
      frequencyPerWeek: 3,
      rationale: "",
      irritationRisk: "high",
    },
  ],
  notes: [],
});

describe("activeSupportsConcern", () => {
  const expected: Record<ActiveKey, readonly ConcernKey[]> = {
    salicylic_acid: ["acne_like_breakouts", "oiliness", "texture_congestion"],
    glycolic_acid: ["texture_congestion"],
    lactic_acid: ["texture_congestion"],
    mandelic_acid: ["texture_congestion"],
    benzoyl_peroxide: ["acne_like_breakouts"],
    azelaic_acid: [
      "acne_like_breakouts",
      "dark_spot_appearance",
      "uneven_tone",
      "redness_appearance",
    ],
    niacinamide: [
      "oiliness",
      "dryness_flaking",
      "uneven_tone",
      "dark_spot_appearance",
      "redness_appearance",
      "irritation_signs",
    ],
    retinoid: [
      "acne_like_breakouts",
      "texture_congestion",
      "dark_spot_appearance",
      "fine_line_appearance",
    ],
    vitamin_c: ["uneven_tone", "dark_spot_appearance", "fine_line_appearance"],
    hydroquinone: [],
    hyaluronic_acid: ["dryness_flaking", "irritation_signs"],
    ceramides: ["dryness_flaking", "irritation_signs"],
  };

  it("uses one deterministic concern map for every approved active", () => {
    for (const [active, supported] of Object.entries(expected) as Array<
      [ActiveKey, readonly ConcernKey[]]
    >) {
      for (const concern of concerns) {
        expect(activeSupportsConcern(active, concern)).toBe(
          supported.includes(concern),
        );
      }
    }
  });
});

describe("assessment-bound routine policy", () => {
  it("keeps products tied to visible evidence and removes unsupported actives", () => {
    const out = applyAssessmentRoutinePolicy(routine(), assessment());
    expect(
      out.routine.am.some((step) => step.active === "hyaluronic_acid"),
    ).toBe(true);
    expect(
      out.routine.pm.some((step) => step.active === "benzoyl_peroxide"),
    ).toBe(false);
    expect(
      out.adjustments.some(
        (adjustment) => adjustment.rule === "assessment_evidence_removed",
      ),
    ).toBe(true);
  });

  it("switches to a calm routine whenever professional review is recommended", () => {
    const out = applyAssessmentRoutinePolicy(
      routine(),
      assessment({
        escalation: {
          recommendProfessional: true,
          reasons: ["Appearance is outside cosmetic scope."],
        },
      }),
    );
    expect(
      [...out.routine.am, ...out.routine.pm].some((step) => step.active),
    ).toBe(false);
    expect(out.routine.notes[0]).toContain("professional assessment");
    expect(
      out.adjustments.filter(
        (adjustment) => adjustment.rule === "professional_review_mode",
      ),
    ).toHaveLength(2);
  });
});
