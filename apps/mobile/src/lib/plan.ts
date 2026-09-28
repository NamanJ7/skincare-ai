/**
 * Local plan helpers shared by the funnel preview and the Today screen, so both
 * show the *same* routine. When a server/AI plan exists in onboarding state we
 * use it; otherwise we run the deterministic safety engine over a deliberately
 * over-loaded draft so the engine visibly does its job offline.
 */
import {
  ACTIVES,
  activeRelevanceScore,
  applyIntakePreferences,
  applySafetyRules,
  applyUnverifiedEvidencePolicy,
  type ActiveKey,
  type IntakeResponse,
  type ProductCategory,
  type Routine,
  type RoutineStep,
  type SafetyAdjustment,
  type SkinGoal,
} from "@pore/shared";
import { isCurrentScanAnalysis } from "./analysis-status";
import { buildIntake } from "./intake";
import { isPlanCurrentForProfile } from "./profile-revision";
import { shiftKey, todayKey, type RoutineRevision } from "./log";
import type { UserProduct, UserProductCategory } from "./profile";
import { shelfVerdict } from "./shelf";
import type { OnboardingData } from "@/state/onboarding";

const GOAL_ACTIVES: Record<SkinGoal, readonly ActiveKey[]> = {
  acne: ["salicylic_acid", "benzoyl_peroxide", "azelaic_acid"],
  post_acne_marks: ["azelaic_acid", "niacinamide", "vitamin_c"],
  hyperpigmentation: ["vitamin_c", "azelaic_acid", "niacinamide"],
  oiliness: ["niacinamide", "salicylic_acid"],
  dryness: ["hyaluronic_acid", "ceramides"],
  texture: ["mandelic_acid", "retinoid"],
  redness: ["azelaic_acid", "niacinamide", "ceramides"],
  fine_lines: ["retinoid", "vitamin_c", "hyaluronic_acid"],
  general_health: ["niacinamide", "ceramides"],
};

const ACTIVE_COPY: Record<
  ActiveKey,
  { category: ProductCategory; period: "am" | "pm"; rationale: string }
> = {
  salicylic_acid: {
    category: "exfoliant",
    period: "pm",
    rationale:
      "Targets the breakout, oil, or clogged-pore priority you selected.",
  },
  glycolic_acid: {
    category: "exfoliant",
    period: "pm",
    rationale:
      "Supports a smoother-looking surface when texture is a stated priority.",
  },
  lactic_acid: {
    category: "exfoliant",
    period: "pm",
    rationale: "Offers a gentler texture-focused exfoliating step.",
  },
  mandelic_acid: {
    category: "exfoliant",
    period: "pm",
    rationale:
      "Adds a gradual texture-focused step without starting with the harshest acid.",
  },
  benzoyl_peroxide: {
    category: "spot_treatment",
    period: "pm",
    rationale:
      "Adds a focused step for the active-breakout priority you selected.",
  },
  azelaic_acid: {
    category: "treatment",
    period: "pm",
    rationale:
      "Supports the marks, uneven-tone, redness, or breakout priority you selected.",
  },
  niacinamide: {
    category: "serum",
    period: "am",
    rationale:
      "A gentle option for oil balance, visible tone, and barrier support.",
  },
  retinoid: {
    category: "treatment",
    period: "pm",
    rationale:
      "Supports the texture or fine-line priority you selected when introduced slowly.",
  },
  vitamin_c: {
    category: "serum",
    period: "am",
    rationale:
      "Supports the uneven-tone, mark, or fine-line priority you selected.",
  },
  hydroquinone: {
    category: "treatment",
    period: "pm",
    rationale: "Clinician-only step.",
  },
  hyaluronic_acid: {
    category: "serum",
    period: "am",
    rationale:
      "Adds hydration for the dryness or fine-line priority you selected.",
  },
  ceramides: {
    category: "serum",
    period: "pm",
    rationale:
      "Adds barrier support for the dryness, redness, or general-health priority you selected.",
  },
};

function candidateActives(intake: IntakeResponse): ActiveKey[] {
  const supportedCurrent = intake.currentProducts
    .filter((key): key is ActiveKey => key in ACTIVES)
    .filter((key) => activeRelevanceScore(key, intake.goals) > 0);
  const requested = intake.goals.flatMap((goal) => GOAL_ACTIVES[goal]);
  return [...supportedCurrent, ...requested].filter(
    (active, index, all) =>
      all.indexOf(active) === index &&
      !intake.allergies.includes(active) &&
      !(
        intake.pregnancyOrBreastfeeding &&
        ACTIVES[active].pregnancySafety === "avoid"
      ) &&
      !(intake.usingPrescriptionSkincare && ACTIVES[active].isStrongActive),
  );
}

/** Build an answer-driven local plan before the shared safety and preference rules run. */
export function draftRoutine(intake: IntakeResponse): Routine {
  const am: RoutineStep[] = [
    {
      order: 1,
      category: "cleanser",
      frequencyPerWeek: 7,
      rationale: "Start clean without stripping your skin.",
      irritationRisk: "low",
    },
  ];
  const pm: RoutineStep[] = [
    {
      order: 1,
      category: "cleanser",
      frequencyPerWeek: 7,
      rationale: "Remove the day's oil, sunscreen, and buildup.",
      irritationRisk: "low",
    },
  ];

  for (const active of candidateActives(intake).slice(0, 3)) {
    const copy = ACTIVE_COPY[active];
    const steps = copy.period === "am" ? am : pm;
    const strong = ACTIVES[active].isStrongActive;
    steps.push({
      order: steps.length + 1,
      category: copy.category,
      active,
      frequencyPerWeek: strong ? (intake.sensitivity === "high" ? 2 : 3) : 7,
      ...(strong
        ? {
            rampSchedule:
              "Start slowly and increase only if your skin stays comfortable.",
          }
        : {}),
      rationale: intake.currentProducts.includes(active)
        ? `You already use this active. ${copy.rationale}`
        : copy.rationale,
      irritationRisk: ACTIVES[active].baseIrritation,
    });
  }

  am.push(
    {
      order: am.length + 1,
      category: "moisturizer",
      frequencyPerWeek: 7,
      rationale: "Support your skin barrier and keep the routine comfortable.",
      irritationRisk: "low",
    },
    {
      order: am.length + 2,
      category: "sunscreen",
      frequencyPerWeek: 7,
      rationale:
        "Daily sunscreen protects the progress every other step is working toward.",
      irritationRisk: "low",
    },
  );
  pm.push({
    order: pm.length + 1,
    category: "moisturizer",
    frequencyPerWeek: 7,
    rationale: "Finish with barrier support so treatment steps stay tolerable.",
    irritationRisk: "low",
  });

  return {
    am,
    pm,
    notes: [
      "Patch-test one new active at a time before using it across your face.",
    ],
  };
}

export interface RoutineResult {
  routine: Routine;
  adjustments: SafetyAdjustment[];
  revision?: RoutineRevision;
}

export interface RoutineShelfAssignments {
  am: Array<UserProduct | undefined>;
  pm: Array<UserProduct | undefined>;
}

const STEP_CATEGORIES: Record<ProductCategory, readonly UserProductCategory[]> =
  {
    cleanser: ["cleanser"],
    moisturizer: ["moisturizer"],
    sunscreen: ["sunscreen"],
    serum: ["serum", "toner"],
    treatment: ["serum", "toner", "other"],
    exfoliant: ["toner", "serum", "other"],
    spot_treatment: ["serum", "other"],
  };

const MINIMUM_MODE_CATEGORIES: ReadonlySet<ProductCategory> = new Set([
  "cleanser",
  "moisturizer",
  "sunscreen",
]);

function shelfProductScore(
  product: UserProduct,
  step: RoutineStep,
): number | undefined {
  const actives = product.actives ?? [];
  // `step.category` and `step.active` come from the server plan, so neither is
  // guaranteed to exist in this build's maps.
  const categoryMatch = !!STEP_CATEGORIES[step.category]?.includes(
    product.category,
  );
  if (step.active) {
    if (!actives.includes(step.active)) return undefined;
    return 100 + (categoryMatch ? 20 : 0) + (product.catalogId ? 2 : 0);
  }
  if (!categoryMatch) return undefined;
  if (actives.some((active) => ACTIVES[active]?.isStrongActive))
    return undefined;
  return 20 + (product.catalogId ? 2 : 0);
}

/** Selects compatible products the user owns for each routine step. */
export function routineShelfAssignments(
  data: OnboardingData,
  routine: Routine,
): RoutineShelfAssignments {
  const intake = buildIntake(data);
  const eligible = (data.userProducts ?? []).filter((product) => {
    if (product.pausedAt) return false;
    const status = shelfVerdict(product, routine, intake).status;
    return status === "earned" || status === "careful";
  });

  const assign = (steps: RoutineStep[]) =>
    steps.map(
      (step) =>
        eligible
          .map((product, index) => ({
            product,
            index,
            score: shelfProductScore(product, step),
          }))
          .filter(
            (
              candidate,
            ): candidate is {
              product: UserProduct;
              index: number;
              score: number;
            } => candidate.score !== undefined,
          )
          .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.product,
    );

  return { am: assign(routine.am), pm: assign(routine.pm) };
}

/** A one-day change, except the irritation recovery pause which lasts 3 days. */
export function activeRoutineRevision(
  revision: RoutineRevision | undefined,
  today = todayKey(),
): RoutineRevision | undefined {
  if (
    !revision ||
    !["pause_strong_actives", "simplify_today", "small_win"].includes(
      revision.kind,
    ) ||
    typeof revision.effectiveDate !== "string" ||
    typeof revision.reason !== "string" ||
    today < revision.effectiveDate
  )
    return undefined;
  const lastDate =
    revision.kind === "pause_strong_actives"
      ? shiftKey(revision.effectiveDate, 2)
      : revision.effectiveDate;
  return today <= lastDate ? revision : undefined;
}

function applyRoutineRevision(
  routine: Routine,
  revision: RoutineRevision | undefined,
  today: string,
): { routine: Routine; revision?: RoutineRevision } {
  const active = activeRoutineRevision(revision, today);
  if (!active) return { routine };

  const isStrong = (step: RoutineStep) =>
    !!step.active && !!ACTIVES[step.active]?.isStrongActive;
  const renumber = (steps: RoutineStep[]) =>
    steps.map((step, index) => ({ ...step, order: index + 1 }));
  if (active.kind === "pause_strong_actives") {
    return {
      routine: {
        ...routine,
        am: renumber(routine.am.filter((step) => !isStrong(step))),
        pm: renumber(routine.pm.filter((step) => !isStrong(step))),
      },
      revision: active,
    };
  }

  const period = active.period ?? "pm";
  const current = routine[period];
  const revised =
    active.kind === "small_win"
      ? current.slice(0, 1)
      : current.filter((step) => MINIMUM_MODE_CATEGORIES.has(step.category));
  return {
    routine: {
      ...routine,
      [period]: renumber(revised.length > 0 ? revised : current.slice(0, 1)),
    },
    revision: active,
  };
}

/** Prefer the generated plan; otherwise clamp the local draft for this user. */
export function routineFor(
  data: OnboardingData,
  revision?: RoutineRevision,
  today = todayKey(),
): RoutineResult {
  const intake = buildIntake(data);
  if (data.plan && isPlanCurrentForProfile(data)) {
    const latest = applySafetyRules(data.plan.routine, intake);
    const personalized = applyIntakePreferences(latest.routine, intake);
    const adjustments = [
      ...data.plan.adjustments,
      ...latest.adjustments,
      ...personalized.adjustments,
    ].filter(
      (adjustment, index, all) =>
        all.findIndex((candidate) => candidate.detail === adjustment.detail) ===
        index,
    );
    return {
      ...applyRoutineRevision(personalized.routine, revision, today),
      adjustments,
    };
  }
  // Answers-only. `draftRoutine` picks actives from stated goals, so without a
  // current scan the evidence policy has nothing to check them against — the
  // unverified-evidence rule is the same "no active without a visible finding"
  // guarantee applied when there is no assessment to consult. Without it this
  // branch was strictly more permissive than a successful scan.
  const clamped = applySafetyRules(draftRoutine(intake), intake);
  const evidenceBound = applyUnverifiedEvidencePolicy(clamped.routine);
  const personalized = applyIntakePreferences(evidenceBound.routine, intake);
  return {
    ...applyRoutineRevision(personalized.routine, revision, today),
    adjustments: [
      ...clamped.adjustments,
      ...evidenceBound.adjustments,
      ...personalized.adjustments,
    ],
  };
}

/**
 * Honest one-line attribution for the routine screen. Never implies the photos
 * were analyzed unless a *current* scan analysis backs the plan; a routine kept
 * from a prior scan (e.g. after a failed rescan) is dated to that scan.
 */
export function routineSourceNote(data: OnboardingData): string {
  if (isCurrentScanAnalysis(data)) return "Based on your scan and answers.";
  if (
    data.plan?.assessment &&
    data.scannedAt &&
    isPlanCurrentForProfile(data)
  ) {
    const when = new Date(data.scannedAt).toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
    });
    return `Based on your last scan on ${when} and your answers.`;
  }
  return "Based on your answers. Add a clear scan to sharpen this.";
}
