import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import type { SkinType, ThemeColors } from "@pore/shared";

import { FunnelScreen } from "@/components/FunnelScreen";
import { track } from "@/lib/analytics";
import { funnelProgress } from "@/lib/funnel-progress";
import { useOnboardingStep } from "@/lib/nav";
import { useOnboarding, type RoutineComplexity } from "@/state/onboarding";
import {
  AppText,
  SectionHeader,
  iconSize,
  radius,
  spacing,
  useThemeColors,
} from "@/theme";

type SkinTypeChoice = SkinType | "unsure";

const SKIN_TYPES: {
  value: SkinTypeChoice;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    value: "oily",
    label: "Oily",
    hint: "Shiny fairly quickly",
    icon: "water-outline",
  },
  { value: "dry", label: "Dry", hint: "Tight or flaky", icon: "leaf-outline" },
  {
    value: "combination",
    label: "Combination",
    hint: "Oily and dry areas",
    icon: "contrast-outline",
  },
  {
    value: "normal",
    label: "Balanced",
    hint: "Usually comfortable",
    icon: "happy-outline",
  },
  {
    value: "unsure",
    label: "Not sure",
    hint: "Use a cautious baseline",
    icon: "help-circle-outline",
  },
];

const COMPLEXITY: {
  value: RoutineComplexity;
  label: string;
  hint: string;
  steps: number;
}[] = [
  {
    value: "minimal",
    label: "2-step essentials",
    hint: "The fewest useful steps",
    steps: 2,
  },
  {
    value: "balanced",
    label: "3-step balanced",
    hint: "Essentials plus one targeted step",
    steps: 3,
  },
  {
    value: "flexible",
    label: "4-step guided",
    hint: "More structure when each step earns its place",
    steps: 4,
  },
];

function initialSkinType(
  choiceId: string | undefined,
  skinType: SkinType | undefined,
): SkinTypeChoice | null {
  if (SKIN_TYPES.some((option) => option.value === choiceId)) {
    return choiceId as SkinTypeChoice;
  }
  return skinType ?? null;
}

function RoutineChoices({
  value,
  onChange,
}: {
  value: RoutineComplexity | null;
  onChange: (value: RoutineComplexity) => void;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reduceMotion = useReducedMotion();
  const reveal = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    reveal.value = reduceMotion
      ? 1
      : withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
  }, [reduceMotion, reveal]);
  const revealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ translateY: (1 - reveal.value) * 8 }],
  }));

  return (
    <Animated.View style={[styles.routineSection, revealStyle]}>
      <SectionHeader title="Choose your routine size" />
      <AppText variant="caption" color={colors.textSecondary}>
        This sets a maximum, not a quota. Safety can always simplify it.
      </AppText>
      <View style={styles.routineList} accessibilityRole="radiogroup">
        {COMPLEXITY.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                onChange(option.value);
                Haptics.selectionAsync().catch(() => {});
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${option.label}. ${option.hint}`}
              style={({ pressed }) => [
                styles.routineChoice,
                selected && styles.choiceSelected,
                pressed && styles.choicePressed,
              ]}
            >
              <View style={styles.stepStack} importantForAccessibility="no">
                {Array.from({ length: option.steps }).map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.stepBar,
                      { width: `${64 + index * 9}%` },
                      selected && styles.stepBarSelected,
                    ]}
                  />
                ))}
              </View>
              <View style={styles.choiceCopy}>
                <AppText variant="bodyStrong">{option.label}</AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  {option.hint}
                </AppText>
              </View>
              <Ionicons
                name={selected ? "checkmark-circle" : "ellipse-outline"}
                size={iconSize.md}
                color={selected ? colors.actionPrimary : colors.borderStrong}
              />
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

export default function SkinProfile() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { fontScale, width } = useWindowDimensions();
  const oneColumn = width < 380 || fontScale > 1.15;
  const { data, update } = useOnboarding();
  const { editing, ctaLabel, proceed } = useOnboardingStep(
    "/onboarding/sensitivity",
  );
  const [skinType, setSkinType] = useState<SkinTypeChoice | null>(() =>
    initialSkinType(data.skinTypeChoiceId, data.skinType),
  );
  const [complexity, setComplexity] = useState<RoutineComplexity | null>(
    data.routineComplexity ?? null,
  );

  useEffect(() => {
    if (!editing) track("onboarding_step_viewed", { step_id: "profile" });
  }, [editing]);

  function next() {
    if (!skinType || !complexity) return;
    void update({
      skinType: skinType === "unsure" ? undefined : skinType,
      skinTypeChoiceId: skinType,
      routineComplexity: complexity,
    });
    if (!editing) {
      track("onboarding_step_completed", { step_id: "profile" });
    }
    proceed();
  }

  function goBack() {
    if (!editing) {
      track("onboarding_step_backed_out", { step_id: "profile" });
    }
    router.back();
  }

  return (
    <FunnelScreen
      progress={editing ? undefined : funnelProgress("profile")}
      title="What fits your skin and your life?"
      subtitle="Start with how your skin usually feels. Your best guess is enough."
      primaryLabel={ctaLabel}
      onPrimary={next}
      primaryDisabled={!skinType || !complexity}
      secondaryLabel={editing ? undefined : "Back"}
      onSecondary={goBack}
    >
      <SectionHeader title="Your skin usually feels" />
      <View style={styles.skinGrid} accessibilityRole="radiogroup">
        {SKIN_TYPES.map((option) => {
          const selected = skinType === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                setSkinType(option.value);
                Haptics.selectionAsync().catch(() => {});
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${option.label}. ${option.hint}`}
              style={({ pressed }) => [
                styles.skinChoice,
                !oneColumn && styles.skinChoiceHalf,
                selected && styles.choiceSelected,
                pressed && styles.choicePressed,
              ]}
            >
              <View
                style={[styles.skinIcon, selected && styles.skinIconSelected]}
              >
                <Ionicons
                  name={option.icon}
                  size={iconSize.md}
                  color={selected ? colors.onBrandAccent : colors.actionPrimary}
                />
              </View>
              <View style={styles.choiceCopy}>
                <AppText variant="bodyStrong">{option.label}</AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  {option.hint}
                </AppText>
              </View>
            </Pressable>
          );
        })}
      </View>
      <AppText variant="caption" color={colors.textSecondary}>
        This is your description, not a scan diagnosis.
      </AppText>

      {skinType ? (
        <RoutineChoices value={complexity} onChange={setComplexity} />
      ) : null}
    </FunnelScreen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    skinGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    skinChoice: {
      width: "100%",
      minHeight: 82,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    skinChoiceHalf: { flexBasis: "47%", flexGrow: 1, width: undefined },
    skinIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.infoSoft,
    },
    skinIconSelected: { backgroundColor: colors.brandAccent },
    choiceSelected: {
      borderColor: colors.actionPrimary,
      backgroundColor: colors.primaryTintSoft,
    },
    choicePressed: { opacity: 0.86 },
    choiceCopy: { flex: 1, gap: spacing.xxs },
    routineSection: { gap: spacing.sm },
    routineList: { gap: spacing.sm },
    routineChoice: {
      minHeight: 82,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    stepStack: {
      width: 54,
      gap: 4,
      alignItems: "flex-start",
      justifyContent: "center",
    },
    stepBar: {
      height: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.border,
    },
    stepBarSelected: { backgroundColor: colors.actionPrimary },
  });
}
