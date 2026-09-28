/**
 * The rule that keeps the answers-only path honest: no strong active without a
 * look at the skin.
 *
 * `applyAssessmentRoutinePolicy` already enforces this on the scan path — an
 * active survives only when a visible, high-confidence finding supports it. But
 * that policy needs an `Assessment`, so the answers-only routine never ran it,
 * and the result was backwards: a user whose scan FAILED could receive up to
 * three goal-derived strong actives (retinoid and benzoyl peroxide among them)
 * with no visual evidence at all, while a user whose scan SUCCEEDED but read
 * softly received none. Failing the scan was the easier route to a stronger
 * routine.
 *
 * This is the same principle expressed without an assessment: with nothing seen,
 * nothing strong. Gentle actives and the cleanser/moisturizer/sunscreen baseline
 * are untouched, so the user still gets a real routine — just not one that
 * treats a concern nobody has looked at.
 */
import type { Routine, RoutineStep } from "../types/routine";
import { ACTIVES } from "./ingredients";
import type { SafetyAdjustment } from "./engine";

function renumber(steps: RoutineStep[]): void {
  steps.forEach((step, index) => {
    step.order = index + 1;
  });
}

export function applyUnverifiedEvidencePolicy(routine: Routine): {
  routine: Routine;
  adjustments: SafetyAdjustment[];
} {
  const output: Routine = {
    am: routine.am.map((step) => ({ ...step })),
    pm: routine.pm.map((step) => ({ ...step })),
    notes: [...routine.notes],
  };
  const adjustments: SafetyAdjustment[] = [];

  for (const { time, steps } of [
    { time: "AM" as const, steps: output.am },
    { time: "PM" as const, steps: output.pm },
  ]) {
    for (const step of [...steps]) {
      if (!step.active || !ACTIVES[step.active].isStrongActive) continue;
      steps.splice(steps.indexOf(step), 1);
      adjustments.push({
        rule: "unverified_evidence_capped",
        action: "removed",
        active: step.active,
        time,
        detail:
          "Removed a strong active because no current scan has shown the concern it would treat.",
      });
    }
  }

  if (adjustments.length > 0) {
    output.notes.unshift(
      "Strong active treatments wait for a scan. Without photos Pore cannot see what an active would be treating, so this routine stays on gentle steps until you complete one.",
    );
  }

  renumber(output.am);
  renumber(output.pm);
  return { routine: output, adjustments };
}
