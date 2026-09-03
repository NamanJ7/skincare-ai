import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { View } from "react-native";

import { ACTIVES, type ActiveKey, type Sensitivity, type SkinGoal, type SkinType } from "@pore/shared";
import { PLAN_FAILURE_COPY, fetchPlan, type PlanFailure } from "@/lib/api";
import { buildIntake } from "@/lib/intake";
import { recordAssessment, savePlan } from "@/lib/journal";
import { CAPTURE_STEPS, listSessions, type CapturedPhoto } from "@/lib/photos";
import { useOnboarding } from "@/state/onboarding";
import {
  AppText,
  Card,
  Chip,
  GhostButton,
  PrimaryButton,
  ProgressDots,
  Screen,
  colors,
  spacing,
} from "@/theme";

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
 * The ingredients the safety engine can actually act on.
 *
 * Only these are offered, because an allergy we cannot enforce is worse than
 * not asking: it reads as a promise. `applySafetyRules` removes any step whose
 * active appears in `intake.allergies`, so every key here is enforceable.
 */
const ALLERGEN_KEYS: ActiveKey[] = [
  "salicylic_acid",
  "glycolic_acid",
  "lactic_acid",
  "benzoyl_peroxide",
  "retinoid",
  "vitamin_c",
  "niacinamide",
  "azelaic_acid",
  "hydroquinone",
];

export default function Intake() {
  const { data, update } = useOnboarding();
  const [step, setStep] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [failure, setFailure] = useState<PlanFailure | null>(null);
  const [goals, setGoals] = useState<SkinGoal[]>([]);
  const [skinType, setSkinType] = useState<SkinType | null>(null);
  const [sensitivity, setSensitivity] = useState<Sensitivity | null>(null);
  const [pregnant, setPregnant] = useState<boolean | null>(null);
  const [allergies, setAllergies] = useState<ActiveKey[]>([]);
  /** Set once the user has answered the allergy step, including "none of these". */
  const [allergiesAnswered, setAllergiesAnswered] = useState(false);

  /**
   * Leaving the screen mid-request used to let the promise resolve anyway and
   * fire `router.replace("/today")`, yanking the user back from wherever they
   * had navigated to.
   */
  const inFlight = useRef<AbortController | null>(null);
  useEffect(() => () => inFlight.current?.abort(), []);

  // One validator per step, so adding a question can't silently make an older
  // one unskippable — which is what the four-clause OR-chain risked.
  const canAdvance = [
    () => goals.length > 0,
    () => skinType !== null,
    () => sensitivity !== null,
    () => pregnant !== null,
    () => allergiesAnswered,
  ][step]?.() ?? false;
  const lastStep = step === 4;

  function toggleGoal(key: SkinGoal) {
    setGoals((prev) => (prev.includes(key) ? prev.filter((g) => g !== key) : [...prev, key]));
  }

  function toggleAllergen(key: ActiveKey) {
    setAllergiesAnswered(true);
    setAllergies((prev) => (prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key]));
  }

  /**
   * Generate the plan and commit it to the on-device record.
   *
   * Separate from `next()` so the error state can retry just this, without
   * walking the user back through five questions they already answered.
   */
  const generate = useCallback(
    async (answers: {
      goals: SkinGoal[];
      skinType: SkinType;
      sensitivity: Sensitivity;
      pregnancyOrBreastfeeding: boolean;
      allergies: ActiveKey[];
    }) => {
      setFailure(null);
      setAnalyzing(true);

      const controller = new AbortController();
      inFlight.current = controller;

      const photos = data.photos ?? [];
      const ordered = CAPTURE_STEPS.map((s) => photos.find((p) => p.angle === s.angle)).filter(
        (p): p is CapturedPhoto => p !== undefined,
      );
      const intake = buildIntake({ ...data, ...answers });
      const outcome = await fetchPlan(
        {
          images: ordered.map((p) => ({
            data: p.data,
            mediaType: "image/jpeg",
            quality: p.quality,
          })),
          intake,
        },
        controller.signal,
      );

      if (controller.signal.aborted) return;
      setAnalyzing(false);

      if (!outcome.ok) {
        setFailure(outcome.reason);
        return;
      }

      // Commit both: the safety engine re-runs against the intake on every
      // render, so a routine stored without its answers gets recomputed from
      // defaults on the next launch.
      savePlan(intake, outcome.plan);
      update({ plan: outcome.plan });

      // This first reading is the zero every later measurement subtracts from.
      recordAssessment({
        // The capture screen has already written its manifest, so the newest
        // stored session is the set this assessment was made from.
        sessionId: listSessions()[0]?.id ?? "baseline",
        capturedAt: ordered[0]?.capturedAt ?? new Date().toISOString(),
        assessment: outcome.plan.assessment,
      });

      router.replace("/today");
    },
    [data, update],
  );

  function answersNow() {
    return {
      goals,
      skinType: skinType ?? "combination",
      sensitivity: sensitivity ?? "medium",
      pregnancyOrBreastfeeding: pregnant ?? false,
      allergies,
    } as const;
  }

  async function next() {
    if (!canAdvance) return;
    if (!lastStep) {
      setStep((s) => s + 1);
      return;
    }
    const answers = answersNow();
    update(answers);
    // The photos were taken first, but the assessment needs these answers, so
    // generation happens here rather than running on questionnaire defaults.
    await generate(answers);
  }

  function back() {
    if (step === 0) router.back();
    else setStep((s) => s - 1);
  }

  if (analyzing) {
    return (
      <Screen contentStyle={{ paddingTop: spacing.section }}>
        <AppText variant="label" color={colors.primary}>
          BUILDING YOUR ROUTINE
        </AppText>
        <AppText variant="title">Reading your skin</AppText>
        <AppText variant="body" color={colors.inkMuted}>
          We look at what&apos;s visible in your photos, then build the routine around it and clamp
          it to what your skin can actually take. This takes about half a minute.
        </AppText>
        <View style={{ marginTop: spacing.lg }}>
          <PrimaryButton label="Reading your skin…" loading onPress={undefined} />
        </View>
      </Screen>
    );
  }

  // A failed generation used to navigate to /today anyway, handing the user a
  // generic routine and calling it theirs. Now it stops here and says so.
  if (failure) {
    return (
      <Screen contentStyle={{ paddingTop: spacing.section }}>
        <AppText variant="label" color={colors.escalate}>
          NO ROUTINE YET
        </AppText>
        <AppText variant="title">We couldn&apos;t build your routine</AppText>
        <Card>
          <AppText variant="body" color={colors.ink}>
            {PLAN_FAILURE_COPY[failure]}
          </AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            Your answers and your photos are still here. Nothing has to be redone.
          </AppText>
        </Card>
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <PrimaryButton label="Try again" onPress={() => void generate(answersNow())} />
          <GhostButton label="Change my answers" onPress={() => setFailure(null)} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen contentStyle={{ paddingTop: spacing.lg }}>
      <ProgressDots count={5} index={step} />

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
          title="Has anything ever reacted badly?"
          subtitle="Anything you pick is removed from your routine outright, not just used sparingly."
        >
          <ChipWrap>
            {ALLERGEN_KEYS.map((key) => (
              <Chip
                key={key}
                label={ACTIVES[key].short}
                selected={allergies.includes(key)}
                onPress={() => toggleAllergen(key)}
              />
            ))}
          </ChipWrap>
          <View style={{ marginTop: spacing.md }}>
            <Chip
              label="Nothing I know of"
              tone="lavender"
              selected={allergiesAnswered && allergies.length === 0}
              onPress={() => {
                setAllergies([]);
                setAllergiesAnswered(true);
              }}
            />
          </View>
        </Question>
      )}

      <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
        <PrimaryButton
          label={lastStep ? "Build my routine" : "Next"}
          onPress={next}
          disabled={!canAdvance}
        />
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
