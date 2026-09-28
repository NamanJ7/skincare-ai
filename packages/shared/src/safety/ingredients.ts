/**
 * Ingredient knowledge base. Conservative on purpose: when guidance is mixed,
 * we err toward the safer call (e.g. "caution" rather than "safe"). This drives
 * the deterministic safety engine — it is NOT medical advice, and the app always
 * surfaces a "confirm with a professional" path for anything concerning.
 */
import type { ActiveKey, IrritationRisk, SkinGoal } from "../types";

export type PregnancySafety = "safe" | "caution" | "avoid";

export interface ActiveMeta {
  key: ActiveKey;
  label: string;
  /** AHA/BHA chemical exfoliant. */
  isExfoliatingAcid: boolean;
  isRetinoid: boolean;
  isBenzoylPeroxide: boolean;
  /**
   * Counts toward the per-session irritation cap and the global sensitivity
   * cap. Gentle actives (niacinamide, azelaic, hydrators) are false.
   */
  isStrongActive: boolean;
  pregnancySafety: PregnancySafety;
  baseIrritation: IrritationRisk;
}

export const ACTIVES: Record<ActiveKey, ActiveMeta> = {
  salicylic_acid: {
    key: "salicylic_acid",
    label: "Salicylic acid (BHA)",
    isExfoliatingAcid: true,
    isRetinoid: false,
    isBenzoylPeroxide: false,
    isStrongActive: true,
    pregnancySafety: "caution",
    baseIrritation: "medium",
  },
  glycolic_acid: {
    key: "glycolic_acid",
    label: "Glycolic acid (AHA)",
    isExfoliatingAcid: true,
    isRetinoid: false,
    isBenzoylPeroxide: false,
    isStrongActive: true,
    pregnancySafety: "caution",
    baseIrritation: "high",
  },
  lactic_acid: {
    key: "lactic_acid",
    label: "Lactic acid (AHA)",
    isExfoliatingAcid: true,
    isRetinoid: false,
    isBenzoylPeroxide: false,
    isStrongActive: true,
    pregnancySafety: "caution",
    baseIrritation: "medium",
  },
  mandelic_acid: {
    key: "mandelic_acid",
    label: "Mandelic acid (AHA)",
    isExfoliatingAcid: true,
    isRetinoid: false,
    isBenzoylPeroxide: false,
    isStrongActive: true,
    pregnancySafety: "caution",
    baseIrritation: "low",
  },
  benzoyl_peroxide: {
    key: "benzoyl_peroxide",
    label: "Benzoyl peroxide",
    isExfoliatingAcid: false,
    isRetinoid: false,
    isBenzoylPeroxide: true,
    isStrongActive: true,
    pregnancySafety: "caution",
    baseIrritation: "high",
  },
  azelaic_acid: {
    key: "azelaic_acid",
    label: "Azelaic acid",
    isExfoliatingAcid: false,
    isRetinoid: false,
    isBenzoylPeroxide: false,
    isStrongActive: false,
    pregnancySafety: "safe",
    baseIrritation: "low",
  },
  niacinamide: {
    key: "niacinamide",
    label: "Niacinamide",
    isExfoliatingAcid: false,
    isRetinoid: false,
    isBenzoylPeroxide: false,
    isStrongActive: false,
    pregnancySafety: "safe",
    baseIrritation: "low",
  },
  retinoid: {
    key: "retinoid",
    label: "Retinoid / retinol",
    isExfoliatingAcid: false,
    isRetinoid: true,
    isBenzoylPeroxide: false,
    isStrongActive: true,
    pregnancySafety: "avoid",
    baseIrritation: "high",
  },
  vitamin_c: {
    key: "vitamin_c",
    label: "Vitamin C",
    isExfoliatingAcid: false,
    isRetinoid: false,
    isBenzoylPeroxide: false,
    isStrongActive: false,
    pregnancySafety: "safe",
    baseIrritation: "medium",
  },
  hydroquinone: {
    key: "hydroquinone",
    label: "Hydroquinone",
    isExfoliatingAcid: false,
    isRetinoid: false,
    isBenzoylPeroxide: false,
    isStrongActive: true,
    pregnancySafety: "avoid",
    baseIrritation: "medium",
  },
  hyaluronic_acid: {
    key: "hyaluronic_acid",
    label: "Hyaluronic acid",
    isExfoliatingAcid: false,
    isRetinoid: false,
    isBenzoylPeroxide: false,
    isStrongActive: false,
    pregnancySafety: "safe",
    baseIrritation: "low",
  },
  ceramides: {
    key: "ceramides",
    label: "Ceramides",
    isExfoliatingAcid: false,
    isRetinoid: false,
    isBenzoylPeroxide: false,
    isStrongActive: false,
    pregnancySafety: "safe",
    baseIrritation: "low",
  },
};

/** How relevant each active is to each goal (used to decide what to KEEP when capping). */
const GOAL_ACTIVE_RELEVANCE: Record<SkinGoal, ActiveKey[]> = {
  acne: ["salicylic_acid", "benzoyl_peroxide", "azelaic_acid", "retinoid"],
  post_acne_marks: ["azelaic_acid", "niacinamide", "vitamin_c", "retinoid"],
  hyperpigmentation: ["vitamin_c", "azelaic_acid", "niacinamide", "retinoid", "hydroquinone"],
  oiliness: ["niacinamide", "salicylic_acid"],
  dryness: ["hyaluronic_acid", "ceramides"],
  texture: ["retinoid", "glycolic_acid", "lactic_acid", "mandelic_acid"],
  redness: ["azelaic_acid", "niacinamide"],
  fine_lines: ["retinoid", "vitamin_c"],
  general_health: ["niacinamide", "vitamin_c"],
};

/**
 * Priority score for an active given the user's goals. Higher = more important
 * to keep. Used to choose survivors when a cap forces us to drop actives.
 */
export function activeRelevanceScore(active: ActiveKey, goals: SkinGoal[]): number {
  let score = 0;
  for (const goal of goals) {
    const list = GOAL_ACTIVE_RELEVANCE[goal];
    const idx = list.indexOf(active);
    if (idx >= 0) score += list.length - idx; // earlier in the list = stronger fit
  }
  return score;
}
