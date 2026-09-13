import { describe, expect, it } from "vitest";
import {
  QUALITY_CONFIG,
  checkFacialSharpness,
  checkLighting,
  type AnalysisReadySession,
  type FrameEvidence,
  type QualityResult,
} from "@pore/shared/scan";
import type { Assessment, ConcernFinding, ConcernKey, ScanPose } from "@pore/shared";

import {
  applyConfidenceLimits,
  captureConditions,
  confidenceCeilings,
  describeCaptureConditions,
  readPoseScalars,
} from "../capture-conditions";

/**
 * Image evidence with everything comfortably inside its gate, so a test only
 * has to move the one scalar it cares about.
 */
function image(overrides: Partial<FrameEvidence["image"] & object> = {}) {
  return {
    width: 2000,
    height: 2000,
    pixelCount: 4_000_000,
    decodeValid: true,
    blankOrUniform: false,
    faceLumaMean: 130,
    faceLumaP10: 60,
    faceLumaP90: 200,
    faceLumaStdDev: 30,
    faceContrast: 60,
    shadowClipping: 0.01,
    highlightClipping: 0.01,
    glareRatio: 0.005,
    skinSharpness: 120,
    skinLaplacianVariance: 200,
    leftFaceLuma: 130,
    rightFaceLuma: 130,
    lightingAsymmetry: 0.01,
    backgroundLuma: 130,
    backlightDelta: 0,
    perceptualHash: "0f1e2d3c4b5a6978",
    ...overrides,
  } as NonNullable<FrameEvidence["image"]>;
}

/**
 * Build metrics through the REAL check functions rather than by hand.
 *
 * This is the format pin: `capture-conditions` parses composite metric value
 * strings, so if `quality-checks` ever changes how it packs them, these tests
 * fail instead of the ceilings silently switching themselves off in production.
 */
function qualityFor(imageOverrides: Parameters<typeof image>[0] = {}): QualityResult {
  const evidence = { image: image(imageOverrides) } as FrameEvidence;
  return {
    passed: true,
    overallScore: 1,
    confidence: 1,
    metrics: {
      ...checkLighting(evidence).metrics,
      ...checkFacialSharpness(evidence).metrics,
    },
    blockingIssues: [],
    warnings: [],
    correctiveAction: null,
    provenance: {} as QualityResult["provenance"],
    configVersion: QUALITY_CONFIG.version,
  };
}

function session(
  perPose: Partial<Record<"front" | "right" | "left", Parameters<typeof image>[0]>> = {},
): AnalysisReadySession {
  return {
    sessionId: "s",
    startedAt: 0,
    analysisReady: true,
    validation: {} as QualityResult,
    captures: {
      front: { quality: qualityFor(perPose.front ?? {}) },
      right: { quality: qualityFor(perPose.right ?? {}) },
      left: { quality: qualityFor(perPose.left ?? {}) },
    },
  } as unknown as AnalysisReadySession;
}

const CONCERNS: ConcernKey[] = [
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

function finding(patch: Partial<ConcernFinding> & { concern: ConcernKey }): ConcernFinding {
  return {
    present: true,
    appearanceLevel: "moderate",
    confidence: 0.95,
    contributingFactors: [],
    regions: [],
    regionDetail: [],
    observedInPoses: ["front", "right", "left"] as ScanPose[],
    ...patch,
  };
}

function assessment(findings: ConcernFinding[]): Assessment {
  const present = new Map(findings.map((f) => [f.concern, f]));
  return {
    findings: CONCERNS.map(
      (concern) =>
        present.get(concern) ??
        finding({
          concern,
          present: false,
          appearanceLevel: "none",
          confidence: 0,
          observedInPoses: [],
        }),
    ),
    escalation: { recommendProfessional: false, reasons: [] },
    summary: "",
    disclaimer: "",
  };
}

const confidenceOf = (a: Assessment, concern: ConcernKey) =>
  a.findings.find((f) => f.concern === concern)!.confidence;

describe("reading measured optics (format pin)", () => {
  it("recovers every scalar from the metric shapes the checks actually emit", () => {
    const scalars = readPoseScalars(
      qualityFor({
        lightingAsymmetry: 0.2,
        backlightDelta: 40,
        shadowClipping: 0.11,
        highlightClipping: 0.08,
        glareRatio: 0.05,
        skinSharpness: 40,
        skinLaplacianVariance: 60,
        faceContrast: 20,
        faceLumaStdDev: 10,
      }),
    );
    // Every field must be a number. A null here means quality-checks changed
    // its value format and the ceilings below stopped being applied.
    for (const [name, value] of Object.entries(scalars)) {
      expect(value, `${name} could not be read from the metric`).not.toBeNull();
    }
    expect(scalars.lightingAsymmetry).toBeCloseTo(0.2);
    expect(scalars.backlightDelta).toBeCloseTo(40);
    expect(scalars.shadowClipping).toBeCloseTo(0.11, 2);
    expect(scalars.glareRatio).toBeCloseTo(0.05, 2);
    expect(scalars.gradientEnergy).toBeCloseTo(40, 0);
    expect(scalars.laplacianVariance).toBeCloseTo(60, 0);
  });

  it("returns null rather than guessing when a metric is absent", () => {
    const empty = readPoseScalars({
      metrics: {},
    } as unknown as QualityResult);
    expect(Object.values(empty).every((value) => value === null)).toBe(true);
  });
});

describe("capture conditions", () => {
  it("reports nothing for a clean session", () => {
    const conditions = captureConditions(session());
    expect(conditions.poses.every((pose) => pose.limitations.length === 0)).toBe(true);
    expect(conditions.affectedPoseCount).toEqual({});
    expect(describeCaptureConditions(conditions)).toContain("no optical limitations");
  });

  it("names the limitation and the measured figure behind it", () => {
    const conditions = captureConditions(session({ front: { lightingAsymmetry: 0.2 } }));
    const brief = describeCaptureConditions(conditions)!;
    expect(brief).toContain("uneven side lighting");
    expect(brief).toContain("51 of 255");
    // The model must not treat an optical artefact as a skin finding.
    expect(brief).toContain("describe the CAMERA, not the skin");
  });

  it("counts how many captures each limitation affected", () => {
    const conditions = captureConditions(
      session({ front: { glareRatio: 0.05 }, right: { glareRatio: 0.05 } }),
    );
    expect(conditions.affectedPoseCount.glare).toBe(2);
  });
});

describe("confidence ceilings", () => {
  it("caps only the concerns a given limitation can fake", () => {
    // Glare and shine are the same pixels, so glare bounds oiliness — and
    // nothing else, because it says nothing about pigment or texture.
    const ceilings = confidenceCeilings(
      captureConditions(session({ front: { glareRatio: 0.05 } })),
    );
    expect(Object.keys(ceilings)).toEqual(["oiliness"]);
  });

  it("maps side lighting to the tonal concerns it can manufacture", () => {
    const ceilings = confidenceCeilings(
      captureConditions(session({ front: { lightingAsymmetry: 0.2 } })),
    );
    expect(Object.keys(ceilings).sort()).toEqual([
      "dark_spot_appearance",
      "redness_appearance",
      "uneven_tone",
    ]);
  });

  it("tightens as more of the session is affected", () => {
    const one = confidenceCeilings(
      captureConditions(session({ front: { glareRatio: 0.05 } })),
    ).oiliness!;
    const all = confidenceCeilings(
      captureConditions(
        session({
          front: { glareRatio: 0.05 },
          right: { glareRatio: 0.05 },
          left: { glareRatio: 0.05 },
        }),
      ),
    ).oiliness!;
    // One bad angle informs; a limitation in every capture is a property of
    // the whole session and must fall below the actionable threshold.
    expect(one).toBeGreaterThan(0.7);
    expect(all).toBeLessThan(0.7);
  });

  it("produces no ceiling at all when the metrics cannot be read", () => {
    const unreadable = {
      sessionId: "s",
      startedAt: 0,
      captures: {
        front: { quality: { metrics: {} } },
        right: { quality: { metrics: {} } },
        left: { quality: { metrics: {} } },
      },
    } as unknown as AnalysisReadySession;
    expect(confidenceCeilings(captureConditions(unreadable))).toEqual({});
  });
});

describe("applyConfidenceLimits", () => {
  it("lowers a confident oiliness read on a glare-heavy session and says why", () => {
    const conditions = captureConditions(
      session({
        front: { glareRatio: 0.05 },
        right: { glareRatio: 0.05 },
        left: { glareRatio: 0.05 },
      }),
    );
    const limited = applyConfidenceLimits(
      assessment([finding({ concern: "oiliness" })]),
      conditions,
    );
    expect(confidenceOf(limited, "oiliness")).toBeLessThan(0.7);
    expect(
      limited.findings.find((f) => f.concern === "oiliness")!.contributingFactors.join(" "),
    ).toContain("glare");
  });

  it("leaves concerns the limitation cannot explain untouched", () => {
    const conditions = captureConditions(
      session({
        front: { glareRatio: 0.05 },
        right: { glareRatio: 0.05 },
        left: { glareRatio: 0.05 },
      }),
    );
    const limited = applyConfidenceLimits(
      assessment([finding({ concern: "dark_spot_appearance" })]),
      conditions,
    );
    expect(confidenceOf(limited, "dark_spot_appearance")).toBe(0.95);
  });

  it("damps a lighting-fakeable concern that only one angle saw", () => {
    const limited = applyConfidenceLimits(
      assessment([
        finding({ concern: "redness_appearance", observedInPoses: ["front"] }),
      ]),
      captureConditions(session()),
    );
    expect(confidenceOf(limited, "redness_appearance")).toBeLessThan(0.7);
    expect(
      limited.findings
        .find((f) => f.concern === "redness_appearance")!
        .contributingFactors.join(" "),
    ).toContain("only one of the three angles");
  });

  it("does not damp the same concern once a second angle corroborates it", () => {
    const limited = applyConfidenceLimits(
      assessment([
        finding({ concern: "redness_appearance", observedInPoses: ["front", "left"] }),
      ]),
      captureConditions(session()),
    );
    expect(confidenceOf(limited, "redness_appearance")).toBe(0.95);
  });

  it("does not damp a single-pose concern that lighting cannot fake", () => {
    // A breakout on one cheek is genuinely only visible from one angle.
    const limited = applyConfidenceLimits(
      assessment([
        finding({ concern: "acne_like_breakouts", observedInPoses: ["right"] }),
      ]),
      captureConditions(session()),
    );
    expect(confidenceOf(limited, "acne_like_breakouts")).toBe(0.95);
  });

  it("never raises confidence and never revives an absent finding", () => {
    const conditions = captureConditions(session({ front: { glareRatio: 0.05 } }));
    const before = assessment([finding({ concern: "oiliness", confidence: 0.2 })]);
    const after = applyConfidenceLimits(before, conditions);
    expect(confidenceOf(after, "oiliness")).toBe(0.2);
    expect(after.findings.every((f, i) => f.present === before.findings[i]!.present)).toBe(
      true,
    );
  });
});
