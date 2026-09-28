import { describe, expect, it } from "vitest";

import {
  coreQuestionnaireComplete,
  onboardingHrefForStep,
  requiredOnboardingStep,
} from "./onboarding-readiness";
import type { OnboardingData } from "@/state/onboarding";

function completeData(overrides: OnboardingData = {}): OnboardingData {
  return {
    age: 28,
    goals: ["dryness"],
    primaryGoal: "dryness",
    goalChoiceIds: ["dryness"],
    skinType: "dry",
    skinTypeChoiceId: "dry",
    routineComplexity: "minimal",
    sensitivity: "low",
    sensitivityChoiceId: "rarely",
    pregnancyOrBreastfeeding: false,
    usingPrescriptionSkincare: false,
    allergies: [],
    currentProducts: [],
    safetyChoiceIds: ["none"],
    analysisStatus: {
      kind: "answers_only",
      reason: "scan_skipped",
      attemptedAt: "2026-07-16T12:00:00.000Z",
    },
    onboardingComplete: true,
    ...overrides,
  };
}

describe("requiredOnboardingStep", () => {
  it("returns the first unanswered step instead of allowing a result", () => {
    expect(requiredOnboardingStep({})).toBe("age");
    expect(requiredOnboardingStep(completeData({ goals: [] }))).toBe("goal");
    expect(
      requiredOnboardingStep(
        completeData({ skinType: undefined, skinTypeChoiceId: undefined }),
      ),
    ).toBe("skin-profile");
    expect(
      requiredOnboardingStep(completeData({ sensitivityChoiceId: undefined })),
    ).toBe("sensitivity");
    expect(
      requiredOnboardingStep(completeData({ safetyChoiceIds: undefined })),
    ).toBe("safety");
  });

  it("requires a real scan decision and persisted completion", () => {
    expect(
      requiredOnboardingStep(
        completeData({
          analysisStatus: undefined,
          plan: undefined,
          onboardingComplete: false,
        }),
      ),
    ).toBe("scan");
    expect(
      requiredOnboardingStep(completeData({ onboardingComplete: false })),
    ).toBe("preview");
    expect(requiredOnboardingStep(completeData())).toBeNull();
  });

  it("maps scan separately from questionnaire routes", () => {
    expect(onboardingHrefForStep("scan")).toBe("/scan-flow?mode=onboarding");
    expect(onboardingHrefForStep("goal")).toBe("/onboarding/goal");
  });
});

describe("coreQuestionnaireComplete", () => {
  it("ignores scan and completion state but not missing user answers", () => {
    expect(
      coreQuestionnaireComplete(
        completeData({
          analysisStatus: undefined,
          plan: undefined,
          onboardingComplete: false,
        }),
      ),
    ).toBe(true);
    expect(
      coreQuestionnaireComplete(
        completeData({
          safetyChoiceIds: undefined,
          analysisStatus: undefined,
          onboardingComplete: false,
        }),
      ),
    ).toBe(false);
  });
});
