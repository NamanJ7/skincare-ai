import { describe, expect, it } from "vitest";

import {
  QUALITY_CONFIG,
  FINAL_REQUIRED_METRIC_NAMES,
  createConsecutiveFrameTracker,
  evaluateQuality,
  isPassedQualityResult,
  validateScanSession,
  assertAnalysisReady,
  type AcceptedCapture,
  type FrameEvidence,
  type ScanSession,
  type StepId,
} from "..";

const BASE = 2_000_000_000_000;
const hashes: Record<StepId, string> = {
  front: "0000000000000000",
  right: "ffffffffffffffff",
  left: "aaaaaaaaaaaaaaaa",
};
const yaws: Record<StepId, number> = { front: 0, right: 42, left: -42 };

function evidence(
  stepId: StepId = "front",
  gate: "live" | "final" = "live",
  frame = 0,
): FrameEvidence {
  const perceptualHash = hashes[stepId];
  return {
    provenance: {
      gate,
      source: gate === "live" ? "camera" : "upload",
      sessionId: "session-current",
      captureId: gate === "final" ? `capture-${stepId}` : undefined,
      frameId: `frame-${stepId}-${frame}`,
      capturedAt: BASE + frame * 180,
      stepId,
      contentDigest: gate === "final" ? `${stepId === "front" ? "1" : stepId === "right" ? "2" : "3"}`.repeat(64) : undefined,
      perceptualHash,
    },
    face: {
      faceCount: 1,
      box: { x: 0.3, y: 0.18, width: 0.4, height: 0.62 },
      yawDeg: yaws[stepId],
      pitchDeg: 0,
      rollDeg: 0,
      completeness: 1,
      occlusionRatio: 0.02,
    },
    image: {
      width: 1024,
      height: 1365,
      pixelCount: 1024 * 1365,
      byteLength: gate === "final" ? 120_000 : undefined,
      decodeValid: true,
      blankOrUniform: false,
      faceLumaMean: 120,
      faceLumaP10: 35,
      faceLumaP90: 205,
      faceLumaStdDev: 28,
      faceContrast: 170,
      shadowClipping: 0.01,
      highlightClipping: 0.01,
      glareRatio: 0.01,
      skinSharpness: 80,
      skinLaplacianVariance: 120,
      leftFaceLuma: 118,
      rightFaceLuma: 122,
      lightingAsymmetry: 0.03,
      backgroundLuma: 125,
      backlightDelta: 5,
      perceptualHash,
    },
    motion: gate === "live" ? { pixelMotion: 0.01, landmarkMotion: 0.01, stable: true } : null,
  };
}

function resultOf(mutator?: (value: FrameEvidence) => void) {
  const value = evidence();
  mutator?.(value);
  return evaluateQuality(value, { now: BASE + 1_000 });
}

describe("strict frame quality", () => {
  it("passes complete finite facial evidence", () => {
    expect(resultOf().passed).toBe(true);
  });

  it.each([
    ["no face", (value: FrameEvidence) => { value.face!.faceCount = 0; }, "no_face"],
    ["multiple faces", (value: FrameEvidence) => { value.face!.faceCount = 2; }, "multiple_faces"],
    ["face too far", (value: FrameEvidence) => { value.face!.box!.width = 0.15; }, "too_far"],
    ["face too close", (value: FrameEvidence) => { value.face!.box!.width = 0.75; }, "too_close"],
    ["face outside frame", (value: FrameEvidence) => { value.face!.completeness = 0.7; }, "face_out_of_frame"],
    ["facial blur", (value: FrameEvidence) => { value.image!.skinSharpness = 20; value.image!.skinLaplacianVariance = 30; }, "blurry"],
    ["covered lens", (value: FrameEvidence) => { value.image!.blankOrUniform = true; }, "blank_or_covered"],
    ["dark face", (value: FrameEvidence) => { value.image!.faceLumaP10 = 2; }, "too_dark"],
    ["overexposed face", (value: FrameEvidence) => { value.image!.faceLumaP90 = 254; }, "too_bright"],
    ["backlight", (value: FrameEvidence) => { value.image!.backlightDelta = 80; }, "backlit"],
    ["uneven light", (value: FrameEvidence) => { value.image!.lightingAsymmetry = 0.5; }, "uneven_lighting"],
    ["glare", (value: FrameEvidence) => { value.image!.glareRatio = 0.2; }, "glare"],
    ["wrong yaw", (value: FrameEvidence) => { value.face!.yawDeg = 40; }, "wrong_pose"],
    ["head pitch", (value: FrameEvidence) => { value.face!.pitchDeg = 20; }, "pitch"],
    ["head roll", (value: FrameEvidence) => { value.face!.rollDeg = 15; }, "roll"],
    ["skin occlusion", (value: FrameEvidence) => { value.face!.occlusionRatio = 0.4; }, "occluded"],
    ["camera motion", (value: FrameEvidence) => { value.motion!.stable = false; }, "motion"],
    ["low resolution", (value: FrameEvidence) => { value.image!.width = 320; value.image!.height = 320; value.image!.pixelCount = 102_400; }, "low_resolution"],
  ] as const)("blocks %s with corrective guidance", (_label, mutate, code) => {
    const result = resultOf(mutate);
    expect(result.passed).toBe(false);
    expect(result.blockingIssues.some((candidate) => candidate.code === code)).toBe(true);
    expect(result.correctiveAction).not.toBeNull();
  });

  it("arms on a VGA guidance frame that declares a large capture", () => {
    // The exact shape native produces: a 640x480 analysis stream feeding a
    // multi-megapixel photo output. Judging the stream's own dimensions made
    // the shutter permanently unreachable.
    const value = evidence("front", "live", 0);
    value.image!.width = 640;
    value.image!.height = 480;
    value.image!.pixelCount = 640 * 480;
    value.image!.stillWidth = 3840;
    value.image!.stillHeight = 2880;
    expect(evaluateQuality(value, { now: BASE + 1_000 }).passed).toBe(true);
  });

  it("still rejects a declared capture below the analysis floor", () => {
    const value = evidence("front", "live", 0);
    value.image!.stillWidth = 640;
    value.image!.stillHeight = 480;
    const result = evaluateQuality(value, { now: BASE + 1_000 });
    expect(result.passed).toBe(false);
    expect(result.blockingIssues.some((issue) => issue.code === "low_resolution")).toBe(true);
  });

  it("fails closed on a partial or non-finite capture declaration", () => {
    const partial = evidence("front", "live", 0);
    partial.image!.stillWidth = 3840;
    expect(evaluateQuality(partial, { now: BASE + 1_000 }).passed).toBe(false);
    const invalid = evidence("front", "live", 0);
    invalid.image!.stillWidth = Number.NaN;
    invalid.image!.stillHeight = 2880;
    expect(evaluateQuality(invalid, { now: BASE + 1_000 }).passed).toBe(false);
  });

  it("ignores a capture declaration on the final gate", () => {
    // The final frame IS the capture, so its real decoded dimensions rule and a
    // declaration can never launder undersized bytes.
    const value = evidence("front", "final", 1);
    value.image!.width = 320;
    value.image!.height = 320;
    value.image!.pixelCount = 320 * 320;
    value.image!.stillWidth = 3840;
    value.image!.stillHeight = 2880;
    const result = evaluateQuality(value, { now: BASE + 1_000 });
    expect(result.passed).toBe(false);
    expect(result.blockingIssues.some((issue) => issue.code === "low_resolution")).toBe(true);
  });

  it("fails closed on missing and non-finite evidence", () => {
    const missing = evidence();
    missing.face = null;
    missing.image = null;
    expect(evaluateQuality(missing, { now: BASE }).passed).toBe(false);
    const invalid = evidence();
    invalid.image!.skinSharpness = Number.NaN;
    const result = evaluateQuality(invalid, { now: BASE });
    expect(result.passed).toBe(false);
    expect(result.blockingIssues.some((candidate) => candidate.code === "invalid_frame")).toBe(true);
  });

  it("prioritizes frame integrity over lower-priority pose feedback", () => {
    const result = resultOf((value) => {
      value.image!.blankOrUniform = true;
      value.face!.yawDeg = 50;
    });
    expect(result.correctiveAction?.code).toBe("blank_or_covered");
  });

  it("requires every final metric for an externally submitted pass", () => {
    const value = evidence("front", "final", 1);
    const result = evaluateQuality(value, { now: BASE + 1_000 });
    expect(FINAL_REQUIRED_METRIC_NAMES.length).toBeGreaterThan(10);
    expect(isPassedQualityResult(result)).toBe(true);
    delete result.metrics.sharpness;
    expect(isPassedQualityResult(result)).toBe(false);
  });
});

describe("consecutive live gate", () => {
  it("requires unique passing frames spanning the configured duration", () => {
    const tracker = createConsecutiveFrameTracker();
    let snapshot = tracker.snapshot();
    for (let frame = 0; frame < QUALITY_CONFIG.motion.consecutivePassingFrames; frame++) {
      const value = evidence("front", "live", frame);
      snapshot = tracker.push(value, evaluateQuality(value, { now: BASE + 1_000 }));
    }
    expect(snapshot.consecutivePasses).toBe(QUALITY_CONFIG.motion.consecutivePassingFrames);
    expect(snapshot.ready).toBe(true);
  });

  it("resets on a repeated frame or any failed evaluation", () => {
    const tracker = createConsecutiveFrameTracker();
    const first = evidence("front", "live", 0);
    tracker.push(first, evaluateQuality(first, { now: BASE + 1_000 }));
    expect(tracker.push(first, evaluateQuality(first, { now: BASE + 1_000 })).consecutivePasses).toBe(0);
    const moving = evidence("front", "live", 1);
    moving.motion!.stable = false;
    expect(tracker.push(moving, evaluateQuality(moving, { now: BASE + 1_000 })).ready).toBe(false);
  });
});

function capture(stepId: StepId): AcceptedCapture {
  const finalEvidence = evidence(stepId, "final", 1);
  const quality = evaluateQuality(finalEvidence, { now: BASE + 5_000 });
  return {
    sessionId: "session-current",
    captureId: `capture-${stepId}`,
    frameId: finalEvidence.provenance.frameId,
    stepId,
    source: "upload",
    capturedAt: finalEvidence.provenance.capturedAt,
    contentDigest: finalEvidence.provenance.contentDigest!,
    perceptualHash: finalEvidence.image!.perceptualHash,
    width: finalEvidence.image!.width,
    height: finalEvidence.image!.height,
    yawDeg: finalEvidence.face!.yawDeg,
    quality,
  };
}

function session(): ScanSession {
  return {
    sessionId: "session-current",
    startedAt: BASE,
    captures: { front: capture("front"), right: capture("right"), left: capture("left") },
  };
}

describe("three-photo session gate", () => {
  it("brands only a complete distinct current session as analysis ready", () => {
    const value = session();
    expect(validateScanSession(value, BASE + 5_000).passed).toBe(true);
    expect(assertAnalysisReady(value, BASE + 5_000).analysisReady).toBe(true);
  });

  it("blocks missing poses", () => {
    const value = session();
    delete value.captures.left;
    expect(validateScanSession(value, BASE + 5_000).correctiveAction?.code).toBe("missing_pose");
  });

  it("blocks exact and perceptual duplicates", () => {
    const value = session();
    value.captures.left!.contentDigest = value.captures.right!.contentDigest;
    expect(validateScanSession(value, BASE + 5_000).blockingIssues.some((issue) => issue.code === "duplicate_image")).toBe(true);
  });

  it("blocks same-direction or insufficiently separated poses", () => {
    const value = session();
    value.captures.left!.yawDeg = 35;
    expect(validateScanSession(value, BASE + 5_000).blockingIssues.some((issue) => issue.code === "pose_not_distinct")).toBe(true);
  });

  it("blocks stale and previous-session captures", () => {
    const stale = session();
    expect(validateScanSession(stale, BASE + QUALITY_CONFIG.session.maxSessionAgeMs + 1).blockingIssues.some((issue) => issue.code === "stale_image")).toBe(true);
    const reused = session();
    reused.captures.right!.sessionId = "previous-session";
    expect(validateScanSession(reused, BASE + 5_000).blockingIssues.some((issue) => issue.code === "wrong_session")).toBe(true);
  });

  it("requires camera captures to bind their armed preview hash", () => {
    const value = session();
    for (const capture of Object.values(value.captures)) {
      if (!capture) continue;
      capture.source = "camera";
      capture.quality.provenance.source = "camera";
      capture.quality.provenance.previewPerceptualHash = capture.perceptualHash;
    }
    expect(validateScanSession(value, BASE + 5_000).passed).toBe(true);
    delete value.captures.front!.quality.provenance.previewPerceptualHash;
    expect(validateScanSession(value, BASE + 5_000).blockingIssues.some((issue) => issue.code === "preview_mismatch")).toBe(true);
    value.captures.front!.quality.provenance.previewPerceptualHash = "ffffffffffffffff";
    expect(validateScanSession(value, BASE + 5_000).blockingIssues.some((issue) => issue.code === "preview_mismatch")).toBe(true);
  });
});

describe("unreadable pixels are diagnosed by gate, not lumped together", () => {
  it("calls a live frame with no measurable skin what it is, and says what to do", () => {
    // The camera is working — the platform just could not sample facial skin
    // (face too small, off-centre, or a strong profile hiding a cheek). Telling
    // the user their photo could not be read is advice they cannot act on.
    const live = evidence("front", "live");
    live.image = null;
    const result = evaluateQuality(live, { now: BASE + 1_000 });

    expect(result.passed).toBe(false);
    expect(result.blockingIssues.some((issue) => issue.code === "skin_not_measurable")).toBe(true);
    expect(result.blockingIssues.some((issue) => issue.code === "corrupt_image")).toBe(false);
    expect(result.correctiveAction?.message).toBe(
      "Center your face in the guide and hold steady.",
    );
  });

  it("still reports a genuine decode failure at the final gate", () => {
    const final = evidence("front", "final");
    final.image = null;
    const result = evaluateQuality(final, { now: BASE + 1_000 });

    expect(result.blockingIssues.some((issue) => issue.code === "corrupt_image")).toBe(true);
    expect(result.correctiveAction?.message).toBe("We couldn't read that photo. Try again.");
  });

  it("keeps calling undecodable bytes corrupt even on a live frame", () => {
    const live = evidence("front", "live");
    live.image!.decodeValid = false;
    const result = evaluateQuality(live, { now: BASE + 1_000 });

    expect(result.blockingIssues.some((issue) => issue.code === "corrupt_image")).toBe(true);
  });
});

describe("a flatly-lit face is told what it can actually fix", () => {
  it("asks for softer light rather than claiming the lens is covered", () => {
    // Visible skin with real luma deviation but little modelling. This is a
    // blocking capture either way — the bug was never that it passed, it was
    // that `blank_or_covered` outranks `low_texture` in guidance, so the user
    // was told to uncover a lens that was never covered.
    const flat = evidence("front", "live");
    flat.image!.faceContrast = 12;
    flat.image!.faceLumaStdDev = 20;
    flat.image!.blankOrUniform = false;
    const result = evaluateQuality(flat, { now: BASE + 1_000 });

    expect(result.passed).toBe(false);
    expect(result.blockingIssues.some((issue) => issue.code === "blank_or_covered")).toBe(false);
    expect(result.blockingIssues.some((issue) => issue.code === "low_texture")).toBe(true);
    expect(result.correctiveAction?.message).toBe(
      "Use softer light so your skin texture stays visible.",
    );
  });

  it("still calls a genuinely uniform frame covered", () => {
    const covered = evidence("front", "live");
    covered.image!.faceLumaStdDev = 2;
    const result = evaluateQuality(covered, { now: BASE + 1_000 });

    expect(result.blockingIssues.some((issue) => issue.code === "blank_or_covered")).toBe(true);
    expect(result.correctiveAction?.message).toBe("Uncover your camera lens.");
  });
});
