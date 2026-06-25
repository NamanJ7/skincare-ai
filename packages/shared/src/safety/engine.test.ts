import { describe, it, expect } from "vitest";
import { applySafetyRules } from "./engine";
import { ACTIVES } from "./ingredients";
import type { IntakeResponse } from "../types/intake";
import type {
  ActiveKey,
  ProductCategory,
  Routine,
  RoutineStep,
} from "../types/routine";

function mk(
  category: ProductCategory,
  active?: ActiveKey,
  freq = 7,
  extra: Partial<RoutineStep> = {},
): RoutineStep {
  return {
    order: 1,
    category,
    active,
    frequencyPerWeek: freq,
    rationale: "test",
    irritationRisk: "medium",
    ...extra,
  };
}

function routine(am: RoutineStep[], pm: RoutineStep[]): Routine {
  return { am, pm, notes: [] };
}

function intake(overrides: Partial<IntakeResponse> = {}): IntakeResponse {
  return {
    age: 22,
    goals: ["acne"],
    skinType: "combination",
    sensitivity: "low",
    currentProducts: [],
    allergies: [],
    budget: "medium",
    fragrancePreference: "no_preference",
    pregnancyOrBreastfeeding: false,
    skinTone: "medium",
    darkMarkProne: true,
    climate: "temperate",
    ...overrides,
  };
}

const isIrritant = (s: RoutineStep) => {
  const m = s.active ? ACTIVES[s.active] : undefined;
  return !!m && (m.isExfoliatingAcid || m.isRetinoid || m.isBenzoylPeroxide);
};
const actives = (steps: RoutineStep[]) => steps.map((s) => s.active).filter(Boolean);
const hasActive = (r: Routine, a: ActiveKey) =>
  [...r.am, ...r.pm].some((s) => s.active === a);

describe("SPF is mandatory in the AM", () => {
  it("adds sunscreen when missing", () => {
    const { routine: out, adjustments } = applySafetyRules(
      routine([mk("cleanser")], [mk("moisturizer")]),
      intake(),
    );
    expect(out.am.some((s) => s.category === "sunscreen")).toBe(true);
    expect(adjustments.some((a) => a.rule === "spf_required")).toBe(true);
  });

  it("does not duplicate an existing sunscreen", () => {
    const { routine: out, adjustments } = applySafetyRules(
      routine([mk("cleanser"), mk("sunscreen")], []),
      intake(),
    );
    expect(out.am.filter((s) => s.category === "sunscreen")).toHaveLength(1);
    expect(adjustments.some((a) => a.rule === "spf_required")).toBe(false);
  });
});

describe("pregnancy / breastfeeding filter", () => {
  it("removes retinoid and flags salicylic acid", () => {
    const { routine: out, adjustments } = applySafetyRules(
      routine(
        [mk("serum", "niacinamide")],
        [mk("treatment", "retinoid"), mk("treatment", "salicylic_acid")],
      ),
      intake({ pregnancyOrBreastfeeding: true }),
    );
    expect(hasActive(out, "retinoid")).toBe(false);
    expect(hasActive(out, "salicylic_acid")).toBe(true);
    expect(adjustments.some((a) => a.rule === "pregnancy_unsafe_removed" && a.active === "retinoid")).toBe(true);
    expect(adjustments.some((a) => a.rule === "pregnancy_caution_flagged" && a.active === "salicylic_acid")).toBe(true);
  });
});

describe("allergy filter", () => {
  it("removes a listed allergen", () => {
    const { routine: out, adjustments } = applySafetyRules(
      routine([mk("serum", "niacinamide")], []),
      intake({ allergies: ["niacinamide"] }),
    );
    expect(hasActive(out, "niacinamide")).toBe(false);
    expect(adjustments.some((a) => a.rule === "allergy_removed" && a.active === "niacinamide")).toBe(true);
  });
});

describe("retinoid frequency clamp", () => {
  it("clamps to 3x/week for non-sensitive skin", () => {
    const { routine: out, adjustments } = applySafetyRules(
      routine([], [mk("treatment", "retinoid", 7)]),
      intake({ goals: ["fine_lines", "texture"], sensitivity: "low" }),
    );
    const ret = out.pm.find((s) => s.active === "retinoid");
    expect(ret?.frequencyPerWeek).toBe(3);
    expect(ret?.rampSchedule).toBeTruthy();
    expect(adjustments.some((a) => a.rule === "retinoid_frequency_clamped")).toBe(true);
  });

  it("clamps to 2x/week for high-sensitivity skin", () => {
    const { routine: out } = applySafetyRules(
      routine([], [mk("treatment", "retinoid", 7)]),
      intake({ goals: ["fine_lines"], sensitivity: "high" }),
    );
    expect(out.pm.find((s) => s.active === "retinoid")?.frequencyPerWeek).toBe(2);
  });
});

describe("per-session irritation cap", () => {
  it("never leaves more than one strong exfoliant in a session", () => {
    const { routine: out } = applySafetyRules(
      routine([], [mk("exfoliant", "salicylic_acid"), mk("exfoliant", "glycolic_acid")]),
      intake({ goals: ["acne"] }),
    );
    expect(out.am.filter(isIrritant).length).toBeLessThanOrEqual(1);
    expect(out.pm.filter(isIrritant).length).toBeLessThanOrEqual(1);
    // Empty AM had room, so the extra acid is moved, not lost.
    expect(hasActive(out, "salicylic_acid")).toBe(true);
    expect(hasActive(out, "glycolic_acid")).toBe(true);
  });

  it("drops extras when there is no room to separate", () => {
    const { routine: out } = applySafetyRules(
      routine(
        [mk("treatment", "retinoid")],
        [
          mk("exfoliant", "salicylic_acid"),
          mk("exfoliant", "glycolic_acid"),
          mk("spot_treatment", "benzoyl_peroxide"),
        ],
      ),
      intake({ goals: ["acne"], sensitivity: "low" }),
    );
    expect(out.am.filter(isIrritant).length).toBeLessThanOrEqual(1);
    expect(out.pm.filter(isIrritant).length).toBeLessThanOrEqual(1);
    // Salicylic is most relevant to acne, so it survives in PM.
    expect(hasActive(out, "salicylic_acid")).toBe(true);
  });
});

describe("sensitivity cap on distinct strong actives", () => {
  it("high sensitivity keeps at most one strong active", () => {
    const { routine: out, adjustments } = applySafetyRules(
      routine([], [mk("exfoliant", "salicylic_acid"), mk("treatment", "retinoid")]),
      intake({ goals: ["acne"], sensitivity: "high" }),
    );
    const strong = actives([...out.am, ...out.pm]).filter(
      (a) => a && ACTIVES[a as ActiveKey].isStrongActive,
    );
    expect(new Set(strong).size).toBeLessThanOrEqual(1);
    expect(adjustments.some((a) => a.rule === "sensitivity_active_cap")).toBe(true);
  });

  it("low sensitivity allows up to three strong actives", () => {
    const { routine: out } = applySafetyRules(
      routine(
        [mk("serum", "vitamin_c")],
        [mk("exfoliant", "salicylic_acid"), mk("treatment", "azelaic_acid")],
      ),
      intake({ goals: ["acne", "hyperpigmentation"], sensitivity: "low" }),
    );
    // salicylic is the only strong one here (vit C + azelaic are gentle) — nothing dropped.
    expect(hasActive(out, "salicylic_acid")).toBe(true);
    expect(hasActive(out, "azelaic_acid")).toBe(true);
    expect(hasActive(out, "vitamin_c")).toBe(true);
  });
});

describe("duplicate active merge", () => {
  it("collapses a repeated active within a session", () => {
    const { routine: out, adjustments } = applySafetyRules(
      routine([], [mk("serum", "niacinamide"), mk("treatment", "niacinamide")]),
      intake(),
    );
    expect(out.pm.filter((s) => s.active === "niacinamide")).toHaveLength(1);
    expect(adjustments.some((a) => a.rule === "duplicate_active_merged")).toBe(true);
  });
});

describe("a gentle routine is left intact (only SPF added)", () => {
  it("does not strip safe steps", () => {
    const { routine: out, adjustments } = applySafetyRules(
      routine([mk("cleanser"), mk("serum", "niacinamide"), mk("moisturizer")], [mk("moisturizer")]),
      intake({ sensitivity: "high" }),
    );
    expect(hasActive(out, "niacinamide")).toBe(true);
    expect(out.am.some((s) => s.category === "sunscreen")).toBe(true);
    const removals = adjustments.filter((a) => a.action === "removed");
    expect(removals).toHaveLength(0);
  });
});
