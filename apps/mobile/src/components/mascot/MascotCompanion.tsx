import { useEffect } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { motion, spacing } from "@pore/shared";
import { AppText } from "@/theme/ui";
import { DropletBuddyArt } from "./DropletBuddyArt";
import {
  MASCOT_STATES,
  MASCOT_STATE_LABELS,
  type MascotState,
} from "./mascot-states";

const SIZE = {
  sm: 40,
  md: 64,
  lg: 96,
} as const;

const companionEasing = Easing.bezier(...motion.easing.inOut);

export function MascotCompanion({
  state,
  size = "md",
  message,
  still = false,
  accessibilityLabel,
  style,
}: {
  state: MascotState;
  size?: keyof typeof SIZE;
  message?: string;
  still?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const reduceMotion = useReducedMotion();
  const visual = MASCOT_STATES[state];
  const breath = useSharedValue(1);
  const idleY = useSharedValue(0);
  const entryY = useSharedValue(0);
  const entryScale = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(breath);
    cancelAnimation(idleY);
    cancelAnimation(entryY);
    cancelAnimation(entryScale);

    breath.value = 1;
    idleY.value = 0;
    entryY.value = 0;
    entryScale.value = 1;

    if (still || reduceMotion) return;

    entryY.value = -Math.max(2, visual.bob);
    entryScale.value = state === "celebrating" ? 0.9 : 0.97;
    entryY.value = withSpring(0, { damping: 12, stiffness: 170 });
    entryScale.value = withSpring(1, { damping: 11, stiffness: 180 });

    breath.value = withRepeat(
      withSequence(
        withTiming(1.025, {
          duration: motion.duration.draw,
          easing: companionEasing,
        }),
        withTiming(1, {
          duration: motion.duration.draw,
          easing: companionEasing,
        }),
      ),
      -1,
      false,
    );
    idleY.value = withRepeat(
      withSequence(
        withTiming(-visual.bob, {
          duration: motion.duration.draw,
          easing: companionEasing,
        }),
        withTiming(0, {
          duration: motion.duration.draw,
          easing: companionEasing,
        }),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(breath);
      cancelAnimation(idleY);
      cancelAnimation(entryY);
      cancelAnimation(entryScale);
    };
  }, [
    breath,
    entryScale,
    entryY,
    idleY,
    reduceMotion,
    state,
    still,
    visual.bob,
  ]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: idleY.value + entryY.value },
      { rotate: `${visual.tilt}deg` },
      { scale: breath.value * entryScale.value },
    ],
  }));

  const label =
    accessibilityLabel ??
    `Pore companion, ${MASCOT_STATE_LABELS[state]}${message ? `. ${message}` : ""}`;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.wrap, style]}
    >
      <Animated.View style={animatedStyle}>
        <DropletBuddyArt state={state} size={SIZE[size]} />
      </Animated.View>
      {message ? (
        <AppText variant="caption" style={styles.message}>
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    alignSelf: "center",
    gap: spacing.xs,
  },
  message: {
    maxWidth: 280,
    textAlign: "center",
  },
});
