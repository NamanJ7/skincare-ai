import { describe, expect, it } from "vitest";

import type { Assessment } from "@pore/shared";

import type { PlanResult } from "./api";
import { planProvenance, provenanceLine } from "./provenance";
import type { OnboardingData } from "@/state/onboarding";

const AT = "2026-07-11T00:00:00.000Z";

function plan(scanId: string): PlanResult {
  const assessment: Assessment = {
    findings: [],
    escalation: { recommendProfessional: false, reasons: [] },
    summary: "",
    disclaimer: "",
  };
  return { mode: "ai", routine: { am: [], pm: [], notes: [] }, adjustments: [], assessment, scanId };
}

/** A funnel completed with the minimum inputs (safety screen left empty). */
const ANSWERED: OnboardingData = {
  age: 18,
  primaryGoal: "acne",
  sensitivity: "medium",
  pregnancyOrBreastfeeding: false,
  usingPrescriptionSkincare: false,
  allergies: [],
  currentProducts: [],
};

describe("planProvenance", () => {
  it("counts nothing on an empty profile", () => {
    expect(planProvenance({})).toEqual({ answers: 0, photos: 0, fromScan: false });
  });

  it("counts a completed answers-only funnel — 'no' safety answers still count", () => {
    expect(planProvenance(ANSWERED)).toEqual({ answers: 5, photos: 0, fromScan: false });
  });

  it("adds one answer per allergy and current-product chip", () => {
    const p = planProvenance({
      ...ANSWERED,
      allergies: ["fragrance", "retinoid"],
      currentProducts: ["niacinamide"],
    });
    expect(p.answers).toBe(8);
  });

  it("counts scan photos only when the current attempt was analyzed", () => {
    const p = planProvenance({
      ...ANSWERED,
      plan: plan("scan-1"),
      analysisStatus: { kind: "scan_analyzed", scanId: "scan-1", analyzedAt: AT },
    });
    expect(p).toEqual({ answers: 5, photos: 3, fromScan: true });
  });

  it("claims no photos for a stale plan from a prior scan", () => {
    const p = planProvenance({
      ...ANSWERED,
      plan: plan("scan-1"),
      scannedAt: AT,
      analysisStatus: { kind: "answers_only", reason: "analysis_failed", attemptedAt: AT },
    });
    expect(p.photos).toBe(0);
    expect(p.fromScan).toBe(false);
  });
});

describe("provenanceLine", () => {
  it("mentions photos only when there are some", () => {
    expect(provenanceLine({ answers: 5, photos: 0, fromScan: false })).toBe("your 5 answers");
    expect(provenanceLine({ answers: 7, photos: 3, fromScan: true })).toBe(
      "your 7 answers and 3 scan photos",
    );
  });

  it("handles singulars", () => {
    expect(provenanceLine({ answers: 1, photos: 0, fromScan: false })).toBe("your 1 answer");
  });
});
