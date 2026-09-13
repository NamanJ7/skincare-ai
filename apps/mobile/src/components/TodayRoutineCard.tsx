import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import {
  motion,
  touchTarget,
  type RoutineStep,
  type ThemeColors,
} from "@pore/shared";
import { frequencyLabel, stepLabel } from "@/lib/labels";
import type { RoutinePeriod, RoutineStepInstance } from "@/lib/log";
import { useCelebration, useCheckPop } from "@/theme/motion";
import {
  AppText,
  Card,
  Divider,
  ProgressBar,
  PrimaryButton,
  StepCircle,
  TextButton,
  radius,
  spacing,
  useThemeColors,
} from "@/theme";

function useTodayRoutineTheme() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return { colors, styles };
}

export function TodayRoutineCard({
  title,
  period,
  steps,
  done,
  onToggle,
  onStartRoutine,
  startRoutineLabel,
  onViewRoutine,
}: {
  title: string;
  period: RoutinePeriod;
  steps: RoutineStepInstance[];
  done: string[];
  onToggle: (step: RoutineStepInstance, willCompletePeriod: boolean) => void;
  onStartRoutine: () => void;
  startRoutineLabel: string;
  onViewRoutine: () => void;
}) {
  const { colors, styles } = useTodayRoutineTheme();
  const complete =
    steps.length > 0 && steps.every((item) => done.includes(item.key));
  const celebrate = useCelebration(period, complete);
  const completedCount = steps.filter((item) => done.includes(item.key)).length;
  const periodLabel = period === "am" ? "morning" : "evening";

  return (
    <Card elevated style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <AppText variant="headline">{title}</AppText>
          <AppText variant="caption" color={colors.textSecondary}>
            {steps.length === 0
              ? `Your ${periodLabel} routine is not ready yet.`
              : complete
                ? `Your ${periodLabel} routine is complete.`
                : `${completedCount} of ${steps.length} complete`}
          </AppText>
        </View>
        {complete ? <CompletionMark celebrate={celebrate} /> : null}
      </View>

      {steps.length > 0 && !complete ? (
        <View style={styles.progress}>
          <ProgressBar value={completedCount / steps.length} />
        </View>
      ) : null}

      {steps.length > 0 ? (
        <View>
          {steps.map((item, index) => {
            const { step, key } = item;
            const checked = done.includes(key);
            const willCompletePeriod =
              !checked &&
              steps.every(
                (candidate) =>
                  candidate.key === key || done.includes(candidate.key),
              );
            return (
              <View key={key}>
                {index > 0 ? <Divider /> : null}
                <TodayRoutineStepRow
                  step={step}
                  checked={checked}
                  willCompletePeriod={willCompletePeriod}
                  onToggle={() => onToggle(item, willCompletePeriod)}
                />
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.empty}>
          <Ionicons
            name="list-outline"
            size={20}
            color={colors.textSecondary}
          />
          <AppText
            variant="caption"
            color={colors.textSecondary}
            style={styles.emptyCopy}
          >
            Open your routine to review what is available.
          </AppText>
        </View>
      )}

      <View style={styles.footer}>
        {!complete && steps.length > 0 ? (
          <PrimaryButton label={startRoutineLabel} onPress={onStartRoutine} />
        ) : null}
        <TextButton label="View full routine" onPress={onViewRoutine} />
      </View>
    </Card>
  );
}

function CompletionMark({ celebrate }: { celebrate: boolean }) {
  const colors = useThemeColors();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!celebrate || reduceMotion) {
      scale.value = 1;
      opacity.value = 1;
      return;
    }
    scale.value = 0.72;
    opacity.value = 0.45;
    scale.value = withSpring(1, {
      damping: 11,
      stiffness: 220,
      mass: 0.6,
    });
    opacity.value = withTiming(1, {
      duration: motion.duration.base,
    });
  }, [celebrate, opacity, reduceMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Ionicons
        name="checkmark-circle"
        size={24}
        color={colors.success}
        accessibilityLabel="Routine complete"
      />
    </Animated.View>
  );
}

function TodayRoutineStepRow({
  step,
  checked,
  willCompletePeriod,
  onToggle,
}: {
  step: RoutineStep;
  checked: boolean;
  willCompletePeriod: boolean;
  onToggle: () => void;
}) {
  const { colors, styles } = useTodayRoutineTheme();
  const { animatedStyle, trigger } = useCheckPop();
  const label = stepLabel(step);

  const toggle = () => {
    trigger();
    const feedback = willCompletePeriod
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    feedback.catch(() => {});
    onToggle();
  };

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      aria-checked={checked}
      accessibilityLabel={`${label}, ${frequencyLabel(step)}`}
      accessibilityHint={
        checked ? "Marks this step not complete" : "Marks this step complete"
      }
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Animated.View style={animatedStyle}>
        <StepCircle state={checked ? "done" : "upcoming"} />
      </Animated.View>
      <View style={styles.rowCopy}>
        <AppText
          variant="bodyStrong"
          color={checked ? colors.textSecondary : colors.textPrimary}
          style={checked ? styles.checkedLabel : undefined}
        >
          {step.order}. {label}
        </AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          {frequencyLabel(step)}
        </AppText>
      </View>
    </Pressable>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      gap: 0,
      paddingVertical: spacing.md,
    },
    header: {
      minHeight: touchTarget.min,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.xxs,
      paddingBottom: spacing.sm,
    },
    headerCopy: {
      flex: 1,
      gap: spacing.xxs,
    },
    progress: {
      paddingHorizontal: spacing.xxs,
      paddingBottom: spacing.sm,
    },
    row: {
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.xxs,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
    },
    rowPressed: {
      backgroundColor: colors.primaryTint,
    },
    rowCopy: {
      flex: 1,
      gap: spacing.xxs,
    },
    checkedLabel: {
      textDecorationLine: "line-through",
    },
    empty: {
      minHeight: touchTarget.min,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.xxs,
    },
    emptyCopy: {
      flex: 1,
    },
    footer: {
      gap: spacing.xs,
      paddingTop: spacing.xs,
    },
  });
}
