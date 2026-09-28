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

import { TOUR_BEATS } from "@/lib/onboarding-tour";
import {
  AppText,
  Callout,
  PrimaryButton,
  iconSize,
  radius,
  spacing,
  useThemeColors,
} from "@/theme";

/** One replayable visual story; it is never a required onboarding step. */
export function OnboardingTour({ onExit }: { onExit: () => void }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reduceMotion = useReducedMotion();
  const reveal = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    reveal.value = reduceMotion
      ? 1
      : withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
  }, [reduceMotion, reveal]);

  const revealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * 12 }],
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.story, revealStyle]}>
        <View
          style={styles.hero}
          accessible
          accessibilityRole="image"
          accessibilityLabel="Pore connects a guided photo to cosmetic context and a safety-adjusted routine"
        >
          <View style={styles.heroHalo} />
          <View style={styles.scanFrame}>
            <Ionicons
              name="person-outline"
              size={iconSize.xl}
              color={colors.actionPrimary}
            />
          </View>
          <View style={[styles.scanCorner, styles.cornerTopLeft]} />
          <View style={[styles.scanCorner, styles.cornerTopRight]} />
          <View style={[styles.scanCorner, styles.cornerBottomLeft]} />
          <View style={[styles.scanCorner, styles.cornerBottomRight]} />
        </View>

        <View style={styles.copy}>
          <AppText variant="overline" color={colors.actionPrimary}>
            HOW PORE WORKS
          </AppText>
          <AppText variant="title">
            A clearer path from photo to routine
          </AppText>
          <AppText variant="body" color={colors.textSecondary}>
            Pore combines what you tell us with an optional, quality-checked
            scan. Every recommendation stays tied to those inputs.
          </AppText>
        </View>

        <View style={styles.beats}>
          {TOUR_BEATS.map((beat, index) => (
            <View key={beat.id} style={styles.beatRow}>
              <View style={styles.beatRail} importantForAccessibility="no">
                <View style={styles.beatIcon}>
                  <Ionicons
                    name={beat.icon}
                    size={iconSize.md}
                    color={colors.onBrandAccent}
                  />
                </View>
                {index < TOUR_BEATS.length - 1 ? (
                  <View style={styles.connector} />
                ) : null}
              </View>
              <View style={styles.beatCopy}>
                <AppText variant="bodyStrong">{beat.label}</AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  {beat.body}
                </AppText>
              </View>
            </View>
          ))}
        </View>

        <Callout
          tone="info"
          icon="eye-off-outline"
          title="Photos stay optional"
        >
          <AppText variant="caption" color={colors.onInfo}>
            Answers alone can build a routine. Pore is cosmetic guidance, not a
            diagnosis, and it asks before opening the camera.
          </AppText>
        </Callout>
      </Animated.View>

      <PrimaryButton label="Done" onPress={onExit} />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  const cornerBase = {
    position: "absolute" as const,
    width: 26,
    height: 26,
    borderColor: colors.actionPrimary,
  };
  return StyleSheet.create({
    wrap: { flex: 1, gap: spacing.lg },
    story: { flex: 1, gap: spacing.lg },
    hero: {
      height: 176,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    heroHalo: {
      position: "absolute",
      width: 168,
      height: 168,
      borderRadius: 84,
      backgroundColor: colors.infoSoft,
    },
    scanFrame: {
      width: 104,
      height: 124,
      borderRadius: radius.xl,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    scanCorner: cornerBase,
    cornerTopLeft: {
      left: "27%",
      top: 20,
      borderLeftWidth: 3,
      borderTopWidth: 3,
      borderTopLeftRadius: radius.sm,
    },
    cornerTopRight: {
      right: "27%",
      top: 20,
      borderRightWidth: 3,
      borderTopWidth: 3,
      borderTopRightRadius: radius.sm,
    },
    cornerBottomLeft: {
      left: "27%",
      bottom: 20,
      borderLeftWidth: 3,
      borderBottomWidth: 3,
      borderBottomLeftRadius: radius.sm,
    },
    cornerBottomRight: {
      right: "27%",
      bottom: 20,
      borderRightWidth: 3,
      borderBottomWidth: 3,
      borderBottomRightRadius: radius.sm,
    },
    copy: { gap: spacing.xs },
    beats: { gap: 0 },
    beatRow: { flexDirection: "row", gap: spacing.md, minHeight: 76 },
    beatRail: { width: 42, alignItems: "center" },
    beatIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.brandAccent,
    },
    connector: {
      width: 2,
      flex: 1,
      minHeight: 24,
      backgroundColor: colors.border,
    },
    beatCopy: { flex: 1, gap: spacing.xxs, paddingBottom: spacing.md },
  });
}
