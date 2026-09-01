/**
 * The tick on a routine step.
 *
 * The check is drawn from two rotated rules rather than a glyph or an icon
 * dependency: it stays crisp at any size, inherits the brand green exactly, and
 * costs nothing to ship. Purely decorative — the row that owns it carries the
 * accessibility role and label.
 *
 * The fill springs rather than snapping. This is the one gesture the user makes
 * every day, and a state change with no motion reads as a screen redrawing
 * rather than an action landing. The spring is skipped entirely when the device
 * asks for reduced motion, which leaves the same two visual states with no
 * travel between them.
 */
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { colors, radius } from "@/theme";

const SIZE = 26;

/** Enough overshoot to feel physical, not enough to look bouncy. */
const SPRING = { damping: 13, stiffness: 220, mass: 0.5 };

export function CheckCircle({ checked }: { checked: boolean }) {
  const reduceMotion = useReducedMotion();
  const fill = useSharedValue(checked ? 1 : 0);
  const mark = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    const to = checked ? 1 : 0;
    if (reduceMotion) {
      fill.value = to;
      mark.value = to;
      return;
    }
    fill.value = withSpring(to, SPRING);
    mark.value = withTiming(to, { duration: 120 });
  }, [checked, reduceMotion, fill, mark]);

  // The ring scales with the fill so the whole control feels pressed rather
  // than just recoloured. Unchecking runs the same spring backwards.
  const ringStyle = useAnimatedStyle(() => ({
    backgroundColor: fill.value > 0 ? colors.primary : "transparent",
    borderWidth: fill.value > 0 ? 0 : 1.5,
    transform: [{ scale: 1 + fill.value * (1 - fill.value) * 0.6 }],
  }));

  // The mark itself fades in behind the fill, a beat later, so the two reads as
  // one gesture instead of two things changing at once.
  const markStyle = useAnimatedStyle(() => ({ opacity: mark.value }));

  return (
    <Animated.View
      accessible={false}
      importantForAccessibility="no"
      style={[
        {
          width: SIZE,
          height: SIZE,
          borderRadius: radius.pill,
          borderColor: colors.hairline,
          alignItems: "center",
          justifyContent: "center",
        },
        ringStyle,
      ]}
    >
      <Animated.View style={[{ width: 13, height: 13 }, markStyle]}>
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 6,
            width: 6,
            height: 2,
            borderRadius: 1,
            backgroundColor: colors.onPrimary,
            transform: [{ rotate: "45deg" }],
          }}
        />
        <View
          style={{
            position: "absolute",
            left: 3,
            top: 4,
            width: 10,
            height: 2,
            borderRadius: 1,
            backgroundColor: colors.onPrimary,
            transform: [{ rotate: "-50deg" }],
          }}
        />
      </Animated.View>
    </Animated.View>
  );
}
