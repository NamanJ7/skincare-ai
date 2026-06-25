/**
 * In-app brand reveal shown once on launch, after the native splash hides and
 * fonts are ready. The teardrop scales in, the "Pore" wordmark rises, the
 * tagline fades, then the whole thing fades out and calls `onDone` to reveal
 * the hero. Built on react-native-reanimated (already a dependency).
 */
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { BrandMark } from "@/components/BrandMark";
import { AppText, colors, spacing } from "@/theme";

const OUT_CUBIC = Easing.out(Easing.cubic);
const TOTAL_MS = 2350;

export function SplashAnimation({ onDone }: { onDone: () => void }) {
  const drop = useSharedValue(0);
  const word = useSharedValue(0);
  const tag = useSharedValue(0);
  const container = useSharedValue(1);
  const done = useRef(false);

  useEffect(() => {
    drop.value = withDelay(100, withTiming(1, { duration: 650, easing: OUT_CUBIC }));
    word.value = withDelay(550, withTiming(1, { duration: 500, easing: OUT_CUBIC }));
    tag.value = withDelay(850, withTiming(1, { duration: 500, easing: OUT_CUBIC }));
    container.value = withDelay(1900, withTiming(0, { duration: 400, easing: Easing.in(Easing.cubic) }));

    const timer = setTimeout(() => {
      if (!done.current) {
        done.current = true;
        onDone();
      }
    }, TOTAL_MS);
    return () => clearTimeout(timer);
  }, []);

  const containerStyle = useAnimatedStyle(() => ({ opacity: container.value }));
  const dropStyle = useAnimatedStyle(() => ({
    opacity: drop.value,
    transform: [{ scale: 0.8 + drop.value * 0.2 }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: (1 - word.value) * 10 }],
  }));
  const tagStyle = useAnimatedStyle(() => ({ opacity: tag.value }));

  return (
    <Animated.View style={[styles.fill, containerStyle]}>
      <Animated.View style={dropStyle}>
        <BrandMark size={84} />
      </Animated.View>
      <Animated.View style={wordStyle}>
        <AppText variant="hero" color={colors.primary} style={styles.word}>
          Pore
        </AppText>
      </Animated.View>
      <Animated.View style={tagStyle}>
        <AppText variant="label" color={colors.gold} style={styles.tag}>
          SKINCARE AI
        </AppText>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  word: { marginTop: spacing.sm },
  tag: { letterSpacing: 4 },
});
