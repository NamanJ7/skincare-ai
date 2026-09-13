import type { OnboardingData } from "@/state/onboarding";
import { isSafetyAnswerComplete } from "./questionnaire";

export type RequiredOnboardingStep =
  | "age"
  | "goal"
  | "skin-profile"
  | "sensitivity"
  | "safety"
  | "scan"
  | "preview";

/**
 * Return the first unfinished step without inventing an answer for the user.
 * Authorization is enforced separately by the age-policy gate because it can
 * route to parent/teen consent rather than one questionnaire screen.
 */
export function requiredOnboardingStep(
  data: OnboardingData,
): RequiredOnboardingStep | null {
  if (!Number.isInteger(data.age)) return "age";
  if (!data.goals?.length || !data.primaryGoal) return "goal";
  if ((!data.skinType && !data.skinTypeChoiceId) || !data.routineComplexity) {
    return "skin-profile";
  }
  if (!data.sensitivity || !data.sensitivityChoiceId) return "sensitivity";
  if (!isSafetyAnswerComplete(data)) return "safety";
  if (!data.plan && !data.analysisStatus) return "scan";
  if (!data.onboardingComplete) return "preview";
  return null;
}

export function onboardingHrefForStep(step: RequiredOnboardingStep): string {
  if (step === "scan") return "/scan-flow?mode=onboarding";
  return `/onboarding/${step}`;
}

export function coreQuestionnaireComplete(data: OnboardingData): boolean {
  const step = requiredOnboardingStep({
    ...data,
    // Readiness for the questionnaire should not depend on whether scan/plan
    // work has happened yet.
    analysisStatus: data.analysisStatus ?? {
      kind: "answers_only",
      reason: "scan_skipped",
      attemptedAt: "readiness-check",
    },
    onboardingComplete: true,
  });
  return step === null;
}
