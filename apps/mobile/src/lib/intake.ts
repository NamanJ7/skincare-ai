import { MIN_SUPPORTED_AGE, type IntakeResponse, type SkinGoal } from "@pore/shared";
import type { OnboardingData } from "@/state/onboarding";

/**
 * Build an IntakeResponse from onboarding answers.
 *
 * Nothing here invents an answer. The assessment prompt is explicit that an
 * omitted field is unknown and that a concern must never be inferred from what
 * the user said they wanted — so shipping a default goal list, age, or
 * sensitivity would hand the model fabricated context under the banner of
 * "what the user told us", and would show up in the plan as a priority they
 * never chose. An absent answer travels as absent; the funnel is what
 * guarantees the required ones are present.
 */
export function buildIntake(data: OnboardingData): IntakeResponse {
  // Lead with the user's chosen primary concern so it anchors the routine.
  const goals: SkinGoal[] = data.goals ?? [];
  const ordered =
    data.primaryGoal && goals.includes(data.primaryGoal)
      ? [data.primaryGoal, ...goals.filter((g) => g !== data.primaryGoal)]
      : goals;
  const currentProducts = [
    ...(data.currentProducts ?? []),
    ...(data.userProducts ?? []).flatMap((product) => product.actives ?? []),
  ].filter((active, index, all) => all.indexOf(active) === index);

  return {
    // The age gate runs before onboarding can reach a scan, so this fallback is
    // unreachable defensive code. Age is prompt *context* only and can never
    // introduce a concern or an active, so a floor here cannot weaken a safety
    // rule the way the sensitivity fallback below could.
    age: data.age ?? MIN_SUPPORTED_AGE,
    goals: ordered,
    skinType: data.skinType,
    // Fail toward the most protective value, not the middle one. Sensitivity is
    // the strong-active cap (high = 1, medium = 2) and the retinoid frequency
    // clamp, so a corrupt profile defaulting to "medium" would quietly hand out
    // a second strong active nobody said the user could tolerate.
    sensitivity: data.sensitivity ?? "high",
    // Onboarding ingredients and later Shelf additions share one safety input.
    currentProducts,
    allergies: data.allergies ?? [],
    ...(data.allergyNotes?.trim() ? { allergyNotes: data.allergyNotes.trim() } : {}),
    ...(data.routineComplexity ? { routineComplexity: data.routineComplexity } : {}),
    budget: data.budget,
    fragrancePreference: data.fragrancePreference,
    pregnancyOrBreastfeeding: data.pregnancyOrBreastfeeding ?? false,
    usingPrescriptionSkincare:
      data.usingPrescriptionSkincare ?? data.currentRoutine === "prescription",
    skinTone: data.skinTone,
    darkMarkProne: data.darkMarkProne,
    climate: data.climate,
    location: data.location,
  };
}
