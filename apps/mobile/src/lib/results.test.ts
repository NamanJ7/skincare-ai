import { describe, expect, it } from "vitest";

import { darkColors } from "@pore/shared";
import type {
  ActiveKey,
  Assessment,
  ConcernFinding,
  ConcernKey,
  ProductCategory,
  Routine,
  RoutineStep,
} from "@pore/shared";

import type { AnalysisStatus } from "./analysis-status";
import { routineFor } from "./plan";
import type { ScanHistory, ScanRecord } from "./scan-history";
import type { OnboardingData } from "@/state/onboarding";
import {
  buildResults,
  canOfferGuidedScan,
  confidenceBand,
  currentScanDate,
  currentScanFrontPhotoName,
  observedRegions,
  regionsByAppearance,
  rankFindings,
  regionSummary,
  routinePeriodForSupport,
  routineSupportForConcern,
  scanResultsFromAssessment,
} from "./results";

function finding(patch: Partial<ConcernFinding> = {}): ConcernFinding {
  return {
    concern: "acne_like_breakouts",
    present: true,
    appearanceLevel: "moderate",
    confidence: 0.8,
    contributingFactors: [],
    regions: [],
    regionDetail: [],
    observedInPoses: ["front", "right", "left"],
    ...patch,
  };
}

function assessment(patch: Partial<Assessment> = {}): Assessment {
  return {
    findings: [],
    escalation: { recommendProfessional: false, reasons: [] },
    summary: "Your skin looks balanced overall.",
    disclaimer: "Cosmetic guidance only.",
    ...patch,
  };
}

function profile(patch: Partial<OnboardingData> = {}): OnboardingData {
  return {
    goals: ["acne", "post_acne_marks"],
    primaryGoal: "post_acne_marks",
    ...patch,
  };
}

/** A profile whose current status is a valid, matching scan analysis. */
function analyzedProfile(
  assessmentPatch: Partial<Assessment> = {},
  scanId = "scan-1",
): OnboardingData {
  const analyzedAt = "2026-07-11T00:00:00.000Z";
  return profile({
    plan: {
      mode: "ai",
      routine: { am: [], pm: [], notes: [] },
      adjustments: [],
      assessment: assessment(assessmentPatch),
      scanId,
    },
    scannedAt: analyzedAt,
    analysisStatus: { kind: "scan_analyzed", scanId, analyzedAt },
  });
}

function step(
  order: number,
  category: ProductCategory,
  active?: ActiveKey,
): RoutineStep {
  return {
    order,
    category,
    active,
    frequencyPerWeek: 7,
    rationale: "Test support step.",
    irritationRisk: "low",
  };
}

function scanRecord(
  patch: Partial<ScanRecord> & { createdAt: string },
): ScanRecord {
  return {
    date: "2026-07-11",
    photoNames: [],
    ...patch,
  };
}

function scanHistory(...scans: ScanRecord[]): ScanHistory {
  return { scans };
}

describe("confidenceBand", () => {
  it("bands by threshold", () => {
    expect(confidenceBand(0.9)).toBe("high");
    expect(confidenceBand(0.55)).toBe("moderate");
    expect(confidenceBand(0.2)).toBe("low");
  });
});

describe("regionSummary", () => {
  it("returns undefined with no regions", () => {
    expect(regionSummary([])).toBeUndefined();
  });
  it("reads one region", () => {
    expect(regionSummary(["forehead"])).toBe(
      "Most visible around your forehead.",
    );
  });
  it("joins multiple regions", () => {
    expect(regionSummary(["forehead", "cheeks", "chin"])).toBe(
      "Most visible around your forehead, cheeks and chin.",
    );
  });

  it("canonicalizes safe aliases, deduplicates, and ignores arbitrary detail", () => {
    expect(
      observedRegions([
        " Cheeks ",
        "under eye",
        "under-eye area",
        "nose",
        "nose",
        "left cheek near nose",
      ]),
    ).toEqual(["cheeks", "under-eye", "nose"]);
    expect(regionSummary(["under eye", "around mouth"])).toBe(
      "Most visible around your under-eye area and mouth area.",
    );
    expect(regionSummary(["left cheek near nose"])).toBeUndefined();
  });
});

describe("regionsByAppearance", () => {
  it("leads with the area the concern is most visible in", () => {
    // "Most visible around your chin and forehead" is only honest if the list
    // is actually ordered by how visible it was.
    expect(
      regionsByAppearance(
        [
          { region: "forehead", appearanceLevel: "mild" },
          { region: "chin", appearanceLevel: "noticeable" },
          { region: "cheeks", appearanceLevel: "moderate" },
        ],
        [],
      ),
    ).toEqual(["chin", "cheeks", "forehead"]);
  });

  it("falls back to the flat list when a stored plan has no per-region reading", () => {
    expect(regionsByAppearance([], ["cheeks", "forehead"])).toEqual([
      "cheeks",
      "forehead",
    ]);
  });

  it("still refuses region detail it cannot narrow to a broad area", () => {
    expect(
      regionsByAppearance(
        [{ region: "left cheek near nose", appearanceLevel: "moderate" }],
        [],
      ),
    ).toEqual([]);
  });
});

describe("rankFindings", () => {
  it("drops absent and none-level findings", () => {
    const ranked = rankFindings([
      finding({ present: false }),
      finding({ appearanceLevel: "none" }),
      finding({ concern: "redness_appearance" }),
    ]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].concern).toBe("redness_appearance");
  });

  it("orders by appearance, then confidence", () => {
    const ranked = rankFindings([
      finding({
        concern: "oiliness",
        appearanceLevel: "mild",
        confidence: 0.9,
      }),
      finding({
        concern: "redness_appearance",
        appearanceLevel: "noticeable",
        confidence: 0.5,
      }),
      finding({
        concern: "uneven_tone",
        appearanceLevel: "moderate",
        confidence: 0.6,
      }),
    ]);
    expect(ranked.map((f) => f.concern)).toEqual([
      "redness_appearance",
      "uneven_tone",
      "oiliness",
    ]);
  });
});

describe("buildResults from a scan", () => {
  it("resolves result tones from the supplied runtime theme", () => {
    const view = buildResults(
      analyzedProfile({
        findings: [
          finding({ appearanceLevel: "noticeable" }),
          finding({ concern: "oiliness", appearanceLevel: "moderate" }),
          finding({ concern: "dryness_flaking", appearanceLevel: "mild" }),
        ],
      }),
      darkColors,
    );

    expect(view.priorities.map((priority) => priority.tone)).toEqual([
      darkColors.warning,
      darkColors.info,
      darkColors.success,
    ]);
    expect(buildResults(profile(), darkColors).priorities[0]?.tone).toBe(
      darkColors.info,
    );
  });

  it("keeps the top 3 priorities with confidence + outlook", () => {
    const view = buildResults(
      analyzedProfile({
        findings: [
          finding({
            concern: "dark_spot_appearance",
            appearanceLevel: "noticeable",
            confidence: 0.82,
            contributingFactors: ["past breakouts", "sun exposure"],
            regions: ["cheeks"],
          }),
          finding({
            concern: "acne_like_breakouts",
            appearanceLevel: "mild",
            confidence: 0.7,
          }),
          finding({
            concern: "oiliness",
            appearanceLevel: "mild",
            confidence: 0.6,
          }),
          finding({
            concern: "redness_appearance",
            appearanceLevel: "mild",
            confidence: 0.55,
          }),
        ],
      }),
    );
    expect(view.source).toBe("scan");
    expect(view.priorities).toHaveLength(3);
    expect(view.priorities[0].concern).toBe("dark_spot_appearance");
    expect(view.priorities[0].confidence).toBe("high");
    expect(view.priorities[0].confidenceLabel).toBe("Fairly clear read.");
    expect(view.priorities[0].appearanceLabel).toBe(
      "More noticeable appearance",
    );
    expect(view.priorities[0].why).toContain("Past breakouts");
    expect(view.priorities[0].observedRegions).toEqual(["cheeks"]);
    expect(view.priorities[0].where).toBe("Most visible around your cheeks.");
    expect(view.priorities[0].outlook.length).toBeGreaterThan(0);
  });

  it("flags a low-confidence read for a retake", () => {
    const view = buildResults(
      analyzedProfile({ findings: [finding({ confidence: 0.3 })] }),
    );
    expect(view.readNote).toContain("brighter");
    expect(view.priorities[0].confidenceLabel).toBe(
      "This read was harder to confirm.",
    );
  });

  it("uses uncertainty-safe copy when nothing is visibly prioritized", () => {
    const view = buildResults(
      analyzedProfile({ findings: [finding({ appearanceLevel: "none" })] }),
    );
    expect(view.priorities).toHaveLength(0);
    expect(view.readNote).toContain("didn't find a clear cosmetic priority");
    expect(view.readNote).not.toContain("good shape");
  });

  it("always explains why a scan priority was included", () => {
    const view = buildResults(
      analyzedProfile({ findings: [finding({ contributingFactors: [] })] }),
    );
    expect(view.priorities[0].why).toContain("Pore noticed");
  });

  it("passes escalation through", () => {
    const view = buildResults(
      analyzedProfile({
        escalation: {
          recommendProfessional: true,
          reasons: ["appears painful"],
        },
      }),
    );
    expect(view.escalate).toBe(true);
    expect(view.reasons).toContain("appears painful");
  });

  it("honors legacy profiles (plan + scannedAt, no analysisStatus)", () => {
    const view = buildResults(
      profile({
        plan: {
          mode: "ai",
          routine: { am: [], pm: [], notes: [] },
          adjustments: [],
          assessment: assessment({ findings: [finding()] }),
        },
        scannedAt: "2026-07-01T00:00:00.000Z",
      }),
    );
    expect(view.source).toBe("scan");
  });
});

describe("buildResults stale-plan prevention", () => {
  it("does NOT show a plan whose scanId doesn't match the current status", () => {
    // A rescan failed: the prior plan (scan-1) is kept, but the current status is
    // an answer-based failure. The old assessment must not render as current.
    const stale = analyzedProfile({ findings: [finding()] }, "scan-1");
    const failedRescan: OnboardingData = {
      ...stale,
      analysisStatus: {
        kind: "answers_only",
        reason: "analysis_failed",
        attemptedAt: "2026-07-11T09:00:00.000Z",
      } satisfies AnalysisStatus,
    };
    const view = buildResults(failedRescan);
    expect(view.source).toBe("answers");
    // Priorities come from the questionnaire goals, not the stale assessment.
    expect(view.priorities[0].title).toBe("Post-acne marks");
  });

  it("does NOT treat a mismatched scanId as current even when status is scan_analyzed", () => {
    const mismatched = analyzedProfile({ findings: [finding()] }, "scan-1");
    mismatched.analysisStatus = {
      kind: "scan_analyzed",
      scanId: "scan-2",
      analyzedAt: "2026-07-11T00:00:00.000Z",
    };
    expect(buildResults(mismatched).source).toBe("answers");
  });
});

describe("buildResults answer-only copy by failure reason", () => {
  it("falls back to goal-based priorities, primary first (skipped)", () => {
    const view = buildResults(profile());
    expect(view.source).toBe("answers");
    expect(view.priorities[0].title).toBe("Post-acne marks");
    expect(view.priorities[0].observedRegions).toEqual([]);
    expect(view.priorities[0].appearanceLabel).toBeUndefined();
    expect(view.priorities[0].confidence).toBeUndefined();
    expect(view.priorities[0].confidenceLabel).toBeUndefined();
    expect(view.priorities[0].where).toBeUndefined();
    expect(view.readNote).toContain("guided scan");
    expect(view.disclaimer).toContain("questionnaire answers");
    expect(view.disclaimer).not.toContain("photos");
  });

  it("explains a quality failure", () => {
    const view = buildResults(
      profile({
        analysisStatus: {
          kind: "answers_only",
          reason: "quality_failed",
          attemptedAt: "2026-07-11T00:00:00.000Z",
        },
      }),
    );
    expect(view.source).toBe("answers");
    expect(view.readNote).toContain("quality checks");
  });

  it("explains an unconfigured backend", () => {
    const data = profile({
      analysisStatus: {
        kind: "answers_only",
        reason: "analysis_unconfigured",
        attemptedAt: "2026-07-11T00:00:00.000Z",
      },
    });
    const view = buildResults(data);
    expect(view.readNote).toContain("connected in this build");
    expect(canOfferGuidedScan(data)).toBe(false);
  });

  it("explains a failed analysis", () => {
    const view = buildResults(
      profile({
        analysisStatus: {
          kind: "answers_only",
          reason: "analysis_failed",
          attemptedAt: "2026-07-11T00:00:00.000Z",
        },
      }),
    );
    expect(view.readNote).toContain("couldn't complete scan analysis");
  });

  it("explains a timeout", () => {
    const data = profile({
      analysisStatus: {
        kind: "answers_only",
        reason: "analysis_timeout",
        attemptedAt: "2026-07-11T00:00:00.000Z",
      },
    });
    const view = buildResults(data);
    expect(view.readNote).toContain("too long");
    expect(canOfferGuidedScan(data)).toBe(true);
  });
});

describe("routineSupportForConcern", () => {
  const cases: Array<{
    concern: ConcernKey;
    baseCategories: ProductCategory[];
    active: ActiveKey;
  }> = [
    {
      concern: "acne_like_breakouts",
      baseCategories: ["cleanser", "spot_treatment"],
      active: "benzoyl_peroxide",
    },
    {
      concern: "oiliness",
      baseCategories: ["cleanser", "moisturizer"],
      active: "salicylic_acid",
    },
    {
      concern: "dryness_flaking",
      baseCategories: ["cleanser", "moisturizer"],
      active: "hyaluronic_acid",
    },
    {
      concern: "texture_congestion",
      baseCategories: ["exfoliant"],
      active: "retinoid",
    },
    {
      concern: "uneven_tone",
      baseCategories: ["sunscreen"],
      active: "vitamin_c",
    },
    {
      concern: "dark_spot_appearance",
      baseCategories: ["sunscreen"],
      active: "azelaic_acid",
    },
    {
      concern: "redness_appearance",
      baseCategories: ["cleanser", "moisturizer"],
      active: "niacinamide",
    },
    {
      concern: "fine_line_appearance",
      baseCategories: ["moisturizer", "sunscreen"],
      active: "retinoid",
    },
    {
      concern: "irritation_signs",
      baseCategories: ["cleanser", "moisturizer"],
      active: "ceramides",
    },
  ];

  it.each(cases)(
    "maps $concern only to its base categories and approved actives",
    ({ concern, baseCategories, active }) => {
      const routine: Routine = {
        am: baseCategories.map((category, index) => step(index + 1, category)),
        pm: [
          step(1, "treatment", active),
          ...baseCategories.map((category, index) =>
            step(index + 2, category, "hydroquinone"),
          ),
        ],
        notes: [],
      };

      const support = routineSupportForConcern(concern, routine);
      expect(support.map((item) => item.step.category).slice(0, -1)).toEqual(
        baseCategories,
      );
      expect(support.at(-1)?.step.active).toBe(active);
      expect(support.every((item) => item.step.active !== "hydroquinone")).toBe(
        true,
      );
    },
  );

  it("preserves AM then PM order and uses period-qualified routine keys", () => {
    const routine: Routine = {
      am: [step(1, "cleanser"), step(2, "serum", "niacinamide")],
      pm: [step(1, "moisturizer"), step(2, "exfoliant", "salicylic_acid")],
      notes: [],
    };
    expect(
      routineSupportForConcern("oiliness", routine).map((item) => item.key),
    ).toEqual([
      "am:cleanser:base",
      "am:serum:niacinamide",
      "pm:moisturizer:base",
      "pm:exfoliant:salicylic_acid",
    ]);
  });

  it("does not match an unrelated active merely because its category matches", () => {
    const routine: Routine = {
      am: [step(1, "cleanser", "vitamin_c")],
      pm: [step(1, "moisturizer", "retinoid")],
      notes: [],
    };
    expect(routineSupportForConcern("oiliness", routine)).toEqual([]);
  });

  it("selects the preferred supported period, the other period, then the fallback", () => {
    const amOnly = routineSupportForConcern("uneven_tone", {
      am: [step(1, "sunscreen")],
      pm: [],
      notes: [],
    });
    expect(routinePeriodForSupport(amOnly, "pm")).toBe("am");

    const both = routineSupportForConcern("dryness_flaking", {
      am: [step(1, "moisturizer")],
      pm: [step(1, "cleanser")],
      notes: [],
    });
    expect(routinePeriodForSupport(both, "pm")).toBe("pm");
    expect(routinePeriodForSupport([], "pm")).toBe("pm");
  });

  it("never restores safety-removed or temporarily paused steps", () => {
    const generated = analyzedProfile({
      findings: [
        finding({
          concern: "fine_line_appearance",
          confidence: 0.9,
        }),
      ],
    });
    generated.goals = ["fine_lines"];
    generated.plan!.routine = {
      am: [],
      pm: [step(1, "treatment", "retinoid")],
      notes: [],
    };

    const safetyAdjusted = routineFor({
      ...generated,
      pregnancyOrBreastfeeding: true,
    }).routine;
    expect(
      routineSupportForConcern("fine_line_appearance", safetyAdjusted).some(
        (item) => item.step.active === "retinoid",
      ),
    ).toBe(false);

    const paused = routineFor(
      generated,
      {
        kind: "pause_strong_actives",
        acceptedAt: "2026-07-11T09:00:00.000Z",
        effectiveDate: "2026-07-11",
        period: "pm",
        reason: "Let your skin settle.",
      },
      "2026-07-11",
    ).routine;
    expect(
      routineSupportForConcern("fine_line_appearance", paused).some(
        (item) => item.step.active === "retinoid",
      ),
    ).toBe(false);
  });
});

describe("priority story copy", () => {
  const concerns: ConcernKey[] = [
    "acne_like_breakouts",
    "oiliness",
    "dryness_flaking",
    "texture_congestion",
    "uneven_tone",
    "dark_spot_appearance",
    "redness_appearance",
    "fine_line_appearance",
    "irritation_signs",
  ];

  it("gives every concern a calm, realistic timeframe", () => {
    for (const concern of concerns) {
      const view = scanResultsFromAssessment(
        assessment({ findings: [finding({ concern })] }),
      );
      expect(view.priorities[0].outlook).toMatch(/days|weeks|months/);
    }
  });

  it("uses non-medical appearance and plain-language confidence labels", () => {
    const subtle = scanResultsFromAssessment(
      assessment({
        findings: [finding({ appearanceLevel: "mild", confidence: 0.5 })],
      }),
    ).priorities[0];
    expect(subtle.appearanceLabel).toBe("Subtle appearance");
    expect(subtle.confidenceLabel).toBe("Some visual support.");
  });

  it("keeps a priority when the scan has no supported broad region", () => {
    const priority = scanResultsFromAssessment(
      assessment({
        findings: [finding({ regions: ["left cheek near nose"] })],
      }),
    ).priorities[0];
    expect(priority.observedRegions).toEqual([]);
    expect(priority.where).toBeUndefined();
    expect(priority.why.length).toBeGreaterThan(0);
  });
});

describe("currentScanFrontPhotoName", () => {
  it("returns only the front photo from the matching analyzed current scan", () => {
    const data = analyzedProfile({}, "scan-current");
    const currentAssessment = data.plan!.assessment;
    const history = scanHistory(
      scanRecord({
        createdAt: "2026-07-10T00:00:00.000Z",
        scanId: "scan-current",
        analyzed: true,
        assessment: currentAssessment,
        photoNames: ["10-right.jpg", "10-front.jpg"],
      }),
      scanRecord({
        createdAt: "2026-07-12T00:00:00.000Z",
        photoNames: ["12-front.jpg"],
      }),
    );
    expect(currentScanFrontPhotoName(data, history)).toBe("10-front.jpg");
  });

  it("does not use a side photo or a record missing analyzed assessment evidence", () => {
    const data = analyzedProfile({}, "scan-current");
    expect(
      currentScanFrontPhotoName(
        data,
        scanHistory(
          scanRecord({
            createdAt: "2026-07-11T00:00:00.000Z",
            scanId: "scan-current",
            analyzed: true,
            assessment: data.plan!.assessment,
            photoNames: ["11-right.jpg", "11-left.jpg"],
          }),
        ),
      ),
    ).toBeUndefined();
    expect(
      currentScanFrontPhotoName(
        data,
        scanHistory(
          scanRecord({
            createdAt: "2026-07-11T00:00:00.000Z",
            scanId: "scan-current",
            analyzed: true,
            photoNames: ["11-front.jpg"],
          }),
        ),
      ),
    ).toBeUndefined();
  });

  it("never exposes scan-photo evidence for answer-only failures or timeouts", () => {
    for (const reason of ["analysis_failed", "analysis_timeout"] as const) {
      const data = analyzedProfile({}, "scan-current");
      data.analysisStatus = {
        kind: "answers_only",
        reason,
        attemptedAt: "2026-07-12T00:00:00.000Z",
      };
      expect(
        currentScanFrontPhotoName(
          data,
          scanHistory(
            scanRecord({
              createdAt: "2026-07-11T00:00:00.000Z",
              scanId: "scan-current",
              analyzed: true,
              assessment: data.plan!.assessment,
              photoNames: ["11-front.jpg"],
            }),
          ),
        ),
      ).toBeUndefined();
    }
  });

  it("joins a legacy scan only by its exact successful timestamp", () => {
    const createdAt = "2026-07-01T00:00:00.000Z";
    const legacy = profile({
      plan: {
        mode: "ai",
        routine: { am: [], pm: [], notes: [] },
        adjustments: [],
        assessment: assessment(),
      },
      scannedAt: createdAt,
      analysisStatus: undefined,
    });
    const history = scanHistory(
      scanRecord({
        createdAt: "2026-06-30T00:00:00.000Z",
        photoNames: ["stale-front.jpg"],
      }),
      scanRecord({
        createdAt,
        photoNames: ["legacy-front.jpg"],
      }),
    );
    expect(currentScanFrontPhotoName(legacy, history)).toBe("legacy-front.jpg");

    legacy.scannedAt = "2026-07-02T00:00:00.000Z";
    expect(currentScanFrontPhotoName(legacy, history)).toBeUndefined();
  });
});

describe("currentScanDate", () => {
  it("uses the matching scan status date even when scannedAt is missing", () => {
    const data = analyzedProfile();
    delete data.scannedAt;
    expect(currentScanDate(data)?.toISOString()).toBe(
      "2026-07-11T00:00:00.000Z",
    );
  });

  it("does not expose a stale scan date for an answer-only failure", () => {
    const data = analyzedProfile();
    data.analysisStatus = {
      kind: "answers_only",
      reason: "analysis_failed",
      attemptedAt: "2026-07-12T00:00:00.000Z",
    };
    expect(currentScanDate(data)).toBeUndefined();
  });
});
