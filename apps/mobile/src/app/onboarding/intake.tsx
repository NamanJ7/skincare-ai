import { router, useLocalSearchParams } from "expo-router";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";

import {
  ACTIVES,
  applySafetyRules,
  type ActiveKey,
  type SafetyAdjustment,
  type Sensitivity,
  type SkinGoal,
  type SkinType,
} from "@pore/shared";
import { type PlanError } from "@/lib/api";
import { buildIntake } from "@/lib/intake";
import { readJournal, saveRoutine } from "@/lib/journal";
import { buildPlan } from "@/lib/plan";
import { REMINDER_HOURS, enableReminder, formatHour } from "@/lib/reminder";
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
  radius,
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
  /**
   * `edit` re-opens the same five questions against the answers already stored,
   * with no photos and no model call.
   *
   * Sensitivity, the pregnancy flag and declared allergies are the three inputs
   * `applySafetyRules` cares most about, and all three change over a life. Until
   * this existed the only way to correct any of them was `Erase everything and
   * start over` on /plan — so a user who became pregnant had no way to tell the
   * app, and the safety engine went on doing exactly the right thing to the
   * wrong answers. That is the failure `profile.ts` was written to prevent, one
   * level up.
   */
  const editing = useLocalSearchParams<{ mode?: string }>().mode === "edit";
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState<SafetyAdjustment[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [planError, setPlanError] = useState<PlanError | null>(null);
  /**
   * Shown after the routine exists, not as another question before it. The
   * permission prompt lands on the moment the user has just been handed
   * something worth being reminded about, which is the only honest time to ask.
   */
  const [askingReminder, setAskingReminder] = useState(false);
  /*
   * Seeded from what is already stored, not from empty.
   *
   * These answers are persisted the moment the questionnaire completes, but the
   * form itself always started blank — so anyone who came back through this
   * screen (after a failed plan, or now to edit) re-answered five questions the
   * app could already see. Editing needs the prefill to be an edit at all.
   */
  const [goals, setGoals] = useState<SkinGoal[]>(() => data.goals ?? []);
  const [skinType, setSkinType] = useState<SkinType | null>(() => data.skinType ?? null);
  const [sensitivity, setSensitivity] = useState<Sensitivity | null>(() => data.sensitivity ?? null);
  const [pregnant, setPregnant] = useState<boolean | null>(
    () => data.pregnancyOrBreastfeeding ?? null,
  );
  /** null until answered; [] is the real answer "none of these". */
  const [allergies, setAllergies] = useState<ActiveKey[] | null>(
    () => (data.allergies as ActiveKey[] | undefined) ?? null,
  );

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

    const answers = answersFromForm();
    update(answers);

    if (editing) {
      reclamp({ ...data, ...answers });
      return;
    }

    // The photos were taken first, but the assessment needs these answers, so
    // generation happens here rather than running on questionnaire defaults.
    // `data` is this closure's value and predates the update() above, so the
    // answers are merged in explicitly rather than read back from it.
    await generate({ ...data, ...answers });
  }

  /**
   * Re-run the safety engine against the edited answers.
   *
   * No model call: the assessment describes the photos, and the photos have not
   * changed. What has changed is what is *allowed*, and that question is settled
   * in code — `applySafetyRules` is the same function the pipeline ends with, so
   * an edit gets exactly the treatment the original routine got.
   *
   * The result is written to both stores on purpose. `today.tsx` prefers
   * `journal.routine` when it exists and `plan.tsx` reads `data.plan`, so
   * writing one and not the other would leave the two screens disagreeing about
   * what the routine is — with the safety-relevant one being whichever the user
   * happened not to be looking at.
   *
   * This can only ever take things away. `applySafetyRules` removes and caps; it
   * has no path that restores a step an earlier answer removed. So a user who
   * un-sets the pregnancy flag does not get their retinoid back here, and the
   * screen says so rather than letting them assume otherwise.
   */
  function reclamp(withAnswers: typeof data) {
    const current = readJournal().routine ?? data.plan?.routine;
    if (!current) {
      router.back();
      return;
    }
    const result = applySafetyRules(current, buildIntake(withAnswers));
    saveRoutine(result.routine);
    if (data.plan) {
      update({ plan: { ...data.plan, routine: result.routine, adjustments: result.adjustments } });
    }
    setSaved(result.adjustments);
  }

  /**
   * The questionnaire's answers, read off local state.
   *
   * Both the first attempt and the retry go through here. They used to build
   * the payload differently — the retry passed `data` alone and was correct
   * only because update() had re-rendered by the time a thumb reached the
   * button. A retry that sends something other than what failed is not a
   * retry, and that difference would have been invisible until it mattered.
   */
  function answersFromForm() {
    return {
      goals,
      skinType: skinType ?? "combination",
      sensitivity: sensitivity ?? "medium",
      pregnancyOrBreastfeeding: pregnant ?? false,
      allergies: allergies ?? [],
      // The marker that says onboarding finished rather than being abandoned.
      // It is what lets the next cold start go straight to the routine.
      onboardedAt: new Date().toISOString(),
    } as const;
  }

  /**
   * Generate the plan.
   *
   * Split out from `next()` so the failure state can retry it without walking
   * the questionnaire again — the answers are already persisted, so a retry is
   * one tap rather than five screens.
   */
  async function generate(withAnswers: typeof data) {
    setAnalyzing(true);
    setPlanError(null);
    try {
      // `buildPlan` owns the payload shape and files the baseline assessment.
      // The recovery path on /today calls the same function against the same
      // stored photos, so a retry cannot quietly become a different request.
      const outcome = await buildPlan(withAnswers, data.photos ?? []);

      // A failed plan used to fall through to /today anyway, where a hardcoded
      // demo routine stood in for the one we never built. Say what happened.
      if (!outcome.ok) {
        setPlanError(outcome.error);
        return;
      }

      update({ plan: outcome.plan });
      setAskingReminder(true);
    } finally {
      setAnalyzing(false);
    }
  }

  async function chooseReminder(hour: number | null) {
    if (hour === null) {
      router.replace("/today");
      return;
    }
    if (await enableReminder(hour)) {
      update({ reminderHour: hour });
      router.replace("/today");
      return;
    }
    /*
     * Say it. This used to navigate on regardless, so someone who tapped "9pm"
     * and then declined the system permission left onboarding believing they had
     * a reminder set — and the one thing standing between this app and being
     * forgotten simply never arrived. `plan.tsx` already alerts on the same
     * failure; the two paths now agree.
     */
    Alert.alert(
      "No reminder set",
      "Notifications are turned off for Pore, so we can't send the evening nudge. You can turn them on in Settings and set it from your plan screen.",
      [{ text: "OK", onPress: () => router.replace("/today") }],
    );
  }

  function back() {
    // Reconsidering an answer is the other way out of a failure, so the stale
    // error card goes with it. Without this the card outlives the answers it
    // was about: `planError` was only ever cleared inside generate(), which a
    // non-retryable failure never calls.
    setPlanError(null);
    if (step === 0) router.back();
    else setStep((s) => s - 1);
  }

  if (saved) {
    return (
      <Screen contentStyle={{ paddingTop: spacing.section }}>
        <AppText variant="label" color={colors.primary}>
          SAVED
        </AppText>
        <AppText variant="title">
          {saved.length > 0 ? "Your routine has changed" : "Your answers are updated"}
        </AppText>

        {saved.length > 0 ? (
          <Card>
            <AppText variant="bodyStrong">What we adjusted</AppText>
            <View style={{ gap: spacing.xs, marginTop: spacing.xxs }}>
              {saved.map((a, i) => (
                <AppText key={`${a.rule}-${i}`} variant="caption" color={colors.ink}>
                  • {a.detail}
                </AppText>
              ))}
            </View>
          </Card>
        ) : (
          <AppText variant="body" color={colors.inkMuted}>
            Nothing in your routine needed to change for those answers.
          </AppText>
        )}

        {/*
          Said plainly rather than left to be discovered. The safety engine only
          ever removes, so a loosened answer cannot restore a step it took away
          on a stricter one — and someone who set the pregnancy flag by mistake
          would otherwise sit and wait for a retinoid that is never coming back.
        */}
        <AppText variant="caption" color={colors.inkMuted}>
          Answers can only make your routine gentler. To have a step considered again, build a new
          routine from a fresh set of photos.
        </AppText>

        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          <PrimaryButton label="Back to my plan" onPress={() => router.back()} />
          <GhostButton
            label="Build a new routine from photos"
            onPress={() => router.replace("/onboarding/photo")}
          />
        </View>
      </Screen>
    );
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
            <Chip key={h} label={formatHour(h)} role="radio" onPress={() => void chooseReminder(h)} />
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
              <Chip key={g.key} label={g.label} role="checkbox" selected={goals.includes(g.key)} onPress={() => toggleGoal(g.key)} />
            ))}
          </ChipWrap>
        </Question>
      )}

      {step === 1 && (
        <Question title="How does your skin usually feel?">
          <ChipWrap>
            {SKIN_TYPES.map((s) => (
              <Chip key={s.key} label={s.label} role="radio" selected={skinType === s.key} onPress={() => setSkinType(s.key)} />
            ))}
          </ChipWrap>
        </Question>
      )}

      {step === 2 && (
        <Question title="How sensitive is your skin?" subtitle="This is the biggest factor in keeping your routine safe.">
          <View style={{ gap: spacing.sm }}>
            {SENSITIVITY.map((s) => (
              <OptionRow
                key={s.key}
                label={s.label}
                hint={s.hint}
                selected={sensitivity === s.key}
                onPress={() => setSensitivity(s.key)}
              />
            ))}
          </View>
        </Question>
      )}

      {step === 3 && (
        <Question title="Are you pregnant or breastfeeding?" subtitle="Some ingredients are best avoided — we'll adjust automatically.">
          <ChipWrap>
            <Chip label="Yes" role="radio" selected={pregnant === true} onPress={() => setPregnant(true)} />
            <Chip label="No" role="radio" selected={pregnant === false} onPress={() => setPregnant(false)} />
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
                role="checkbox"
                selected={allergies?.includes(key) ?? false}
                onPress={() => toggleAllergen(key)}
              />
            ))}
            <Chip
              label="Nothing I know of"
              tone="lavender"
              role="checkbox"
              selected={allergies?.length === 0}
              onPress={() => setAllergies([])}
            />
          </ChipWrap>
        </Question>
      )}

      {planError && (
        <Card>
          <AppText variant="bodyStrong" color={colors.escalate}>
            We couldn&apos;t finish your routine
          </AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            {planError.message}
          </AppText>
          <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
            {planError.retryable && (
              <PrimaryButton
                label="Try again"
                onPress={() => void generate({ ...data, ...answersFromForm() })}
              />
            )}
            <GhostButton
              label="Retake my photos"
              onPress={() => router.replace("/onboarding/photo")}
            />
          </View>
        </Card>
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
          {/*
            While the error card is up it owns the forward action, so the
            primary button stands down rather than offering a second way to
            do the same thing. Back never stands down: a `rejected` failure
            offers no "Try again", and hiding both left "Retake my photos" as
            the only exit — sending someone back to the camera over an answer
            they might rather have changed.
          */}
          {!planError && (
            <PrimaryButton
              label={
                step < STEP_COUNT - 1 ? "Next" : editing ? "Save changes" : "Build my routine"
              }
              onPress={next}
              disabled={!canAdvance}
            />
          )}
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

/**
 * A full-width choice with a line of explanation under it.
 *
 * The sensitivity question is the one place an option needs a sentence — it is
 * the single biggest safety lever in the intake and "Somewhat" alone tells the
 * user nothing. That sentence used to be crammed into a `Chip`, which is a pill
 * built for two or three words: it wrapped awkwardly at the default text size
 * and turned into a paragraph in a lozenge above it. A row is the right shape
 * for a label plus a hint, and it grows down instead of sideways.
 */
function OptionRow({
  label,
  hint,
  selected,
  onPress,
}: {
  label: string;
  hint: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      accessibilityLabel={`${label}. ${hint}`}
      style={({ pressed }) => [
        {
          minHeight: 56,
          justifyContent: "center",
          gap: spacing.xxs,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: selected ? colors.primary : colors.hairline,
          backgroundColor: selected ? colors.primary : colors.surface,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <AppText variant="bodyStrong" color={selected ? colors.onPrimary : colors.ink}>
        {label}
      </AppText>
      <AppText variant="caption" color={selected ? "rgba(255,255,255,0.8)" : colors.inkMuted}>
        {hint}
      </AppText>
    </Pressable>
  );
}

function ChipWrap({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>{children}</View>;
}
