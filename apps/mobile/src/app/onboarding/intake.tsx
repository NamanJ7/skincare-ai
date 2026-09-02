import { router } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";

import type { PlanError, Sensitivity, SkinGoal, SkinType } from "@pore/shared";
import { fetchPlan } from "@/lib/api";
import { buildIntake } from "@/lib/intake";
import { recordAssessment } from "@/lib/journal";
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

const STEP_COUNT = 4;

export default function Intake() {
  const { data, update } = useOnboarding();
  const [step, setStep] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<PlanError | null>(null);
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

  const answers = {
    goals,
    skinType: skinType ?? "combination",
    sensitivity: sensitivity ?? "medium",
    pregnancyOrBreastfeeding: pregnant ?? false,
  } as const;

  /**
   * Generate the plan.
   *
   * Split out from `next()` so the failure state can retry it without walking
   * the questionnaire again — the answers are already saved, so a retry is one
   * tap rather than four screens.
   */
  async function generate() {
    setAnalyzing(true);
    setError(null);
    try {
      const photos = data.photos ?? [];
      const ordered = CAPTURE_STEPS.map((s) => photos.find((p) => p.angle === s.angle)).filter(
        (p): p is CapturedPhoto => p !== undefined,
      );
      const outcome = await fetchPlan({
        images: ordered.map((p) => ({ data: p.data, mediaType: "image/jpeg", quality: p.quality })),
        intake: buildIntake({ ...data, ...answers }),
      });

      // A failed plan used to navigate to /today anyway, where a hardcoded demo
      // routine stood in for the one we never built. Say what happened instead.
      if (!outcome.ok) {
        setError(outcome.error);
        return;
      }

      update({ plan: outcome.plan });
      // This first reading is the zero every later measurement subtracts from,
      // so it is filed away the moment it exists. Without it there is nothing
      // to compare a return visit against.
      recordAssessment({
        // The capture screen has already written its manifest, so the newest
        // stored session is the set this assessment was made from.
        sessionId: listSessions()[0]?.id ?? "baseline",
        capturedAt: ordered[0]?.capturedAt ?? new Date().toISOString(),
        assessment: outcome.plan.assessment,
      });
      router.replace("/today");
    } catch {
      setError({
        kind: "unknown",
        message: "Something went wrong building your routine. Trying again usually works.",
        retryable: true,
      });
    } finally {
      // Previously never reset, so any throw left the spinner up forever.
      setAnalyzing(false);
    }
  }

  async function next() {
    if (!canAdvance) return;
    if (step < STEP_COUNT - 1) {
      setStep((s) => s + 1);
      return;
    }
    // The photos were taken first, but the assessment needs these answers, so
    // generation happens here rather than running on questionnaire defaults.
    update(answers);
    await generate();
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

      {error && (
        <Card>
          <AppText variant="bodyStrong" color={colors.escalate}>
            We couldn&apos;t finish your routine
          </AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            {error.message}
          </AppText>
          <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
            {error.retryable && <PrimaryButton label="Try again" onPress={() => void generate()} />}
            <GhostButton
              label="Retake my photos"
              onPress={() => router.replace("/onboarding/photo")}
            />
          </View>
        </Card>
      )}

      {analyzing ? (
        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          <ActivityIndicator color={colors.primary} />
          <BuildStages />
        </View>
      ) : (
        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          <PrimaryButton
            label={step < STEP_COUNT - 1 ? "Next" : "Build my routine"}
            onPress={next}
            disabled={!canAdvance}
          />
          {!error && <GhostButton label="Back" onPress={back} />}
        </View>
      )}
    </Screen>
  );
}

/**
 * What is happening during the wait, named.
 *
 * The plan is two model calls behind a 60s ceiling, and this used to be one
 * spinner and one line of text. A minute of undifferentiated waiting is where
 * people decide an app is broken. Naming the three real stages costs nothing,
 * and it is the only place in onboarding where we get to explain that a
 * deterministic safety pass runs over whatever the model suggested.
 *
 * The timings are honest about being approximate: they advance the *label*, not
 * a progress bar, so nothing here claims to know how far along the request is.
 */
const BUILD_STAGES = [
  { after: 0, text: "Reading your photos — texture, tone, and what's actually visible." },
  { after: 12_000, text: "Matching what we found to your goals and building a routine." },
  { after: 30_000, text: "Running the safety checks — frequencies, interactions, your sensitivity." },
];

function BuildStages() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - started), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={{ gap: spacing.xs }}>
      {BUILD_STAGES.map((stage, i) => {
        const reached = elapsed >= stage.after;
        const current = reached && (i === BUILD_STAGES.length - 1 || elapsed < BUILD_STAGES[i + 1]!.after);
        return (
          <AppText
            key={stage.after}
            variant={current ? "bodyStrong" : "caption"}
            color={reached ? colors.ink : colors.inkMuted}
            style={!reached ? { opacity: 0.5 } : undefined}
          >
            {stage.text}
          </AppText>
        );
      })}
      <AppText variant="caption" color={colors.inkMuted} style={{ marginTop: spacing.xxs }}>
        This takes up to a minute. Keep the app open.
      </AppText>
    </View>
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
