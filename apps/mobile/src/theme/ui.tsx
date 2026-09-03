/**
 * Pore UI primitives — the warm clinical-calm system rendered in React Native.
 * Every value comes from @pore/shared design tokens, so the app and the
 * marketing site stay consistent. Headlines use the Fraunces serif; body + UI
 * use Inter (loaded in the root layout, resolved per-weight in ./fonts).
 */
import type { ReactNode, RefObject } from "react";
import {
  ActivityIndicator,
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
import { colors, radius, shadow, spacing, typography } from "@pore/shared";
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
  loading = false,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  /** Shows a spinner in place of the label and blocks repeat presses. */
  loading?: boolean;
}) {
  const inert = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy: loading }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: pressed ? colors.primaryPress : colors.primary },
        inert && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onPrimary} />
      ) : (
        <AppText variant="bodyStrong" color={colors.onPrimary}>
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

export function GhostButton({
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
      accessibilityState={{ disabled }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.ghost,
        pressed && styles.ghostPressed,
        disabled && styles.disabled,
      ]}
    >
      <AppText variant="bodyStrong" color={colors.primary}>
        {label}
      </AppText>
    </Pressable>
  );
}

/**
 * The primary input control across the whole questionnaire and the tone picker.
 *
 * Three things it was missing: any press feedback at all, an accessibility role,
 * and a way to be a plain label. That last one matters because /plan renders
 * findings as chips with no `onPress`, so screen readers announced a button
 * that did nothing. Without `onPress` it is now static text, not a control.
 */
export function Chip({
  label,
  selected = false,
  tone = "primary",
  onPress,
  /** Multi-select groups are checkboxes; single-select are radios. */
  role = "radio",
}: {
  label: string;
  selected?: boolean;
  /** Selected fill: deep green ("primary") or soft lavender ("lavender"). */
  tone?: "primary" | "lavender";
  onPress?: () => void;
  role?: "radio" | "checkbox";
}) {
  const selectedStyle = tone === "lavender" ? styles.chipSelectedLavender : styles.chipSelected;
  const selectedTextColor = tone === "lavender" ? colors.accentInk : colors.onPrimary;
  const body = (
    <AppText variant="caption" color={selected ? selectedTextColor : colors.ink}>
      {label}
    </AppText>
  );

  if (!onPress) {
    return <View style={[styles.chip, selected ? selectedStyle : styles.chipDefault]}>{body}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={role}
      accessibilityState={role === "checkbox" ? { checked: selected } : { selected }}
      style={({ pressed }) => [
        styles.chip,
        selected ? selectedStyle : styles.chipDefault,
        pressed && styles.chipPressed,
      ]}
    >
      {body}
    </Pressable>
  );
}

export function ProgressDots({ count, index }: { count: number; index: number }) {
  return (
    <View style={styles.dots}>
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
        {...rest}
        style={[styles.field, style]}
      />
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

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
  // Was hand-written here while shadow.card sat unused in tokens.ts. The token
  // is the single soft elevation in the system; it should be the only source.
  // Was hand-written here while shadow.card sat unused in tokens.ts. The token
  // carries its own alpha in `color`, so `opacity` stays 1 and the whole thing
  // is used verbatim — one source for the single soft elevation in the system.
  cardShadow: {
    borderWidth: 0,
    shadowColor: shadow.card.color,
    shadowOpacity: shadow.card.opacity,
    shadowRadius: shadow.card.radius,
    shadowOffset: shadow.card.offset,
    elevation: shadow.card.elevation,
  },
  btn: {
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.45 },
  ghost: {
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  // colors.primary at 8%. Was written out as a literal, which meant a change to
  // the brand green would have silently left this behind.
  ghostPressed: { backgroundColor: `${colors.primary}14` },
  chip: {
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    // Comfortably past the 44pt minimum once the caption line-height is added.
    minHeight: 44,
    justifyContent: "center",
  },
  chipDefault: { backgroundColor: colors.surface, borderColor: colors.hairline },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipSelectedLavender: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipPressed: { opacity: 0.65 },
  field: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontFamily: resolveFontFamily(typography.body.family, typography.body.weight),
    fontSize: typography.body.size,
    color: colors.ink,
  },
  dots: { flexDirection: "row", gap: spacing.xs, justifyContent: "center" },
  dot: { width: 7, height: 7, borderRadius: radius.pill },
  dotActive: { backgroundColor: colors.primary, width: 20 },
  dotInactive: { backgroundColor: colors.hairline },
  divider: { height: 1, backgroundColor: colors.hairline },
});
