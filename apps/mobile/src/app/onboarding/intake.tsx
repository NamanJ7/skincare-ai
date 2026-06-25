import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { View } from "react-native";

import type { Sensitivity, SkinGoal, SkinType } from "@pore/shared";
import { useOnboarding } from "@/state/onboarding";
import { AppText, Chip, GhostButton, PrimaryButton, ProgressDots, Screen, colors, spacing } from "@/theme";

const GOALS: { key: SkinGoal; label: string }[] = [
  { key: "acne", label: "Acne / breakouts" },
  { key: "post_acne_marks", label: "Post-acne marks" },
  { key: "hyperpigmentation", label: "Dark spots / uneven tone" },
  { key: "oiliness", label: "Oiliness" },
  { key: "dryness", label: "Dryness" },
  { key: "texture", label: "Texture" },
  { key: "redness", label: "Redness" },
  { key: "general_health", label: "Overall healthy skin" },
];

const SKIN_TYPES: { key: SkinType; label: string }[] = [
  { key: "oily", label: "Oily" },
  { key: "dry", label: "Dry" },
  { key: "combination", label: "Combination" },
  { key: "normal", label: "Normal" },
];

const SENSITIVITY: { key: Sensitivity; label: string; hint: string }[] = [
  { key: "low", label: "Not very", hint: "I can try most products without issues" },
  { key: "medium", label: "Somewhat", hint: "Some products sting or make me red" },
  { key: "high", label: "Very", hint: "My skin reacts easily and often" },
];

const STEP_COUNT = 4;

export default function Intake() {
  const { update } = useOnboarding();
  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState<SkinGoal[]>([]);
  const [skinType, setSkinType] = useState<SkinType | null>(null);
  const [sensitivity, setSensitivity] = useState<Sensitivity | null>(null);
  const [pregnant, setPregnant] = useState<boolean | null>(null);

  const canAdvance =
    (step === 0 && goals.length > 0) ||
    (step === 1 && skinType !== null) ||
    (step === 2 && sensitivity !== null) ||
    (step === 3 && pregnant !== null);

  function toggleGoal(key: SkinGoal) {
    setGoals((prev) => (prev.includes(key) ? prev.filter((g) => g !== key) : [...prev, key]));
  }

  function next() {
    if (!canAdvance) return;
    if (step < STEP_COUNT - 1) {
      setStep((s) => s + 1);
      return;
    }
    update({
      goals,
      skinType: skinType ?? "combination",
      sensitivity: sensitivity ?? "medium",
      pregnancyOrBreastfeeding: pregnant ?? false,
    });
    router.push("/onboarding/photo");
  }

  function back() {
    if (step === 0) router.back();
    else setStep((s) => s - 1);
  }

  return (
    <Screen contentStyle={{ paddingTop: spacing.lg }}>
      <ProgressDots count={STEP_COUNT} index={step} />

      {step === 0 && (
        <Question title="What do you want to work on?" subtitle="Pick all that apply.">
          <ChipWrap>
            {GOALS.map((g) => (
              <Chip key={g.key} label={g.label} selected={goals.includes(g.key)} onPress={() => toggleGoal(g.key)} />
            ))}
          </ChipWrap>
        </Question>
      )}

      {step === 1 && (
        <Question title="How does your skin usually feel?">
          <ChipWrap>
            {SKIN_TYPES.map((s) => (
              <Chip key={s.key} label={s.label} selected={skinType === s.key} onPress={() => setSkinType(s.key)} />
            ))}
          </ChipWrap>
        </Question>
      )}

      {step === 2 && (
        <Question title="How sensitive is your skin?" subtitle="This is the biggest factor in keeping your routine safe.">
          <View style={{ gap: spacing.sm }}>
            {SENSITIVITY.map((s) => (
              <Chip key={s.key} label={`${s.label} — ${s.hint}`} selected={sensitivity === s.key} onPress={() => setSensitivity(s.key)} />
            ))}
          </View>
        </Question>
      )}

      {step === 3 && (
        <Question title="Are you pregnant or breastfeeding?" subtitle="Some ingredients are best avoided — we'll adjust automatically.">
          <ChipWrap>
            <Chip label="Yes" selected={pregnant === true} onPress={() => setPregnant(true)} />
            <Chip label="No" selected={pregnant === false} onPress={() => setPregnant(false)} />
          </ChipWrap>
        </Question>
      )}

      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        <PrimaryButton label={step < STEP_COUNT - 1 ? "Next" : "Continue to photo"} onPress={next} disabled={!canAdvance} />
        <GhostButton label="Back" onPress={back} />
      </View>
    </Screen>
  );
}

function Question({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
      <AppText variant="title">{title}</AppText>
      {subtitle ? (
        <AppText variant="body" color={colors.inkMuted}>
          {subtitle}
        </AppText>
      ) : null}
      <View style={{ marginTop: spacing.sm }}>{children}</View>
    </View>
  );
}

function ChipWrap({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>{children}</View>;
}
