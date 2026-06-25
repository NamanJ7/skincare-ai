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
 */
import type { IntakeResponse } from "../types/intake";
import type { ActiveKey, Routine, RoutineStep, RoutineTime } from "../types/routine";
import { ACTIVES, activeRelevanceScore, type ActiveMeta } from "./ingredients";

export type SafetyRuleId =
  | "spf_required"
  | "pregnancy_unsafe_removed"
  | "pregnancy_caution_flagged"
  | "allergy_removed"
  | "retinoid_frequency_clamped"
  | "session_irritation_cap"
  | "sensitivity_active_cap"
  | "duplicate_active_merged";

export interface SafetyAdjustment {
  rule: SafetyRuleId;
  action: "added" | "removed" | "reduced_frequency" | "separated" | "flagged" | "merged";
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
  return meta.baseIrritation === "low" ? 0 : meta.baseIrritation === "medium" ? 1 : 2;
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

export function applySafetyRules(routine: Routine, intake: IntakeResponse): SafetyResult {
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
          detail: `Removed ${labelOf(step.active)} (${time}) — you listed it as an allergy or past reaction.`,
        });
      }
    }
  }

  // 2. Pregnancy / breastfeeding filter.
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
            detail: `Removed ${m.label} (${time}) — best avoided during pregnancy or breastfeeding.`,
          });
        } else if (m.pregnancySafety === "caution") {
          adjustments.push({
            rule: "pregnancy_caution_flagged",
            action: "flagged",
            active: m.key,
            time,
            detail: `${m.label} is usually used in limited amounts during pregnancy/breastfeeding — confirm with your doctor or pharmacist first.`,
          });
        }
      }
    }
  }

  // 3. Merge duplicate actives within a session.
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

  // 4. Retinoid frequency clamp.
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
          detail: `Lowered ${m.label} from ${was}x to ${maxRetinoidFreq}x/week — retinoids should be introduced slowly to avoid irritation.`,
        });
      }
    }
  }

  // 5. At most one strong exfoliating/active per session (try to move, else drop).
  capSessionIrritants(pm, am, "PM", "AM", intake.goals, adjustments);
  capSessionIrritants(am, pm, "AM", "PM", intake.goals, adjustments);

  // 6. Sensitivity cap on distinct strong actives across the whole routine.
  applySensitivityCap(am, pm, intake, adjustments);

  // 7. Sunscreen is mandatory in the AM.
  if (!am.some((s) => s.category === "sunscreen")) {
    am.push({
      order: am.length + 1,
      category: "sunscreen",
      frequencyPerWeek: 7,
      rationale:
        "Daily SPF protects your barrier and stops dark marks from deepening — the single highest-impact step, never skip it.",
      irritationRisk: "low",
    });
    adjustments.push({
      rule: "spf_required",
      action: "added",
      time: "AM",
      detail: "Added a daily sunscreen step — required in every Pore routine.",
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
    if (sessionIrritants(other).length === 0) {
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
        detail: `Removed ${labelOf(extra.active)} from ${selfTime} — combining several strong exfoliating actives at once risks over-exfoliation.`,
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
  const strong: ActiveKey[] = [];
  for (const step of [...am, ...pm]) {
    const m = metaOf(step.active);
    if (m?.isStrongActive && step.active && !strong.includes(step.active)) {
      strong.push(step.active);
    }
  }
  if (strong.length <= cap) return;

  const ranked = [...strong].sort((a, b) => {
    const sa = activeRelevanceScore(a, intake.goals);
    const sb = activeRelevanceScore(b, intake.goals);
    if (sa !== sb) return sa - sb; // lowest relevance dropped first
    const ra = irritationRank(ACTIVES[a]);
    const rb = irritationRank(ACTIVES[b]);
    return rb - ra; // harsher dropped first on ties
  });
  const toDrop = ranked.slice(0, strong.length - cap);

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
      detail: `Removed ${labelOf(active)} — with ${intake.sensitivity} sensitivity we keep to ${cap} strong active${cap === 1 ? "" : "s"} so your skin barrier can recover.`,
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
