import { describe, expect, it } from "vitest";

import type { OnboardingData } from "@/state/onboarding";
import { nextRequiredOnboardingHref } from "./onboarding-flow";
import {
  createGuardianAuthorization,
  createTeenSelfConsent,
} from "./youth-consent";

function complete(): OnboardingData {
  return {
    age: 30,
    primaryGoal: "acne",
    goals: ["acne"],
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
    safetyChoiceIds: ["none"],
    analysisStatus: {
      kind: "answers_only",
      reason: "scan_skipped",
      attemptedAt: "2026-07-16T12:00:00.000Z",
    },
  };
}

describe("onboarding completion gate", () => {
  it("accepts every age 1-100 and applies only the matching youth guard", () => {
    for (let age = 1; age <= 12; age += 1) {
      expect(nextRequiredOnboardingHref({ age })).toBe(
        "/onboarding/age-restricted",
      );
    }
    for (let age = 13; age <= 15; age += 1) {
      expect(nextRequiredOnboardingHref({ age })).toBe(
        "/onboarding/parent-consent",
      );
      expect(
        nextRequiredOnboardingHref({
          age,
          guardianAuthorization: createGuardianAuthorization(age, {
            algorithm: "sha256",
            salt: "test-salt",
            digest: "test-digest",
          }),
        }),
      ).toBe("/onboarding/goal");
    }
    for (let age = 16; age <= 17; age += 1) {
      expect(nextRequiredOnboardingHref({ age })).toBe(
        "/onboarding/teen-consent",
      );
      expect(
        nextRequiredOnboardingHref({
          age,
          teenSelfConsent: createTeenSelfConsent(age),
        }),
      ).toBe("/onboarding/goal");
    }
    for (let age = 18; age <= 100; age += 1) {
      expect(nextRequiredOnboardingHref({ age })).toBe("/onboarding/goal");
    }
    expect(nextRequiredOnboardingHref({ age: 34 })).toBe("/onboarding/goal");
  });

  it("routes missing answers to their first required screen", () => {
    expect(nextRequiredOnboardingHref({})).toBe("/onboarding/age");
    expect(nextRequiredOnboardingHref({ age: 30 })).toBe("/onboarding/goal");
    expect(
      nextRequiredOnboardingHref({
        age: 30,
        primaryGoal: "acne",
        goals: ["acne"],
        goalChoiceIds: ["acne"],
      }),
    ).toBe("/onboarding/skin-profile");
  });

  it("requires a completed scan attempt or explicit answers-only path", () => {
    const data = complete();
    data.analysisStatus = undefined;
    expect(nextRequiredOnboardingHref(data)).toBe("/scan-flow?mode=onboarding");
  });

  it("allows the final handoff only after every required answer", () => {
    expect(nextRequiredOnboardingHref(complete())).toBeNull();
  });
});
