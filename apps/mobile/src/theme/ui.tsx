/**
 * Pore UI primitives — the warm clinical-calm system rendered in React Native.
 * Every value comes from @pore/shared design tokens, so the app and the
 * marketing site stay consistent. Headlines use the Fraunces serif; body + UI
 * use Inter (loaded in the root layout, resolved per-weight in ./fonts).
 */
import { useEffect, useMemo, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  borderWidth,
  motion,
  radius,
  shadow,
  spacing,
  touchTarget,
  typography,
  type ThemeColors,
} from "@pore/shared";
import { resolveFontFamily } from "./fonts";
import { useEntrance } from "./motion";
import { useThemeColors } from "./provider";

type TextVariant = keyof typeof typography;
const progressEasing = Easing.bezier(...motion.easing.exit);

/**
 * Wraps a screen section in the shared entrance motion. Pass an increasing
 * `index` down a screen so sections settle in sequence. Purely presentational —
 * children keep their own layout and accessibility.
 */
export function Enter({
  index = 0,
  style,
  children,
}: {
  index?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const animatedStyle = useEntrance(index);
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

function useUiTheme() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return { colors, styles };
}

export function AppText({
  variant = "body",
  color,
  style,
  maxFontSizeMultiplier,
  ...rest
}: TextProps & { variant?: TextVariant; color?: string }) {
  const colors = useThemeColors();
  const t = typography[variant];
  return (
    <Text
      {...rest}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        {
          // The loaded face already encodes the weight, so we set fontFamily
          // (not fontWeight) to avoid synthetic double-bolding on iOS.
          fontFamily: resolveFontFamily(t.family, t.weight),
          fontSize: t.size,
          lineHeight: t.lineHeight,
          letterSpacing: t.letterSpacing,
          color: color ?? colors.textPrimary,
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
  const { styles } = useUiTheme();
  const { fontScale } = useWindowDimensions();
  // Screens designed as fixed-height presentations still become scrollable at
  // larger Dynamic Type sizes so content and actions cannot be clipped.
  const shouldScroll = scroll || fontScale > 1;
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {shouldScroll ? (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            !scroll && styles.scrollFill,
            contentStyle,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.flex, contentStyle]}>
          {children}
        </View>
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
  const { styles } = useUiTheme();
  return (
    <View style={[styles.card, elevated && styles.cardShadow, style]}>
      {children}
    </View>
  );
}

/** The one pill per screen — reserved for the single primary CTA. */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const { colors, styles } = useUiTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: colors.brandAccent,
          opacity: pressed ? 0.86 : 1,
        },
        (disabled || loading) && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.onBrandAccent} />
      ) : (
        <AppText
          variant="bodyStrong"
          color={colors.onBrandAccent}
          style={styles.buttonLabel}
        >
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

/** Soft-rect secondary that must still read as tappable (OAuth, empty-state CTAs). */
export function GhostButton({
  label,
  onPress,
}: {
  label: string;
  onPress?: () => void;
}) {
  const { colors, styles } = useUiTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.ghost, pressed && styles.ghostPressed]}
    >
      <AppText
        variant="bodyStrong"
        color={colors.link}
        style={styles.buttonLabel}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

/** Borderless tertiary action — Back / Skip / Not now / Retake. */
export function TextButton({
  label,
  onPress,
  tone,
}: {
  label: string;
  onPress?: () => void;
  tone?: string;
}) {
  const { colors, styles } = useUiTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.textBtn, pressed && styles.ghostPressed]}
    >
      <AppText
        variant="bodyStrong"
        color={tone ?? colors.link}
        style={styles.buttonLabel}
      >
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
  const { colors, styles } = useUiTheme();
  const selectedStyle =
    tone === "lavender" ? styles.chipSelectedLavender : styles.chipSelected;
  const selectedTextColor =
    tone === "lavender" ? colors.accentInk : colors.onBrandAccent;
  const content = (
    <AppText
      variant="caption"
      color={selected ? selectedTextColor : colors.ink}
    >
      {label}
    </AppText>
  );
  if (!onPress) {
    return (
      <View
        accessible
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        style={[styles.chip, selected ? selectedStyle : styles.chipDefault]}
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        selected ? selectedStyle : styles.chipDefault,
        pressed && styles.choicePressed,
      ]}
    >
      {content}
    </Pressable>
  );
}

export function ProgressDots({
  count,
  index,
}: {
  count: number;
  index: number;
}) {
  const { styles } = useUiTheme();
  return (
    <View
      style={styles.dots}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${index + 1} of ${count}`}
      accessibilityValue={{ min: 1, max: count, now: index + 1 }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === index ? styles.dotActive : styles.dotInactive,
          ]}
          importantForAccessibility="no"
        />
      ))}
    </View>
  );
}

/**
 * Thin top-of-screen funnel progress. `value` is 0..1; the fill animates.
 * `from` starts the fill at the previous step so the advance is visible on
 * mount — progress the user watches arrive, not a static bar.
 */
export function ProgressBar({ value, from }: { value: number; from?: number }) {
  const { styles } = useUiTheme();
  const w = useSharedValue(from ?? value);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    const next = Math.max(0, Math.min(1, value));
    w.value = reduceMotion
      ? next
      : withTiming(next, {
          duration: motion.duration.gentle,
          easing: progressEasing,
        });
  }, [reduceMotion, value, w]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  const now = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <View
      style={styles.progressTrack}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now }}
    >
      <Animated.View style={[styles.progressFill, fillStyle]} />
    </View>
  );
}

/**
 * Full-width selectable row — the funnel's primary input control for longer
 * option lists. `multi` swaps the trailing indicator to a checkbox; otherwise a
 * radio-style dot. `badge` is an optional trailing tag (e.g. "PRIMARY").
 */
export function OptionRow({
  label,
  hint,
  selected = false,
  multi = false,
  badge,
  onPress,
}: {
  label: string;
  hint?: string;
  selected?: boolean;
  multi?: boolean;
  badge?: string;
  onPress?: () => void;
}) {
  const { colors, styles } = useUiTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multi ? "checkbox" : "radio"}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      accessibilityLabel={hint ? `${label}, ${hint}` : label}
      style={({ pressed }) => [
        styles.optionRow,
        selected && styles.optionRowSelected,
        pressed && styles.choicePressed,
      ]}
    >
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <AppText variant="bodyStrong" color={colors.textPrimary}>
          {label}
        </AppText>
        {hint ? (
          <AppText variant="caption" color={colors.inkMuted}>
            {hint}
          </AppText>
        ) : null}
      </View>
      {badge ? (
        <View style={styles.optionBadge}>
          <AppText variant="label" color={colors.accentInk}>
            {badge}
          </AppText>
        </View>
      ) : null}
      <View
        style={[
          multi ? styles.checkBox : styles.radio,
          selected && (multi ? styles.checkBoxOn : styles.radioOn),
        ]}
      >
        {selected ? (
          <AppText
            variant="label"
            color={colors.onBrandAccent}
            style={styles.checkMark}
          >
            ✓
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Generic pill segmented control (paywall term switch, AM/PM routine, …). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel = "Options",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  accessibilityLabel?: string;
}) {
  const { colors, styles } = useUiTheme();
  return (
    <View
      style={styles.toggleWrap}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="radio"
            accessibilityLabel={opt.label}
            accessibilityState={{ checked: active, selected: active }}
            style={[styles.toggleSeg, active && styles.toggleSegActive]}
          >
            <AppText
              variant="bodyStrong"
              color={active ? colors.onBrandAccent : colors.textSecondary}
            >
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function TextField({
  label,
  style,
  ...rest
}: TextInputProps & { label?: string }) {
  const { colors, styles } = useUiTheme();
  const accessibleLabel = label ?? rest.accessibilityLabel ?? rest.placeholder;
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? (
        <AppText variant="overline" color={colors.inkMuted}>
          {label.toUpperCase()}
        </AppText>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.brandAccent}
        accessibilityLabel={accessibleLabel}
        {...rest}
        style={[styles.field, style]}
      />
    </View>
  );
}

export function Divider() {
  const { styles } = useUiTheme();
  return <View style={styles.divider} importantForAccessibility="no" />;
}

/**
 * Shared icon-only action. Requiring a label prevents unlabeled close, back,
 * and menu controls, while the fixed minimum size keeps the hit target usable.
 */
export function IconButton({
  accessibilityLabel,
  children,
  disabled,
  style,
  ...rest
}: Omit<PressableProps, "accessibilityLabel" | "children" | "style"> & {
  accessibilityLabel: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { styles } = useUiTheme();
  return (
    <Pressable
      {...rest}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        styles.iconButton,
        pressed && styles.ghostPressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    scrollFill: { flexGrow: 1 },
    content: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.xl,
      gap: spacing.md,
    },
    card: {
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.lg,
      padding: spacing.lg,
      borderWidth: borderWidth.hairline,
      borderColor: colors.border,
      gap: spacing.sm,
    },
    cardShadow: {
      borderWidth: 0,
      shadowColor: colors.shadowColor,
      shadowOpacity: shadow.card.opacity,
      shadowRadius: shadow.card.radius,
      shadowOffset: shadow.card.offset,
      elevation: shadow.card.elevation,
    },
    btn: {
      minHeight: touchTarget.min,
      borderRadius: radius.pill,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      alignItems: "center",
      justifyContent: "center",
    },
    disabled: { opacity: 0.52 },
    buttonLabel: { textAlign: "center", flexShrink: 1 },
    ghost: {
      minHeight: touchTarget.min,
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: borderWidth.hairline,
      borderColor: colors.actionPrimary,
    },
    ghostPressed: { backgroundColor: colors.primaryTintSoft },
    textBtn: {
      minHeight: touchTarget.min,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      alignItems: "center",
      justifyContent: "center",
    },
    iconButton: {
      width: touchTarget.min,
      minWidth: touchTarget.min,
      height: touchTarget.min,
      minHeight: touchTarget.min,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    chip: {
      minHeight: touchTarget.min,
      borderRadius: radius.pill,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderWidth: borderWidth.hairline,
      alignItems: "center",
      justifyContent: "center",
    },
    chipDefault: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
    },
    chipSelected: {
      backgroundColor: colors.brandAccent,
      borderColor: colors.actionPrimary,
    },
    chipSelectedLavender: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    choicePressed: { opacity: 0.88 },
    field: {
      minHeight: touchTarget.min,
      backgroundColor: colors.inputBackground,
      borderWidth: borderWidth.hairline,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontFamily: resolveFontFamily("body", "400"),
      fontSize: 17,
      color: colors.textPrimary,
    },
    dots: { flexDirection: "row", gap: spacing.xs, justifyContent: "center" },
    dot: { width: 7, height: 7, borderRadius: radius.pill },
    dotActive: { backgroundColor: colors.actionPrimary, width: 20 },
    dotInactive: { backgroundColor: colors.border },
    divider: { height: 1, backgroundColor: colors.border },
    progressTrack: {
      height: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.chartTrack,
      overflow: "hidden",
    },
    progressFill: {
      height: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.actionPrimary,
    },
    optionRow: {
      minHeight: touchTarget.min,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderWidth: borderWidth.hairline,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    optionRowSelected: {
      borderColor: colors.actionPrimary,
      backgroundColor: colors.primaryTintSoft,
    },
    optionBadge: {
      paddingVertical: 2,
      paddingHorizontal: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: colors.accent,
    },
    radio: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: borderWidth.emphasis,
      borderColor: colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    radioOn: {
      borderColor: colors.actionPrimary,
      backgroundColor: colors.brandAccent,
    },
    checkBox: {
      width: 22,
      height: 22,
      borderRadius: radius.sm,
      borderWidth: borderWidth.emphasis,
      borderColor: colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    checkBoxOn: {
      borderColor: colors.actionPrimary,
      backgroundColor: colors.brandAccent,
    },
    checkMark: { fontSize: 13, lineHeight: 16 },
    toggleWrap: {
      flexDirection: "row",
      backgroundColor: colors.surfaceElevated,
      borderWidth: borderWidth.hairline,
      borderColor: colors.border,
      borderRadius: radius.md,
      padding: spacing.xxs,
      gap: spacing.xxs,
    },
    toggleSeg: {
      flex: 1,
      minHeight: touchTarget.min,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    toggleSegActive: { backgroundColor: colors.brandAccent },
  });
}
