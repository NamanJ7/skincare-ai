/** Route helpers shared by the funnel screens and every scan entry point. */
import { router, useLocalSearchParams, type Href } from "expo-router";

import type { OnboardingData } from "@/state/onboarding";
import { profileAuthorizationRequirement } from "./youth-consent";

export type ScanMode = "onboarding" | "rescan";

/**
 * The first route the user must complete before a personalized profile can be
 * used. Null means this age tier already has the required authorization.
 */
export function profileAuthorizationHref(
  data: OnboardingData,
): string | null {
  const requirement = profileAuthorizationRequirement(
    data.age,
    data.guardianAuthorization,
    data.teenSelfConsent,
  );
  if (requirement === "age") return "/onboarding/age";
  if (requirement === "under_13") return "/onboarding/age-restricted";
  if (requirement === "guardian") return "/onboarding/parent-consent";
  if (requirement === "teen") return "/onboarding/teen-consent";
  return null;
}

/** Every camera entry point uses the same age and authorization gate. */
export function scanEntryHref(data: OnboardingData, mode: ScanMode): string {
  return profileAuthorizationHref(data) ?? `/scan-flow?mode=${mode}`;
}

/**
 * Dismiss a modal-style screen without ever becoming a dead button.
 *
 * `router.back()` alone does nothing when there is no history to pop — a deep
 * link, a notification tap, or a browser reload all land on the screen with an
 * empty stack, and the close affordance then silently fails. Every dismissable
 * screen routes through here so the reader always ends up somewhere.
 */
export function closeTo(fallback: Href = "/(tabs)/profile"): void {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}

/**
 * Question screens run in two modes: the funnel (Continue -> next screen) and
 * edit (opened from the review step with ?edit=1; Save -> back to review).
 * When `editing`, screens hide their progress bar and Back/Skip buttons.
 */
export function useOnboardingStep(nextHref: Href) {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const editing = edit === "1";
  return {
    editing,
    ctaLabel: editing ? "Save" : "Continue",
    proceed: () => (editing ? router.back() : router.push(nextHref)),
  };
}
