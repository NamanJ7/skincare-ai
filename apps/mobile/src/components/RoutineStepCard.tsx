/**
 * Expandable step row for the Routine tab: check-off + frequency at a
 * glance, tap for the why / how-much / safety detail. Rows live inside one
 * shared card on the Routine tab (divider-separated) instead of each being
 * its own card. Expansion is plain state — no LayoutAnimation (unreliable
 * alongside reanimated 4 / New Arch).
 */
import * as Haptics from "expo-haptics";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";

import type { RoutineStep, SafetyAdjustment, ThemeColors } from "@pore/shared";
import { frequencyLabel, stepLabel } from "@/lib/labels";
import { PRODUCT_IMAGES } from "@/lib/product-images";
import type { UserProduct } from "@/lib/profile";
import { CATEGORY_LABELS } from "@/lib/labels";
import { USAGE } from "@/lib/usage";
import {
  AppText,
  Badge,
  StepCircle,
  TextButton,
  borderWidth,
  radius,
  spacing,
  touchTarget,
  useCheckPop,
  useThemeColors,
} from "@/theme";

export function RoutineStepCard({
  step,
  product,
  checked,
  willCompletePeriod = false,
  onToggle,
  adjustments,
  focusState,
  supportLabel,
  notOwned = false,
  onNotOwned,
  onAlreadyUse,
  scheduledToday = true,
  scheduleLabel,
}: {
  step: RoutineStep;
  product?: UserProduct;
  checked: boolean;
  /** True only when checking this row will complete the visible period. */
  willCompletePeriod?: boolean;
  onToggle: () => void;
  /** Safety adjustments already filtered to this step's active + period. */
  adjustments: SafetyAdjustment[];
  focusState?: "essential" | "resting";
  /** Named priority this existing, safety-adjusted step supports. */
  supportLabel?: string;
  notOwned?: boolean;
  onNotOwned?: () => void;
  onAlreadyUse?: () => void;
  scheduledToday?: boolean;
  scheduleLabel?: string;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const usage = USAGE[step.category];
  const displayLabel = product?.name ?? stepLabel(step);
  const supportContext = supportLabel
    ? ` Supports the ${supportLabel} priority.`
    : "";
  const stateContext = [
    focusState === "resting" ? "Resting today." : undefined,
    step.irritationRisk === "high" ? "Higher irritation risk." : undefined,
    notOwned ? "Product not currently owned." : undefined,
    !scheduledToday ? "Not scheduled today." : undefined,
  ]
    .filter(Boolean)
    .join(" ");
  const { animatedStyle: checkStyle, trigger: triggerCheck } = useCheckPop();
  const statusBadge = !scheduledToday
    ? { label: "NOT TODAY", tone: "primary" as const }
    : supportLabel
      ? { label: "PRIORITY STEP", tone: "accent" as const }
      : focusState === "resting"
        ? { label: "RESTING TODAY", tone: "accent" as const }
        : product
          ? { label: "YOUR PRODUCT", tone: "accent" as const }
          : notOwned
            ? { label: "NOT OWNED", tone: "accent" as const }
            : undefined;

  const toggle = () => {
    if (!scheduledToday) return;
    triggerCheck();
    const feedback = willCompletePeriod
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    feedback.catch(() => {});
    onToggle();
  };

  return (
    <View
      style={[
        styles.wrap,
        supportLabel ? styles.support : undefined,
        focusState === "essential" && styles.essential,
        focusState === "resting" && styles.resting,
      ]}
    >
      <View style={styles.head}>
        <Pressable
          onPress={toggle}
          disabled={!scheduledToday}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked, disabled: !scheduledToday }}
          aria-checked={checked}
          accessibilityLabel={
            !scheduledToday
              ? `${displayLabel}. Not scheduled today. ${scheduleLabel ?? ""} ${stateContext}${supportContext}`
              : checked
                ? `Mark ${displayLabel} not done. ${stateContext}${supportContext}`
                : `Mark ${displayLabel} done. ${stateContext}${supportContext}`
          }
          style={styles.checkTarget}
        >
          <Animated.View style={checkStyle}>
            <StepCircle state={checked ? "done" : "upcoming"} />
          </Animated.View>
        </Pressable>
        <Pressable
          onPress={() => setOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${displayLabel}, ${open ? "hide" : "show"} details. ${stateContext}${supportContext}`}
          style={styles.summary}
        >
          {product?.catalogId && PRODUCT_IMAGES[product.catalogId] ? (
            <Image
              source={PRODUCT_IMAGES[product.catalogId]}
              contentFit="contain"
              accessible={false}
              style={styles.productImage}
            />
          ) : null}
          <View style={{ flex: 1, gap: spacing.xxs }}>
            <AppText variant="bodyStrong">
              {step.order}. {displayLabel}
            </AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              {product
                ? `${stepLabel(step)} · ${frequencyLabel(step)}`
                : `${step.active ? CATEGORY_LABELS[step.category] : "Base step"} · ${frequencyLabel(step)}`}
            </AppText>
            {!scheduledToday && scheduleLabel ? (
              <AppText variant="caption" color={colors.textSecondary}>
                {scheduleLabel}
              </AppText>
            ) : null}
            {statusBadge ? (
              <View style={{ alignSelf: "flex-start" }}>
                <Badge label={statusBadge.label} tone={statusBadge.tone} />
              </View>
            ) : null}
          </View>
          {step.irritationRisk === "high" ? (
            <Ionicons
              name="alert-circle"
              size={14}
              color={colors.warning}
              accessibilityLabel="Higher irritation risk"
            />
          ) : null}
          <Ionicons
            name={open ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.textSecondary}
          />
        </Pressable>
      </View>

      {open ? (
        <View style={styles.body}>
          <View style={{ gap: spacing.xxs }}>
            <AppText variant="label" color={colors.textSecondary}>
              WHY
            </AppText>
            <AppText variant="caption" color={colors.textPrimary}>
              {step.rationale}
            </AppText>
          </View>

          <View style={{ gap: spacing.xxs }}>
            <AppText variant="label" color={colors.textSecondary}>
              HOW
            </AppText>
            <AppText variant="caption" color={colors.textPrimary}>
              {usage.amount}. {usage.note}
            </AppText>
            {step.rampSchedule ? (
              <AppText variant="caption" color={colors.textPrimary}>
                Ramp up: {step.rampSchedule}
              </AppText>
            ) : null}
          </View>

          {adjustments.length > 0 ? (
            <View style={{ gap: spacing.xxs }}>
              <AppText variant="label" color={colors.warning}>
                NOTE
              </AppText>
              {adjustments.map((a, i) => (
                <AppText key={i} variant="caption" color={colors.textPrimary}>
                  • {a.detail}
                </AppText>
              ))}
            </View>
          ) : null}

          {!product && (onNotOwned || onAlreadyUse) ? (
            <View style={{ gap: spacing.xxs }}>
              <AppText variant="label" color={colors.textSecondary}>
                YOUR PRODUCT
              </AppText>
              <AppText variant="caption" color={colors.textPrimary}>
                {notOwned
                  ? "You marked this category as not currently owned. Your routine stays useful while you decide what to add."
                  : "Tell Pore whether you already use a product for this step."}
              </AppText>
              <View style={styles.productActions}>
                {onAlreadyUse ? (
                  <TextButton
                    label={notOwned ? "I use one now" : "I already use one"}
                    onPress={onAlreadyUse}
                  />
                ) : null}
                {!notOwned && onNotOwned ? (
                  <TextButton
                    label="I don't own this category"
                    tone={colors.textSecondary}
                    onPress={onNotOwned}
                  />
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: { paddingVertical: spacing.md },
    essential: {
      backgroundColor: colors.primaryTintSoft,
      borderRadius: radius.md,
      marginHorizontal: -spacing.xs,
      paddingHorizontal: spacing.xs,
    },
    support: {
      backgroundColor: colors.infoSoft,
      borderLeftWidth: borderWidth.accent,
      borderLeftColor: colors.info,
      borderRadius: radius.md,
      marginHorizontal: -spacing.xs,
      paddingHorizontal: spacing.xs,
    },
    resting: {
      backgroundColor: colors.background,
      borderLeftWidth: borderWidth.accent,
      borderLeftColor: colors.textSecondary,
      borderRadius: radius.md,
      marginHorizontal: -spacing.xs,
      paddingHorizontal: spacing.xs,
    },
    head: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    checkTarget: {
      width: touchTarget.min,
      minHeight: touchTarget.min,
      alignItems: "center",
      justifyContent: "center",
    },
    summary: {
      flex: 1,
      minHeight: touchTarget.min,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    productImage: {
      width: 48,
      height: 48,
      borderRadius: radius.sm,
      backgroundColor: colors.background,
    },
    body: { gap: spacing.sm, marginTop: spacing.sm },
    productActions: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: spacing.sm,
    },
  });
}
