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
