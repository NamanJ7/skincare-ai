/**
 * Pore UI primitives — the warm clinical-calm system rendered in React Native.
 * Every value comes from @pore/shared design tokens, so the app and the
 * marketing site stay consistent. Headlines use the Fraunces serif; body + UI
 * use Inter (loaded in the root layout, resolved per-weight in ./fonts).
 */
import type { ReactNode, RefObject } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing, typography } from "@pore/shared";
import { resolveFontFamily } from "./fonts";

type TextVariant = keyof typeof typography;

export function AppText({
  variant = "body",
  color = colors.ink,
  style,
  ...rest
}: TextProps & { variant?: TextVariant; color?: string }) {
  const t = typography[variant];
  return (
    <Text
      {...rest}
      style={[
        {
          // The loaded face already encodes the weight, so we set fontFamily
          // (not fontWeight) to avoid synthetic double-bolding on iOS.
          fontFamily: resolveFontFamily(t.family, t.weight),
          fontSize: t.size,
          lineHeight: t.lineHeight,
          letterSpacing: t.letterSpacing,
          color,
        },
        style,
      ]}
    />
  );
}

export function Screen({
  children,
  scroll = true,
  contentStyle,
  scrollRef,
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Opt-in handle on the internal ScrollView, for jump-to-section links. */
  scrollRef?: RefObject<ScrollView | null>;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.content, contentStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.flex, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({
  children,
  elevated = false,
  style,
}: {
  children: ReactNode;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, elevated && styles.cardShadow, style]}>{children}</View>;
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      // Disabled is currently signalled only by dimming to 45% opacity, which
      // is invisible to a screen reader.
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: pressed ? colors.primaryPress : colors.primary },
        disabled && styles.disabled,
      ]}
    >
      <AppText variant="bodyStrong" color={colors.onPrimary}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function GhostButton({ label, onPress }: { label: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.ghost, pressed && styles.ghostPressed]}
    >
      <AppText variant="bodyStrong" color={colors.primary}>
        {label}
      </AppText>
    </Pressable>
  );
}

/**
 * A pill. Used two ways, and the difference matters to a screen reader.
 *
 * With `onPress` it is a control — a goal, a skin type, an allergen, a reminder
 * hour — and announces as a button that is or isn't selected. Without `onPress`
 * it is a read-only tag (the "what we noticed" concerns on /plan), and renders
 * as a plain View: announcing a tappable button that does nothing is worse than
 * announcing nothing at all.
 *
 * `role` is not decoration. A chip that picks one of several options is a
 * radio; one that toggles independently is a checkbox; `button` is the fallback
 * for a chip that just does something. Getting this right is what makes the
 * selected state audible at all — `aria-selected` is not a valid attribute on
 * `role="button"`, and react-native-web has no handler for the
 * `accessibilityState` object, so a button-role chip conveys nothing about
 * whether it is chosen. `radio` and `checkbox` carry `checked`, which both
 * platforms and the DOM understand. This mirrors what today.tsx already does by
 * hand for the step rows and the skin check-in.
 */
export function Chip({
  label,
  selected = false,
  tone = "primary",
  role = "button",
  onPress,
}: {
  label: string;
  selected?: boolean;
  /** Selected fill: deep green ("primary") or soft lavender ("lavender"). */
  tone?: "primary" | "lavender";
  /** "radio" for pick-one groups, "checkbox" for independent toggles. */
  role?: "button" | "radio" | "checkbox";
  /** Omit for a display-only tag. Its presence is what makes this a control. */
  onPress?: () => void;
}) {
  const selectedStyle = tone === "lavender" ? styles.chipSelectedLavender : styles.chipSelected;
  const selectedTextColor = tone === "lavender" ? colors.accentInk : colors.onPrimary;
  const style = [styles.chip, selected ? selectedStyle : styles.chipDefault];
  const text = (
    <AppText variant="caption" color={selected ? selectedTextColor : colors.ink}>
      {label}
    </AppText>
  );

  if (!onPress) return <View style={style}>{text}</View>;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityState={role === "button" ? { selected } : { checked: selected }}
      // react-native-web ignores accessibilityState entirely, so the DOM needs
      // the aria attribute spelled out. Harmless on native, where the prop above
      // is what counts.
      aria-checked={role === "button" ? undefined : selected}
      style={style}
    >
      {text}
    </Pressable>
  );
}

/**
 * Step position, as dots. The dots carry real information — which of five
 * onboarding questions you are on — and were three silent Views, so a screen
 * reader user had no way to know how much was left. Labelled as one unit rather
 * than per-dot; "Step 3 of 5" is the fact, and five separate announcements are
 * noise.
 */
export function ProgressDots({ count, index }: { count: number; index: number }) {
  return (
    <View
      style={styles.dots}
      accessible
      accessibilityLabel={`Step ${index + 1} of ${count}`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.dot, i === index ? styles.dotActive : styles.dotInactive]} />
      ))}
    </View>
  );
}

export function TextField({
  label,
  style,
  ...rest
}: TextInputProps & { label?: string }) {
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? (
        <AppText variant="label" color={colors.inkMuted}>
          {label.toUpperCase()}
        </AppText>
      ) : null}
      <TextInput
        placeholderTextColor={colors.inkMuted}
        // The visible label is a sibling Text, so nothing associates the two.
        // Spread `rest` after this so a call site can still pass its own.
        accessibilityLabel={label}
        {...rest}
        style={[styles.field, style]}
      />
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

/**
 * Minimum comfortable touch target, in points.
 *
 * The chip already reached exactly this by arithmetic — 12pt of padding either
 * side of a 20pt line-height — which meant it sat on the threshold by accident,
 * with nothing in the code saying that was the intent. Any later padding tweak
 * or type-scale change would have dropped it under without a word. Stated
 * explicitly here so it has to be broken on purpose. Matches the floors already
 * hand-written into today.tsx.
 */
const TAP_TARGET = 44;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    gap: spacing.sm,
  },
  cardShadow: {
    borderWidth: 0,
    shadowColor: "#1C1C1A",
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  btn: {
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.45 },
  ghost: {
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: TAP_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  ghostPressed: { backgroundColor: "rgba(50,72,63,0.08)" },
  chip: {
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: TAP_TARGET,
    justifyContent: "center",
    borderWidth: 1,
  },
  chipDefault: { backgroundColor: colors.surface, borderColor: colors.hairline },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipSelectedLavender: { backgroundColor: colors.accent, borderColor: colors.accent },
  field: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: resolveFontFamily("body", "400"),
    fontSize: 17,
    color: colors.ink,
  },
  dots: { flexDirection: "row", gap: spacing.xs, justifyContent: "center" },
  dot: { width: 7, height: 7, borderRadius: radius.pill },
  dotActive: { backgroundColor: colors.primary, width: 20 },
  dotInactive: { backgroundColor: colors.hairline },
  divider: { height: 1, backgroundColor: colors.hairline },
});
