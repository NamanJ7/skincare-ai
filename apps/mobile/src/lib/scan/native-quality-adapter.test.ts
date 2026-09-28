import { describe, expect, it } from "vitest";

import {
  canArmNativeCapture,
  evaluateNativePacket,
} from "./native-quality-adapter";
import type { NativeFramePacket } from "./native-frame-evidence";

const HASH = "0000000000000000";
const DIGEST = "a".repeat(64);

function packet(): NativeFramePacket {
  return {
    frameId: "frame", timestamp: 1, width: 1024, height: 1365,
    faces: [{
      bounds: { x: 100, y: 100, width: 220, height: 320 }, frameWidth: 480, frameHeight: 640,
      centerX: 0.44, centerY: 0.41, widthRatio: 0.46, heightRatio: 0.5,
      yawDeg: 0, pitchDeg: 0, rollDeg: 0, landmarkCoverage: 1,
    }],
    pixels: {
      meanLuma: 0.5, shadowClipping: 0.01, highlightClipping: 0.01, contrast: 0.2, sharpness: 0.1,
      gradientEnergy: 80, laplacianVariance: 100, lumaP10: 50, lumaP90: 210, lumaStdDev: 25,
      lightingUniformity: 1, cheekLumaDifference: 0.02, leftFaceLuma: 125, rightFaceLuma: 130,
      glareRatio: 0.01, backgroundLuma: 130, backlightDelta: 2, dynamicRange: 0.6, sampleCount: 500,
      perceptualHash: HASH, nearlyUniform: false, occlusionRatio: 0,
    },
  };
}

function evaluate(previewPerceptualHash?: string) {
  return evaluateNativePacket(packet(), null, {
    gate: "final", sessionId: "session", stepId: "front", frameId: "frame", capturedAt: Date.now(),
    captureId: "capture", contentDigest: DIGEST, byteLength: 80_000, previewPerceptualHash,
  });
}

describe("native quality adapter", () => {
  it("threads the preview hash into provenance and accepts a matching final", () => {
    const out = evaluate(HASH);
    expect(out.evidence.provenance.previewPerceptualHash).toBe(HASH);
    expect(out.result.passed).toBe(true);
  });
  it("fails closed for a missing or distant camera preview hash", () => {
    expect(evaluate().result.blockingIssues.some((issue) => issue.code === "preview_mismatch")).toBe(true);
    expect(evaluate("ffffffffffffffff").result.blockingIssues.some((issue) => issue.code === "preview_mismatch")).toBe(true);
  });

  it("never arms unless the current fresh frame has a strict pass", () => {
    const candidate = {
      evaluatedFrameId: "frame-2",
      currentFrameId: "frame-2",
      fresh: true,
      legacyReady: true,
    };
    expect(
      canArmNativeCapture({ ...candidate, result: { passed: false } }),
    ).toBe(false);
    expect(
      canArmNativeCapture({
        ...candidate,
        result: { passed: true },
        currentFrameId: "frame-3",
      }),
    ).toBe(false);
    expect(
      canArmNativeCapture({
        ...candidate,
        result: { passed: true },
        fresh: false,
      }),
    ).toBe(false);
    expect(
      canArmNativeCapture({ ...candidate, result: { passed: true } }),
    ).toBe(true);
  });
});
