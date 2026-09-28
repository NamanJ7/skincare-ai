import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import type { ThemeColors } from "@pore/shared";
import type { RoutinePeriod } from "@/lib/log";
import type { RoutineSupportStep, SkinPriority } from "@/lib/results";
import { AppText, radius, spacing, useThemeColors } from "@/theme";
import { PlanConnection } from "./PlanConnection";

function usePriorityStoryTheme() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return { colors, styles };
}

export function PriorityStoryCard({
  priority,
  rank,
  selected,
  expanded,
  scanBased,
  support,
  supportPeriod,
  onSelect,
  onOpenRoutine,
}: {
  priority: SkinPriority;
  rank: number;
  selected: boolean;
  expanded: boolean;
  scanBased: boolean;
  support: RoutineSupportStep[];
  supportPeriod: RoutinePeriod;
  onSelect: () => void;
  onOpenRoutine: () => void;
}) {
  const { colors, styles } = usePriorityStoryTheme();
  const reduceMotion = useReducedMotion();
  const bodyReveal = useSharedValue(expanded ? 1 : 0);
  // Keep the body mounted through a collapse so it can retract rather than snap.
  const [rendered, setRendered] = useState(expanded);

  useEffect(() => {
    if (expanded) {
      setRendered(true);
      bodyReveal.value = reduceMotion
        ? 1
        : withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
      return;
    }
    if (reduceMotion) {
      bodyReveal.value = 0;
      setRendered(false);
      return;
    }
    bodyReveal.value = withTiming(
      0,
      { duration: 160, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(setRendered)(false);
      },
    );
  }, [bodyReveal, expanded, reduceMotion]);

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: bodyReveal.value,
    transform: [{ translateY: (1 - bodyReveal.value) * 4 }],
  }));
  const actionLabel =
    supportPeriod === "pm" ? "View evening steps" : "View morning steps";
  const headerLabel = [
    `Priority ${rank}`,
    priority.title,
    scanBased && priority.appearanceLabel
      ? `appearance ${priority.appearanceLabel}`
      : undefined,
    selected ? "selected" : "not selected",
    expanded ? "expanded" : "collapsed",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <View style={[styles.card, selected && styles.cardSelected]}>
      <Pressable
        onPress={onSelect}
        accessibilityRole="button"
        accessibilityState={{ selected, expanded }}
        aria-pressed={selected}
        aria-expanded={expanded}
        accessibilityLabel={headerLabel}
        style={({ pressed }) => [
          styles.header,
          pressed && styles.headerPressed,
        ]}
      >
        <View style={[styles.rank, selected && styles.rankSelected]}>
          <AppText
            variant="bodyStrong"
            color={selected ? colors.onActionPrimary : colors.actionPrimary}
          >
            {rank}
          </AppText>
        </View>
        <View style={styles.headerCopy}>
          <AppText
            variant="headline"
            color={selected ? colors.actionPrimary : colors.textPrimary}
          >
            {priority.title}
          </AppText>
          {scanBased && priority.appearanceLabel ? (
            <View style={styles.appearance}>
              <AppText variant="label" color={colors.info}>
                APPEARANCE: {priority.appearanceLabel}
              </AppText>
            </View>
          ) : (
            <AppText variant="caption" color={colors.textSecondary}>
              From what you shared with Pore
            </AppText>
          )}
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.textSecondary}
          accessible={false}
          style={styles.chevron}
        />
      </Pressable>

      {rendered ? (
        <Animated.View style={[styles.body, bodyStyle]}>
          {scanBased ? (
            <StoryFact
              icon="location-outline"
              label="WHERE PORE NOTICED IT"
              body={
                priority.where ??
                "This scan did not return a broad facial region for this priority."
              }
            />
          ) : (
            <StoryFact
              icon="chatbubble-ellipses-outline"
              label="WHAT THIS IS BASED ON"
              body="This priority comes from your answers, not visual scan evidence."
            />
          )}

          {scanBased ? (
            <StoryFact
              icon={
                priority.confidence === "low"
                  ? "help-circle-outline"
                  : "checkmark-circle-outline"
              }
              label="CONFIDENCE"
              body={
                priority.confidenceLabel ??
                "Pore could not assign a clear confidence description to this read."
              }
            />
          ) : null}

          <StoryFact
            icon="flag-outline"
            label="WHY PORE FLAGGED IT"
            body={
              priority.why ??
              (scanBased
                ? "This was one of the clearest cosmetic priorities in your scan."
                : "You chose this as an area you want your routine to support.")
            }
          />

          <StoryFact
            icon="time-outline"
            label="VISIBLE CHANGE TAKES TIME"
            body={priority.outlook}
          />

          <PlanConnection
            support={support}
            period={supportPeriod}
            actionLabel={actionLabel}
            onPress={onOpenRoutine}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

function StoryFact({
  icon,
  label,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  body: string;
}) {
  const { colors, styles } = usePriorityStoryTheme();
  return (
    <View style={styles.fact}>
      <Ionicons
        name={icon}
        size={18}
        color={colors.gold}
        accessible={false}
        style={styles.factIcon}
      />
      <View style={styles.factCopy}>
        <AppText variant="overline" color={colors.textSecondary}>
          {label}
        </AppText>
        <AppText variant="caption" color={colors.textPrimary}>
          {body}
        </AppText>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      overflow: "hidden",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      backgroundColor: colors.background,
    },
    cardSelected: {
      borderWidth: 2,
      borderColor: colors.actionPrimary,
      backgroundColor: colors.infoSoft,
    },
    header: {
      minHeight: 68,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      padding: spacing.md,
    },
    headerPressed: { backgroundColor: colors.primaryTint },
    rank: {
      minWidth: 38,
      minHeight: 38,
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xxs,
      borderRadius: radius.pill,
      borderWidth: 2,
      borderColor: colors.gold,
      backgroundColor: colors.background,
    },
    rankSelected: {
      borderColor: colors.actionPrimary,
      backgroundColor: colors.actionPrimary,
    },
    headerCopy: { flex: 1, minWidth: 0, gap: spacing.xxs },
    appearance: {
      alignSelf: "flex-start",
      maxWidth: "100%",
      borderRadius: radius.pill,
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
      backgroundColor: colors.infoSoft,
    },
    chevron: { flexShrink: 0, marginTop: spacing.xs },
    body: {
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
    },
    fact: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
    },
    factIcon: { flexShrink: 0, marginTop: 1 },
    factCopy: { flex: 1, gap: spacing.xxs },
  });
}
