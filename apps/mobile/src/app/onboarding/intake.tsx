import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";

import { ACTIVES, type ActiveKey, type Sensitivity, type SkinGoal, type SkinType } from "@pore/shared";
import { fetchPlan } from "@/lib/api";
import { buildIntake } from "@/lib/intake";
import { recordAssessment } from "@/lib/journal";
import { CAPTURE_STEPS, listSessions, type CapturedPhoto } from "@/lib/photos";
import { REMINDER_HOURS, enableReminder, formatHour } from "@/lib/reminder";
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

/**
 * The actives worth asking about by name.
 *
 * Not all twelve. "Have you reacted to mandelic acid?" is a question almost
 * nobody can answer, and a list of twelve chemical names is exactly the kind of
 * jargon wall that makes people tap through without reading. These six are the
 * ones that appear on drugstore packaging and that people actually remember
 * reacting to. Labels come from ACTIVES so there is one source of truth for
 * ingredient naming across the app.
 */
const ASKED_ALLERGENS: ActiveKey[] = [
  "retinoid",
  "benzoyl_peroxide",
  "salicylic_acid",
  "glycolic_acid",
  "vitamin_c",
  "niacinamide",
];

const STEP_COUNT = 5;

export default function Intake() {
  const { data, update } = useOnboarding();
  const [step, setStep] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  /**
   * Shown after the routine exists, not as another question before it. The
   * permission prompt lands on the moment the user has just been handed
   * something worth being reminded about, which is the only honest time to ask.
   */
  const [askingReminder, setAskingReminder] = useState(false);
  const [goals, setGoals] = useState<SkinGoal[]>([]);
  const [skinType, setSkinType] = useState<SkinType | null>(null);
  const [sensitivity, setSensitivity] = useState<Sensitivity | null>(null);
  const [pregnant, setPregnant] = useState<boolean | null>(null);
  /** null until answered; [] is the real answer "none of these". */
  const [allergies, setAllergies] = useState<ActiveKey[] | null>(null);

  const canAdvance =
    (step === 0 && goals.length > 0) ||
    (step === 1 && skinType !== null) ||
    (step === 2 && sensitivity !== null) ||
    (step === 3 && pregnant !== null) ||
    (step === 4 && allergies !== null);

  function toggleGoal(key: SkinGoal) {
    setGoals((prev) => (prev.includes(key) ? prev.filter((g) => g !== key) : [...prev, key]));
  }

  function toggleAllergen(key: ActiveKey) {
    setAllergies((prev) =>
      prev?.includes(key) ? prev.filter((a) => a !== key) : [...(prev ?? []), key],
    );
  }

  async function next() {
    if (!canAdvance) return;
    if (step < STEP_COUNT - 1) {
      setStep((s) => s + 1);
      return;
    }

    const answers = {
      goals,
      skinType: skinType ?? "combination",
      sensitivity: sensitivity ?? "medium",
      pregnancyOrBreastfeeding: pregnant ?? false,
      allergies: allergies ?? [],
      // The marker that says onboarding finished rather than being abandoned.
      // It is what lets the next cold start go straight to the routine.
      onboardedAt: new Date().toISOString(),
    } as const;
    update(answers);

    // The photos were taken first, but the assessment needs these answers, so
    // generation happens here rather than running on questionnaire defaults.
    setAnalyzing(true);
    const photos = data.photos ?? [];
    const ordered = CAPTURE_STEPS.map((s) => photos.find((p) => p.angle === s.angle)).filter(
      (p): p is CapturedPhoto => p !== undefined,
    );
    const plan = await fetchPlan({
      images: ordered.map((p) => ({ data: p.data, mediaType: "image/jpeg", quality: p.quality })),
      intake: buildIntake({ ...data, ...answers }),
    });
    if (plan) {
      update({ plan });
      // This first reading is the zero every later measurement subtracts from,
      // so it is filed away the moment it exists. Without it there is nothing
      // to compare a return visit against.
      recordAssessment({
        // The capture screen has already written its manifest, so the newest
        // stored session is the set this assessment was made from.
        sessionId: listSessions()[0]?.id ?? "baseline",
        capturedAt: ordered[0]?.capturedAt ?? new Date().toISOString(),
        assessment: plan.assessment,
      });
    }
    setAnalyzing(false);
    setAskingReminder(true);
  }

  async function chooseReminder(hour: number | null) {
    if (hour !== null && (await enableReminder(hour))) update({ reminderHour: hour });
    router.replace("/today");
  }

  function back() {
    if (step === 0) router.back();
    else setStep((s) => s - 1);
  }

  if (askingReminder) {
    return (
      <Screen contentStyle={{ paddingTop: spacing.section }}>
        <AppText variant="title">Want a nudge in the evening?</AppText>
        <AppText variant="body" color={colors.inkMuted}>
          One reminder a day, at a time you pick. That&apos;s the only notification Pore sends —
          no streaks to keep, nothing chasing you. You can turn it off any time.
        </AppText>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md }}>
          {REMINDER_HOURS.map((h) => (
            <Chip key={h} label={formatHour(h)} onPress={() => void chooseReminder(h)} />
          ))}
        </View>

        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          <GhostButton label="No reminders" onPress={() => void chooseReminder(null)} />
        </View>
      </Screen>
    );
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

      {step === 4 && (
        <Question
          title="Has anything ever irritated your skin?"
          subtitle="We'll keep it out of your routine entirely. Skip if nothing comes to mind."
        >
          <ChipWrap>
            {ASKED_ALLERGENS.map((key) => (
              <Chip
                key={key}
                label={ACTIVES[key].short}
                selected={allergies?.includes(key) ?? false}
                onPress={() => toggleAllergen(key)}
              />
            ))}
            <Chip
              label="Nothing I know of"
              tone="lavender"
              selected={allergies?.length === 0}
              onPress={() => setAllergies([])}
            />
          </ChipWrap>
        </Question>
      )}

      {analyzing ? (
        <View style={{ alignItems: "center", gap: spacing.sm, marginTop: spacing.lg }}>
          <ActivityIndicator color={colors.primary} />
          <AppText variant="caption" color={colors.inkMuted}>
            Reading your skin and building a routine…
          </AppText>
        </View>
      ) : (
        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          <PrimaryButton
            label={step < STEP_COUNT - 1 ? "Next" : "Build my routine"}
            onPress={next}
            disabled={!canAdvance}
          />
          <GhostButton label="Back" onPress={back} />
        </View>
      )}
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
