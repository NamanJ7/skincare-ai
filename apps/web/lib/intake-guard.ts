/**
 * Runtime validation for the client-supplied `intake` object.
 *
 * The scan half of a plan request has always been validated (scan-analysis-guard),
 * but `intake` was only cast. That matters because the safety engine reads these
 * fields directly and several of its guarantees fail *open* on `undefined`:
 * a missing `pregnancyOrBreastfeeding` skips the entire pregnancy filter, and a
 * missing `sensitivity` makes the strong-active cap a silent no-op (the count
 * arithmetic goes NaN and drops nothing). Others — `allergies`, `currentProducts`,
 * `goals` — throw, but only *after* both Opus calls have been paid for.
 *
 * So this runs before any model call, and rejects rather than repairs: a
 * deterministic safety guarantee must never be switchable by omitting a key.
 */
import { z } from "zod";
import { MIN_SUPPORTED_AGE, type IntakeResponse } from "@pore/shared";

import { AnalysisRequestError } from "./scan-analysis-guard";

const goal = z.enum([
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

/**
 * Length ceilings for the free-text and array fields.
 *
 * Every one of these is interpolated verbatim into both Opus prompts
 * (`JSON.stringify(input.intake, null, 2)` in lib/pipeline.ts, twice). Without
 * bounds a caller could inflate a single request into an arbitrary number of
 * input tokens across two `max_tokens: 32_000` calls, and had an unlimited
 * channel for steering prompt content.
 *
 * Values are sized above what the mobile client can actually produce:
 * `goals` is capped by the enum itself, `currentProducts` accumulates
 * onboarding ingredients plus the actives of every shelf product
 * (apps/mobile/src/lib/intake.ts), and `allergyNotes` is one TextField.
 */
const LIMITS = {
  goals: 9,
  currentProducts: 100,
  productLength: 120,
  allergies: 50,
  allergyLength: 120,
  allergyNotes: 500,
  location: 120,
} as const;

export const IntakeSchema = z.object({
  // Upper bound rejects nonsense that would otherwise reach the prompt verbatim.
  age: z.number().int().min(MIN_SUPPORTED_AGE).max(120),
  goals: z.array(goal).max(LIMITS.goals),
  skinType: z.enum(["oily", "dry", "combination", "normal"]).optional(),
  sensitivity: z.enum(["low", "medium", "high"]),
  currentProducts: z
    .array(z.string().max(LIMITS.productLength))
    .max(LIMITS.currentProducts),
  allergies: z
    .array(z.string().max(LIMITS.allergyLength))
    .max(LIMITS.allergies),
  allergyNotes: z.string().max(LIMITS.allergyNotes).optional(),
  budget: z.enum(["low", "medium", "high"]).optional(),
  fragrancePreference: z.enum(["fragrance_free", "no_preference"]).optional(),
  routineComplexity: z.enum(["minimal", "balanced", "flexible"]).optional(),
  pregnancyOrBreastfeeding: z.boolean(),
  usingPrescriptionSkincare: z.boolean().optional(),
  skinTone: z
    .enum(["very_fair", "fair", "medium", "olive", "brown", "deep"])
    .optional(),
  darkMarkProne: z.boolean().optional(),
  climate: z.enum(["dry", "humid", "temperate", "cold"]).optional(),
  location: z.string().max(LIMITS.location).optional(),
});

/**
 * Throws `AnalysisRequestError` (400) on any shape the safety engine cannot
 * reason about. Never returns a partially-defaulted profile.
 *
 * The failing field names go in `detail`, not `message`. The route echoes
 * `message` to the caller, and the field list is a map of exactly which inputs
 * the safety engine keys on — `{"intake":{}}` used to return the whole set.
 * `detail` is logged server-side, so debuggability is unchanged.
 */
export function assertRuntimeIntake(value: unknown): IntakeResponse {
  const parsed = IntakeSchema.safeParse(value);
  if (!parsed.success) {
    const fields = [
      ...new Set(parsed.error.issues.map((issue) => issue.path.join("."))),
    ]
      .filter(Boolean)
      .slice(0, 6);
    throw new AnalysisRequestError(
      "Your profile answers were not valid.",
      "INVALID_INTAKE",
      400,
      fields.length ? `intake fields: ${fields.join(", ")}` : "intake: unparseable",
    );
  }
  return parsed.data satisfies IntakeResponse;
}
