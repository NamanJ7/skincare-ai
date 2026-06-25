/**
 * The structured output of the vision LLM call. STRICTLY cosmetic/wellness
 * language — never diagnostic. This is the JSON contract the rubric prompt
 * must return.
 */

export type ConcernKey =
  | "acne_like_breakouts"
  | "oiliness"
  | "dryness_flaking"
  | "texture_congestion"
  | "uneven_tone"
  | "dark_spot_appearance"
  | "redness_appearance"
  | "fine_line_appearance"
  | "irritation_signs";

/** Deliberately avoids clinical severity words. "noticeable" is the top band. */
export type AppearanceLevel = "none" | "mild" | "moderate" | "noticeable";

export interface ConcernFinding {
  concern: ConcernKey;
  present: boolean;
  appearanceLevel: AppearanceLevel;
  /** 0..1 model confidence. */
  confidence: number;
  /** Plain-language, non-diagnostic possible contributors. */
  contributingFactors: string[];
  /** Rough face regions, e.g. "forehead", "cheeks". */
  regions: string[];
}

export interface EscalationResult {
  /** True when the photo shows something that warrants professional care. */
  recommendProfessional: boolean;
  /** e.g. "appears painful", "rapidly changing", "bleeding". */
  reasons: string[];
}

export interface Assessment {
  findings: ConcernFinding[];
  escalation: EscalationResult;
  /** One-paragraph supportive, non-shaming summary. */
  summary: string;
  /** Standard non-diagnostic disclaimer shown with every assessment. */
  disclaimer: string;
}
