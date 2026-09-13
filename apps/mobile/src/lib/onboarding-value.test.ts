import { describe, expect, it } from "vitest";

import type {
  Assessment,
  ConcernFinding,
  Routine,
  RoutineStep,
  SkinGoal,
} from "@pore/shared";

import type { PlanResult } from "./api";
import { GOAL_LABELS } from "./labels";
import { buildOnboardingValueModel } from "./onboarding-value";
import type { OnboardingData } from "@/state/onboarding";

const NOW = new Date(2026, 6, 17, 10, 30, 0);

function step(
  order: number,
  category: RoutineStep["category"],
  active?: RoutineStep["active"],
  frequencyPerWeek = 7,
): RoutineStep {
  return {
    order,
    category,
    ...(active ? { active } : {}),
    frequencyPerWeek,
    rationale: "Test routine step.",
    irritationRisk: active === "retinoid" ? "high" : "low",
  };
}

function assessment(patch: Partial<Assessment> = {}): Assessment {
  return {
    findings: [],
    escalation: { recommendProfessional: false, reasons: [] },
    summary: "A cosmetic appearance summary.",
    disclaimer: "Cosmetic guidance only, not a diagnosis.",
    ...patch,
  };
}

function plan(
  scanId = "scan-current",
  routine: Routine = { am: [], pm: [], notes: [] },
  assessmentPatch: Partial<Assessment> = {},
): PlanResult {
  return {
    mode: "ai",
    scanId,
    routine,
    adjustments: [],
    assessment: assessment(assessmentPatch),
  };
}

function completeAnswers(patch: Partial<OnboardingData> = {}): OnboardingData {
  return {
    age: 34,
    goals: ["acne"],
    primaryGoal: "acne",
    goalChoiceIds: ["acne"],
    skinType: "combination",
    skinTypeChoiceId: "combination",
    routineComplexity: "balanced",
    sensitivity: "medium",
    sensitivityChoiceId: "sometimes",
    pregnancyOrBreastfeeding: false,
    usingPrescriptionSkincare: false,
    allergies: [],
    currentProducts: [],
    ...patch,
  };
}

function analyzedProfile(
  patch: Partial<OnboardingData> = {},
  assessmentPatch: Partial<Assessment> = {},
  routine?: Routine,
): OnboardingData {
  const scanId = "scan-current";
  return completeAnswers({
    plan: plan(scanId, routine, assessmentPatch),
    scannedAt: "2026-07-17T14:00:00.000Z",
    analysisStatus: {
      kind: "scan_analyzed",
      scanId,
      analyzedAt: "2026-07-17T14:00:00.000Z",
    },
    ...patch,
  });
}

describe("buildOnboardingValueModel goal path", () => {
  const goals: SkinGoal[] = [
    "acne",
    "post_acne_marks",
    "hyperpigmentation",
    "oiliness",
    "dryness",
    "texture",
    "redness",
    "fine_lines",
    "general_health",
  ];

  it.each(goals)("builds a personalized, answer-based path for %s", (goal) => {
    const model = buildOnboardingValueModel(
      completeAnswers({ goals: [goal], primaryGoal: goal, goalChoiceIds: undefined }),
      NOW,
    );

    expect(model.source.label).toBe("Answers");
    expect(model.goalHero.focus).toBe(GOAL_LABELS[goal]);
    expect(model.goalHero.title).not.toBe("");
    expect(model.priorities[0]).toMatchObject({
      title: GOAL_LABELS[goal],
      evidence: "answers",
    });
    expect(model.actions).toHaveLength(3);
  });

  it("uses the user's visual ranked choices without splitting one choice into duplicate goals", () => {
    const model = buildOnboardingValueModel(
      completeAnswers({
        goals: ["post_acne_marks", "hyperpigmentation", "texture"],
        primaryGoal: "post_acne_marks",
        goalChoiceIds: ["marks", "texture"],
      }),
      NOW,
    );

    expect(model.goalHero.focus).toBe("Dark spots & acne marks");
    expect(model.goalHero.supporting).toEqual(["Texture & clogged pores"]);
    expect(model.priorities.map((item) => item.title)).toEqual([
      "Dark spots & acne marks",
      "Texture & clogged pores",
    ]);
  });
});

describe("buildOnboardingValueModel evidence gates", () => {
  const finding: ConcernFinding = {
    concern: "acne_like_breakouts",
    present: true,
    appearanceLevel: "moderate",
    confidence: 0.84,
    contributingFactors: ["visible surface patterns"],
    regions: ["forehead", "cheeks"],
    regionDetail: [
      { region: "forehead", appearanceLevel: "moderate" },
      { region: "cheeks", appearanceLevel: "mild" },
    ],
    observedInPoses: ["front", "right", "left"],
  };

  it("shows confidence and broad regions only for a current validated scan", () => {
    const current = analyzedProfile({}, { findings: [finding] });
    const model = buildOnboardingValueModel(current, NOW);

    expect(model.source.label).toBe("Scan + answers");
    expect(model.priorities[0]).toMatchObject({
      evidence: "scan",
      confidence: "high",
      regions: ["forehead", "cheeks"],
    });

    const mismatched = {
      ...current,
      analysisStatus: {
        kind: "scan_analyzed" as const,
        scanId: "scan-different",
        analyzedAt: "2026-07-17T15:00:00.000Z",
      },
    };
    const fallback = buildOnboardingValueModel(mismatched, NOW);
    expect(fallback.source.label).toBe("Answers");
    expect(fallback.priorities[0].evidence).toBe("answers");
    expect(fallback.priorities[0]).not.toHaveProperty("confidence");
    expect(fallback.priorities[0]).not.toHaveProperty("regions");
    expect(fallback.priorities[0]).not.toHaveProperty("appearanceLabel");
  });

  it("hides stale scan claims after a plan-affecting edit and rebuilds from answers", () => {
    const stale = analyzedProfile(
      {
        goals: ["dryness"],
        primaryGoal: "dryness",
        goalChoiceIds: ["dry"],
        profileRevision: 2,
        planProfileRevision: 1,
      },
      { findings: [finding] },
      {
        am: [],
        pm: [step(1, "treatment", "retinoid")],
        notes: [],
      },
    );
    const model = buildOnboardingValueModel(stale, NOW);
    const shown = JSON.stringify(model);

    expect(model.source).toMatchObject({
      kind: "answers",
      staleScan: true,
      rescanRecommended: true,
    });
    expect(model.goalHero.focus).toBe("Dryness & irritation");
    expect(model.priorities[0].evidence).toBe("answers");
    expect(shown).not.toContain("Visible surface patterns");
    expect(model.dailyPlan.activeGuidance.map((item) => item.label)).not.toContain(
      "Retinoid / retinol",
    );
  });
});

describe("buildOnboardingValueModel routine and safety", () => {
  it("derives tiles from the final safety-adjusted routine", () => {
    const model = buildOnboardingValueModel(
      analyzedProfile(
        { pregnancyOrBreastfeeding: true },
        {},
        {
          am: [step(1, "cleanser")],
          pm: [step(1, "treatment", "retinoid", 7)],
          notes: [],
        },
      ),
      NOW,
    );

    expect(model.dailyPlan.activeGuidance.map((item) => item.label)).not.toContain(
      "Retinoid / retinol",
    );
    expect(model.dailyPlan.spf).toMatchObject({
      label: "SPF",
      frequency: "Daily",
    });
    expect(model.safetyHighlights.some((item) => item.id === "pregnancy")).toBe(
      true,
    );
  });

  it("preserves the final routine's real SPF frequency rather than inferring it from questionnaire products", () => {
    const model = buildOnboardingValueModel(
      analyzedProfile(
        { currentProducts: [] },
        {},
        {
          am: [step(1, "sunscreen", undefined, 3)],
          pm: [],
          notes: [],
        },
      ),
      NOW,
    );

    expect(model.dailyPlan.spf?.frequency).toBe("3x / week");
  });

  it("puts professional review first and suppresses active-forward messaging", () => {
    const model = buildOnboardingValueModel(
      analyzedProfile(
        {},
        {
          findings: [],
          escalation: {
            recommendProfessional: true,
            reasons: ["worth a professional look"],
          },
        },
        {
          am: [step(1, "serum", "vitamin_c")],
          pm: [step(1, "treatment", "retinoid")],
          notes: [],
        },
      ),
      NOW,
    );
    const forwardCopy = JSON.stringify({
      daily: model.dailyPlan,
      actions: model.actions,
      hero: model.goalHero,
    });

    expect(model.escalation).toBe(true);
    expect(model.dailyPlan.activeGuidance).toEqual([]);
    expect(model.actions[0].title).toContain("qualified professional");
    expect(model.safetyHighlights[0]).toMatchObject({
      id: "professional-review",
      tone: "escalate",
    });
    expect(forwardCopy).not.toContain("Retinoid / retinol");
    expect(forwardCopy).not.toContain("Vitamin C");
  });
});

describe("buildOnboardingValueModel checkpoints and review", () => {
  it("uses local calendar dates across a month boundary", () => {
    const now = new Date(2026, 0, 30, 23, 45, 0);
    const model = buildOnboardingValueModel(completeAnswers(), now);

    expect(model.checkpoints.map((item) => item.label)).toEqual([
      "Today",
      "Day 7",
      "Week 4",
    ]);
    expect(model.checkpoints.map((item) => item.dateKey)).toEqual([
      "2026-01-30",
      "2026-02-06",
      "2026-02-27",
    ]);
    expect(model.checkpoints[0].state).toBe("current");
    expect(model.checkpoints.slice(1).every((item) => item.state === "upcoming")).toBe(
      true,
    );
  });

  it("keeps milestones observational and includes every editable answer row", () => {
    const model = buildOnboardingValueModel(completeAnswers(), NOW);
    const checkpointCopy = JSON.stringify(model.checkpoints);

    expect(checkpointCopy).not.toMatch(/score|percentage|guarantee|predicted result/i);
    expect(model.answerRows.map((row) => row.screen)).toEqual([
      "age",
      "goal",
      "skin-profile",
      "sensitivity",
      "safety",
    ]);
    expect(model.comparisonRows.map((row) => row.id)).toEqual([
      "priorities",
      "safety",
      "progress",
    ]);
  });
});
