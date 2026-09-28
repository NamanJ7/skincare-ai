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

/** How much structure the user wants in the routine Pore builds. */
export type RoutineComplexity = "minimal" | "balanced" | "flexible";

/** Simplified Fitzpatrick-style banding; informs PIH / dark-mark guidance. */
export type SkinTone = "very_fair" | "fair" | "medium" | "olive" | "brown" | "deep";

export type Climate = "dry" | "humid" | "temperate" | "cold";

export interface IntakeResponse {
  /** Years. Age-policy authorization is enforced before this profile is built. */
  age: number;
  goals: SkinGoal[];
  /** Optional legacy/profile context. Omitted when the user was not asked. */
  skinType?: SkinType;
  sensitivity: Sensitivity;
  /** Active keys the user already owns (so we can prefer "use what you own"). */
  currentProducts: string[];
  /** Active keys / ingredients the user is allergic to or has reacted badly to. */
  allergies: string[];
  /** A restriction Pore cannot match to a supported ingredient key. */
  allergyNotes?: string;
  budget?: Budget;
  fragrancePreference?: FragrancePreference;
  /** Deterministic cap on optional treatment steps. */
  routineComplexity?: RoutineComplexity;
  /** Hard safety flag — strips contraindicated actives from the routine. */
  pregnancyOrBreastfeeding: boolean;
  /** Conservative baseline mode when the user already follows a prescription regimen. */
  usingPrescriptionSkincare?: boolean;
  skinTone?: SkinTone;
  /** Whether the user tends to get dark marks after breakouts. */
  darkMarkProne?: boolean;
  climate?: Climate;
  /** Free-text location string (city/region), optional. */
  location?: string;
}
