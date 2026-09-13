/** Nudge shown when the weekly check-in is due (Progress + Home). */
import { router } from "expo-router";

import {
  AppText,
  Callout,
  Card,
  PrimaryButton,
  spacing,
  useThemeColors,
} from "@/theme";

export function CheckInDueCard({
  firstTime = false,
  compact = false,
}: {
  /** True when no self-report exists yet; the scan remains the visual baseline. */
  firstTime?: boolean;
  /** Slimmer tappable variant for the Home tab. */
  compact?: boolean;
}) {
  const colors = useThemeColors();
  const title = firstTime
    ? "How does your skin feel today?"
    : "Time for your weekly check-in";
  const body = firstTime
    ? "This optional check-in adds how your skin feels alongside Day 1."
    : "Four quick questions. Pore compares this week to last.";

  if (compact) {
    return (
      <Callout
        tone="info"
        icon="clipboard-outline"
        title={title}
        onPress={() => router.push("/check-in")}
      >
        <AppText variant="caption" color={colors.onInfo}>
          About a minute
        </AppText>
      </Callout>
    );
  }

  return (
    <Card elevated style={{ gap: spacing.sm }}>
      <AppText variant="headline">{title}</AppText>
      <AppText variant="body" color={colors.textSecondary}>
        {body}
      </AppText>
      <PrimaryButton
        label={firstTime ? "Share how it feels" : "Start check-in"}
        onPress={() => router.push("/check-in")}
      />
      <AppText
        variant="caption"
        color={colors.textSecondary}
        style={{ textAlign: "center" }}
      >
        About a minute
      </AppText>
    </Card>
  );
}
