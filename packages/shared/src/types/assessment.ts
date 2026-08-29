/**
 * The structured output of the vision LLM call. STRICTLY cosmetic/wellness
 * language — never diagnostic. This is the JSON contract the rubric prompt
 * must return.
 */

import type { PhotoQualityFlag } from "../vision/quality";

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

/** Which guided angle a photo was taken from. */
export type CaptureAngle = "front" | "left" | "right";

/**
 * What the on-device capture gate measured for one photo. Client-supplied and
 * attached to the assessment after parsing — the model is told about it so it
 * can lower its own confidence, but it is never asked to invent it.
 */
export interface PhotoQuality {
  angle: CaptureAngle;
  /** 0..1 composite from the capture gate. */
  score: number;
  flags: PhotoQualityFlag[];
  /**
   * Whether the shot was lit by the app's screen flash (a known, repeatable
   * illuminant) or whatever light the room happened to have. Only screen-flash
   * captures are comparable to each other across sessions.
   */
  illuminant: "screen_flash" | "ambient";
}

export interface Assessment {
  findings: ConcernFinding[];
  escalation: EscalationResult;
  /** One-paragraph supportive, non-shaming summary. */
  summary: string;
  /** Standard non-diagnostic disclaimer shown with every assessment. */
  disclaimer: string;
  /** What the capture gate measured, echoed back so the UI can explain itself. */
  photoQuality: PhotoQuality[];
  /** 0..1. Must fall when photos are flagged, rather than answering confidently anyway. */
  overallConfidence: number;
  /**
   * Plain-language list of what could NOT be assessed and why — a region out of
   * frame, an angle that came out soft. Saying so is more credible than a
   * confident number with nothing behind it.
   */
  limitations: string[];
}
