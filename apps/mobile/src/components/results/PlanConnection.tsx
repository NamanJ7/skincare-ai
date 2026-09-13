import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import type { ThemeColors } from "@pore/shared";
import type { RoutineSupportStep } from "@/lib/results";
import type { RoutinePeriod } from "@/lib/log";
import { AppText, TextButton, radius, spacing, useThemeColors } from "@/theme";
import { RoutineSupportChip } from "./RoutineSupportChip";

export function PlanConnection({
  support,
  period,
  actionLabel,
  onPress,
}: {
  support: RoutineSupportStep[];
  period: RoutinePeriod;
  actionLabel: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reduceMotion = useReducedMotion();
  const reveal = useSharedValue(reduceMotion ? 1 : 0);
  const periodSupport = useMemo(
    () => support.filter((item) => item.period === period),
    [period, support],
  );
  const supportKey = useMemo(
    () => periodSupport.map((item) => item.key).join("|"),
    [periodSupport],
  );

  useEffect(() => {
    if (reduceMotion) {
      reveal.value = 1;
      return;
    }
    reveal.value = 0;
    reveal.value = withTiming(1, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });
  }, [reduceMotion, reveal, supportKey]);

  const revealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * 4 }],
  }));
  const periodLabel = period === "am" ? "morning" : "evening";

  return (
    <Animated.View style={[styles.wrap, revealStyle]}>
      <View style={styles.headingRow}>
        <View style={styles.connectionMark}>
          <Ionicons
            name="leaf-outline"
            size={17}
            color={colors.actionPrimary}
            accessible={false}
          />
        </View>
        <View style={styles.headingCopy}>
          <AppText variant="overline" color={colors.actionPrimary}>
            YOUR PLAN CONNECTION
          </AppText>
          <AppText variant="caption" color={colors.textSecondary}>
            {periodSupport.length > 0
              ? `These ${periodLabel} steps support this priority.`
              : "Your adjusted routine does not include a targeted step for this priority right now."}
          </AppText>
        </View>
      </View>

      {periodSupport.length > 0 ? (
        <View style={styles.chips}>
          {periodSupport.map((item) => (
            <RoutineSupportChip key={item.key} support={item} />
          ))}
        </View>
      ) : (
        <AppText variant="caption" color={colors.textPrimary}>
          Keep following the gentle routine Pore has already adjusted for you.
        </AppText>
      )}

      <View style={styles.action}>
        <TextButton label={actionLabel} onPress={onPress} />
      </View>
    </Animated.View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      gap: spacing.sm,
      borderRadius: radius.lg,
      padding: spacing.md,
      borderLeftWidth: 3,
      borderLeftColor: colors.gold,
      backgroundColor: colors.primaryTintSoft,
    },
    headingRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
    },
    connectionMark: {
      width: 32,
      height: 32,
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 16,
      backgroundColor: colors.background,
    },
    headingCopy: { flex: 1, gap: spacing.xxs },
    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
    },
    action: { alignSelf: "flex-start", marginLeft: -spacing.md },
  });
}
