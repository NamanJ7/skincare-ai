import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import {
  borderWidth,
  motion,
  radius,
  spacing,
  type ThemeColors,
} from "@pore/shared";
import type { JourneyEvent, JourneySummary } from "@/lib/journey";
import { AppText, TextButton, useThemeColors } from "@/theme";
import { MascotCompanion } from "../mascot/MascotCompanion";
import { journeyLanes, JourneyMilestone } from "./JourneyMilestone";

export function JourneyPath({
  summary,
  onEventPress,
  maxEvents = 8,
  style,
}: {
  summary: JourneySummary;
  onEventPress?: (event: JourneyEvent) => void;
  maxEvents?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const lanes = useMemo(() => journeyLanes(colors), [colors]);
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const draw = useSharedValue(reduceMotion ? 1 : 0);
  const count = Math.max(1, maxEvents);
  const visibleEvents = expanded
    ? summary.events
    : summary.events.slice(-count);
  const hiddenCount = Math.max(0, summary.events.length - visibleEvents.length);

  useEffect(() => {
    if (reduceMotion) {
      draw.value = 1;
      return;
    }
    draw.value = 0;
    const [x1, y1, x2, y2] = motion.easing.inOut;
    draw.value = withTiming(1, {
      duration: motion.duration.draw,
      easing: Easing.bezier(x1, y1, x2, y2),
    });
  }, [draw, reduceMotion, visibleEvents.length]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: draw.value }],
  }));

  if (visibleEvents.length === 0) {
    return (
      <View style={[styles.empty, style]}>
        <MascotCompanion state="empty" size="md" still />
        <AppText variant="headline" style={styles.centered}>
          Your journey starts with one small step
        </AppText>
        <AppText
          variant="caption"
          color={colors.textSecondary}
          style={styles.centered}
        >
          Complete a routine, save a scan, or add a check-in to begin.
        </AppText>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.summary}>
        <View style={styles.summaryCopy}>
          <AppText variant="headline">
            {summary.dayNumber == null
              ? "Your skin journey"
              : `Day ${summary.dayNumber}`}
          </AppText>
          <AppText variant="caption" color={colors.textSecondary}>
            {summary.completedRoutineDays}{" "}
            {summary.completedRoutineDays === 1
              ? "routine day completed"
              : "routine days completed"}
          </AppText>
        </View>
        <AppText variant="caption" color={colors.textSecondary}>
          {visibleEvents.length}{" "}
          {visibleEvents.length === 1 ? "saved event" : "saved events"}
        </AppText>
      </View>

      <View style={styles.legend}>
        {Object.entries(lanes).map(([key, lane]) => (
          <View key={key} style={styles.legendItem}>
            <View
              importantForAccessibility="no"
              style={[styles.legendDot, { backgroundColor: lane.color }]}
            />
            <AppText variant="caption" color={colors.textSecondary}>
              {lane.label}
            </AppText>
          </View>
        ))}
      </View>

      {hiddenCount > 0 ? (
        <View style={styles.historyControl}>
          <AppText variant="caption" color={colors.textSecondary}>
            Showing the latest {visibleEvents.length} events. {hiddenCount}{" "}
            earlier {hiddenCount === 1 ? "event is" : "events are"} still saved.
          </AppText>
          <TextButton
            label="Show earlier events"
            onPress={() => setExpanded(true)}
          />
        </View>
      ) : expanded && summary.events.length > count ? (
        <View style={styles.historyControl}>
          <TextButton
            label="Show latest only"
            onPress={() => setExpanded(false)}
          />
        </View>
      ) : null}

      <View style={styles.timeline}>
        {visibleEvents.length > 1 ? (
          <>
            <View importantForAccessibility="no" style={styles.spineTrack} />
            <Animated.View
              importantForAccessibility="no"
              style={[styles.spineFill, fillStyle]}
            />
          </>
        ) : null}
        {visibleEvents.map((event, index) => (
          <JourneyMilestone
            key={event.id}
            event={event}
            index={index}
            current={index === visibleEvents.length - 1}
            onPress={onEventPress}
          />
        ))}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      gap: spacing.sm,
    },
    summary: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: spacing.sm,
    },
    summaryCopy: {
      flex: 1,
      gap: spacing.xxs,
    },
    legend: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xxs,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: radius.pill,
    },
    historyControl: {
      alignItems: "flex-start",
      gap: spacing.xxs,
    },
    timeline: {
      position: "relative",
    },
    spineTrack: {
      position: "absolute",
      top: 29,
      bottom: 29,
      left: 17,
      width: borderWidth.emphasis,
      backgroundColor: colors.border,
    },
    spineFill: {
      position: "absolute",
      top: 29,
      bottom: 29,
      left: 17,
      width: borderWidth.emphasis,
      backgroundColor: colors.actionPrimary,
      transformOrigin: "top",
    },
    empty: {
      alignItems: "center",
      gap: spacing.xs,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xl,
    },
    centered: {
      textAlign: "center",
    },
  });
}
