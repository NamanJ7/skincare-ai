/**
 * Editable rows for the questions that remain in the core funnel. Each row
 * points to one edit-capable screen, so Settings cannot resurrect retired
 * onboarding questions.
 */
import { GOAL_LABELS, SENSITIVITY_LABELS, ingredientLabel } from "./labels";
import { GOAL_CHOICES } from "./questionnaire";
import type { OnboardingData } from "@/state/onboarding";

export interface AnswerRow {
  label: string;
  value: string;
  /** Onboarding screen name that edits this answer. */
  screen: string;
}

function safetySummary(data: OnboardingData): string {
  const parts: string[] = [];
  if (data.pregnancyOrBreastfeeding) parts.push("Pregnancy-safe mode");
  if (data.usingPrescriptionSkincare ?? data.currentRoutine === "prescription") {
    parts.push("Prescription skincare");
  }
  if (data.allergies?.length) {
    parts.push(`Avoid: ${data.allergies.map(ingredientLabel).join(", ")}`);
  }
  if (data.allergyNotes?.trim()) parts.push("Other restrictions noted");
  if (data.currentProducts?.length) {
    parts.push(`Uses: ${data.currentProducts.map(ingredientLabel).join(", ")}`);
  }
  return parts.join(" · ") || "Nothing flagged";
}

export function answerRows(data: OnboardingData): AnswerRow[] {
  const focus = data.primaryGoal ?? data.goals?.[0];
  const rankedGoals = (data.goalChoiceIds ?? [])
    .map((id) => GOAL_CHOICES.find((choice) => choice.id === id)?.label)
    .filter((label): label is string => label !== undefined);
  const skinType = data.skinType
    ? `${data.skinType[0].toUpperCase()}${data.skinType.slice(1)}`
    : data.skinTypeChoiceId === "unsure"
      ? "Skin type unsure"
      : "Skin type not answered";
  const complexity = data.routineComplexity
    ? {
        minimal: "minimal routine",
        balanced: "balanced routine",
        flexible: "more guided routine",
      }[data.routineComplexity]
    : "routine preference not answered";
  return [
    {
      label: "Age",
      value: data.age ? `${data.age} years old` : "Not answered",
      screen: "age",
    },
    {
      label: "Priorities",
      value:
        rankedGoals.length > 0
          ? rankedGoals.join(" → ")
          : focus
            ? GOAL_LABELS[focus]
            : "Not answered",
      screen: "goal",
    },
    {
      label: "Skin & routine",
      value: `${skinType} · ${complexity}`,
      screen: "skin-profile",
    },
    {
      label: "Sensitivity",
      value: data.sensitivity ? SENSITIVITY_LABELS[data.sensitivity] : "Not answered",
      screen: "sensitivity",
    },
    {
      label: "Safety & current treatments",
      value: safetySummary(data),
      screen: "safety",
    },
  ];
}

export interface EditHint {
  kind: "plan-stale" | "auto";
  text: string;
  /** Offer a re-scan action next to the hint. */
  rescan: boolean;
}

/** Explain honestly whether an answer edit rebuilds the current plan. */
export function editHint(data: OnboardingData): EditHint {
  if (data.plan) {
    const when = data.scannedAt
      ? `your scan on ${new Date(data.scannedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
      : "your last scan";
    return {
      kind: "plan-stale",
      text: `Your saved plan and analysis are from ${when}. Re-scan or retake the questionnaire to rebuild them with these answers.`,
      rescan: true,
    };
  }
  return {
    kind: "auto",
    text: "Your routine re-adjusts to your answers automatically.",
    rescan: false,
  };
}
