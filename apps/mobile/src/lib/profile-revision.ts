import type { OnboardingData } from "@/state/onboarding";

const PLAN_INPUT_KEYS = [
  "age",
  "goals",
  "primaryGoal",
  "goalChoiceIds",
  "skinType",
  "skinTypeChoiceId",
  "sensitivity",
  "sensitivityChoiceId",
  "pregnancyOrBreastfeeding",
  "usingPrescriptionSkincare",
  "allergies",
  "allergyNotes",
  "currentProducts",
  "routineComplexity",
  "budget",
  "fragrancePreference",
  "skinTone",
  "darkMarkProne",
  "climate",
  "location",
] as const satisfies readonly (keyof OnboardingData)[];

function sameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  return JSON.stringify(left) === JSON.stringify(right);
}

export function changesPlanInputs(
  current: OnboardingData,
  patch: OnboardingData,
): boolean {
  return PLAN_INPUT_KEYS.some(
    (key) =>
      Object.prototype.hasOwnProperty.call(patch, key) &&
      !sameValue(current[key], patch[key]),
  );
}

export function nextProfileRevision(
  current: OnboardingData,
  patch: OnboardingData,
): number {
  const revision = current.profileRevision ?? 0;
  return changesPlanInputs(current, patch) ? revision + 1 : revision;
}

/** Legacy plans remain usable until a plan-affecting answer is edited. */
export function isPlanCurrentForProfile(data: OnboardingData): boolean {
  if (!data.plan) return false;
  const revision = data.profileRevision ?? 0;
  if (data.planProfileRevision === undefined) return revision === 0;
  return data.planProfileRevision === revision;
}

