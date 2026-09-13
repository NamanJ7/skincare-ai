import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { Sensitivity, ThemeColors } from "@pore/shared";

import { FunnelScreen } from "@/components/FunnelScreen";
import { OnboardingReaction } from "@/components/OnboardingReaction";
import { track } from "@/lib/analytics";
import { funnelProgress } from "@/lib/funnel-progress";
import { useOnboardingStep } from "@/lib/nav";
import { useOnboarding } from "@/state/onboarding";
import {
  AppText,
  OptionRow,
  iconSize,
  radius,
  spacing,
  useThemeColors,
} from "@/theme";

const OPTIONS: {
  id: string;
  label: string;
  hint: string;
  value: Sensitivity;
  level: number;
  reaction: string;
}[] = [
  {
    id: "rarely",
    label: "Rarely reacts",
    hint: "Most new products feel comfortable",
    value: "low",
    level: 1,
    reaction:
      "Pore can use a standard cautious pace, while still avoiding unnecessary active stacking.",
  },
  {
    id: "sometimes",
    label: "Sometimes irritated",
    hint: "Some products cause stinging, dryness, or redness",
    value: "medium",
    level: 2,
    reaction:
      "Pore will stagger stronger steps and leave more room to see how your skin responds.",
  },
  {
    id: "often",
    label: "Very easily irritated",
    hint: "Reactions happen often or linger",
    value: "high",
    level: 3,
    reaction:
      "Pore will start slower, simplify stronger steps, and prioritize comfort over speed.",
  },
  {
    id: "unsure",
    label: "I'm not sure",
    hint: "Use a cautious middle starting point",
    value: "medium",
    level: 2,
    reaction:
      "Pore will begin cautiously and use later comfort check-ins to help you adjust.",
  },
];

export default function SensitivityScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data, update } = useOnboarding();
  const { editing, ctaLabel, proceed } =
    useOnboardingStep("/onboarding/safety");
  const [choice, setChoice] = useState<string | null>(
    data.sensitivityChoiceId ??
      OPTIONS.find((option) => option.value === data.sensitivity)?.id ??
      null,
  );
  const selected = OPTIONS.find((option) => option.id === choice);

  useEffect(() => {
    if (!editing) track("onboarding_step_viewed", { step_id: "sensitivity" });
  }, [editing]);

  function choose(id: string) {
    setChoice(id);
    Haptics.selectionAsync().catch(() => {});
  }

  function next() {
    if (!selected) return;
    void update({
      sensitivity: selected.value,
      sensitivityChoiceId: selected.id,
    });
    if (!editing) {
      track("onboarding_step_completed", { step_id: "sensitivity" });
    }
    proceed();
  }

  function goBack() {
    if (!editing) {
      track("onboarding_step_backed_out", { step_id: "sensitivity" });
    }
    router.back();
  }

  return (
    <FunnelScreen
      progress={editing ? undefined : funnelProgress("sensitivity")}
      title="How reactive is your skin?"
      subtitle="Choose the closest fit. This sets how slowly Pore introduces stronger steps."
      primaryLabel={ctaLabel}
      onPrimary={next}
      primaryDisabled={!choice}
      secondaryLabel={editing ? undefined : "Back"}
      onSecondary={goBack}
    >
      <View style={styles.scale} accessibilityRole="radiogroup">
        {OPTIONS.slice(0, 3).map((option) => {
          const active = choice === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => choose(option.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`${option.label}. ${option.hint}`}
              style={({ pressed }) => [
                styles.level,
                active && styles.levelSelected,
                pressed && styles.levelPressed,
              ]}
            >
              <View style={styles.levelVisual} importantForAccessibility="no">
                <View style={styles.bars}>
                  {[1, 2, 3].map((bar) => (
                    <View
                      key={bar}
                      style={[
                        styles.bar,
                        { height: 7 + bar * 6 },
                        bar <= option.level &&
                          (active ? styles.barActive : styles.barFilled),
                      ]}
                    />
                  ))}
                </View>
                <Ionicons
                  name={active ? "checkmark-circle" : "ellipse-outline"}
                  size={iconSize.md}
                  color={active ? colors.actionPrimary : colors.borderStrong}
                />
              </View>
              <View style={styles.levelCopy}>
                <AppText variant="bodyStrong">{option.label}</AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  {option.hint}
                </AppText>
              </View>
            </Pressable>
          );
        })}
      </View>

      <OptionRow
        label={OPTIONS[3].label}
        hint={OPTIONS[3].hint}
        selected={choice === "unsure"}
        onPress={() => choose("unsure")}
      />

      <OnboardingReaction
        title="How Pore adjusts"
        message={selected?.reaction}
      />
    </FunnelScreen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    scale: { gap: spacing.sm, marginTop: spacing.sm },
    level: {
      minHeight: 88,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    levelSelected: {
      borderColor: colors.actionPrimary,
      backgroundColor: colors.primaryTintSoft,
    },
    levelPressed: { opacity: 0.86 },
    levelVisual: {
      width: 60,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: spacing.xs,
    },
    bars: {
      height: 30,
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 3,
    },
    bar: {
      width: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.border,
    },
    barFilled: { backgroundColor: colors.accent },
    barActive: { backgroundColor: colors.actionPrimary },
    levelCopy: { flex: 1, gap: spacing.xxs },
  });
}
