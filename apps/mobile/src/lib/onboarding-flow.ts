import type { OnboardingData } from "@/state/onboarding";
import {
  onboardingHrefForStep,
  requiredOnboardingStep,
} from "./onboarding-readiness";
import { profileAuthorizationRequirement } from "./youth-consent";

/** First unfinished route required before a user can complete onboarding. */
export function nextRequiredOnboardingHref(
  data: OnboardingData,
): string | null {
  const authorization = profileAuthorizationRequirement(
    data.age,
    data.guardianAuthorization,
    data.teenSelfConsent,
  );
  if (authorization === "age") return "/onboarding/age";
  if (authorization === "under_13") return "/onboarding/age-restricted";
  if (authorization === "guardian") return "/onboarding/parent-consent";
  if (authorization === "teen") return "/onboarding/teen-consent";

  // Keep the final handoff aligned with the root route guard. Completion is
  // ignored here because this helper runs immediately before it is persisted.
  const required = requiredOnboardingStep({
    ...data,
    onboardingComplete: true,
  });
  if (required && required !== "scan") {
    return onboardingHrefForStep(required);
  }
  const attempted =
    (data.analysisStatus && data.analysisStatus.kind !== "none") ||
    (!!data.plan && !!data.scannedAt);
  if (!attempted) return "/scan-flow?mode=onboarding";
  return null;
}
