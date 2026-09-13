/** Bind product recommendations to the cosmetic findings actually supported by a scan. */
import type { Assessment, ConcernKey } from "../types/assessment";
import type { ActiveKey, Routine, RoutineStep } from "../types/routine";
import type { SafetyAdjustment } from "./engine";

const MIN_ACTIONABLE_CONFIDENCE = 0.7;

const ACTIVE_CONCERNS: Record<ActiveKey, readonly ConcernKey[]> = {
  salicylic_acid: ["acne_like_breakouts", "oiliness", "texture_congestion"],
  glycolic_acid: ["texture_congestion"],
  lactic_acid: ["texture_congestion"],
  mandelic_acid: ["texture_congestion"],
  benzoyl_peroxide: ["acne_like_breakouts"],
  azelaic_acid: [
    "acne_like_breakouts",
    "dark_spot_appearance",
    "uneven_tone",
    "redness_appearance",
  ],
  niacinamide: [
    "oiliness",
    "dryness_flaking",
    "uneven_tone",
    "dark_spot_appearance",
    "redness_appearance",
    "irritation_signs",
  ],
  retinoid: [
    "acne_like_breakouts",
    "texture_congestion",
    "dark_spot_appearance",
    "fine_line_appearance",
  ],
  vitamin_c: ["uneven_tone", "dark_spot_appearance", "fine_line_appearance"],
  hydroquinone: [],
  hyaluronic_acid: ["dryness_flaking", "irritation_signs"],
  ceramides: ["dryness_flaking", "irritation_signs"],
};

/** True when an approved active has a cosmetic use for this concern. */
export function activeSupportsConcern(
  active: ActiveKey,
  concern: ConcernKey,
): boolean {
  return ACTIVE_CONCERNS[active].includes(concern);
}

function clone(routine: Routine): Routine {
  return {
    am: routine.am.map((step) => ({ ...step })),
    pm: routine.pm.map((step) => ({ ...step })),
    notes: [...routine.notes],
  };
}

function dropActive(steps: RoutineStep[], step: RoutineStep): void {
  const index = steps.indexOf(step);
  if (index >= 0) steps.splice(index, 1);
}

function renumber(steps: RoutineStep[]): void {
  steps.forEach((step, index) => {
    step.order = index + 1;
  });
}

/**
 * Strong treatment products are allowed only for a visibly present,
 * high-confidence cosmetic concern. Escalated scans receive a calm basic
 * routine while a clinician determines what the appearance represents.
 */
export function applyAssessmentRoutinePolicy(
  routine: Routine,
  assessment: Assessment,
): { routine: Routine; adjustments: SafetyAdjustment[] } {
  const output = clone(routine);
  const adjustments: SafetyAdjustment[] = [];
  const sessions = [
    { time: "AM" as const, steps: output.am },
    { time: "PM" as const, steps: output.pm },
  ];

  if (assessment.escalation.recommendProfessional) {
    for (const { time, steps } of sessions) {
      for (const step of [...steps]) {
        if (!step.active) continue;
        dropActive(steps, step);
        adjustments.push({
          rule: "professional_review_mode",
          action: "removed",
          active: step.active,
          time,
          detail:
            "Removed active treatment because this appearance needs professional review before a cosmetic routine is chosen.",
        });
      }
    }
    output.notes.unshift(
      "Photo review found an appearance that may need professional assessment. Keep the routine gentle and pause new active treatments until you can get advice.",
    );
  } else {
    const supported = new Set(
      assessment.findings
        .filter(
          (finding) =>
            finding.present &&
            finding.appearanceLevel !== "none" &&
            finding.confidence >= MIN_ACTIONABLE_CONFIDENCE,
        )
        .map((finding) => finding.concern),
    );
    for (const { time, steps } of sessions) {
      for (const step of [...steps]) {
        if (!step.active) continue;
        const supportsActive = [...supported].some((concern) =>
          activeSupportsConcern(step.active!, concern),
        );
        if (supportsActive) continue;
        dropActive(steps, step);
        adjustments.push({
          rule: "assessment_evidence_removed",
          action: "removed",
          active: step.active,
          time,
          detail:
            "Removed an active that was not supported by a clearly visible, high-confidence cosmetic finding.",
        });
      }
    }
    if (supported.size === 0) {
      output.notes.unshift(
        "No clearly visible, high-confidence treatment target was found, so this routine stays focused on gentle maintenance.",
      );
    }
  }

  renumber(output.am);
  renumber(output.pm);
  return { routine: output, adjustments };
}
