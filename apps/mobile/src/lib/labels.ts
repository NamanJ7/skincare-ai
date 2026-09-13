/** Shared display labels for plan + profile data (Home, Routine, Scan, review, Profile). */
import {
  ACTIVES,
  type ActiveKey,
  type Budget,
  type Climate,
  type ConcernKey,
  type FragrancePreference,
  type ProductCategory,
  type RoutineStep,
  type Sensitivity,
  type SkinGoal,
  type SkinType,
} from "@pore/shared";

import type { UserProductCategory } from "@/lib/profile";
import type { CurrentRoutine } from "@/state/onboarding";

export const GOAL_LABELS: Record<SkinGoal, string> = {
  acne: "Breakouts",
  post_acne_marks: "Post-acne marks",
  hyperpigmentation: "Uneven tone",
  oiliness: "Oiliness",
  dryness: "Dryness",
  texture: "Texture",
  redness: "Redness",
  fine_lines: "Fine lines",
  general_health: "General skin health",
};

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  cleanser: "Cleanser",
  treatment: "Treatment",
  serum: "Serum",
  moisturizer: "Moisturizer",
  sunscreen: "Sunscreen (SPF)",
  exfoliant: "Exfoliant",
  spot_treatment: "Spot treatment",
};

export const CONCERN_LABELS: Record<ConcernKey, string> = {
  acne_like_breakouts: "Acne-like breakouts",
  oiliness: "Oiliness",
  dryness_flaking: "Dryness / flaking",
  texture_congestion: "Texture & congestion",
  uneven_tone: "Uneven tone",
  dark_spot_appearance: "Dark-spot appearance",
  redness_appearance: "Redness appearance",
  fine_line_appearance: "Fine-line appearance",
  irritation_signs: "Signs of irritation",
};

export const SKIN_TYPE_LABELS: Record<SkinType, string> = {
  oily: "Oily",
  dry: "Dry",
  combination: "Combination",
  normal: "Normal",
};

export const SENSITIVITY_LABELS: Record<Sensitivity, string> = {
  low: "Rarely sensitive",
  medium: "Sometimes sensitive",
  high: "Often sensitive",
};

export const CLIMATE_LABELS: Record<Climate, string> = {
  dry: "Dry climate",
  humid: "Humid climate",
  temperate: "Temperate climate",
  cold: "Cold climate",
};

export const BUDGET_LABELS: Record<Budget, string> = {
  low: "Lean: under ~$25/mo",
  medium: "Balanced: $25–60/mo",
  high: "Premium: $60+/mo",
};

export const FRAGRANCE_LABELS: Record<FragrancePreference, string> = {
  fragrance_free: "Fragrance-free only",
  no_preference: "Fragrance is fine",
};

export const USER_PRODUCT_CATEGORY_LABELS: Record<UserProductCategory, string> =
  {
    cleanser: "Cleanser",
    moisturizer: "Moisturizer",
    sunscreen: "Sunscreen",
    serum: "Serum / treatment",
    toner: "Toner",
    other: "Other",
  };

export const ROUTINE_MATURITY_LABELS: Record<CurrentRoutine, string> = {
  barely: "Barely a routine",
  cleanser_moisturizer: "Cleanser + moisturizer",
  few_inconsistent: "A few products, inconsistent",
  full: "Full routine",
  prescription: "Prescription skincare",
};

/** Keys match the challenges screen (and computeRoutineHealth reads). */
export const PAIN_POINT_LABELS: Record<string, string> = {
  compatibility: "Product compatibility",
  inconsistent: "Staying consistent",
  wasted_money: "Wasted money on products",
  skin_changes: "Skin changes constantly",
  social_overwhelm: "Advice overload",
  ingredients: "Knowing which ingredients",
  irritation: "Routine causes irritation",
};

export const SKIN_CHANGE_LABELS: Record<string, string> = {
  cycle: "Around my cycle",
  stress: "With stress",
  seasonal: "Seasonally",
  prefer_not_to_say: "Prefer not to say",
};

/** Label for an onboarding ingredient/allergy key (engine actives + extras). */
export function ingredientLabel(key: string): string {
  if (key in ACTIVES) return ACTIVES[key as ActiveKey].label;
  if (key === "sunscreen") return "Sunscreen";
  if (key === "fragrance") return "Fragrance";
  return key;
}

export function stepLabel(step: RoutineStep): string {
  // Both keys are server-supplied. Fall back through active -> category -> the
  // raw key rather than rendering `undefined.label` and crashing the screen.
  if (step.active) return ACTIVES[step.active]?.label ?? ingredientLabel(step.active);
  return CATEGORY_LABELS[step.category] ?? step.category;
}

export function frequencyLabel(step: RoutineStep): string {
  return step.frequencyPerWeek >= 7
    ? "Daily"
    : `${step.frequencyPerWeek}x / week`;
}
