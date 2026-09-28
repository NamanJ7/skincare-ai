import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
} from "react-native-reanimated";

import {
  borderWidth,
  motion,
  radius,
  spacing,
  touchTarget,
  type ThemeColors,
} from "@pore/shared";
import type {
  JourneyEvent,
  JourneyEventKind,
  JourneyLane,
} from "@/lib/journey";
import { AppText, useThemeColors } from "@/theme";
import { MascotCompanion } from "../mascot/MascotCompanion";

export function journeyLanes(
  colors: ThemeColors,
): Record<JourneyLane, { label: string; color: string }> {
  return {
    behavior: { label: "Routine consistency", color: colors.actionPrimary },
    observation: { label: "Visual observation", color: colors.info },
    self_report: { label: "How your skin felt", color: colors.gold },
  };
}

const EVENT_ICONS: Record<JourneyEventKind, keyof typeof Ionicons.glyphMap> = {
  journey_start: "flag-outline",
  routine_day: "checkmark-circle-outline",
  scan: "camera-outline",
  check_in: "chatbubble-ellipses-outline",
  routine_revision: "options-outline",
  milestone: "checkmark",
};

export function JourneyMilestone({
  event,
  index = 0,
  current = false,
  onPress,
}: {
  event: JourneyEvent;
  index?: number;
  current?: boolean;
  onPress?: (event: JourneyEvent) => void;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(reduceMotion ? 1 : 0.75);
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const lane = journeyLanes(colors)[event.lane];
  const tone = event.irritation ? colors.warning : lane.color;
  const detail =
    event.detail ??
    (event.kind === "scan" && event.analyzed === false
      ? "Photo saved. No visual analysis was available."
      : undefined);
  const date = formatJourneyDate(event.date);

  useEffect(() => {
    if (reduceMotion) {
      scale.value = 1;
      opacity.value = 1;
      return;
    }
    const delay = Math.min(index, 6) * motion.duration.fast;
    scale.value = withDelay(
      delay,
      withSpring(1, { damping: 12, stiffness: 180 }),
    );
    opacity.value = withDelay(
      delay,
      withSpring(1, { damping: 16, stiffness: 160 }),
    );
  }, [index, opacity, reduceMotion, scale]);

  const nodeStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  const accessibilityLabel = [
    current ? "Current point" : undefined,
    date,
    event.title,
    lane.label,
    detail,
  ]
    .filter(Boolean)
    .join(". ");

  const content = (
    <>
      <View style={styles.nodeColumn}>
        <Animated.View
          style={[
            styles.node,
            { borderColor: tone },
            event.irritation ? styles.nodeCaution : undefined,
            nodeStyle,
          ]}
        >
          <Ionicons
            name={event.irritation ? "alert" : EVENT_ICONS[event.kind]}
            size={16}
            color={tone}
          />
        </Animated.View>
      </View>
      <View style={styles.copy}>
        <View style={styles.meta}>
          <AppText variant="label" color={tone}>
            {lane.label.toUpperCase()}
          </AppText>
          <AppText variant="caption" color={colors.textSecondary}>
            {date}
          </AppText>
        </View>
        <AppText variant="bodyStrong">{event.title}</AppText>
        {detail ? (
          <AppText variant="caption" color={colors.textSecondary}>
            {detail}
          </AppText>
        ) : null}
      </View>
      {current ? (
        <MascotCompanion
          state="observing"
          size="sm"
          still
          accessibilityLabel="Current point in your skin journey"
          style={styles.companion}
        />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={() => onPress(event)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View accessible accessibilityLabel={accessibilityLabel} style={styles.row}>
      {content}
    </View>
  );
}

function formatJourneyDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      minHeight: touchTarget.min,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
    },
    rowPressed: {
      backgroundColor: colors.primaryTint,
    },
    nodeColumn: {
      width: 36,
      alignItems: "center",
      zIndex: 1,
    },
    node: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: borderWidth.emphasis,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    nodeCaution: {
      backgroundColor: colors.warningSoft,
    },
    copy: {
      flex: 1,
      gap: spacing.xxs,
      paddingTop: spacing.xxs,
    },
    meta: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.xs,
    },
    companion: {
      alignSelf: "flex-start",
      marginTop: -spacing.xxs,
    },
  });
}
