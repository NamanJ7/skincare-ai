import { useEffect } from "react";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { AppText, Callout, useThemeColors } from "@/theme";

/** A non-blocking Pore response that appears as soon as an answer has meaning. */
export function OnboardingReaction({
  title,
  message,
}: {
  title: string;
  message?: string | null;
}) {
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();
  const reveal = useSharedValue(message ? 1 : 0);

  useEffect(() => {
    if (!message) {
      reveal.value = 0;
      return;
    }
    if (reduceMotion) {
      reveal.value = 1;
      return;
    }
    reveal.value = 0;
    reveal.value = withTiming(1, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [message, reduceMotion, reveal]);

  const style = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * 8 }],
  }));

  if (!message) return null;
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${title}. ${message}`}
      style={style}
    >
      <Callout tone="info" icon="sparkles-outline" title={title}>
        <AppText variant="caption" color={colors.onInfo}>
          {message}
        </AppText>
      </Callout>
    </Animated.View>
  );
}
