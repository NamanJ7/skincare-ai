/**
 * Zod schemas for the AI pipeline's structured outputs. These mirror the
 * @pore/shared domain types and are passed to Claude via `zodOutputFormat` so
 * the model is constrained to return schema-valid JSON (then validated again on
 * parse). Keep the enum members in sync with @pore/shared/types.
 */
import { z } from "zod";
import type { Routine } from "@pore/shared";

const concern = z.enum([
  "acne_like_breakouts",
  "oiliness",
  "dryness_flaking",
  "texture_congestion",
  "uneven_tone",
  "dark_spot_appearance",
  "redness_appearance",
  "fine_line_appearance",
  "irritation_signs",
]);

const appearance = z.enum(["none", "mild", "moderate", "noticeable"]);

const active = z.enum([
  "salicylic_acid",
  "glycolic_acid",
  "lactic_acid",
  "mandelic_acid",
  "benzoyl_peroxide",
  "azelaic_acid",
  "niacinamide",
  "retinoid",
  "vitamin_c",
  "hydroquinone",
  "hyaluronic_acid",
  "ceramides",
]);

const category = z.enum([
  "cleanser",
  "treatment",
  "serum",
  "moisturizer",
  "sunscreen",
  "exfoliant",
  "spot_treatment",
]);

const risk = z.enum(["low", "medium", "high"]);

/**
 * Angles the guided capture takes, in order. Also the labels the pipeline puts
 * in front of each image block so the model knows what it is looking at.
 */
export const CAPTURE_ANGLES = ["front", "left", "right"] as const;

const captureAngle = z.enum(CAPTURE_ANGLES);

const photoQualityFlag = z.enum([
  "dark",
  "bright",
  "blurry",
  "uneven_light",
  "color_cast",
  "too_far",
]);

/**
 * Client-measured capture quality. Validated on the way IN (it arrives from the
 * app, which is a trust boundary) and attached to the assessment afterwards —
 * the model is told about it but never asked to produce it.
 */
export const PhotoQualitySchema = z.object({
  angle: captureAngle,
  score: z.number().min(0).max(1),
  flags: z.array(photoQualityFlag),
  illuminant: z.enum(["screen_flash", "ambient"]),
});

export const AssessmentSchema = z.object({
  findings: z.array(
    z.object({
      concern,
      present: z.boolean(),
      appearanceLevel: appearance,
      confidence: z.number(),
      contributingFactors: z.array(z.string()),
      regions: z.array(z.string()),
    }),
  ),
  escalation: z.object({
    recommendProfessional: z.boolean(),
    reasons: z.array(z.string()),
  }),
  summary: z.string(),
  disclaimer: z.string(),
  /**
   * Must fall when photos are flagged. A confident number over a blurry photo
   * is the exact failure mode this product exists to not repeat.
   */
  overallConfidence: z.number(),
  /** What could not be assessed, and why. Empty only when nothing was obscured. */
  limitations: z.array(z.string()),
});

const RoutineStepSchema = z.object({
  order: z.number(),
  category,
  // nullable (not optional) — structured outputs handle nullables cleanly.
  active: active.nullable(),
  frequencyPerWeek: z.number(),
  rampSchedule: z.string().nullable(),
  rationale: z.string(),
  irritationRisk: risk,
});

export const RoutineDraftSchema = z.object({
  am: z.array(RoutineStepSchema),
  pm: z.array(RoutineStepSchema),
  notes: z.array(z.string()),
});

export type RoutineDraft = z.infer<typeof RoutineDraftSchema>;

/** Convert the model's nullable fields to the optional shape the engine expects. */
export function normalizeDraft(draft: RoutineDraft): Routine {
  const map = (s: RoutineDraft["am"][number]) => ({
    order: s.order,
    category: s.category,
    active: s.active ?? undefined,
    frequencyPerWeek: s.frequencyPerWeek,
    rampSchedule: s.rampSchedule ?? undefined,
    rationale: s.rationale,
    irritationRisk: s.irritationRisk,
  });
  return { am: draft.am.map(map), pm: draft.pm.map(map), notes: draft.notes };
}

/**
 * Inbound intake validation.
 *
 * `/api/plan` is a trust boundary in front of two paid Opus calls, and the intake
 * is JSON-stringified straight into both prompts (see pipeline.ts). Without bounds
 * here, one anonymous request can put an unbounded number of tokens through the
 * model — rate limiting caps how many requests you pay for, this caps how much
 * each one can cost. Every free-text field is therefore length- and count-capped,
 * and the object is `.strict()` so unknown keys are rejected rather than forwarded
 * into a prompt.
 *
 * The shape mirrors `IntakeResponse` in @pore/shared. It is checked against that
 * type at the `generatePlan` call site, so drift fails `pnpm typecheck`.
 */
const skinGoal = z.enum([
  "acne",
  "post_acne_marks",
  "hyperpigmentation",
  "oiliness",
  "dryness",
  "texture",
  "redness",
  "fine_lines",
  "general_health",
]);

/** Free-text the user types. Capped so it cannot become a token bomb. */
const shortText = z.string().max(80);

export const IntakeSchema = z
  .object({
    // The <16 gate is enforced on the client (onboarding/age.tsx); enforce it
    // here too, because the client is not the only thing that can call this.
    age: z.number().int().min(16).max(120),
    goals: z.array(skinGoal).max(9),
    skinType: z.enum(["oily", "dry", "combination", "normal"]),
    sensitivity: z.enum(["low", "medium", "high"]),
    currentProducts: z.array(shortText).max(30),
    allergies: z.array(shortText).max(30),
    budget: z.enum(["low", "medium", "high"]),
    fragrancePreference: z.enum(["fragrance_free", "no_preference"]),
    pregnancyOrBreastfeeding: z.boolean(),
    skinTone: z.enum(["very_fair", "fair", "medium", "olive", "brown", "deep"]),
    darkMarkProne: z.boolean(),
    climate: z.enum(["dry", "humid", "temperate", "cold"]),
    location: z.string().max(120).optional(),
  })
  .strict();

export type ParsedIntake = z.infer<typeof IntakeSchema>;
