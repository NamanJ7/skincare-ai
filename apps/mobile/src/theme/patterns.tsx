/**
 * Pore UI patterns — composed pieces one level above the ui.tsx primitives.
 * These carry the "calm premium" layout language: content lives on the cream
 * canvas grouped by SectionHeaders; white cards are reserved for the one or
 * two genuinely elevated moments per screen; safety/info notes are tinted
 * Callouts rather than more white cards.
 */
import { useMemo, type ReactNode } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import {
  borderWidth,
  iconSize,
  radius,
  spacing,
  touchTarget,
  type ThemeColors,
} from "@pore/shared";
import { MascotCompanion } from "@/components/mascot/MascotCompanion";
import type { MascotState } from "@/components/mascot/mascot-states";
import type { WeekDay } from "@/lib/log";
import { AppText, TextButton } from "./ui";
import { useThemeColors } from "./provider";

function usePatternTheme() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return { colors, styles };
}

/** Uppercase kicker that heads a canvas section — replaces per-section cards. */
export function SectionHeader({
  title,
  action,
  onAction,
  style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, styles } = usePatternTheme();
  return (
    <View style={[styles.sectionHead, style]}>
      <AppText variant="overline" color={colors.inkMuted}>
        {title.toUpperCase()}
      </AppText>
      {action ? (
        <Pressable
          onPress={onAction}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={action}
          style={styles.sectionAction}
        >
          <AppText variant="label" color={colors.primary}>
            {action}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * The canonical tappable canvas row — a title with optional overline/body/detail
 * and a trailing chevron, framed by hairline rules. Replaces the hand-rolled
 * bordered rows that used to be re-implemented per screen (and drifted on pressed
 * color). Renders as a static row when `onPress` is omitted, so a quiet
 * informational row and a navigational one share one look.
 */
export function NavRow({
  overline,
  title,
  titleVariant = "bodyStrong",
  body,
  detail,
  icon,
  onPress,
  accessibilityLabel,
  disabled = false,
  divider = true,
}: {
  overline?: string;
  title: string;
  titleVariant?: "bodyStrong" | "headline";
  body?: string;
  detail?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  divider?: boolean;
}) {
  const { colors, styles } = usePatternTheme();
  const interactive = Boolean(onPress) && !disabled;
  const content = (
    <>
      {icon ? (
        <Ionicons
          name={icon}
          size={iconSize.md}
          color={colors.actionPrimary}
          style={styles.navRowIcon}
        />
      ) : null}
      <View style={styles.navRowCopy}>
        {overline ? (
          <AppText variant="overline" color={colors.textSecondary}>
            {overline}
          </AppText>
        ) : null}
        <AppText variant={titleVariant} color={colors.textPrimary}>
          {title}
        </AppText>
        {body ? (
          <AppText variant="body" color={colors.textSecondary}>
            {body}
          </AppText>
        ) : null}
        {detail ? (
          <AppText variant="caption" color={colors.textSecondary}>
            {detail}
          </AppText>
        ) : null}
      </View>
      {interactive ? (
        <Ionicons
          name="chevron-forward"
          size={iconSize.sm}
          color={colors.textSecondary}
        />
      ) : null}
    </>
  );

  const rowStyle = [styles.navRow, divider && styles.navRowDivider];
  if (!interactive) {
    return <View style={rowStyle}>{content}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ??
        [overline, title, body, detail].filter(Boolean).join(", ")
      }
      style={({ pressed }) => [
        ...rowStyle,
        pressed && styles.navRowPressed,
      ]}
    >
      {content}
    </Pressable>
  );
}

/**
 * Trailing-week consistency strip: seven calm cells (filled = a completed
 * routine day, ring = today, hairline = an unfinished day), with narrow weekday
 * letters. The whole strip reads as one progressbar to assistive tech. Derive
 * `days` with `weekDays()` from lib/log so the visual and the "N of 7" copy
 * always agree.
 */
export function WeekStrip({ days }: { days: WeekDay[] }) {
  const { colors, styles } = usePatternTheme();
  const completed = days.filter((day) => day.complete).length;
  return (
    <View
      style={styles.weekStrip}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${completed} of ${days.length} routine days completed this week`}
      accessibilityValue={{ min: 0, max: days.length, now: completed }}
    >
      {days.map((day) => {
        const state = day.complete ? "done" : day.isToday ? "today" : "empty";
        return (
          <View
            key={day.dateKey}
            style={styles.weekCell}
            importantForAccessibility="no-hide-descendants"
          >
            <View
              style={[
                styles.weekDot,
                state === "done" && styles.weekDotDone,
                state === "today" && styles.weekDotToday,
                state === "empty" && styles.weekDotEmpty,
              ]}
            >
              {state === "done" ? (
                <Ionicons
                  name="checkmark"
                  size={iconSize.xs}
                  color={colors.onActionPrimary}
                />
              ) : null}
            </View>
            <AppText
              variant="label"
              color={day.isToday ? colors.actionPrimary : colors.textSecondary}
            >
              {weekdayLetter(day.dateKey)}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

function weekdayLetter(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day)
    .toLocaleDateString(undefined, { weekday: "narrow" })
    .charAt(0);
}

export type CalloutTone = "info" | "caution" | "escalate" | "success";

function calloutTones(colors: ThemeColors) {
  return {
    info: {
      bg: colors.infoSoft,
      fg: colors.onInfo,
      icon: "information-circle",
    },
    caution: {
      bg: colors.warningSoft,
      fg: colors.onWarning,
      icon: "alert-circle",
    },
    escalate: {
      bg: colors.errorSoft,
      fg: colors.onError,
      icon: "information-circle",
    },
    success: {
      bg: colors.successSoft,
      fg: colors.onSuccess,
      icon: "checkmark-circle",
    },
  } as const;
}

/**
 * Tinted note — info, caution, escalation, or reassurance. No white card, no
 * border: the tint itself is the container, so safety copy reads calm instead
 * of stacking another card.
 */
export function Callout({
  tone = "info",
  icon,
  title,
  children,
  onPress,
  accessibilityLabel,
  style,
}: {
  tone?: CalloutTone;
  icon?: keyof typeof Ionicons.glyphMap;
  title?: string;
  children?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, styles } = usePatternTheme();
  const t = calloutTones(colors)[tone];
  const body = (
    <>
      <Ionicons
        name={icon ?? t.icon}
        size={20}
        color={t.fg}
        style={styles.calloutIcon}
      />
      <View style={styles.calloutBody}>
        {title ? (
          <AppText variant="bodyStrong" color={t.fg}>
            {title}
          </AppText>
        ) : null}
        {children}
      </View>
      {onPress ? (
        <Ionicons name="chevron-forward" size={16} color={t.fg} />
      ) : null}
    </>
  );
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title ?? "Open details"}
        style={({ pressed }) => [
          styles.callout,
          { backgroundColor: t.bg },
          pressed && { opacity: 0.85 },
          style,
        ]}
      >
        {body}
      </Pressable>
    );
  }
  return (
    <View style={[styles.callout, { backgroundColor: t.bg }, style]}>
      {body}
    </View>
  );
}

/** Centered canvas empty state — icon in a tinted circle, no card around it. */
export function EmptyState({
  icon,
  mascot,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  mascot?: MascotState;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors, styles } = usePatternTheme();
  return (
    <View style={styles.empty}>
      {mascot ? (
        <MascotCompanion state={mascot} size="md" still />
      ) : icon ? (
        <View style={styles.emptyIcon}>
          <Ionicons name={icon} size={24} color={colors.primary} />
        </View>
      ) : null}
      <AppText variant="headline" style={{ textAlign: "center" }}>
        {title}
      </AppText>
      {body ? (
        <AppText
          variant="caption"
          color={colors.inkMuted}
          style={{ textAlign: "center" }}
        >
          {body}
        </AppText>
      ) : null}
      {actionLabel ? (
        <TextButton label={actionLabel} onPress={onAction} />
      ) : null}
    </View>
  );
}

/**
 * The one step/check circle. done → filled check, active → filled label,
 * upcoming → hairline outline. Replaces the inline circles that used to be
 * re-drawn in timeline, generating, and the check rows.
 */
export function StepCircle({
  state,
  label,
  size = 24,
}: {
  state: "done" | "active" | "upcoming";
  label?: string | number;
  size?: 24 | 34;
}) {
  const { colors, styles } = usePatternTheme();
  const filled = state !== "upcoming";
  const stateLabel =
    state === "done" ? "complete" : state === "active" ? "current" : "upcoming";
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Step${label != null ? ` ${label}` : ""}, ${stateLabel}`}
      style={[
        styles.stepCircle,
        { width: size, height: size, borderRadius: size / 2 },
        filled ? styles.stepCircleFilled : styles.stepCircleOutline,
      ]}
    >
      {state === "done" ? (
        <Ionicons
          name="checkmark"
          size={size === 34 ? 18 : 14}
          color={colors.onPrimary}
        />
      ) : label != null ? (
        <AppText
          variant="label"
          color={filled ? colors.onPrimary : colors.inkMuted}
        >
          {String(label)}
        </AppText>
      ) : null}
    </View>
  );
}

export type BadgeTone = "accent" | "primary" | "caution" | "escalate";

function badgeTones(colors: ThemeColors) {
  return {
    accent: { bg: colors.infoSoft, fg: colors.onInfo },
    primary: { bg: colors.brandAccent, fg: colors.onBrandAccent },
    caution: { bg: colors.warningSoft, fg: colors.onWarning },
    escalate: { bg: colors.errorSoft, fg: colors.onError },
  } as const;
}

/** Tiny pill tag — "PRIMARY", "SOON", "EARNED A SPOT". */
export function Badge({
  label,
  tone = "accent",
}: {
  label: string;
  tone?: BadgeTone;
}) {
  const { colors, styles } = usePatternTheme();
  const t = badgeTones(colors)[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <AppText variant="label" color={t.fg}>
        {label}
      </AppText>
    </View>
  );
}

/** Grouped-list row (settings, plan actions). Lives inside a Card with Dividers. */
export function ListRow({
  icon,
  label,
  detail,
  badge,
  tone,
  trailing = "chevron",
  onPress,
  disabled = false,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  detail?: string;
  badge?: string;
  tone?: string;
  trailing?: "chevron" | "none" | ReactNode;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const { colors, styles } = usePatternTheme();
  const resolvedTone = tone ?? colors.textPrimary;
  const content = (
    <>
      {icon ? (
        <Ionicons
          name={icon}
          size={20}
          color={tone == null ? colors.actionPrimary : resolvedTone}
        />
      ) : null}
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong" color={resolvedTone}>
          {label}
        </AppText>
        {detail ? (
          <AppText variant="caption" color={colors.inkMuted}>
            {detail}
          </AppText>
        ) : null}
      </View>
      {badge ? (
        <Badge label={badge} />
      ) : trailing === "chevron" && onPress && !disabled ? (
        <Ionicons name="chevron-forward" size={16} color={colors.inkMuted} />
      ) : trailing === "chevron" || trailing === "none" ? null : (
        trailing
      )}
    </>
  );

  // Static rows must not become disabled buttons. This also lets a trailing
  // Switch be the single interactive element instead of nesting it in a
  // Pressable, which creates duplicate focus and activation behavior.
  if (!onPress) {
    return (
      <View style={[styles.listRow, disabled && { opacity: 0.55 }]}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={[label, detail, badge].filter(Boolean).join(", ")}
      style={({ pressed }) => [
        styles.listRow,
        pressed && { backgroundColor: colors.primaryTint },
        disabled && { opacity: 0.55 },
      ]}
    >
      {content}
    </Pressable>
  );
}

/** Photo thumbnail with optional caption lines (scan review, progress photos). */
export function PhotoThumb({
  uri,
  width,
  aspectRatio = 3 / 4,
  label,
  sublabel,
  accessibilityLabel,
}: {
  uri?: string | null;
  width?: number;
  aspectRatio?: number;
  label?: string;
  sublabel?: string;
  accessibilityLabel?: string;
}) {
  const { colors, styles } = usePatternTheme();
  const imageLabel =
    accessibilityLabel ?? (label ? `${label} photo` : undefined);
  return (
    <View
      style={[{ gap: spacing.xxs }, width != null ? { width } : { flex: 1 }]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={[styles.thumb, { aspectRatio }]}
          contentFit="cover"
          accessible={Boolean(imageLabel)}
          accessibilityLabel={imageLabel}
        />
      ) : (
        <View
          style={[styles.thumb, styles.thumbEmpty, { aspectRatio }]}
          accessible={Boolean(imageLabel)}
          accessibilityLabel={
            imageLabel ? `${imageLabel}, not captured` : undefined
          }
        >
          <Ionicons name="image-outline" size={20} color={colors.inkMuted} />
        </View>
      )}
      {label ? <AppText variant="label">{label}</AppText> : null}
      {sublabel ? (
        <AppText variant="caption" color={colors.inkMuted}>
          {sublabel}
        </AppText>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    sectionHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxs,
    },
    sectionAction: {
      minWidth: touchTarget.min,
      minHeight: touchTarget.min,
      alignItems: "flex-end",
      justifyContent: "center",
    },
    navRow: {
      minHeight: touchTarget.min,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.md,
    },
    navRowDivider: {
      borderTopWidth: borderWidth.hairline,
      borderBottomWidth: borderWidth.hairline,
      borderColor: colors.border,
    },
    navRowPressed: { backgroundColor: colors.primaryTint },
    navRowIcon: { flexShrink: 0 },
    navRowCopy: { flex: 1, gap: spacing.xxs },
    weekStrip: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: spacing.xxs,
    },
    weekCell: { flex: 1, alignItems: "center", gap: spacing.xs },
    weekDot: {
      width: 28,
      height: 28,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    weekDotDone: { backgroundColor: colors.actionPrimary },
    weekDotToday: {
      borderWidth: borderWidth.emphasis,
      borderColor: colors.actionPrimary,
      backgroundColor: colors.surface,
    },
    weekDotEmpty: {
      borderWidth: borderWidth.hairline,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    callout: {
      minHeight: touchTarget.min,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      borderRadius: radius.lg,
      padding: spacing.md,
    },
    calloutIcon: { marginTop: 2 },
    calloutBody: { flex: 1, gap: spacing.xxs },
    empty: {
      alignItems: "center",
      gap: spacing.xs,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primaryTintSoft,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: spacing.xxs,
    },
    stepCircle: { alignItems: "center", justifyContent: "center" },
    stepCircleFilled: { backgroundColor: colors.actionPrimary },
    stepCircleOutline: {
      borderWidth: borderWidth.emphasis,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    badge: {
      paddingVertical: 2,
      paddingHorizontal: spacing.xs,
      borderRadius: radius.pill,
    },
    listRow: {
      minHeight: touchTarget.min,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.md,
      marginHorizontal: -spacing.xs,
      paddingHorizontal: spacing.xs,
      borderRadius: radius.sm,
    },
    thumb: {
      width: "100%",
      borderRadius: radius.md,
      backgroundColor: colors.infoSoft,
    },
    thumbEmpty: {
      alignItems: "center",
      justifyContent: "center",
      borderWidth: borderWidth.hairline,
      borderColor: colors.border,
    },
  });
}
