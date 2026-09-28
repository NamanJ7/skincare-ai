import { describe, expect, it } from "vitest";

import type { Assessment } from "@pore/shared";

import type { PlanResult } from "./api";
import { answerRows, editHint } from "./profile-rows";
import type { OnboardingData } from "@/state/onboarding";

function plan(): PlanResult {
  const assessment: Assessment = {
    findings: [],
    escalation: { recommendProfessional: false, reasons: [] },
    summary: "",
    disclaimer: "",
  };
  return { mode: "ai", routine: { am: [], pm: [], notes: [] }, adjustments: [], assessment };
}

describe("answerRows", () => {
  it("offers only the five retained answer screens", () => {
    const rows = answerRows({});
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.screen)).toEqual([
      "age",
      "goal",
      "skin-profile",
      "sensitivity",
      "safety",
    ]);
  });

  it("falls back to honest empty values for unanswered questions", () => {
    const values = Object.fromEntries(answerRows({}).map((r) => [r.label, r.value]));
    expect(values["Age"]).toBe("Not answered");
    expect(values["Priorities"]).toBe("Not answered");
    expect(values["Skin & routine"]).toContain("not answered");
    expect(values["Safety & current treatments"]).toBe("Nothing flagged");
  });

  it("shows the primary goal and the safety decisions that are in force", () => {
    const data: OnboardingData = {
      age: 17,
      goals: ["texture", "acne"],
      primaryGoal: "acne",
      goalChoiceIds: ["acne", "texture"],
      skinType: "combination",
      skinTypeChoiceId: "combination",
      routineComplexity: "balanced",
      pregnancyOrBreastfeeding: true,
      usingPrescriptionSkincare: true,
      allergies: ["fragrance"],
      currentProducts: ["retinoid"],
    };
    const values = Object.fromEntries(answerRows(data).map((r) => [r.label, r.value]));
    expect(values["Age"]).toBe("17 years old");
    expect(values["Priorities"]).toBe("Active breakouts → Texture & clogged pores");
    expect(values["Skin & routine"]).toBe("Combination · balanced routine");
    expect(values["Safety & current treatments"]).toContain("Pregnancy-safe mode");
    expect(values["Safety & current treatments"]).toContain("Prescription skincare");
    expect(values["Safety & current treatments"]).toContain("Retinoid / retinol");
  });
});

describe("editHint", () => {
  it("tells plan-backed users their saved plan needs a re-scan to rebuild", () => {
    const hint = editHint({ plan: plan(), scannedAt: "2026-07-10T12:00:00.000Z" });
    expect(hint.kind).toBe("plan-stale");
    expect(hint.rescan).toBe(true);
    expect(hint.text).toContain("Re-scan or retake the questionnaire");
    // Never claims the saved plan auto-updates.
    expect(hint.text).not.toMatch(/automatically/i);
  });

  it("handles a plan with no scannedAt date", () => {
    const hint = editHint({ plan: plan() });
    expect(hint.kind).toBe("plan-stale");
    expect(hint.text).toContain("your last scan");
  });

  it("tells answers-only users the routine re-adjusts automatically", () => {
    const hint = editHint({});
    expect(hint.kind).toBe("auto");
    expect(hint.rescan).toBe(false);
    expect(hint.text).toContain("automatically");
  });
});
