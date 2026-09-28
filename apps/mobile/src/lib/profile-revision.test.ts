import { describe, expect, it } from "vitest";

import type { PlanResult } from "./api";
import {
  changesPlanInputs,
  isPlanCurrentForProfile,
  nextProfileRevision,
} from "./profile-revision";
import type { OnboardingData } from "@/state/onboarding";

const plan = {
  mode: "ai",
  assessment: {
    findings: [],
    escalation: { recommendProfessional: false, reasons: [] },
    summary: "",
    disclaimer: "",
  },
  routine: { am: [], pm: [], notes: [] },
  adjustments: [],
} satisfies PlanResult;

describe("profile plan revisions", () => {
  it("increments only when a plan input really changes", () => {
    const current: OnboardingData = {
      goals: ["acne"],
      profileRevision: 2,
      onboardingComplete: true,
    };
    expect(changesPlanInputs(current, { onboardingComplete: false })).toBe(
      false,
    );
    expect(nextProfileRevision(current, { onboardingComplete: false })).toBe(
      2,
    );
    expect(nextProfileRevision(current, { goals: ["dryness"] })).toBe(3);
  });

  it("keeps a legacy plan current only until the first relevant edit", () => {
    expect(isPlanCurrentForProfile({ plan })).toBe(true);
    expect(isPlanCurrentForProfile({ plan, profileRevision: 1 })).toBe(false);
  });

  it("requires the generated plan revision to match current answers", () => {
    expect(
      isPlanCurrentForProfile({
        plan,
        profileRevision: 4,
        planProfileRevision: 4,
      }),
    ).toBe(true);
    expect(
      isPlanCurrentForProfile({
        plan,
        profileRevision: 5,
        planProfileRevision: 4,
      }),
    ).toBe(false);
  });
});

