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

/** The three guided capture angles, in the order they are shown to the model. */
export type ScanPose = "front" | "right" | "left";

/**
 * One region's own reading of a concern.
 *
 * Ordinal only, and deliberately so: the same four appearance bands the whole
 * concern uses. A per-region *number* would be invented precision — nothing in
 * the pipeline measures a region's severity, the model is only ranking what it
 * can see.
 */
export interface RegionObservation {
  region: string;
  appearanceLevel: AppearanceLevel;
}

export interface ConcernFinding {
  concern: ConcernKey;
  present: boolean;
  /** The strongest band across `regionDetail`; the whole-face headline. */
  appearanceLevel: AppearanceLevel;
  /** 0..1 model confidence. */
  confidence: number;
  /** Plain-language, non-diagnostic possible contributors. */
  contributingFactors: string[];
  /**
   * Rough face regions, e.g. "forehead", "cheeks".
   *
   * Derived from `regionDetail` by the normalizer, never sent by the model, so
   * the two can never disagree. Kept because it is the shape every existing
   * consumer reads.
   */
  regions: string[];
  /** Per-region breakdown. Empty when the concern is not present. */
  regionDetail: RegionObservation[];
  /**
   * Which of the three captures the concern was actually visible in.
   *
   * This is the anti-lighting-artifact signal: a tone or shine that shows up at
   * exactly one angle is far more likely to be how the light fell than a
   * property of the skin, so a single-pose sighting of a lighting-fakeable
   * concern gets its confidence damped downstream. Empty when not present.
   */
  observedInPoses: ScanPose[];
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
