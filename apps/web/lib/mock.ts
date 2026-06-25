/**
 * Deterministic mock used when ANTHROPIC_API_KEY is not set, so the full flow
 * works end-to-end before a key is wired up. The draft routine is intentionally
 * over-loaded (two acids at night, a daily retinoid, no SPF) so the real safety
 * engine has visible work to do.
 */
import type { Assessment, IntakeResponse, Routine } from "@pore/shared";

const DISCLAIMER =
  "Pore offers cosmetic skincare guidance, not a medical diagnosis. If something looks painful, is bleeding, spreading quickly, or isn't improving, please check in with a pharmacist or doctor.";

export function mockAssessment(intake: IntakeResponse): Assessment {
  return {
    findings: [
      {
        concern: "acne_like_breakouts",
        present: true,
        appearanceLevel: "moderate",
        confidence: 0.7,
        contributingFactors: ["visible oil in the T-zone", "a few clustered breakouts"],
        regions: ["forehead", "chin"],
      },
      {
        concern: "dark_spot_appearance",
        present: intake.darkMarkProne,
        appearanceLevel: "mild",
        confidence: 0.6,
        contributingFactors: ["marks left after older breakouts"],
        regions: ["cheeks"],
      },
      {
        concern: "oiliness",
        present: intake.skinType === "oily" || intake.skinType === "combination",
        appearanceLevel: "noticeable",
        confidence: 0.65,
        contributingFactors: ["shine across the T-zone"],
        regions: ["forehead", "nose"],
      },
    ],
    escalation: { recommendProfessional: false, reasons: [] },
    summary:
      "Your skin looks like it's dealing with some everyday breakouts and a little leftover marking — both very common and very workable. A simple, consistent routine will go a long way here.",
    disclaimer: DISCLAIMER,
  };
}

export function draftRoutine(_intake: IntakeResponse): Routine {
  return {
    am: [
      { order: 1, category: "cleanser", frequencyPerWeek: 7, rationale: "Start clean without stripping your skin.", irritationRisk: "low" },
      { order: 2, category: "serum", active: "vitamin_c", frequencyPerWeek: 7, rationale: "Helps brighten and even out tone over time.", irritationRisk: "medium" },
      { order: 3, category: "moisturizer", frequencyPerWeek: 7, rationale: "Locks in hydration and supports your barrier.", irritationRisk: "low" },
      // No sunscreen on purpose — the safety engine must add it.
    ],
    pm: [
      { order: 1, category: "cleanser", frequencyPerWeek: 7, rationale: "Remove the day's oil and sunscreen.", irritationRisk: "low" },
      { order: 2, category: "exfoliant", active: "salicylic_acid", frequencyPerWeek: 4, rationale: "Helps clear pores and reduce breakouts.", irritationRisk: "medium" },
      { order: 3, category: "exfoliant", active: "glycolic_acid", frequencyPerWeek: 4, rationale: "Smooths texture and fades marks.", irritationRisk: "high" },
      { order: 4, category: "treatment", active: "retinoid", frequencyPerWeek: 7, rationale: "Boosts cell turnover for texture and marks.", irritationRisk: "high" },
    ],
    notes: ["Patch-test any new active for a few days before full use."],
  };
}
