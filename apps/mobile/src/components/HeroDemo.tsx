/**
 * First-run camera demo. The portrait is fictional and the animated labels
 * demonstrate Pore's real capture flow without presenting invented findings.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import type { ThemeColors } from "@pore/shared";
import { AppText, iconSize, radius, spacing, useThemeColors } from "@/theme";

const DEMO_SELFIE = require("../../assets/images/demo-selfie-v1.png");

const DEMO_STAGES = [
  {
    icon: "scan-outline",
    title: "Take a guided photo",
    detail: "Pore checks position, light, angle, and sharpness before capture.",
  },
  {
    icon: "sparkles-outline",
    title: "Understand what is visible",
    detail: "Cosmetic observations stay separate from medical diagnosis.",
  },
  {
    icon: "shield-checkmark-outline",
    title: "Follow a safer routine",
    detail: "Your goals, sensitivity, and safety answers shape every step.",
  },
] as const;

const FACE_POINTS = [
  { left: "32%", top: "35%" },
  { right: "32%", top: "35%" },
  { left: "49%", top: "49%" },
  { left: "37%", top: "60%" },
  { right: "37%", top: "60%" },
] as const;

export function HeroDemo() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState(0);
  const scanProgress = useSharedValue(reduceMotion ? 0.52 : 0);
  const maxWidth = Math.min(420, width - spacing.lg * 2);
  const compact = height < 740;
  const stage = DEMO_STAGES[active];

  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(() => {
      setActive((current) => (current + 1) % DEMO_STAGES.length);
    }, 2100);
    return () => clearInterval(timer);
  }, [reduceMotion]);

  useEffect(() => {
    scanProgress.value = reduceMotion
      ? 0.52
      : withRepeat(
          withTiming(1, {
            duration: 2300,
            easing: Easing.inOut(Easing.quad),
          }),
          -1,
          true,
        );
    return () => cancelAnimation(scanProgress);
  }, [reduceMotion, scanProgress]);

  const scanStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanProgress.value * (compact ? 128 : 154) }],
  }));

  return (
    <View
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={
        reduceMotion
          ? "Pore promise: take a guided photo, understand cosmetic visible patterns, and follow a safety-adjusted routine."
          : `Pore camera demo. ${stage.title}. ${stage.detail}`
      }
      style={[
        styles.frame,
        { width: maxWidth },
        compact && styles.frameCompact,
      ]}
    >
      <Image
        source={DEMO_SELFIE}
        contentFit="cover"
        contentPosition="center"
        transition={250}
        style={StyleSheet.absoluteFill}
        accessibilityLabel="Fictional adult taking a front-facing skincare photo"
      />
      <View style={styles.cameraTint} importantForAccessibility="no" />

      <View style={styles.topBar}>
        <View style={styles.demoPill}>
          <View style={styles.liveDot} />
          <AppText variant="overline" color={colors.guideActive}>
            PORE SCAN · DEMO
          </AppText>
        </View>
        <View style={styles.qualityPill}>
          <Ionicons
            name="sunny-outline"
            size={iconSize.sm}
            color={colors.textPrimary}
          />
          <AppText variant="label" color={colors.textPrimary}>
            Light: good
          </AppText>
        </View>
      </View>

      <View style={styles.faceGuide} importantForAccessibility="no">
        <View style={[styles.corner, styles.cornerTopLeft]} />
        <View style={[styles.corner, styles.cornerTopRight]} />
        <View style={[styles.corner, styles.cornerBottomLeft]} />
        <View style={[styles.corner, styles.cornerBottomRight]} />
        {FACE_POINTS.map((point, index) => (
          <View key={index} style={[styles.facePoint, point]} />
        ))}
        <Animated.View style={[styles.scanLine, scanStyle]} />
      </View>

      <View style={styles.analysisCard}>
        {reduceMotion ? (
          <View style={styles.staticPromise}>
            {DEMO_STAGES.map((item, index) => (
              <View key={item.title} style={styles.staticPromiseRow}>
                <View
                  style={[
                    styles.staticPromiseIcon,
                    index === DEMO_STAGES.length - 1 && styles.stageIconComplete,
                  ]}
                >
                  <Ionicons
                    name={item.icon}
                    size={16}
                    color={colors.textPrimary}
                  />
                </View>
                <AppText
                  variant="label"
                  color={colors.textPrimary}
                  style={{ flex: 1 }}
                >
                  {item.title}
                </AppText>
              </View>
            ))}
          </View>
        ) : (
          <>
            <View style={styles.analysisHeader}>
              <View
                style={[styles.stageIcon, active === 2 && styles.stageIconComplete]}
              >
                <Ionicons
                  name={stage.icon}
                  size={iconSize.md}
                  color={colors.textPrimary}
                />
              </View>
              <View style={styles.analysisCopy}>
                <AppText variant="bodyStrong" color={colors.textPrimary}>
                  {stage.title}
                </AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  {stage.detail}
                </AppText>
              </View>
            </View>

            <View style={styles.stageTrack} importantForAccessibility="no">
              {DEMO_STAGES.map((item, index) => (
                <View
                  key={item.title}
                  style={[
                    styles.stageSegment,
                    index <= active && styles.stageSegmentActive,
                  ]}
                />
              ))}
            </View>
          </>
        )}

        <View style={styles.signalRow}>
          <View style={styles.signalChip}>
            <Ionicons
              name="aperture-outline"
              size={13}
              color={colors.onSuccess}
            />
            <AppText variant="label" color={colors.onSuccess}>
              Position checked
            </AppText>
          </View>
          <View style={styles.signalChip}>
            <Ionicons
              name="shield-checkmark-outline"
              size={13}
              color={colors.onSuccess}
            />
            <AppText variant="label" color={colors.onSuccess}>
              Safety adjusted
            </AppText>
          </View>
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    frame: {
      height: 372,
      position: "relative",
      overflow: "hidden",
      borderRadius: 30,
      backgroundColor: colors.cameraSurface,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      shadowColor: colors.shadowColor,
      shadowOpacity: 0.22,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 5,
    },
    frameCompact: { height: 330 },
    cameraTint: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: colors.cameraScrim,
    },
    topBar: {
      position: "absolute",
      top: spacing.sm,
      left: spacing.sm,
      right: spacing.sm,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: spacing.xs,
    },
    demoPill: {
      minHeight: 30,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.pill,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      backgroundColor: colors.cameraScrim,
    },
    liveDot: {
      width: 7,
      height: 7,
      borderRadius: radius.pill,
      backgroundColor: colors.guidePositive,
    },
    qualityPill: {
      minHeight: 30,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.pill,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xxs,
      backgroundColor: colors.surfaceFade,
    },
    faceGuide: {
      position: "absolute",
      top: 54,
      alignSelf: "center",
      width: "54%",
      height: 194,
      borderRadius: radius.xl,
      overflow: "hidden",
    },
    corner: {
      position: "absolute",
      width: 29,
      height: 29,
      borderColor: colors.guideActive,
    },
    cornerTopLeft: {
      left: 0,
      top: 0,
      borderTopWidth: 2,
      borderLeftWidth: 2,
      borderTopLeftRadius: radius.md,
    },
    cornerTopRight: {
      right: 0,
      top: 0,
      borderTopWidth: 2,
      borderRightWidth: 2,
      borderTopRightRadius: radius.md,
    },
    cornerBottomLeft: {
      left: 0,
      bottom: 0,
      borderBottomWidth: 2,
      borderLeftWidth: 2,
      borderBottomLeftRadius: radius.md,
    },
    cornerBottomRight: {
      right: 0,
      bottom: 0,
      borderBottomWidth: 2,
      borderRightWidth: 2,
      borderBottomRightRadius: radius.md,
    },
    facePoint: {
      position: "absolute",
      width: 5,
      height: 5,
      borderRadius: radius.pill,
      backgroundColor: colors.guideActive,
      shadowColor: colors.cameraSurface,
      shadowOpacity: 0.3,
      shadowRadius: 2,
    },
    scanLine: {
      position: "absolute",
      top: 16,
      left: 14,
      right: 14,
      height: 2,
      borderRadius: radius.pill,
      backgroundColor: colors.guidePositive,
      shadowColor: colors.guidePositive,
      shadowOpacity: 0.9,
      shadowRadius: 7,
    },
    analysisCard: {
      position: "absolute",
      left: spacing.sm,
      right: spacing.sm,
      bottom: spacing.sm,
      padding: spacing.sm,
      gap: spacing.xs,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceFade,
      borderWidth: 1,
      borderColor: colors.border,
    },
    analysisHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    stageIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      backgroundColor: colors.infoSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    stageIconComplete: { backgroundColor: colors.successSoft },
    analysisCopy: { flex: 1, gap: 1 },
    staticPromise: { gap: spacing.xxs },
    staticPromiseRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
    },
    staticPromiseIcon: {
      width: 26,
      height: 26,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.infoSoft,
    },
    stageTrack: { flexDirection: "row", gap: spacing.xxs },
    stageSegment: {
      flex: 1,
      height: 3,
      borderRadius: radius.pill,
      backgroundColor: colors.chartTrack,
    },
    stageSegmentActive: { backgroundColor: colors.actionPrimary },
    signalRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    signalChip: {
      minHeight: 26,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xxs,
      paddingHorizontal: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: colors.successSoft,
    },
  });
}
