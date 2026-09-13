import { useCallback, useEffect, useRef, useState } from "react";
import {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { motion } from "@pore/shared";

export const motionEasing = {
  exit: Easing.bezier(...motion.easing.exit),
  enter: Easing.bezier(...motion.easing.enter),
  inOut: Easing.bezier(...motion.easing.inOut),
} as const;

/** How far each section rises into place, and the gap between staggered items. */
const ENTRANCE_RISE = 8;
const ENTRANCE_STAGGER = 45;
const ENTRANCE_STAGGER_CAP = 6;

/**
 * The shared "settle on mount" motion: content fades and rises a few points
 * into place, optionally staggered by `index` so a screen's sections arrive in
 * sequence rather than all at once. Reduced motion resolves instantly. Built on
 * shared values (not layout-animation primitives) so it behaves under
 * react-native-web for the live preview.
 */
export function useEntrance(index = 0) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withDelay(
      Math.min(index, ENTRANCE_STAGGER_CAP) * ENTRANCE_STAGGER,
      withTiming(1, {
        duration: motion.duration.gentle,
        easing: motionEasing.exit,
      }),
    );
  }, [index, progress, reduceMotion]);

  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * ENTRANCE_RISE }],
  }));
}

/**
 * A restrained check-control response. The caller owns any haptic so feedback
 * is emitted only from the surface the user actually touched.
 */
export function useCheckPop() {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const trigger = useCallback(() => {
    if (reduceMotion) {
      scale.value = 1;
      return;
    }
    scale.value = withSequence(
      withTiming(0.86, {
        duration: motion.duration.fast,
        easing: motionEasing.enter,
      }),
      withSpring(1, {
        damping: 11,
        stiffness: 280,
        mass: 0.55,
      }),
    );
  }, [reduceMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return { animatedStyle, trigger };
}

/**
 * True only for an incomplete-to-complete transition in the current period.
 * Navigating to a period that was already complete does not replay celebration.
 */
export function useCelebration<Period extends string>(
  period: Period,
  complete: boolean,
): boolean {
  const [celebrate, setCelebrate] = useState(false);
  const previous = useRef({ period, complete });

  useEffect(() => {
    const justCompleted =
      complete &&
      !previous.current.complete &&
      previous.current.period === period;
    setCelebrate(justCompleted);
    previous.current = { period, complete };
  }, [complete, period]);

  return celebrate;
}
