import { Redirect, type Href } from "expo-router";

import { nextRequiredOnboardingHref } from "@/lib/onboarding-flow";
import { useOnboarding } from "@/state/onboarding";

/** Compatibility route: onboarding no longer contains a purchase interruption. */
export default function RetiredOnboardingPaywall() {
  const { data } = useOnboarding();
  return (
    <Redirect
      href={(nextRequiredOnboardingHref(data) ?? "/onboarding/preview") as Href}
    />
  );
}
