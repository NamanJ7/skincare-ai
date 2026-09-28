/**
 * Deterministic intake personalization.
 *
 * These rules make retained questionnaire answers visible in the final
 * product: routine size is capped, dry skin slows exfoliating acids, baseline
 * copy reflects self-reported skin type, and restrictions/age context are
 * carried into routine notes.
 */
import type { IntakeResponse, SkinType } from "../types/intake";
import type { ActiveKey, Routine, RoutineStep } from "../types/routine";
import { ACTIVES, activeRelevanceScore } from "./ingredients";
import type { SafetyAdjustment } from "./engine";

const ACTIVE_CAP = {
  minimal: 1,
  balanced: 2,
  flexible: 3,
} as const;

const IRRITATION_RANK = { low: 0, medium: 1, high: 2 } as const;

function clone(routine: Routine): Routine {
  return {
    am: routine.am.map((step) => ({ ...step })),
    pm: routine.pm.map((step) => ({ ...step })),
    notes: [...routine.notes],
  };
}

function appendNote(notes: string[], note: string): void {
  if (!notes.includes(note)) notes.push(note);
}

function skinTypeRationale(
  skinType: SkinType,
  category: RoutineStep["category"],
): string | undefined {
  if (category === "cleanser") {
    if (skinType === "dry")
      return "Because your skin usually feels dry, use a gentle cleanser that does not leave it tight.";
    if (skinType === "oily")
      return "Because your skin usually feels oily, cleanse away buildup without trying to strip every bit of oil.";
    if (skinType === "combination")
      return "Because your skin feels different across areas, cleanse gently instead of over-treating the oilier zones.";
    return "Because your skin usually feels balanced, keep cleansing simple and non-stripping.";
  }
  if (category === "moisturizer") {
    if (skinType === "dry")
      return "Your dry-skin answer makes barrier support and lasting hydration a daily priority.";
    if (skinType === "oily")
      return "A lightweight moisturizer supports your barrier without making an oily feel heavier.";
    if (skinType === "combination")
      return "A balanced moisturizer supports drier areas without overloading oilier ones.";
    return "A simple moisturizer helps keep your balanced baseline steady.";
  }
  return undefined;
}

function renumber(routine: Routine): void {
  routine.am.forEach((step, index) => {
    step.order = index + 1;
  });
  routine.pm.forEach((step, index) => {
    step.order = index + 1;
  });
}

function activeRank(active: ActiveKey, intake: IntakeResponse): number {
  const ownedBonus = intake.currentProducts.includes(active) ? 100 : 0;
  const goalFit = activeRelevanceScore(active, intake.goals) * 10;
  const gentleness = 3 - IRRITATION_RANK[ACTIVES[active].baseIrritation];
  return ownedBonus + goalFit + gentleness;
}

export function applyIntakePreferences(
  routine: Routine,
  intake: IntakeResponse,
): { routine: Routine; adjustments: SafetyAdjustment[] } {
  const output = clone(routine);
  const adjustments: SafetyAdjustment[] = [];

  if (intake.skinType) {
    for (const step of [...output.am, ...output.pm]) {
      const rationale = skinTypeRationale(intake.skinType, step.category);
      if (rationale) step.rationale = rationale;

      if (
        intake.skinType === "dry" &&
        step.active &&
        ACTIVES[step.active].isExfoliatingAcid &&
        step.frequencyPerWeek > 2
      ) {
        const was = step.frequencyPerWeek;
        step.frequencyPerWeek = 2;
        step.rampSchedule ??=
          "Start once weekly. Move to twice weekly only if your skin stays comfortable.";
        adjustments.push({
          rule: "skin_type_frequency_adjusted",
          action: "reduced_frequency",
          active: step.active,
          detail: `Lowered ${ACTIVES[step.active].label} from ${was}x to 2x/week because you said your skin usually feels dry.`,
        });
      }
    }
  }

  const complexity = intake.routineComplexity ?? "balanced";
  const cap = ACTIVE_CAP[complexity];
  const activeSteps = [...output.am, ...output.pm].filter(
    (step): step is RoutineStep & { active: ActiveKey } => !!step.active,
  );
  if (activeSteps.length > cap) {
    const keep = new Set(
      [...activeSteps]
        .sort(
          (a, b) =>
            activeRank(b.active, intake) - activeRank(a.active, intake) ||
            a.order - b.order,
        )
        .slice(0, cap),
    );
    for (const period of ["am", "pm"] as const) {
      output[period] = output[period].filter((step) => {
        if (
          !step.active ||
          keep.has(step as RoutineStep & { active: ActiveKey })
        )
          return true;
        adjustments.push({
          rule: "routine_preference_cap",
          action: "removed",
          active: step.active,
          time: period === "am" ? "AM" : "PM",
          detail: `Removed ${ACTIVES[step.active].label} to keep this a ${complexity} routine, as requested.`,
        });
        return false;
      });
    }
  }

  if (intake.fragrancePreference === "fragrance_free") {
    appendNote(
      output.notes,
      "Choose fragrance-free versions of every step because you listed fragrance as a known reaction.",
    );
  }
  if (intake.allergyNotes?.trim()) {
    appendNote(
      output.notes,
      `You also listed: ${intake.allergyNotes.trim()}. Pore cannot automatically verify this restriction, so check every product label and confirm severe allergies with a qualified professional.`,
    );
  }

  appendNote(
    output.notes,
    intake.age < 25
      ? "Your age is used as context only. Pore will not add age-based treatment unless it also matches your stated goal or a clear scan finding."
      : "Your age is used as context only. Pore targets your stated goals and visible scan findings, not assumptions about what skin should look like at your age.",
  );

  renumber(output);
  return { routine: output, adjustments };
}
