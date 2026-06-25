/** The routine the engine produces and the safety layer validates. */

export type ActiveKey =
  | "salicylic_acid"
  | "glycolic_acid"
  | "lactic_acid"
  | "mandelic_acid"
  | "benzoyl_peroxide"
  | "azelaic_acid"
  | "niacinamide"
  | "retinoid"
  | "vitamin_c"
  | "hydroquinone"
  | "hyaluronic_acid"
  | "ceramides";

export type ProductCategory =
  | "cleanser"
  | "treatment"
  | "serum"
  | "moisturizer"
  | "sunscreen"
  | "exfoliant"
  | "spot_treatment";

export type RoutineTime = "AM" | "PM";

export type IrritationRisk = "low" | "medium" | "high";

export interface RoutineStep {
  /** 1-based ordering within its AM/PM list. */
  order: number;
  category: ProductCategory;
  /** Omitted for inert steps like a plain cleanser or moisturizer. */
  active?: ActiveKey;
  /** Times per week this step is used (7 = daily). */
  frequencyPerWeek: number;
  /** e.g. "Start 2x/week, increase to nightly over 4-6 weeks". */
  rampSchedule?: string;
  /** Why this step is here, in plain language. */
  rationale: string;
  irritationRisk: IrritationRisk;
}

export interface Routine {
  am: RoutineStep[];
  pm: RoutineStep[];
  /** General notes (e.g. "Always patch-test new actives"). */
  notes: string[];
}
