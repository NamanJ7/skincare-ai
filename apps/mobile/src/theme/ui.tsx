/**
 * Pore UI primitives — the warm clinical-calm system rendered in React Native.
 * Every value comes from @pore/shared design tokens, so the app and the
 * marketing site stay consistent. Headlines use the Fraunces serif; body + UI
 * use Inter (loaded in the root layout, resolved per-weight in ./fonts).
 */
import type { ReactNode } from "react";
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
}: {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {scroll ? (
        <ScrollView
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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.ghost, pressed && styles.ghostPressed]}>
      <AppText variant="bodyStrong" color={colors.primary}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function Chip({
  label,
  selected = false,
  tone = "primary",
  onPress,
}: {
  label: string;
  selected?: boolean;
  /** Selected fill: deep green ("primary") or soft lavender ("lavender"). */
  tone?: "primary" | "lavender";
  onPress?: () => void;
}) {
  const selectedStyle = tone === "lavender" ? styles.chipSelectedLavender : styles.chipSelected;
  const selectedTextColor = tone === "lavender" ? colors.accentInk : colors.onPrimary;
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected ? selectedStyle : styles.chipDefault]}>
      <AppText variant="caption" color={selected ? selectedTextColor : colors.ink}>
        {label}
      </AppText>
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
  ghostPressed: { backgroundColor: "rgba(50,72,63,0.08)" },
  chip: {
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
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
