/**
 * One weekly-report trend line: direction icon + headline, expanding to the
 * noticed / why / next breakdown. "Better" is always green regardless of
 * whether the underlying number went up or down.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { TrendStatement } from "@/lib/trends";
import { AppText, spacing, touchTarget, useThemeColors } from "@/theme";

const ICONS: Record<
  TrendStatement["direction"],
  keyof typeof Ionicons.glyphMap
> = {
  better: "checkmark-circle",
  stable: "remove-circle",
  worse: "alert-circle",
};

function Detail({ label, text }: { label: string; text: string }) {
  const colors = useThemeColors();
  return (
    <View style={{ gap: spacing.xxs }}>
      <AppText variant="overline" color={colors.textSecondary}>
        {label}
      </AppText>
      <AppText variant="caption" color={colors.textPrimary}>
        {text}
      </AppText>
    </View>
  );
}

export function TrendRow({ statement }: { statement: TrendStatement }) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);
  const tone = {
    better: colors.success,
    stable: colors.textSecondary,
    worse: colors.warning,
  }[statement.direction];

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={statement.headline}
        style={styles.head}
      >
        <Ionicons name={ICONS[statement.direction]} size={20} color={tone} />
        <AppText variant="bodyStrong" style={{ flex: 1 }}>
          {statement.headline}
        </AppText>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.textSecondary}
        />
      </Pressable>
      {open ? (
        <View style={styles.details}>
          <Detail label="NOTICED" text={statement.noticed} />
          <Detail label="WHY" text={statement.why} />
          <Detail label="NEXT" text={statement.next} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  head: {
    minHeight: touchTarget.min,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  details: {
    gap: spacing.sm,
    paddingLeft: 20 + spacing.sm,
    paddingBottom: spacing.xs,
  },
});
