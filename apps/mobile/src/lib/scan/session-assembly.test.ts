import { describe, expect, it } from "vitest";

import {
  QUALITY_CONFIG,
  type FrameEvidence,
  type QualityResult,
  type StepId,
} from "@pore/shared/scan";

import { assembleSubmission, type CaptureEvaluation } from "./session-assembly";

const SESSION = "session-abcdef";
const NOW = 1_800_000_000_000;
const STARTED = NOW - 5_000;
const CAPTURED = NOW - 1_000;

const DIGEST: Record<StepId, string> = {
  front: "aa".repeat(32),
  right: "bb".repeat(32),
  left: "cc".repeat(32),
};
const PHASH: Record<StepId, string> = {
  front: "0000000000000000",
  right: "ffffffffffffffff",
  left: "0f0f0f0f0f0f0f0f",
};
const YAW: Record<StepId, number> = { front: 0, right: 45, left: -45 };

function makeEval(stepId: StepId, overrides: Partial<CaptureEvaluation> = {}): CaptureEvaluation {
  const captureId = `cap-${stepId}`;
  const frameId = `frame-${stepId}`;
  const digest = DIGEST[stepId];
  const perceptualHash = PHASH[stepId];
  const provenance = {
    gate: "final" as const,
    source: "camera" as const,
    sessionId: SESSION,
    captureId,
    frameId,
    capturedAt: CAPTURED,
    stepId,
    contentDigest: digest,
    perceptualHash,
    previewPerceptualHash: perceptualHash,
  };
  const result: QualityResult = {
    passed: true,
    overallScore: 1,
    confidence: 1,
    metrics: {},
    blockingIssues: [],
    warnings: [],
    correctiveAction: null,
    provenance,
    configVersion: QUALITY_CONFIG.version,
  };
  const evidence: FrameEvidence = {
    provenance,
    face: {
      faceCount: 1,
      box: { x: 0.3, y: 0.2, width: 0.4, height: 0.5 },
      yawDeg: YAW[stepId],
      pitchDeg: 0,
      rollDeg: 0,
      completeness: 1,
      occlusionRatio: 0,
    },
    image: {
      width: 1024,
      height: 1365,
      pixelCount: 1024 * 1365,
      byteLength: 80_000,
      decodeValid: true,
      blankOrUniform: false,
      faceLumaMean: 150,
      faceLumaP10: 90,
      faceLumaP90: 210,
      faceLumaStdDev: 30,
      faceContrast: 40,
      shadowClipping: 0.01,
      highlightClipping: 0.01,
      glareRatio: 0.01,
      skinSharpness: 60,
      skinLaplacianVariance: 80,
      leftFaceLuma: 150,
      rightFaceLuma: 150,
      lightingAsymmetry: 0.02,
      backgroundLuma: 140,
      backlightDelta: 10,
      perceptualHash,
    },
    motion: null,
  };
  return {
    stepId,
    captureId,
    frameId,
    capturedAt: CAPTURED,
    source: "camera",
    base64: `data-${stepId}`,
    contentDigest: digest,
    evidence,
    result,
    ...overrides,
  };
}

const ALL: CaptureEvaluation[] = [makeEval("front"), makeEval("right"), makeEval("left")];

describe("assembleSubmission", () => {
  it("builds a validated session + ordered, digest-bound images", () => {
    const out = assembleSubmission(SESSION, STARTED, ALL, NOW);
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.images.map((i) => i.stepId)).toEqual(["front", "right", "left"]);
    expect(out.images[0].contentDigest).toBe(DIGEST.front);
    expect(out.session.captures.front?.captureId).toBe("cap-front");
    expect(out.session.captures.left?.yawDeg).toBe(-45);
    expect(out.comparisonMetadata.configVersion).toBe(QUALITY_CONFIG.version);
    expect(out.comparisonMetadata.poses.right.yawDeg).toBe(45);
  });

  it("fails closed when a pose is missing", () => {
    const out = assembleSubmission(SESSION, STARTED, [makeEval("front"), makeEval("right")], NOW);
    expect(out).toMatchObject({ ok: false, code: "incomplete_scan", stepId: "left" });
  });

  it("fails with the corrective message when a capture didn't pass its gate", () => {
    const bad = makeEval("right");
    bad.result = {
      ...bad.result,
      passed: false,
      correctiveAction: { code: "too_dark", message: "Find brighter, even light." },
    };
    const out = assembleSubmission(SESSION, STARTED, [makeEval("front"), bad, makeEval("left")], NOW);
    expect(out).toMatchObject({ ok: false, code: "capture_quality", stepId: "right" });
    if (!out.ok) expect(out.message).toContain("brighter");
  });

  it("rejects non-distinct left/right poses (session validation)", () => {
    // A "left" capture that actually duplicates the right pose (same visual hash,
    // right-range yaw) must fail the distinct-pose / duplicate gate.
    const notDistinct = makeEval("left");
    notDistinct.evidence.image!.perceptualHash = PHASH.right;
    notDistinct.evidence.face!.yawDeg = 44;
    notDistinct.result.provenance.perceptualHash = PHASH.right;
    const out = assembleSubmission(SESSION, STARTED, [makeEval("front"), makeEval("right"), notDistinct], NOW);
    expect(out.ok).toBe(false);
  });

  it("rejects a stale session", () => {
    const out = assembleSubmission(SESSION, NOW - 60 * 60 * 1000, ALL, NOW);
    expect(out.ok).toBe(false);
  });
});

describe("assembleSubmission failure surface", () => {
  // buildAnalysisSubmission (session-builder.ts) used to call assembleSubmission
  // *outside* its try/catch, so a throw here rejected the caller's promise
  // instead of returning a SubmissionResult. review.tsx awaits that promise with
  // `processing` set, and every escape hatch on that screen is gated on
  // `!processing` — a throw stranded the user with no tappable control at all.
  it("reports an inconsistent session as a result, never as a silent pass", () => {
    // Two poses claiming the same yaw cannot be a real three-pose session.
    const left = makeEval("left");
    left.evidence.face!.yawDeg = YAW.right;
    const evaluations = [makeEval("front"), makeEval("right"), left];
    const result = assembleSubmission(SESSION, STARTED, evaluations);
    expect(result.ok).toBe(false);
  });

  it("rejects a submission whose captures belong to another session", () => {
    const evaluations = [makeEval("front"), makeEval("right"), makeEval("left")];
    const result = assembleSubmission("session-different", STARTED, evaluations);
    expect(result.ok).toBe(false);
  });
});
