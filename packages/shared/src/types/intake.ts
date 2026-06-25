/** What the user tells us up front. Drives routine generation + safety. */

export type SkinType = "oily" | "dry" | "combination" | "normal";

/** How reactive the user's skin is — the single biggest safety lever. */
export type Sensitivity = "low" | "medium" | "high";

export type SkinGoal =
  | "acne"
  | "post_acne_marks"
  | "hyperpigmentation"
  | "oiliness"
  | "dryness"
  | "texture"
  | "redness"
  | "fine_lines"
  | "general_health";

export type Budget = "low" | "medium" | "high";

export type FragrancePreference = "fragrance_free" | "no_preference";

/** Simplified Fitzpatrick-style banding; informs PIH / dark-mark guidance. */
export type SkinTone = "very_fair" | "fair" | "medium" | "olive" | "brown" | "deep";

export type Climate = "dry" | "humid" | "temperate" | "cold";

export interface IntakeResponse {
  /** Years. Used with the age gate; <16 is blocked upstream. */
  age: number;
  goals: SkinGoal[];
  skinType: SkinType;
  sensitivity: Sensitivity;
  /** Active keys the user already owns (so we can prefer "use what you own"). */
  currentProducts: string[];
  /** Active keys / ingredients the user is allergic to or has reacted badly to. */
  allergies: string[];
  budget: Budget;
  fragrancePreference: FragrancePreference;
  /** Hard safety flag — strips contraindicated actives from the routine. */
  pregnancyOrBreastfeeding: boolean;
  skinTone: SkinTone;
  /** Whether the user tends to get dark marks after breakouts. */
  darkMarkProne: boolean;
  climate: Climate;
  /** Free-text location string (city/region), optional. */
  location?: string;
}
