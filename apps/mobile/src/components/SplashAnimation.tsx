/**
 * In-app brand reveal shown once on launch, after the native splash hides and
 * fonts are ready. The teardrop scales in, the "Pore" wordmark rises, then the
 * whole thing fades out and calls `onDone` to reveal the hero. Built on
 * react-native-reanimated (already a dependency).
 */
import { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

import { BrandMark } from "@/components/BrandMark";
import type { ThemeColors } from "@pore/shared";
import { AppText, spacing, useThemeColors } from "@/theme";

const OUT_CUBIC = Easing.out(Easing.cubic);
const TOTAL_MS = 2350;

export function SplashAnimation({ onDone }: { onDone: () => void }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const drop = useSharedValue(0);
  const word = useSharedValue(0);
  const container = useSharedValue(1);
  const done = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      done.current = true;
      onDoneRef.current();
      return;
    }

    drop.value = withDelay(
      100,
      withTiming(1, { duration: 650, easing: OUT_CUBIC }),
    );
    word.value = withDelay(
      550,
      withTiming(1, { duration: 500, easing: OUT_CUBIC }),
    );
    container.value = withDelay(
      1900,
      withTiming(0, { duration: 400, easing: Easing.in(Easing.cubic) }),
    );

    const timer = setTimeout(() => {
      if (!done.current) {
        done.current = true;
        onDoneRef.current();
      }
    }, TOTAL_MS);
    return () => {
      clearTimeout(timer);
      cancelAnimation(drop);
      cancelAnimation(word);
      cancelAnimation(container);
    };
  }, [container, drop, reduceMotion, word]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: container.value }));
  const dropStyle = useAnimatedStyle(() => ({
    opacity: drop.value,
    transform: [{ scale: 0.8 + drop.value * 0.2 }],
  }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: word.value,
    transform: [{ translateY: (1 - word.value) * 10 }],
  }));

  if (reduceMotion) return null;

  return (
    <Animated.View style={[styles.fill, containerStyle]}>
      <Animated.View style={[styles.markHalo, dropStyle]}>
        <BrandMark size={158} />
      </Animated.View>
      <Animated.View style={wordStyle}>
        <AppText
          variant="hero"
          color={colors.actionPrimary}
          style={styles.word}
        >
          Pore
        </AppText>
        <AppText
          variant="overline"
          color={colors.textSecondary}
          style={styles.signature}
        >
          PERSONAL SKIN GUIDANCE
        </AppText>
      </Animated.View>
    </Animated.View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    fill: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.background,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
    },
    markHalo: {
      width: 188,
      height: 188,
      borderRadius: 94,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    word: { marginTop: spacing.sm, textAlign: "center" },
    signature: { marginTop: spacing.xs, textAlign: "center" },
  });
}
