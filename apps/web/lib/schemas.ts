/**
 * Zod schemas for the AI pipeline's structured outputs.
 *
 * TWO LAYERS, ON PURPOSE.
 *
 * The *wire* schemas are what `zodOutputFormat` sends to the model, so they
 * carry only what the API can actually enforce: types, enums, required keys,
 * object shape. They deliberately contain no numeric bounds, array-length
 * rules, or `superRefine` checks — the SDK strips every one of those from the
 * schema it transmits and then re-runs them client-side, where a failure
 * *throws*. Encoding a rule there does not constrain the model; it only turns a
 * near-miss into `ANALYSIS_INVALID_OUTPUT` and drops the user to an
 * answer-based plan after they passed three strict photo gates.
 *
 * The *normalizers* below are where those rules actually live. They coerce what
 * is coercible (clamp a confidence, dedupe a repeated concern, backfill a
 * missing one) and drop what is not, so an imperfect response still produces an
 * honest assessment. Nothing here is a safety decision: @pore/shared/safety
 * re-clamps the routine afterwards regardless of what arrives.
 *
 * Keep the enum members in sync with @pore/shared/types.
 */
import { z } from "zod";
import type {
  Assessment,
  AppearanceLevel,
  ConcernFinding,
  ConcernKey,
  RegionObservation,
  Routine,
  ScanPose,
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
const region = z.enum(["forehead", "cheeks", "nose", "chin", "jaw", "under-eye", "around mouth", "temples"]);
const pose = z.enum(["front", "right", "left"]);

/**
 * A region reads on its own ordinal band, not a number. The four bands are the
 * same vocabulary the whole-face reading uses, so a region can never claim more
 * resolution than the concern itself has.
 */
const regionObservation = z.object({
  region,
  appearanceLevel: appearance,
});

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

const CONCERN_KEYS = concern.options;
const PASSIVE_CATEGORIES = new Set(["cleanser", "moisturizer", "sunscreen"]);

/** Sent to the model. Structure and vocabulary only — see the file header. */
export const AssessmentSchema = z.object({
  findings: z.array(
    z.object({
      concern,
      present: z.boolean(),
      appearanceLevel: appearance,
      /** 0..1. Bounds are enforced by normalizeAssessment, not the wire. */
      confidence: z.number(),
      contributingFactors: z.array(z.string()),
      /**
       * Where the concern appears, and how strongly in each place. The flat
       * `regions` list every consumer reads is derived from this, so there is
       * one source of truth for location.
       */
      regionDetail: z.array(regionObservation),
      /** Which of the three labelled captures actually showed this. */
      observedInPoses: z.array(pose),
    }),
  ),
  escalation: z.object({
    recommendProfessional: z.boolean(),
    reasons: z.array(z.string()),
  }),
  summary: z.string(),
  disclaimer: z.string(),
});

export type AssessmentDraft = z.infer<typeof AssessmentSchema>;

const RoutineStepSchema = z.object({
  order: z.number(),
  category,
  // nullable (not optional) — structured outputs handle nullables cleanly.
  active: active.nullable(),
  /** 1..7. Bounds are enforced by normalizeDraft, not the wire. */
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

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function absentFinding(key: ConcernKey): ConcernFinding {
  return {
    concern: key,
    present: false,
    appearanceLevel: "none",
    confidence: 0,
    contributingFactors: [],
    regions: [],
    regionDetail: [],
    observedInPoses: [],
  };
}

const APPEARANCE_RANK: Record<AppearanceLevel, number> = {
  none: 0,
  mild: 1,
  moderate: 2,
  noticeable: 3,
};

/**
 * One entry per region, keeping the strongest band the model gave it.
 *
 * A repeated region is a duplication, not two places. Regions reported as
 * "none" are dropped: an absent reading is not a location.
 */
function normalizeRegionDetail(
  raw: readonly RegionObservation[],
): RegionObservation[] {
  const byRegion = new Map<string, RegionObservation>();
  for (const entry of raw) {
    if (entry.appearanceLevel === "none") continue;
    const existing = byRegion.get(entry.region);
    if (
      !existing ||
      APPEARANCE_RANK[entry.appearanceLevel] > APPEARANCE_RANK[existing.appearanceLevel]
    ) {
      byRegion.set(entry.region, entry);
    }
  }
  return [...byRegion.values()];
}

/**
 * Reconcile a model assessment into the exact nine-concern contract the app
 * renders, without inventing findings.
 *
 * Every correction here resolves an ambiguity in the *conservative* direction:
 * an unreadable confidence becomes 0 (not 1), a contradictory finding becomes
 * absent (never present), a missing concern is reported as not visible, and an
 * escalation is never discarded for lacking a reason — dropping a "see someone
 * about this" signal to satisfy a schema would be the one unsafe coercion.
 */
export function normalizeAssessment(draft: AssessmentDraft): Assessment {
  const byConcern = new Map<ConcernKey, ConcernFinding>();

  for (const raw of draft.findings) {
    const confidence = clamp(raw.confidence, 0, 1, 0);
    // "Present but not visible at all" is self-contradictory; the only reading
    // that cannot fabricate a concern is to treat it as absent.
    const present = raw.present && raw.appearanceLevel !== "none";
    const appearanceLevel: AppearanceLevel = present ? raw.appearanceLevel : "none";
    // Location and pose provenance describe where something *is* and where it
    // was seen; an absent finding has neither.
    const regionDetail = present ? normalizeRegionDetail(raw.regionDetail) : [];
    const observedInPoses: ScanPose[] = present ? [...new Set(raw.observedInPoses)] : [];
    const finding: ConcernFinding = {
      concern: raw.concern,
      present,
      appearanceLevel,
      confidence,
      contributingFactors: raw.contributingFactors
        .map((factor) => factor.trim())
        .filter(Boolean),
      regions: regionDetail.map((entry) => entry.region),
      regionDetail,
      observedInPoses,
    };

    // A repeated concern is a duplication, not two findings. Keep the reading
    // the model was most sure of so a stray low-confidence echo cannot
    // overwrite a confident one.
    const existing = byConcern.get(raw.concern);
    if (!existing || finding.confidence > existing.confidence) {
      byConcern.set(raw.concern, finding);
    }
  }

  const escalation = {
    recommendProfessional: draft.escalation.recommendProfessional,
    reasons: draft.escalation.reasons.map((reason) => reason.trim()).filter(Boolean),
  };
  if (escalation.recommendProfessional && escalation.reasons.length === 0) {
    escalation.reasons = [
      "The photo review flagged something that should be looked at in person.",
    ];
  }

  return {
    // Rebuilt from the canonical key list so the order is stable and every
    // concern is answered exactly once, whatever arrived.
    findings: CONCERN_KEYS.map((key) => byConcern.get(key) ?? absentFinding(key)),
    escalation,
    summary: draft.summary.trim(),
    disclaimer: draft.disclaimer.trim(),
  };
}

/**
 * Convert the model's nullable fields to the optional shape the engine expects,
 * and resolve category/active contradictions rather than rejecting the routine.
 *
 * A cleanser that arrived carrying a treatment active keeps its step and loses
 * the active; a treatment step that arrived with no active is dropped, because
 * there is no way to guess what it was meant to be. The safety engine restores
 * a cleanser/moisturizer/sunscreen baseline afterwards either way.
 */
export function normalizeDraft(draft: RoutineDraft): Routine {
  const session = (steps: RoutineDraft["am"]): Routine["am"] =>
    steps
      .filter((step) => PASSIVE_CATEGORIES.has(step.category) || step.active != null)
      .map((step, index) => ({
        order: index + 1,
        category: step.category,
        active: PASSIVE_CATEGORIES.has(step.category)
          ? undefined
          : (step.active ?? undefined),
        frequencyPerWeek: Math.round(clamp(step.frequencyPerWeek, 1, 7, 7)),
        rampSchedule: step.rampSchedule?.trim() || undefined,
        rationale: step.rationale,
        irritationRisk: step.irritationRisk,
      }));

  return { am: session(draft.am), pm: session(draft.pm), notes: draft.notes };
}
