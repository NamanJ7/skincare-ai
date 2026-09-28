import type { SkinGoal } from "@pore/shared";

export const SAFETY_CHOICE_IDS = [
  "pregnancy_or_breastfeeding",
  "prescription_skincare",
  "known_reactions",
  "current_strong_actives",
  "none",
] as const;

export type SafetyChoiceId = (typeof SAFETY_CHOICE_IDS)[number];

export interface SafetyAnswerShape {
  safetyChoiceIds?: readonly string[];
  pregnancyOrBreastfeeding?: boolean;
  usingPrescriptionSkincare?: boolean;
  allergies?: readonly string[];
  allergyNotes?: string;
  currentProducts?: readonly string[];
}

/** Drop malformed/duplicate stored ids and keep "none" mutually exclusive. */
export function normalizeSafetyChoiceIds(value: unknown): SafetyChoiceId[] {
  if (!Array.isArray(value)) return [];
  const valid = value
    .filter(
      (id): id is SafetyChoiceId =>
        typeof id === "string" &&
        SAFETY_CHOICE_IDS.includes(id as SafetyChoiceId),
    )
    .filter((id, index, all) => all.indexOf(id) === index);
  if (valid.length > 1) return valid.filter((id) => id !== "none");
  return valid;
}

/** Infer explicit choices from a fully answered legacy safety screen. */
export function safetyChoicesFromLegacyAnswers(
  data: SafetyAnswerShape,
): SafetyChoiceId[] | undefined {
  if (
    typeof data.pregnancyOrBreastfeeding !== "boolean" ||
    typeof data.usingPrescriptionSkincare !== "boolean" ||
    !Array.isArray(data.allergies) ||
    !Array.isArray(data.currentProducts)
  ) {
    return undefined;
  }

  const choices: SafetyChoiceId[] = [];
  if (data.pregnancyOrBreastfeeding) {
    choices.push("pregnancy_or_breastfeeding");
  }
  if (data.usingPrescriptionSkincare) choices.push("prescription_skincare");
  if (data.allergies.length > 0 || data.allergyNotes?.trim()) {
    choices.push("known_reactions");
  }
  if (data.currentProducts.length > 0) choices.push("current_strong_actives");
  return choices.length > 0 ? choices : ["none"];
}

/** "None" clears every other choice; choosing a flag clears "none". */
export function toggleSafetyChoice(
  selected: readonly SafetyChoiceId[],
  id: SafetyChoiceId,
): SafetyChoiceId[] {
  if (id === "none") return selected.includes("none") ? [] : ["none"];
  const concrete = selected.filter((choice) => choice !== "none");
  return concrete.includes(id)
    ? concrete.filter((choice) => choice !== id)
    : [...concrete, id];
}

/** Require each revealed safety category to contain the matching details. */
export function isSafetyAnswerComplete(data: SafetyAnswerShape): boolean {
  if (
    typeof data.pregnancyOrBreastfeeding !== "boolean" ||
    typeof data.usingPrescriptionSkincare !== "boolean" ||
    !Array.isArray(data.allergies) ||
    !Array.isArray(data.currentProducts) ||
    !Array.isArray(data.safetyChoiceIds)
  ) {
    return false;
  }

  const choices = normalizeSafetyChoiceIds(data.safetyChoiceIds);
  if (choices.length === 0 || choices.length !== data.safetyChoiceIds.length) {
    return false;
  }
  const has = (id: SafetyChoiceId) => choices.includes(id);
  const hasReactionDetail =
    data.allergies.length > 0 || Boolean(data.allergyNotes?.trim());
  const hasTreatmentDetail = data.currentProducts.length > 0;

  if (has("none")) {
    return (
      choices.length === 1 &&
      !data.pregnancyOrBreastfeeding &&
      !data.usingPrescriptionSkincare &&
      !hasReactionDetail &&
      !hasTreatmentDetail
    );
  }

  return (
    data.pregnancyOrBreastfeeding === has("pregnancy_or_breastfeeding") &&
    data.usingPrescriptionSkincare === has("prescription_skincare") &&
    hasReactionDetail === has("known_reactions") &&
    hasTreatmentDetail === has("current_strong_actives")
  );
}

/** A user can name a few concerns without turning onboarding into a survey. */
export const MAX_RANKED_CONCERNS = 3;

export interface GoalChoice {
  id: string;
  label: string;
  primary: SkinGoal;
  goals: SkinGoal[];
}

export const GOAL_CHOICES: readonly GoalChoice[] = [
  { id: "acne", label: "Active breakouts", primary: "acne", goals: ["acne"] },
  {
    id: "marks",
    label: "Dark spots & acne marks",
    primary: "post_acne_marks",
    goals: ["post_acne_marks", "hyperpigmentation"],
  },
  {
    id: "oily",
    label: "Oily or shiny skin",
    primary: "oiliness",
    goals: ["oiliness"],
  },
  {
    id: "dry",
    label: "Dryness & irritation",
    primary: "dryness",
    goals: ["dryness", "redness"],
  },
  {
    id: "texture",
    label: "Texture & clogged pores",
    primary: "texture",
    goals: ["texture"],
  },
  {
    id: "aging",
    label: "Fine lines & early aging",
    primary: "fine_lines",
    goals: ["fine_lines"],
  },
  {
    id: "unsure",
    label: "I'm not sure yet",
    primary: "general_health",
    goals: ["general_health"],
  },
] as const;

/**
 * Keep selections in tap order so the first answer is a real primary concern.
 * "Not sure" is exclusive; choosing a concrete concern replaces it.
 */
export function toggleRankedGoal(selected: string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter((item) => item !== id);
  if (id === "unsure") return [id];

  const concrete = selected.filter((item) => item !== "unsure");
  if (concrete.length >= MAX_RANKED_CONCERNS) return concrete;
  return [...concrete, id];
}

/** Convert the ordered UI choices into the routine engine's ordered goals. */
export function answersForRankedGoals(choiceIds: string[]): {
  goals: SkinGoal[];
  primaryGoal: SkinGoal;
  goalChoiceIds: string[];
} | null {
  const choices = choiceIds
    .map((id) => GOAL_CHOICES.find((option) => option.id === id))
    .filter((option): option is GoalChoice => option !== undefined)
    .slice(0, MAX_RANKED_CONCERNS);
  if (choices.length === 0) return null;

  const goals = choices
    .flatMap((choice) => choice.goals)
    .filter((goal, index, all) => all.indexOf(goal) === index);
  return {
    goals,
    primaryGoal: choices[0].primary,
    goalChoiceIds: choices.map((choice) => choice.id),
  };
}

/**
 * Contract for every question in the core onboarding funnel.
 *
 * A question belongs here only when its answer has a named consumer and a
 * concrete decision it changes. Behavior tests cover each decision so unused
 * questions cannot quietly creep back into the critical path.
 */
export const CORE_QUESTION_CONTRACT = [
  {
    id: "age_range",
    fields: ["age"],
    consumer: "age-tier authorization gate and age-context routine note",
    expectedDecision:
      "Under-13 users are blocked, ages 13–15 require a parent, ages 16–17 self-consent in teen-readable language, and adults continue normally.",
  },
  {
    id: "ranked_goals",
    fields: ["goals", "primaryGoal"],
    consumer: "routine active-relevance ranking",
    expectedDecision:
      "The first concern anchors the routine and up to two supporting concerns add context.",
  },
  {
    id: "skin_type",
    fields: ["skinType"],
    consumer: "baseline rationale and dry-skin exfoliation frequency",
    expectedDecision:
      "Cleanser and moisturizer guidance reflects the user's description, and dry skin slows exfoliating acids.",
  },
  {
    id: "routine_complexity",
    fields: ["routineComplexity"],
    consumer: "deterministic optional-active cap",
    expectedDecision:
      "Minimal, balanced, and flexible routines keep at most one, two, or three optional active steps.",
  },
  {
    id: "sensitivity",
    fields: ["sensitivity"],
    consumer: "strong-active cap and retinoid ramp",
    expectedDecision:
      "Higher sensitivity produces fewer strong actives and a slower retinoid start.",
  },
  {
    id: "pregnancy_safety",
    fields: ["pregnancyOrBreastfeeding"],
    consumer: "pregnancy ingredient guard",
    expectedDecision:
      "Contraindicated actives are removed and caution ingredients are flagged.",
  },
  {
    id: "prescription_skincare",
    fields: ["usingPrescriptionSkincare"],
    consumer: "prescription baseline mode",
    expectedDecision:
      "The generated plan stays gentle instead of layering a strong OTC active.",
  },
  {
    id: "known_reactions",
    fields: ["allergies", "allergyNotes"],
    consumer: "allergy removal guard and visible routine cautions",
    expectedDecision:
      "Supported ingredients are removed, fragrance changes formulation guidance, and other restrictions remain visible.",
  },
  {
    id: "current_treatments",
    fields: ["currentProducts"],
    consumer: "sensitivity active-cap baseline",
    expectedDecision:
      "Strong actives already in use consume the cap before Pore introduces another.",
  },
] as const;
