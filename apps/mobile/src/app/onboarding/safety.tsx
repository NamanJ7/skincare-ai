import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { router, type Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { ThemeColors } from "@pore/shared";

import { FunnelScreen } from "@/components/FunnelScreen";
import { OnboardingReaction } from "@/components/OnboardingReaction";
import { track } from "@/lib/analytics";
import { funnelProgress } from "@/lib/funnel-progress";
import { scanEntryHref, useOnboardingStep } from "@/lib/nav";
import {
  isSafetyAnswerComplete,
  normalizeSafetyChoiceIds,
  safetyChoicesFromLegacyAnswers,
  toggleSafetyChoice,
} from "@/lib/questionnaire";
import { useOnboarding, type SafetyChoiceId } from "@/state/onboarding";
import {
  AppText,
  Callout,
  Chip,
  SectionHeader,
  TextField,
  iconSize,
  radius,
  spacing,
  useThemeColors,
} from "@/theme";

const SAFETY_FLAGS: {
  id: Exclude<SafetyChoiceId, "none">;
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    id: "pregnancy_or_breastfeeding",
    label: "Pregnant, breastfeeding, or trying",
    hint: "Keep incompatible ingredients out",
    icon: "heart-outline",
  },
  {
    id: "prescription_skincare",
    label: "I use prescription skincare",
    hint: "Avoid stacking strong over-the-counter actives",
    icon: "medical-outline",
  },
  {
    id: "known_reactions",
    label: "I have known ingredient reactions",
    hint: "Tell Pore what to keep out",
    icon: "alert-circle-outline",
  },
  {
    id: "current_strong_actives",
    label: "I already use strong actives",
    hint: "Count them before adding another",
    icon: "flask-outline",
  },
];

const REACTIONS = [
  { id: "fragrance", label: "Fragrance" },
  { id: "retinoid", label: "Retinoids" },
  { id: "vitamin_c", label: "Vitamin C" },
  { id: "salicylic_acid", label: "Salicylic acid" },
  { id: "benzoyl_peroxide", label: "Benzoyl peroxide" },
  { id: "glycolic_acid", label: "Exfoliating acids" },
  { id: "niacinamide", label: "Niacinamide" },
] as const;

const CURRENT_ACTIVES = [
  { id: "retinoid", label: "Retinoid / retinol" },
  { id: "salicylic_acid", label: "Salicylic acid" },
  { id: "benzoyl_peroxide", label: "Benzoyl peroxide" },
  { id: "glycolic_acid", label: "AHA / exfoliating acid" },
  { id: "vitamin_c", label: "Vitamin C" },
  { id: "niacinamide", label: "Niacinamide" },
] as const;

function toggleItem(items: string[], id: string): string[] {
  return items.includes(id)
    ? items.filter((item) => item !== id)
    : [...items, id];
}

function initialChoices(
  data: Parameters<typeof safetyChoicesFromLegacyAnswers>[0],
) {
  const stored = normalizeSafetyChoiceIds(data.safetyChoiceIds);
  if (stored.length > 0) return stored;
  return safetyChoicesFromLegacyAnswers(data) ?? [];
}

function SafetyFlag({
  label,
  hint,
  icon,
  selected,
  onPress,
}: {
  label: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${label}. ${hint}`}
      style={({ pressed }) => [
        styles.flag,
        selected && styles.flagSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.flagIcon, selected && styles.flagIconSelected]}>
        <Ionicons
          name={icon}
          size={iconSize.md}
          color={selected ? colors.onBrandAccent : colors.actionPrimary}
        />
      </View>
      <View style={styles.flagCopy}>
        <AppText variant="bodyStrong">{label}</AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          {hint}
        </AppText>
      </View>
      <Ionicons
        name={selected ? "checkmark-circle" : "ellipse-outline"}
        size={iconSize.md}
        color={selected ? colors.actionPrimary : colors.borderStrong}
      />
    </Pressable>
  );
}

function reactionFor(choices: readonly SafetyChoiceId[]): string | undefined {
  if (choices.includes("none")) {
    return "Nothing is silently assumed. Pore can focus on your goals and sensitivity while keeping its normal safety checks.";
  }
  if (choices.includes("pregnancy_or_breastfeeding")) {
    return "Pore will keep pregnancy-incompatible ingredients out and surface extra caution where needed.";
  }
  if (choices.includes("prescription_skincare")) {
    return "Pore will use a gentler baseline instead of stacking another strong treatment on top.";
  }
  if (choices.includes("known_reactions")) {
    return "Pore will keep supported reaction ingredients out and leave other restrictions visible in your plan.";
  }
  if (choices.includes("current_strong_actives")) {
    return "Pore will count what you already use before deciding whether another targeted step earns a place.";
  }
  return undefined;
}

export default function SafetyScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data, update } = useOnboarding();
  const { editing, ctaLabel, proceed } = useOnboardingStep(
    scanEntryHref(data, "onboarding") as Href,
  );
  const [choices, setChoices] = useState<SafetyChoiceId[]>(() =>
    initialChoices(data),
  );
  const [allergies, setAllergies] = useState<string[]>(data.allergies ?? []);
  const [allergyNotes, setAllergyNotes] = useState(data.allergyNotes ?? "");
  const [currentProducts, setCurrentProducts] = useState<string[]>(
    data.currentProducts ?? [],
  );
  const reactionSelected = choices.includes("known_reactions");
  const treatmentsSelected = choices.includes("current_strong_actives");
  const effectiveAllergies = reactionSelected ? allergies : [];
  const effectiveNotes = reactionSelected ? allergyNotes.trim() : "";
  const effectiveProducts = treatmentsSelected ? currentProducts : [];
  const draft = {
    safetyChoiceIds: choices,
    pregnancyOrBreastfeeding: choices.includes("pregnancy_or_breastfeeding"),
    usingPrescriptionSkincare: choices.includes("prescription_skincare"),
    allergies: effectiveAllergies,
    allergyNotes: effectiveNotes,
    currentProducts: effectiveProducts,
  };
  const complete = isSafetyAnswerComplete(draft);

  useEffect(() => {
    if (!editing) track("onboarding_step_viewed", { step_id: "safety" });
  }, [editing]);

  function choose(id: SafetyChoiceId) {
    const next = toggleSafetyChoice(choices, id);
    setChoices(next);
    if (!next.includes("known_reactions")) {
      setAllergies([]);
      setAllergyNotes("");
    }
    if (!next.includes("current_strong_actives")) setCurrentProducts([]);
    Haptics.selectionAsync().catch(() => {});
  }

  function next() {
    if (!complete) return;
    void update({
      safetyChoiceIds: choices,
      pregnancyOrBreastfeeding: draft.pregnancyOrBreastfeeding,
      usingPrescriptionSkincare: draft.usingPrescriptionSkincare,
      allergies: effectiveAllergies,
      allergyNotes: effectiveNotes || undefined,
      currentProducts: effectiveProducts,
      fragrancePreference: effectiveAllergies.includes("fragrance")
        ? "fragrance_free"
        : undefined,
    });
    if (!editing) track("onboarding_step_completed", { step_id: "safety" });
    proceed();
  }

  function goBack() {
    if (!editing) track("onboarding_step_backed_out", { step_id: "safety" });
    router.back();
  }

  return (
    <FunnelScreen
      progress={editing ? undefined : funnelProgress("safety")}
      title="What should Pore account for?"
      subtitle="Choose every statement that applies, or explicitly choose none. Details appear only when needed."
      primaryLabel={ctaLabel}
      onPrimary={next}
      primaryDisabled={!complete}
      secondaryLabel={editing ? undefined : "Back"}
      onSecondary={goBack}
    >
      <View style={styles.flagList}>
        {SAFETY_FLAGS.map((flag) => (
          <SafetyFlag
            key={flag.id}
            {...flag}
            selected={choices.includes(flag.id)}
            onPress={() => choose(flag.id)}
          />
        ))}
        <SafetyFlag
          label="None of these apply"
          hint="I still want Pore's standard cautious guidance"
          icon="checkmark-done-outline"
          selected={choices.includes("none")}
          onPress={() => choose("none")}
        />
      </View>

      {reactionSelected ? (
        <View style={styles.details}>
          <SectionHeader title="Known ingredient reactions" />
          <AppText variant="caption" color={colors.textSecondary}>
            Choose at least one ingredient or write another restriction.
          </AppText>
          <View style={styles.chips}>
            {REACTIONS.map((item) => (
              <Chip
                key={item.id}
                label={item.label}
                selected={allergies.includes(item.id)}
                onPress={() =>
                  setAllergies((value) => toggleItem(value, item.id))
                }
              />
            ))}
          </View>
          <TextField
            label="Another restriction"
            value={allergyNotes}
            onChangeText={setAllergyNotes}
            // Matches the server bound in apps/web/lib/intake-guard.ts so a
            // long note is trimmed here rather than 400-ing at analysis time.
            maxLength={500}
            placeholder="Keep this visible in my routine"
          />
          {effectiveAllergies.length === 0 && !effectiveNotes ? (
            <AppText variant="caption" color={colors.error}>
              Add a reaction ingredient or another restriction to continue.
            </AppText>
          ) : null}
        </View>
      ) : null}

      {treatmentsSelected ? (
        <View style={styles.details}>
          <SectionHeader title="Current strong actives" />
          <AppText variant="caption" color={colors.textSecondary}>
            Choose at least one active you already use.
          </AppText>
          <View style={styles.chips}>
            {CURRENT_ACTIVES.map((item) => (
              <Chip
                key={item.id}
                label={item.label}
                tone="lavender"
                selected={currentProducts.includes(item.id)}
                onPress={() =>
                  setCurrentProducts((value) => toggleItem(value, item.id))
                }
              />
            ))}
          </View>
          {effectiveProducts.length === 0 ? (
            <AppText variant="caption" color={colors.error}>
              Choose a current active to continue.
            </AppText>
          ) : null}
        </View>
      ) : null}

      <OnboardingReaction
        title="Your safety guard"
        message={reactionFor(choices)}
      />

      <Callout tone="caution" title="For severe reactions">
        <AppText variant="caption" color={colors.onWarning}>
          Pore cannot verify every ingredient name. Confirm product labels with
          a qualified professional when a reaction could be serious.
        </AppText>
      </Callout>
    </FunnelScreen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flagList: { gap: spacing.sm, marginTop: spacing.sm },
    flag: {
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
    flagSelected: {
      borderColor: colors.actionPrimary,
      backgroundColor: colors.primaryTintSoft,
    },
    pressed: { opacity: 0.86 },
    flagIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.infoSoft,
    },
    flagIconSelected: { backgroundColor: colors.brandAccent },
    flagCopy: { flex: 1, gap: spacing.xxs },
    details: { gap: spacing.sm },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  });
}
