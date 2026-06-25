import type { IntakeResponse } from "@pore/shared";
import type { OnboardingData } from "@/state/onboarding";

/** Build a full IntakeResponse from onboarding answers, filling sensible defaults. */
export function buildIntake(data: OnboardingData): IntakeResponse {
  return {
    age: data.age ?? 22,
    goals: data.goals?.length ? data.goals : ["acne", "post_acne_marks"],
    skinType: data.skinType ?? "combination",
    sensitivity: data.sensitivity ?? "medium",
    currentProducts: [],
    allergies: [],
    budget: "medium",
    fragrancePreference: "no_preference",
    pregnancyOrBreastfeeding: data.pregnancyOrBreastfeeding ?? false,
    skinTone: "medium",
    darkMarkProne: true,
    climate: "temperate",
  };
}
