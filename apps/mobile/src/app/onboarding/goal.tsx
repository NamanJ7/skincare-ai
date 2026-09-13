import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";

import type { ThemeColors } from "@pore/shared";

import { FunnelScreen } from "@/components/FunnelScreen";
import { OnboardingReaction } from "@/components/OnboardingReaction";
import { track } from "@/lib/analytics";
import { funnelProgress } from "@/lib/funnel-progress";
import { useOnboardingStep } from "@/lib/nav";
import {
  GOAL_CHOICES,
  MAX_RANKED_CONCERNS,
  answersForRankedGoals,
  toggleRankedGoal,
} from "@/lib/questionnaire";
import { useOnboarding, type OnboardingData } from "@/state/onboarding";
import {
  AppText,
  Badge,
  iconSize,
  radius,
  spacing,
  useThemeColors,
} from "@/theme";

const GOAL_VISUALS: Record<
  string,
  {
    icon: keyof typeof Ionicons.glyphMap;
    hint: string;
    reaction: string;
  }
> = {
  acne: {
    icon: "water-outline",
    hint: "Calmer-looking breakouts",
    reaction:
      "Pore will rank breakout-friendly steps first and keep the routine from doing too much at once.",
  },
  marks: {
    icon: "sunny-outline",
    hint: "More even-looking tone",
    reaction:
      "Pore will prioritize a steady tone-supporting routine without promising a fixed result date.",
  },
  oily: {
    icon: "sparkles-outline",
    hint: "Less visible shine",
    reaction:
      "Pore will balance oil-focused steps with barrier support instead of trying to strip the skin.",
  },
  dry: {
    icon: "leaf-outline",
    hint: "Comfort and barrier support",
    reaction:
      "Pore will make hydration and comfort the baseline before considering stronger targeted steps.",
  },
  texture: {
    icon: "grid-outline",
    hint: "Smoother-looking texture",
    reaction:
      "Pore will focus on a gradual texture routine and use your sensitivity answer to set the pace.",
  },
  aging: {
    icon: "time-outline",
    hint: "Support over time",
    reaction:
      "Pore will favor consistent, well-tolerated steps over an aggressive anti-aging stack.",
  },
  unsure: {
    icon: "compass-outline",
    hint: "Start with the essentials",
    reaction:
      "Pore will begin with a simple skin-health baseline and let later check-ins add context.",
  },
};

function initialChoices(data: OnboardingData): string[] {
  const validStored = (data.goalChoiceIds ?? [])
    .filter((id) => GOAL_CHOICES.some((option) => option.id === id))
    .slice(0, MAX_RANKED_CONCERNS);
  if (validStored.length > 0) return validStored;

  const orderedGoals = [
    ...(data.primaryGoal ? [data.primaryGoal] : []),
    ...(data.goals ?? []).filter((goal) => goal !== data.primaryGoal),
  ];
  return orderedGoals
    .map((goal) => GOAL_CHOICES.find((option) => option.primary === goal)?.id)
    .filter((id): id is string => id !== undefined)
    .filter((id, index, all) => all.indexOf(id) === index)
    .slice(0, MAX_RANKED_CONCERNS);
}

export default function Goal() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { fontScale, width } = useWindowDimensions();
  const oneColumn = width < 380 || fontScale > 1.15;
  const { data, update } = useOnboarding();
  const { editing, ctaLabel, proceed } = useOnboardingStep(
    "/onboarding/skin-profile",
  );
  const [choices, setChoices] = useState<string[]>(() => initialChoices(data));
  const primaryVisual = choices[0] ? GOAL_VISUALS[choices[0]] : undefined;

  useEffect(() => {
    if (!editing) track("onboarding_step_viewed", { step_id: "goal" });
  }, [editing]);

  function select(id: string) {
    setChoices((value) => toggleRankedGoal(value, id));
    Haptics.selectionAsync().catch(() => {});
  }

  function next() {
    const answers = answersForRankedGoals(choices);
    if (!answers) return;
    void update(answers);
    if (!editing) track("onboarding_step_completed", { step_id: "goal" });
    proceed();
  }

  function goBack() {
    if (!editing) track("onboarding_step_backed_out", { step_id: "goal" });
    router.back();
  }

  return (
    <FunnelScreen
      progress={editing ? undefined : funnelProgress("goal")}
      title="What matters most right now?"
      subtitle="Pick one main focus. Add up to two supporting concerns only if they matter."
      primaryLabel={ctaLabel}
      onPrimary={next}
      primaryDisabled={choices.length === 0}
      secondaryLabel={editing ? undefined : "Back"}
      onSecondary={goBack}
    >
      <View style={styles.grid}>
        {GOAL_CHOICES.map((option) => {
          const rank = choices.indexOf(option.id);
          const selected = rank >= 0;
          const visual = GOAL_VISUALS[option.id];
          return (
            <Pressable
              key={option.id}
              onPress={() => select(option.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${option.label}. ${visual.hint}${selected ? `. ${rank === 0 ? "Main focus" : `Priority ${rank + 1}`}` : ""}`}
              style={({ pressed }) => [
                styles.tile,
                !oneColumn && styles.tileHalf,
                selected && styles.tileSelected,
                pressed && styles.tilePressed,
              ]}
            >
              <View style={styles.tileTop}>
                <View
                  style={[styles.iconWrap, selected && styles.iconWrapSelected]}
                >
                  <Ionicons
                    name={visual.icon}
                    size={iconSize.md}
                    color={
                      selected ? colors.onBrandAccent : colors.actionPrimary
                    }
                  />
                </View>
                {selected ? (
                  <Badge
                    label={rank === 0 ? "MAIN" : `#${rank + 1}`}
                    tone={rank === 0 ? "primary" : "accent"}
                  />
                ) : null}
              </View>
              <AppText variant="bodyStrong">{option.label}</AppText>
              <AppText variant="caption" color={colors.textSecondary}>
                {visual.hint}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <OnboardingReaction
        title="Your Pore focus"
        message={primaryVisual?.reaction}
      />

      <AppText
        variant="caption"
        color={colors.textSecondary}
        style={styles.count}
      >
        {choices.length === 0
          ? "Choose your main focus"
          : `${choices.length} of ${MAX_RANKED_CONCERNS} selected`}
      </AppText>
    </FunnelScreen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    tile: {
      width: "100%",
      minHeight: 132,
      gap: spacing.xs,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    tileHalf: { flexBasis: "47%", flexGrow: 1, width: undefined },
    tileSelected: {
      borderColor: colors.actionPrimary,
      backgroundColor: colors.primaryTintSoft,
    },
    tilePressed: { opacity: 0.86 },
    tileTop: {
      minHeight: 38,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.xs,
    },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.infoSoft,
    },
    iconWrapSelected: { backgroundColor: colors.brandAccent },
    count: { textAlign: "center" },
  });
}
