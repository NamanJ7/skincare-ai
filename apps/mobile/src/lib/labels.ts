/**
 * User-facing names for domain enums.
 *
 * These maps were copy-pasted across today.tsx, plan.tsx and compare.tsx, which
 * is how the same concept ends up worded three slightly different ways. One
 * copy, so the vocabulary the app speaks stays consistent.
 */
import { ACTIVES, type AppearanceLevel, type ConcernKey, type ProductCategory, type RoutineStep } from "@pore/shared";

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

export const BAND_LABELS: Record<AppearanceLevel, string> = {
  none: "Clear",
  mild: "Mild",
  moderate: "Moderate",
  noticeable: "Noticeable",
};

/** The short name for a step: the active if it has one, else the category. */
export function stepLabel(step: RoutineStep): string {
  return step.active ? ACTIVES[step.active].short : CATEGORY_LABELS[step.category];
}

/** How often a step runs, in words rather than a fraction. */
export function frequencyLabel(perWeek: number): string {
  return perWeek >= 7 ? "Daily" : `${perWeek}x / week`;
}
