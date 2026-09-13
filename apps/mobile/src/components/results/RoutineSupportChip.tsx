import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import type { ThemeColors } from "@pore/shared";
import type { RoutineSupportStep } from "@/lib/results";
import { stepLabel } from "@/lib/labels";
import { AppText, radius, spacing, useThemeColors } from "@/theme";

/** A non-interactive label for a step that exists in the adjusted routine. */
export function RoutineSupportChip({
  support,
}: {
  support: RoutineSupportStep;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const label = stepLabel(support.step);
  const period = support.period === "am" ? "Morning" : "Evening";

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${period} routine support: ${label}`}
      style={styles.chip}
    >
      <View
        style={styles.period}
        importantForAccessibility="no-hide-descendants"
      >
        <AppText variant="label" color={colors.onActionPrimary}>
          {support.period.toUpperCase()}
        </AppText>
      </View>
      <AppText
        variant="caption"
        color={colors.textPrimary}
        style={styles.label}
      >
        {label}
      </AppText>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    chip: {
      maxWidth: "100%",
      minHeight: 36,
      flexDirection: "row",
      alignItems: "center",
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.pill,
      backgroundColor: colors.background,
    },
    period: {
      alignSelf: "stretch",
      justifyContent: "center",
      paddingHorizontal: spacing.xs,
      backgroundColor: colors.actionPrimary,
    },
    label: {
      flexShrink: 1,
      paddingVertical: spacing.xxs,
      paddingLeft: spacing.xs,
      paddingRight: spacing.sm,
    },
  });
}
