import { Redirect } from "expo-router";

/**
 * Compatibility redirect for old links/builds. The guardian-email prototype
 * was not verifiable consent, so old links return to the current age policy.
 */
export default function RetiredParentalConsentRoute() {
  return <Redirect href="/onboarding/age" />;
}
