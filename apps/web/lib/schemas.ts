/**
 * Zod schemas for the AI pipeline's structured outputs. These mirror the
 * @pore/shared domain types and are passed to Claude via `zodOutputFormat` so
 * the model is constrained to return schema-valid JSON (then validated again on
 * parse).
 *
 * The enum members mirror @pore/shared/types. That used to be a comment asking
 * for discipline; the `Covers<>` assertions at the bottom of this file make it
 * a compile error instead, so adding a domain value without updating the schema
 * fails `pnpm typecheck` rather than silently shipping a validator that rejects
 * valid input.
 */
import { z } from "zod";
import type {
  ActiveKey,
  Budget,
  Climate,
  FragrancePreference,
  IntakeResponse,
  ProductCategory,
  Routine,
  Sensitivity,
  SkinGoal,
  SkinTone,
  SkinType,
} from "@pore/shared";

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

// ---------------------------------------------------------------- intake --

/**
 * The intake, validated at the trust boundary.
 *
 * This exists because `intake` was previously checked for presence and nothing
 * else, then `JSON.stringify`'d into BOTH model calls. That made the token cost
 * of a request attacker-controlled: an unknown field holding a few megabytes of
 * text is serialized twice into a 1M-context model at $5/M input.
 *
 * `.strict()` is the load-bearing part. Rejecting unknown keys means the
 * serialized size is bounded by the fields below rather than by whatever the
 * caller decided to attach — a stronger guarantee than a byte cap, because it
 * rejects the shape of the attack and not just its size. It also closes the
 * prompt-injection surface: only enum members and bounded values survive, and
 * `location` is the single free-text field that gets through.
 */
const skinType = z.enum(["oily", "dry", "combination", "normal"]);
const sensitivity = z.enum(["low", "medium", "high"]);
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
const budget = z.enum(["low", "medium", "high"]);
const fragrancePreference = z.enum(["fragrance_free", "no_preference"]);
const skinTone = z.enum(["very_fair", "fair", "medium", "olive", "brown", "deep"]);
const climate = z.enum(["dry", "humid", "temperate", "cold"]);

/** There are twelve actives in total, so no list of them can legitimately be longer. */
const ACTIVE_COUNT = 12;
/** Nine concerns, nine goals. */
const GOAL_COUNT = 9;

export const IntakeSchema = z
  .object({
    // The app blocks under-16 upstream; the server does not take the client's
    // word for that, because the client is whoever is calling.
    age: z.number().int().min(16).max(120),
    goals: z.array(skinGoal).max(GOAL_COUNT),
    skinType,
    sensitivity,
    currentProducts: z.array(active).max(ACTIVE_COUNT),
    allergies: z.array(active).max(ACTIVE_COUNT),
    budget,
    fragrancePreference,
    pregnancyOrBreastfeeding: z.boolean(),
    skinTone,
    darkMarkProne: z.boolean(),
    climate,
    // The one free-text field that reaches the prompt. Keep it short.
    location: z.string().max(120).optional(),
  })
  .strict();

/**
 * Compile-time proof that each Zod enum covers its domain union.
 *
 * `Covers<Union, Members>` resolves to `never` unless every member of the
 * union appears in the enum, so a missing value is a type error here rather
 * than a validator that quietly 400s real users.
 */
type Covers<Union extends string, Members extends string> = [
  Exclude<Union, Members>,
] extends [never]
  ? true
  : ["MISSING FROM ZOD ENUM:", Exclude<Union, Members>];

const _enumsCoverDomain: {
  active: Covers<ActiveKey, z.infer<typeof active>>;
  category: Covers<ProductCategory, z.infer<typeof category>>;
  skinType: Covers<SkinType, z.infer<typeof skinType>>;
  sensitivity: Covers<Sensitivity, z.infer<typeof sensitivity>>;
  skinGoal: Covers<SkinGoal, z.infer<typeof skinGoal>>;
  budget: Covers<Budget, z.infer<typeof budget>>;
  fragrance: Covers<FragrancePreference, z.infer<typeof fragrancePreference>>;
  skinTone: Covers<SkinTone, z.infer<typeof skinTone>>;
  climate: Covers<Climate, z.infer<typeof climate>>;
} = {
  active: true,
  category: true,
  skinType: true,
  sensitivity: true,
  skinGoal: true,
  budget: true,
  fragrance: true,
  skinTone: true,
  climate: true,
};
void _enumsCoverDomain;

/** The parsed intake is structurally the domain type. */
const _intakeMatchesDomain: IntakeResponse = {} as z.infer<typeof IntakeSchema>;
void _intakeMatchesDomain;
