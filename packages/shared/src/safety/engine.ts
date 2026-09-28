/**
 * Deterministic routine-safety engine.
 *
 * Takes a candidate routine (typically from the LLM) plus the user's intake and
 * returns a corrected routine + an audit trail of every change. This is the part
 * of Pore that is CODE, not a prompt — it guarantees the non-negotiables hold no
 * matter what the model returns:
 *
 *   1. Sunscreen is always present in the AM routine.
 *   2. Pregnancy/breastfeeding strips contraindicated actives.
 *   3. Allergens the user listed are removed.
 *   4. Retinoids start at a low weekly frequency.
 *   5. At most one strong exfoliating/active per session (no over-exfoliation).
 *   6. Sensitivity caps the number of distinct strong actives overall.
 *   7. Duplicate actives within a session are merged.
 *   8. Every routine retains a gentle cleanser and moisturizer baseline.
 *   9. Clinician-only hydroquinone is never recommended as self-care.
 */
import type { IntakeResponse } from "../types/intake";
import type {
  ActiveKey,
  Routine,
  RoutineStep,
  RoutineTime,
} from "../types/routine";
import { ACTIVES, activeRelevanceScore, type ActiveMeta } from "./ingredients";

export type SafetyRuleId =
  | "spf_required"
  | "pregnancy_unsafe_removed"
  | "pregnancy_caution_flagged"
  | "prescription_baseline_mode"
  | "allergy_removed"
  | "retinoid_frequency_clamped"
  | "session_irritation_cap"
  | "sensitivity_active_cap"
  | "duplicate_active_merged"
  | "routine_preference_cap"
  | "skin_type_frequency_adjusted"
  | "cleanser_required"
  | "moisturizer_required"
  | "clinician_only_removed"
  | "assessment_evidence_removed"
  | "unverified_evidence_capped"
  | "professional_review_mode";

export interface SafetyAdjustment {
  rule: SafetyRuleId;
  action:
    | "added"
    | "removed"
    | "reduced_frequency"
    | "separated"
    | "flagged"
    | "merged";
  active?: ActiveKey;
  time?: RoutineTime;
  detail: string;
}

export interface SafetyResult {
  routine: Routine;
  adjustments: SafetyAdjustment[];
}

const MAX_ACTIVES_BY_SENSITIVITY = { low: 3, medium: 2, high: 1 } as const;
const SESSION_IRRITANT_CAP = 1;

function metaOf(active: ActiveKey | undefined): ActiveMeta | undefined {
  return active ? ACTIVES[active] : undefined;
}

/** Exfoliating acid, retinoid, or benzoyl peroxide — the "don't stack these" set. */
function isSessionIrritant(meta: ActiveMeta): boolean {
  return meta.isExfoliatingAcid || meta.isRetinoid || meta.isBenzoylPeroxide;
}

function irritationRank(meta: ActiveMeta): number {
  return meta.baseIrritation === "low"
    ? 0
    : meta.baseIrritation === "medium"
      ? 1
      : 2;
}

function removeFrom(arr: RoutineStep[], step: RoutineStep): void {
  const i = arr.indexOf(step);
  if (i >= 0) arr.splice(i, 1);
}

function sessionIrritants(steps: RoutineStep[]): RoutineStep[] {
  return steps.filter((s) => {
    const m = metaOf(s.active);
    return m !== undefined && isSessionIrritant(m);
  });
}

/** Sort so the steps we most want to KEEP come first. */
function byKeepPriorityDesc(goals: IntakeResponse["goals"]) {
  return (a: RoutineStep, b: RoutineStep): number => {
    const sa = a.active ? activeRelevanceScore(a.active, goals) : 0;
    const sb = b.active ? activeRelevanceScore(b.active, goals) : 0;
    if (sb !== sa) return sb - sa; // higher relevance kept
    const ma = metaOf(a.active);
    const mb = metaOf(b.active);
    const ra = ma ? irritationRank(ma) : 0;
    const rb = mb ? irritationRank(mb) : 0;
    return ra - rb; // gentler kept on ties
  };
}

export function applySafetyRules(
  routine: Routine,
  intake: IntakeResponse,
): SafetyResult {
  const adjustments: SafetyAdjustment[] = [];
  const am: RoutineStep[] = routine.am.map((s) => ({ ...s }));
  const pm: RoutineStep[] = routine.pm.map((s) => ({ ...s }));
  const sessions: Array<[RoutineTime, RoutineStep[]]> = [
    ["AM", am],
    ["PM", pm],
  ];

  // 1. Allergy removal.
  for (const [time, steps] of sessions) {
    for (const step of [...steps]) {
      if (step.active && intake.allergies.includes(step.active)) {
        removeFrom(steps, step);
        adjustments.push({
          rule: "allergy_removed",
          action: "removed",
          active: step.active,
          time,
          detail: `Removed ${labelOf(step.active)} (${time}) because you listed it as an allergy or past reaction.`,
        });
      }
    }
  }

  // 2. Hydroquinone requires clinician supervision; never offer it as a
  // self-care product recommendation regardless of market or skin concern.
  for (const [time, steps] of sessions) {
    for (const step of [...steps]) {
      if (step.active !== "hydroquinone") continue;
      removeFrom(steps, step);
      adjustments.push({
        rule: "clinician_only_removed",
        action: "removed",
        active: step.active,
        time,
        detail:
          "Removed hydroquinone. Use it only when a licensed clinician prescribes and supervises it.",
      });
    }
  }

  // 3. Pregnancy / breastfeeding filter.
  if (intake.pregnancyOrBreastfeeding) {
    for (const [time, steps] of sessions) {
      for (const step of [...steps]) {
        const m = metaOf(step.active);
        if (!m) continue;
        if (m.pregnancySafety === "avoid") {
          removeFrom(steps, step);
          adjustments.push({
            rule: "pregnancy_unsafe_removed",
            action: "removed",
            active: m.key,
            time,
            detail: `Removed ${m.label} (${time}). It is best avoided during pregnancy or breastfeeding.`,
          });
        } else if (m.pregnancySafety === "caution") {
          adjustments.push({
            rule: "pregnancy_caution_flagged",
            action: "flagged",
            active: m.key,
            time,
            detail: `${m.label} is usually used in limited amounts during pregnancy or breastfeeding. Confirm with your doctor or pharmacist first.`,
          });
        }
      }
    }
  }

  // A prescription regimen is an unknown clinical baseline. Keep Pore's plan
  // gentle instead of layering an OTC strong active onto it.
  if (intake.usingPrescriptionSkincare) {
    for (const [time, steps] of sessions) {
      for (const step of [...steps]) {
        const meta = metaOf(step.active);
        if (!meta?.isStrongActive) continue;
        removeFrom(steps, step);
        adjustments.push({
          rule: "prescription_baseline_mode",
          action: "removed",
          active: meta.key,
          time,
          detail: `Removed ${meta.label} (${time}) because you use prescription skincare. Pore won't layer a strong active without your prescriber's guidance.`,
        });
      }
    }
  }

  // 4. Merge duplicate actives within a session.
  for (const [time, steps] of sessions) {
    const seen = new Set<ActiveKey>();
    for (const step of [...steps]) {
      if (!step.active) continue;
      if (seen.has(step.active)) {
        removeFrom(steps, step);
        adjustments.push({
          rule: "duplicate_active_merged",
          action: "merged",
          active: step.active,
          time,
          detail: `Merged a duplicate ${labelOf(step.active)} step in your ${time} routine.`,
        });
      } else {
        seen.add(step.active);
      }
    }
  }

  // 5. Retinoid frequency clamp.
  const maxRetinoidFreq = intake.sensitivity === "high" ? 2 : 3;
  for (const [time, steps] of sessions) {
    for (const step of steps) {
      const m = metaOf(step.active);
      if (m?.isRetinoid && step.frequencyPerWeek > maxRetinoidFreq) {
        const was = step.frequencyPerWeek;
        step.frequencyPerWeek = maxRetinoidFreq;
        if (!step.rampSchedule) {
          step.rampSchedule = `Start ${maxRetinoidFreq}x/week and only increase if your skin stays calm.`;
        }
        adjustments.push({
          rule: "retinoid_frequency_clamped",
          action: "reduced_frequency",
          active: m.key,
          time,
          detail: `Lowered ${m.label} from ${was}x to ${maxRetinoidFreq}x/week. Retinoids should be introduced slowly to avoid irritation.`,
        });
      }
    }
  }

  // 6. At most one strong exfoliating/active per session (try to move, else drop).
  capSessionIrritants(pm, am, "PM", "AM", intake.goals, adjustments);
  capSessionIrritants(am, pm, "AM", "PM", intake.goals, adjustments);

  // 7. Sensitivity cap on distinct strong actives across the whole routine.
  applySensitivityCap(am, pm, intake, adjustments);

  // 8. A simple barrier-supporting baseline is mandatory.
  if (
    !am.some((step) => step.category === "cleanser") &&
    !pm.some((step) => step.category === "cleanser")
  ) {
    pm.unshift({
      order: 0,
      category: "cleanser",
      frequencyPerWeek: 7,
      rationale:
        "Use a gentle cleanser to remove sunscreen and daily buildup without over-stripping your skin.",
      irritationRisk: "low",
    });
    adjustments.push({
      rule: "cleanser_required",
      action: "added",
      time: "PM",
      detail: "Added a gentle cleanser as the baseline evening step.",
    });
  }
  for (const [time, steps] of sessions) {
    if (steps.some((step) => step.category === "moisturizer")) continue;
    steps.push({
      order: steps.length + 1,
      category: "moisturizer",
      frequencyPerWeek: 7,
      rationale:
        "Use a simple moisturizer to support your skin barrier and reduce irritation from treatment steps.",
      irritationRisk: "low",
    });
    adjustments.push({
      rule: "moisturizer_required",
      action: "added",
      time,
      detail: `Added a simple moisturizer to the ${time} routine.`,
    });
  }

  // 9. Sunscreen is mandatory in the AM.
  if (!am.some((s) => s.category === "sunscreen")) {
    am.push({
      order: am.length + 1,
      category: "sunscreen",
      frequencyPerWeek: 7,
      rationale:
        "Daily SPF protects your barrier and stops dark marks from deepening. It is the single highest-impact step, so never skip it.",
      irritationRisk: "low",
    });
    adjustments.push({
      rule: "spf_required",
      action: "added",
      time: "AM",
      detail:
        "Added a daily sunscreen step because every Pore routine needs one.",
    });
  }

  renumber(am);
  renumber(pm);

  return { routine: { am, pm, notes: routine.notes }, adjustments };
}

function capSessionIrritants(
  self: RoutineStep[],
  other: RoutineStep[],
  selfTime: RoutineTime,
  otherTime: RoutineTime,
  goals: IntakeResponse["goals"],
  adjustments: SafetyAdjustment[],
): void {
  const irritants = sessionIrritants(self).sort(byKeepPriorityDesc(goals));
  if (irritants.length <= SESSION_IRRITANT_CAP) return;
  const extras = irritants.slice(SESSION_IRRITANT_CAP);
  for (const extra of extras) {
    removeFrom(self, extra);
    // Relieving PM's irritant load must not create a worse problem in AM.
    // Retinoids are PM-only: they photodegrade and raise photosensitivity, so
    // an overflowing PM drops one rather than relocating it into the morning.
    // Exfoliating acids may still move — rule 9 guarantees sunscreen in the AM.
    const meta = metaOf(extra.active);
    const retinoidIntoMorning = otherTime === "AM" && !!meta?.isRetinoid;
    if (sessionIrritants(other).length === 0 && !retinoidIntoMorning) {
      other.push(extra);
      adjustments.push({
        rule: "session_irritation_cap",
        action: "separated",
        active: extra.active,
        time: selfTime,
        detail: `Moved ${labelOf(extra.active)} to ${otherTime} so you're not using more than one strong exfoliating active at once.`,
      });
    } else {
      adjustments.push({
        rule: "session_irritation_cap",
        action: "removed",
        active: extra.active,
        time: selfTime,
        detail: `Removed ${labelOf(extra.active)} from ${selfTime}. Combining several strong exfoliating actives at once risks over-exfoliation.`,
      });
    }
  }
}

function applySensitivityCap(
  am: RoutineStep[],
  pm: RoutineStep[],
  intake: IntakeResponse,
  adjustments: SafetyAdjustment[],
): void {
  const cap = MAX_ACTIVES_BY_SENSITIVITY[intake.sensitivity];
  const ownedStrong = new Set<ActiveKey>();
  for (const key of intake.currentProducts) {
    if (!(key in ACTIVES)) continue;
    const active = key as ActiveKey;
    if (ACTIVES[active].isStrongActive) ownedStrong.add(active);
  }
  const strong: ActiveKey[] = [];
  for (const step of [...am, ...pm]) {
    const m = metaOf(step.active);
    if (m?.isStrongActive && step.active && !strong.includes(step.active)) {
      strong.push(step.active);
    }
  }
  const combined = new Set<ActiveKey>([...ownedStrong, ...strong]);
  if (combined.size <= cap) return;

  const ranked = [...strong].sort((a, b) => {
    // Existing compatible actives are kept before newly proposed ones.
    if (ownedStrong.has(a) !== ownedStrong.has(b))
      return ownedStrong.has(a) ? 1 : -1;
    const sa = activeRelevanceScore(a, intake.goals);
    const sb = activeRelevanceScore(b, intake.goals);
    if (sa !== sb) return sa - sb; // lowest relevance dropped first
    const ra = irritationRank(ACTIVES[a]);
    const rb = irritationRank(ACTIVES[b]);
    return rb - ra; // harsher dropped first on ties
  });
  // Counted against `combined` (owned + proposed) on purpose: a user already at
  // the cap with products they own gets no *new* strong active, even though only
  // the routine's own steps are droppable.
  const toDrop = ranked.slice(0, Math.min(ranked.length, combined.size - cap));

  for (const active of toDrop) {
    for (const steps of [am, pm]) {
      for (const step of [...steps]) {
        if (step.active === active) removeFrom(steps, step);
      }
    }
    adjustments.push({
      rule: "sensitivity_active_cap",
      action: "removed",
      active,
      detail: `Removed ${labelOf(active)}. With ${intake.sensitivity} sensitivity, we keep to ${cap} strong active${cap === 1 ? "" : "s"} so your skin barrier can recover.`,
    });
  }
}

function renumber(steps: RoutineStep[]): void {
  steps.forEach((s, i) => {
    s.order = i + 1;
  });
}

function labelOf(active: ActiveKey | undefined): string {
  return active ? ACTIVES[active].label : "this step";
}
