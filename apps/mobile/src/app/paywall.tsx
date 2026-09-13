/**
 * In-app upsell paywall (modal), opened from a lock surface with
 * ?feature=<PremiumFeature> so the pitch leads with what the user wanted.
 */
import { useLocalSearchParams } from "expo-router";

import { PaywallContent } from "@/components/PaywallContent";
import { isPremiumFeature } from "@/lib/gate";

export default function UpsellPaywall() {
  const { feature } = useLocalSearchParams<{ feature?: string }>();
  return (
    <PaywallContent mode="upsell" feature={isPremiumFeature(feature) ? feature : undefined} />
  );
}
