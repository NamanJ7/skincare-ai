import { Redirect, router, useLocalSearchParams } from "expo-router";

import { OnboardingTour } from "@/components/OnboardingTour";
import { Screen, spacing } from "@/theme";

/** Replay-only visual explainer; it never contributes to funnel progress. */
export default function Intro() {
  const { replay } = useLocalSearchParams<{ replay?: string }>();

  if (replay !== "1") return <Redirect href="/onboarding/goal" />;

  const exitReplay = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  return (
    <Screen contentStyle={{ paddingTop: spacing.md }}>
      <OnboardingTour onExit={exitReplay} />
    </Screen>
  );
}
