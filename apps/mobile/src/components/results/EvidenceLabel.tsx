import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";

import type { ThemeColors } from "@pore/shared";
import { AppText, radius, spacing, useThemeColors } from "@/theme";

export type EvidenceSource = "scan" | "answers";

/**
 * The provenance label for a Results story. Text and icon both carry the
 * meaning, so scan evidence never depends on colour alone.
 */
export function EvidenceLabel({ source }: { source: EvidenceSource }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scanBased = source === "scan";
  const label = scanBased ? "Scan-based read" : "Based on your answers";
  const announcement = `Evidence: ${label}`;

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(announcement);
  }, [announcement]);

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={announcement}
      accessibilityLiveRegion="polite"
      style={[styles.wrap, scanBased ? styles.scan : styles.answers]}
    >
      <Ionicons
        name={scanBased ? "camera-outline" : "chatbubble-ellipses-outline"}
        size={15}
        color={scanBased ? colors.actionPrimary : colors.info}
        accessible={false}
      />
      <AppText
        variant="label"
        color={scanBased ? colors.actionPrimary : colors.info}
        style={styles.label}
      >
        {label}
      </AppText>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      alignSelf: "flex-start",
      maxWidth: "100%",
      minHeight: 32,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xxs,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xxs,
    },
    scan: { backgroundColor: colors.primaryTint },
    answers: { backgroundColor: colors.infoSoft },
    label: { flexShrink: 1 },
  });
}
