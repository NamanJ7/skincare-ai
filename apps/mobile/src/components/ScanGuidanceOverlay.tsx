/**
 * Camera-overlay guidance: state-colored oval, one damped instruction line,
 * and the auto-capture countdown numeral. Colors here are camera-surface
 * tokens for live video rather than colors intended for light surfaces.
 */
import { useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import type { ThemeColors } from "@pore/shared";

import type {
  GuideState,
  LiveQualityStatus,
} from "@/lib/scan/live-guidance-types";
import { useGuidanceAnnouncement } from "@/lib/scan/use-guidance-announcement";
import {
  AppText,
  borderWidth,
  radius,
  spacing,
  useThemeColors,
} from "@/theme";

export function ScanGuidanceOverlay({
  guideState,
  instruction,
  positive = false,
  countdown,
  status,
  direction,
  active,
}: {
  guideState: GuideState;
  /** Live feedback line under the oval; null hides the pill. */
  instruction: string | null;
  /** Tints the pill's leading dot green ("looks good / steady"). */
  positive?: boolean;
  /** 3..1 numeral over the oval during auto-capture countdown. */
  countdown: number | null;
  /** Current strict metric groups for the quiet status rail. */
  status?: LiveQualityStatus;
  /** Direction the user should turn in the mirrored preview. */
  direction?: "left" | "right";
  /** False while the route is hidden or the host app is backgrounded. */
  active: boolean;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width, height } = useWindowDimensions();
  const ovalWidth = Math.max(
    190,
    Math.min(250, width - spacing.xl * 2, height * 0.36),
  );
  const ovalHeight = ovalWidth * 1.32;
  const instructionWidth = Math.max(180, width - spacing.lg * 2);
  const ovalColor: Record<GuideState, string> = {
    searching: colors.guideIdle,
    adjust: colors.guideActive,
    good: colors.guidePositive,
  };
  const statusItems = status
    ? ([
        ["Face", status.face],
        ["Frame", status.framing],
        ["Angle", status.angle],
        ["Light", status.light],
        ["Sharp", status.sharpness],
      ] as const)
    : [];

  useGuidanceAnnouncement({ active, instruction, countdown });

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.ovalWrap}>
        <View
          style={[
            styles.oval,
            {
              width: ovalWidth,
              height: ovalHeight,
              borderRadius: ovalHeight / 2,
            },
            { borderColor: ovalColor[guideState] },
            guideState === "good" && styles.ovalGood,
          ]}
        />
        <View style={styles.poseCue}>
          <View
            style={[
              styles.poseHead,
              direction === "left" && styles.poseHeadLeft,
              direction === "right" && styles.poseHeadRight,
            ]}
          >
            <View style={styles.poseNose} />
          </View>
          <View style={styles.poseShoulders} />
          {direction ? (
            <AppText
              variant="headline"
              color={colors.guideActive}
              style={[
                styles.turnArrow,
                direction === "left"
                  ? styles.turnArrowLeft
                  : styles.turnArrowRight,
              ]}
              accessibilityLabel={`Turn ${direction}`}
            >
              {direction === "left" ? "←" : "→"}
            </AppText>
          ) : null}
        </View>
        {countdown != null ? (
          <View
            style={styles.countdownWrap}
            accessible
            accessibilityLabel={`Photo in ${countdown}`}
            accessibilityLiveRegion="assertive"
          >
            {/* key retriggers the mount per tick so each number pops fresh */}
            <AppText
              key={countdown}
              variant="hero"
              color={colors.guideActive}
              style={styles.countdown}
            >
              {countdown}
            </AppText>
          </View>
        ) : null}
      </View>
      {statusItems.length > 0 ? (
        <View
          style={styles.statusRail}
          accessible
          accessibilityLabel={statusItems
            .map(([label, value]) => `${label} ${value}`)
            .join(", ")}
        >
          {statusItems.map(([label, value]) => (
            <View key={label} style={styles.statusItem}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      value === "pass"
                        ? colors.guidePositive
                        : value === "adjust"
                          ? colors.guideActive
                          : colors.guideIdle,
                  },
                ]}
              />
              <AppText variant="caption" color={colors.guideActive}>
                {label}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
      <View style={[styles.instructionSlot, { maxWidth: instructionWidth }]}> 
        {instruction ? (
          <View
            style={styles.instructionPill}
            accessible
            accessibilityLabel={instruction}
            accessibilityLiveRegion="polite"
          >
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: positive
                    ? colors.guidePositive
                    : colors.guideActive,
                },
              ]}
            />
            <AppText
              variant="bodyStrong"
              color={colors.guideActive}
              style={styles.instructionText}
            >
              {instruction}
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: { alignItems: "center", gap: spacing.md },
    ovalWrap: { alignItems: "center", justifyContent: "center" },
    oval: {
      borderWidth: borderWidth.emphasis,
      borderStyle: "dashed",
    },
    ovalGood: { borderWidth: borderWidth.accent, borderStyle: "solid" },
    poseCue: {
      position: "absolute",
      alignItems: "center",
      justifyContent: "center",
    },
    poseHead: {
      width: 42,
      height: 54,
      borderRadius: 24,
      borderWidth: borderWidth.hairline,
      borderColor: colors.guideActive,
      alignItems: "center",
      justifyContent: "center",
    },
    poseHeadLeft: { transform: [{ rotate: "-9deg" }] },
    poseHeadRight: { transform: [{ rotate: "9deg" }] },
    poseNose: {
      width: 5,
      height: 9,
      borderRadius: radius.pill,
      backgroundColor: colors.guideActive,
      opacity: 0.8,
    },
    poseShoulders: {
      width: 70,
      height: 24,
      marginTop: spacing.xxs,
      borderTopWidth: borderWidth.hairline,
      borderColor: colors.guideActive,
      borderRadius: radius.pill,
    },
    turnArrow: {
      position: "absolute",
      top: 15,
      textShadowColor: colors.cameraScrim,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    turnArrowLeft: { right: 54 },
    turnArrowRight: { left: 54 },
    countdownWrap: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: "center",
      justifyContent: "center",
    },
    countdown: {
      fontSize: 72,
      lineHeight: 80,
      textShadowColor: colors.cameraScrim,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 8,
    },
    statusRail: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: spacing.xxs,
      paddingHorizontal: spacing.sm,
      backgroundColor: colors.cameraScrim,
      borderRadius: radius.pill,
    },
    statusItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xxs,
    },
    statusDot: { width: 6, height: 6, borderRadius: radius.pill },
    instructionSlot: { minHeight: 48, justifyContent: "center" },
    instructionPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      backgroundColor: colors.cameraScrim,
      borderRadius: radius.pill,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
    },
    instructionText: { flexShrink: 1, textAlign: "center" },
    dot: { width: 8, height: 8, borderRadius: radius.pill },
  });
}
