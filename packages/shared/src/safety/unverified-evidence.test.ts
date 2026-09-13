import { describe, expect, it } from "vitest";

import { applyUnverifiedEvidencePolicy } from "./unverified-evidence";
import type { Routine } from "../types/routine";

function routine(overrides: Partial<Routine> = {}): Routine {
  return {
    am: [
      { order: 1, category: "cleanser", frequencyPerWeek: 7, rationale: "", irritationRisk: "low" },
      { order: 2, category: "serum", active: "niacinamide", frequencyPerWeek: 7, rationale: "", irritationRisk: "low" },
      { order: 3, category: "sunscreen", frequencyPerWeek: 7, rationale: "", irritationRisk: "low" },
    ],
    pm: [
      { order: 1, category: "treatment", active: "retinoid", frequencyPerWeek: 3, rationale: "", irritationRisk: "high" },
      { order: 2, category: "moisturizer", frequencyPerWeek: 7, rationale: "", irritationRisk: "low" },
    ],
    notes: [],
    ...overrides,
  };
}

describe("applyUnverifiedEvidencePolicy", () => {
  it("removes strong actives when nothing has looked at the skin", () => {
    const { routine: out, adjustments } = applyUnverifiedEvidencePolicy(routine());

    expect(out.pm.some((step) => step.active === "retinoid")).toBe(false);
    expect(adjustments).toHaveLength(1);
    expect(adjustments[0]).toMatchObject({
      rule: "unverified_evidence_capped",
      action: "removed",
      active: "retinoid",
      time: "PM",
    });
  });

  it("keeps gentle actives and the whole baseline", () => {
    const { routine: out } = applyUnverifiedEvidencePolicy(routine());

    expect(out.am.some((step) => step.active === "niacinamide")).toBe(true);
    expect(out.am.some((step) => step.category === "cleanser")).toBe(true);
    expect(out.am.some((step) => step.category === "sunscreen")).toBe(true);
    expect(out.pm.some((step) => step.category === "moisturizer")).toBe(true);
  });

  it("explains itself in the notes rather than silently thinning the routine", () => {
    const { routine: out } = applyUnverifiedEvidencePolicy(routine());
    expect(out.notes.join(" ")).toContain("Strong active treatments wait for a scan");
  });

  it("is a no-op on a routine that was already gentle", () => {
    const gentle = routine({ pm: [{ order: 1, category: "moisturizer", frequencyPerWeek: 7, rationale: "", irritationRisk: "low" }] });
    const { routine: out, adjustments } = applyUnverifiedEvidencePolicy(gentle);

    expect(adjustments).toEqual([]);
    expect(out.notes).toEqual([]);
    expect(out.pm).toHaveLength(1);
  });

  it("renumbers what remains and does not mutate the input", () => {
    const input = routine({
      pm: [
        { order: 1, category: "treatment", active: "benzoyl_peroxide", frequencyPerWeek: 3, rationale: "", irritationRisk: "high" },
        { order: 2, category: "serum", active: "ceramides", frequencyPerWeek: 7, rationale: "", irritationRisk: "low" },
        { order: 3, category: "moisturizer", frequencyPerWeek: 7, rationale: "", irritationRisk: "low" },
      ],
    });
    const { routine: out } = applyUnverifiedEvidencePolicy(input);

    expect(out.pm.map((step) => step.order)).toEqual([1, 2]);
    expect(input.pm).toHaveLength(3);
  });

  it("removes every clinician-grade and exfoliating-acid active, not just retinoid", () => {
    const stacked = routine({
      am: [
        { order: 1, category: "exfoliant", active: "glycolic_acid", frequencyPerWeek: 2, rationale: "", irritationRisk: "high" },
        { order: 2, category: "treatment", active: "salicylic_acid", frequencyPerWeek: 3, rationale: "", irritationRisk: "medium" },
        { order: 3, category: "serum", active: "vitamin_c", frequencyPerWeek: 7, rationale: "", irritationRisk: "low" },
      ],
      pm: [],
    });
    const { routine: out } = applyUnverifiedEvidencePolicy(stacked);

    expect(out.am.map((step) => step.active)).toEqual(["vitamin_c"]);
  });
});
