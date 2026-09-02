import type { IntakeResponse, SkinTone } from "@pore/shared";
import type { OnboardingData } from "@/state/onboarding";

const DARK_MARK_PRONE_TONES: SkinTone[] = ["olive", "brown", "deep"];

/** Build a full IntakeResponse from onboarding answers, filling sensible defaults. */
export function buildIntake(data: OnboardingData): IntakeResponse {
  return {
    age: data.age ?? 22,
    goals: data.goals?.length ? data.goals : ["acne", "post_acne_marks"],
    skinType: data.skinType ?? "combination",
    sensitivity: data.sensitivity ?? "medium",
    currentProducts: [],
    // Was hardcoded to [], so the safety engine's allergy_removed rule could
    // never fire no matter what the user had told us.
    allergies: data.allergies ?? [],
    budget: "medium",
    fragrancePreference: "no_preference",
    pregnancyOrBreastfeeding: data.pregnancyOrBreastfeeding ?? false,
    // Asked during capture, where it also calibrates the exposure floor.
    skinTone: data.skinTone ?? "medium",
    // Deeper tones mark more readily after breakouts; default accordingly
    // rather than assuming it of everyone.
    darkMarkProne: data.darkMarkProne ?? DARK_MARK_PRONE_TONES.includes(data.skinTone ?? "medium"),
    climate: "temperate",
  };
}
