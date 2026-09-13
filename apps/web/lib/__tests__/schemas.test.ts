/**
 * The wire schemas constrain the model; the normalizers constrain the data.
 *
 * These used to be one layer, and every rule lived in a `superRefine` that the
 * SDK stripped before sending and then re-ran client-side as a throw. The rules
 * therefore never shaped a single response — they only converted a stray value
 * into a total analysis failure. What follows asserts the split: the wire
 * schema still rejects the wrong *vocabulary*, and the normalizer resolves the
 * rest conservatively instead of discarding the scan.
 */
import { describe, expect, it } from "vitest";

import {
  AssessmentSchema,
  RoutineDraftSchema,
  normalizeAssessment,
  normalizeDraft,
  type AssessmentDraft,
  type RoutineDraft,
} from "../schemas";

const concerns = [
  "acne_like_breakouts", "oiliness", "dryness_flaking", "texture_congestion", "uneven_tone",
  "dark_spot_appearance", "redness_appearance", "fine_line_appearance", "irritation_signs",
] as const;

function assessment(): AssessmentDraft {
  return {
    findings: concerns.map((concern) => ({
      concern, present: false, appearanceLevel: "none" as const, confidence: 0.9,
      contributingFactors: [], regionDetail: [], observedInPoses: [],
    })),
    escalation: { recommendProfessional: false, reasons: [] },
    summary: "Clear", disclaimer: "Cosmetic guidance only.",
  };
}

const find = (value: ReturnType<typeof normalizeAssessment>, key: string) =>
  value.findings.find((finding) => finding.concern === key)!;

describe("assessment wire schema", () => {
  it("still rejects vocabulary the app cannot render", () => {
    const draft = assessment();
    expect(
      AssessmentSchema.safeParse({
        ...draft,
        findings: [
          {
            ...draft.findings[0]!,
            regionDetail: [{ region: "not-a-face-region", appearanceLevel: "mild" }],
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      AssessmentSchema.safeParse({
        ...draft,
        findings: [{ ...draft.findings[0]!, appearanceLevel: "severe" }],
      }).success,
    ).toBe(false);
    expect(
      AssessmentSchema.safeParse({
        ...draft,
        findings: [{ ...draft.findings[0]!, observedInPoses: ["rear"] }],
      }).success,
    ).toBe(false);
  });

  it("accepts a structurally valid response the old schema would have thrown on", () => {
    const draft = assessment();
    draft.findings.pop();
    draft.findings[0] = { ...draft.findings[0]!, confidence: 1.4 };
    expect(AssessmentSchema.safeParse(draft).success).toBe(true);
  });
});

describe("normalizeAssessment", () => {
  it("answers every concern exactly once, in a stable order", () => {
    const draft = assessment();
    draft.findings.splice(3, 2);
    const value = normalizeAssessment(draft);
    expect(value.findings).toHaveLength(concerns.length);
    expect(value.findings.map((finding) => finding.concern)).toEqual([...concerns]);
  });

  it("reports a missing concern as not visible rather than dropping it", () => {
    const draft = assessment();
    draft.findings = draft.findings.filter((f) => f.concern !== "oiliness");
    const oiliness = find(normalizeAssessment(draft), "oiliness");
    expect(oiliness).toMatchObject({ present: false, appearanceLevel: "none", confidence: 0 });
  });

  it("clamps an out-of-range confidence toward the cautious end", () => {
    const draft = assessment();
    draft.findings[0] = { ...draft.findings[0]!, confidence: 1.4 };
    draft.findings[1] = { ...draft.findings[1]!, confidence: -0.2 };
    draft.findings[2] = { ...draft.findings[2]!, confidence: Number.NaN };
    const value = normalizeAssessment(draft);
    expect(find(value, "acne_like_breakouts").confidence).toBe(1);
    expect(find(value, "oiliness").confidence).toBe(0);
    expect(find(value, "dryness_flaking").confidence).toBe(0);
  });

  it("keeps the most confident reading when a concern is repeated", () => {
    const draft = assessment();
    draft.findings.push({
      concern: "oiliness", present: true, appearanceLevel: "moderate",
      confidence: 0.95, contributingFactors: ["visible shine"],
      regionDetail: [{ region: "nose", appearanceLevel: "moderate" }],
      observedInPoses: ["front"],
    });
    draft.findings.push({
      concern: "oiliness", present: true, appearanceLevel: "mild",
      confidence: 0.3, contributingFactors: [],
      regionDetail: [{ region: "chin", appearanceLevel: "mild" }],
      observedInPoses: ["front"],
    });
    const oiliness = find(normalizeAssessment(draft), "oiliness");
    expect(oiliness.confidence).toBe(0.95);
    expect(oiliness.regions).toEqual(["nose"]);
  });

  it("resolves a contradictory finding as absent, never as present", () => {
    const draft = assessment();
    // "Present" with nothing visible, and regions on something absent.
    draft.findings[0] = {
      ...draft.findings[0]!,
      present: true,
      appearanceLevel: "none",
      regionDetail: [{ region: "cheeks", appearanceLevel: "mild" }],
    };
    draft.findings[1] = {
      ...draft.findings[1]!,
      present: false,
      regionDetail: [{ region: "chin", appearanceLevel: "mild" }],
    };
    const value = normalizeAssessment(draft);
    expect(find(value, "acne_like_breakouts")).toMatchObject({ present: false, regions: [] });
    expect(find(value, "oiliness").regions).toEqual([]);
  });

  it("never discards an escalation for lacking a reason", () => {
    const draft = assessment();
    draft.escalation = { recommendProfessional: true, reasons: ["  ", ""] };
    const value = normalizeAssessment(draft);
    expect(value.escalation.recommendProfessional).toBe(true);
    expect(value.escalation.reasons).toHaveLength(1);
    expect(value.escalation.reasons[0]).toBeTruthy();
  });
});

describe("routine wire schema", () => {
  const step = {
    order: 1, category: "treatment" as const, active: "salicylic_acid" as const,
    frequencyPerWeek: 3, rampSchedule: null, rationale: "", irritationRisk: "medium" as const,
  };

  it("still refuses a clinician-only active outright", () => {
    expect(
      RoutineDraftSchema.safeParse({ am: [], pm: [{ ...step, active: "hydroquinone" }], notes: [] }).success,
    ).toBe(false);
  });
});

describe("normalizeDraft", () => {
  const step = {
    order: 1, category: "treatment" as const, active: "salicylic_acid" as const,
    frequencyPerWeek: 3, rampSchedule: null, rationale: "Targets congestion.",
    irritationRisk: "medium" as const,
  };
  const draft = (overrides: Partial<RoutineDraft>): RoutineDraft => ({
    am: [], pm: [], notes: [], ...overrides,
  });

  it("strips a treatment active from a basic product category", () => {
    const routine = normalizeDraft(draft({ am: [{ ...step, category: "cleanser" }] }));
    expect(routine.am).toHaveLength(1);
    expect(routine.am[0]!.active).toBeUndefined();
  });

  it("drops a treatment step that carries no active", () => {
    const routine = normalizeDraft(draft({ pm: [{ ...step, active: null }, step] }));
    expect(routine.pm).toHaveLength(1);
    expect(routine.pm[0]!.active).toBe("salicylic_acid");
  });

  it("clamps an out-of-range frequency into the weekly band", () => {
    const routine = normalizeDraft(draft({
      pm: [
        { ...step, frequencyPerWeek: 9 },
        { ...step, active: "niacinamide", frequencyPerWeek: 0 },
        { ...step, active: "azelaic_acid", frequencyPerWeek: 2.4 },
      ],
    }));
    expect(routine.pm.map((s) => s.frequencyPerWeek)).toEqual([7, 1, 2]);
  });

  it("renumbers steps after dropping one", () => {
    const routine = normalizeDraft(draft({
      am: [{ ...step, active: null }, { ...step, order: 5 }, { ...step, order: 9, active: "niacinamide" }],
    }));
    expect(routine.am.map((s) => s.order)).toEqual([1, 2]);
  });
});

describe("region and pose provenance", () => {
  it("derives the flat regions list from regionDetail so the two cannot disagree", () => {
    const draft = assessment();
    draft.findings[1] = {
      ...draft.findings[1]!,
      present: true,
      appearanceLevel: "moderate",
      regionDetail: [
        { region: "nose", appearanceLevel: "moderate" },
        { region: "forehead", appearanceLevel: "mild" },
      ],
      observedInPoses: ["front", "right"],
    };
    const oiliness = find(normalizeAssessment(draft), "oiliness");

    expect(oiliness.regions).toEqual(["nose", "forehead"]);
    expect(oiliness.regionDetail).toHaveLength(2);
    expect(oiliness.observedInPoses).toEqual(["front", "right"]);
  });

  it("keeps the strongest reading when a region is repeated, and drops 'none'", () => {
    const draft = assessment();
    draft.findings[1] = {
      ...draft.findings[1]!,
      present: true,
      appearanceLevel: "noticeable",
      regionDetail: [
        { region: "cheeks", appearanceLevel: "mild" },
        { region: "cheeks", appearanceLevel: "noticeable" },
        { region: "chin", appearanceLevel: "none" },
      ],
      observedInPoses: ["front", "front", "left"],
    };
    const oiliness = find(normalizeAssessment(draft), "oiliness");

    expect(oiliness.regionDetail).toEqual([
      { region: "cheeks", appearanceLevel: "noticeable" },
    ]);
    expect(oiliness.observedInPoses).toEqual(["front", "left"]);
  });

  it("clears location and pose provenance on an absent finding", () => {
    const draft = assessment();
    draft.findings[2] = {
      ...draft.findings[2]!,
      present: false,
      regionDetail: [{ region: "cheeks", appearanceLevel: "moderate" }],
      observedInPoses: ["front"],
    };
    const dryness = find(normalizeAssessment(draft), "dryness_flaking");

    expect(dryness.regions).toEqual([]);
    expect(dryness.regionDetail).toEqual([]);
    expect(dryness.observedInPoses).toEqual([]);
  });
});
