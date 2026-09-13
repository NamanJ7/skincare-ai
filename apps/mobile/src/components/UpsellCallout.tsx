/**
 * The one lock surface: every gated feature shows this identical tinted
 * callout, which opens the /paywall modal led by that feature. Copy comes
 * from FEATURE_COPY so locks never overclaim what's behind them.
 */
import { router } from "expo-router";
import { View } from "react-native";

import { FEATURE_COPY, type PremiumFeature } from "@/lib/gate";
import { AppText, Badge, Callout, spacing, useThemeColors } from "@/theme";

export function UpsellCallout({
  feature,
  compact = false,
}: {
  feature: PremiumFeature;
  /** Title + badge only — for tight spots like an expanded shelf row. */
  compact?: boolean;
}) {
  const colors = useThemeColors();
  const copy = FEATURE_COPY[feature];
  return (
    <Callout
      tone="info"
      icon="lock-closed"
      onPress={() => router.push(`/paywall?feature=${feature}`)}
    >
      <View
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
      >
        <AppText
          variant="bodyStrong"
          color={colors.onInfo}
          style={{ flexShrink: 1 }}
        >
          {copy.title}
        </AppText>
        <Badge label="PLUS" />
      </View>
      {compact ? null : (
        <AppText variant="caption" color={colors.onInfo}>
          {copy.body}
        </AppText>
      )}
    </Callout>
  );
}
