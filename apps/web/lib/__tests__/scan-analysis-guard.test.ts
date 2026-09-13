/**
 * What the bound-input guard does — and, just as importantly, what it does not.
 *
 * The guard is an *integrity* check, not an authorization or anti-abuse
 * control. The client supplies both the session and the images, so every value
 * it compares came from the same untrusted request. It reliably catches
 * mismatched, reordered, reused, and stale captures; it cannot tell a genuine
 * scan from a fabricated one. Spend limits therefore have to be enforced by
 * identity and quota (lib/quota.ts), never by this module.
 */
import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { QUALITY_CONFIG } from "@pore/shared/scan";

import { assertBoundAnalysisInput, AnalysisRequestError } from "../scan-analysis-guard";
import type { PlanImage } from "../pipeline";

const NOW = 1_700_000_000_000;

function digestOf(base64: string): string {
  return createHash("sha256")
    .update(Buffer.from(base64, "base64"))
    .digest("hex");
}

const DATA: Record<string, string> = {
  front: "AAAAAAAA",
  right: "BBBBBBBB",
  left: "CCCCCCCC",
};

function capture(stepId: string) {
  return {
    stepId,
    sessionId: "session-1",
    captureId: `capture-${stepId}`,
    frameId: `frame-${stepId}`,
    contentDigest: digestOf(DATA[stepId]!),
    perceptualHash: `phash-${stepId}`,
    capturedAt: NOW - 10_000,
    width: 1080,
    height: 1440,
    yawDeg: 0,
    quality: {
      passed: true,
      provenance: { source: "native" },
      metrics: {},
      blockingIssues: [],
      warnings: [],
    },
  };
}

function session() {
  return {
    sessionId: "session-1",
    startedAt: NOW - 60_000,
    captures: {
      front: capture("front"),
      right: capture("right"),
      left: capture("left"),
    },
  } as never;
}

function images(): PlanImage[] {
  return (["front", "right", "left"] as const).map((stepId) => ({
    data: DATA[stepId]!,
    mediaType: "image/jpeg" as const,
    stepId,
    captureId: `capture-${stepId}`,
    contentDigest: digestOf(DATA[stepId]!),
  }));
}

describe("assertBoundAnalysisInput — integrity guarantees", () => {
  it("rejects bytes that do not match the capture's digest", () => {
    const tampered = images();
    tampered[0]!.data = "ZZZZZZZZ";
    expect(() => assertBoundAnalysisInput(session(), tampered, NOW)).toThrow(
      AnalysisRequestError,
    );
  });

  it("rejects a capture reused for more than one pose", () => {
    const reused = images();
    reused[1]!.captureId = "capture-front";
    expect(() => assertBoundAnalysisInput(session(), reused, NOW)).toThrow(
      AnalysisRequestError,
    );
  });

  it("rejects images submitted out of pose order", () => {
    const reordered = [images()[1]!, images()[0]!, images()[2]!];
    expect(() => assertBoundAnalysisInput(session(), reordered, NOW)).toThrow(
      AnalysisRequestError,
    );
  });

  it("rejects anything other than exactly three images", () => {
    expect(() =>
      assertBoundAnalysisInput(session(), images().slice(0, 2), NOW),
    ).toThrow(AnalysisRequestError);
  });

  it("rejects data that is not valid base64", () => {
    const bad = images();
    bad[0]!.data = "!!!not base64!!!";
    expect(() => assertBoundAnalysisInput(session(), bad, NOW)).toThrow(
      AnalysisRequestError,
    );
  });

  it("rejects a malformed session payload", () => {
    expect(() =>
      assertBoundAnalysisInput({ sessionId: "x" } as never, images(), NOW),
    ).toThrow(AnalysisRequestError);
  });
});

describe("assertBoundAnalysisInput — what it deliberately cannot do", () => {
  /**
   * Pinned on purpose, and the reason the spend controls in lib/quota.ts exist.
   *
   * The guard is thorough: it cross-binds provenance, requires format-valid
   * hashes, enforces pose separation, freshness and near-duplicate rejection,
   * and re-hashes the bytes. But of every value it compares, only
   * `contentDigest` is independently recomputed server-side — the perceptual
   * hashes, yaw angles, timestamps and per-metric verdicts are all claims the
   * caller makes about itself. An attacker who reads the client source can
   * therefore assemble a fully self-consistent session over arbitrary images.
   *
   * That raises the bar (casual replay and naive scripting fail here) without
   * bounding cost. If this test ever starts failing, someone has added real
   * provenance — worth celebrating, and still not a reason to drop the quota.
   */
  it("accepts a fully self-consistent forged session over arbitrary images", () => {
    // Only these have to survive a server-side check: sha256 over real bytes.
    const forgedData: Record<string, string> = {
      front: Buffer.from("forged-front-image").toString("base64"),
      right: Buffer.from("forged-right-image").toString("base64"),
      left: Buffer.from("forged-left-image").toString("base64"),
    };
    // Format-valid 16-hex hashes, chosen far enough apart to clear the
    // near-duplicate and left/right separation thresholds. Never verified
    // against the pixels, so any values that satisfy the arithmetic will do.
    const phash: Record<string, string> = {
      front: "00000000ffffffff",
      right: "0000000000000000",
      left: "ffffffffffffffff",
    };
    const yaw: Record<string, number> = { front: 0, right: 45, left: -45 };

    const metrics = Object.fromEntries(
      [
        "integrity", "resolution", "faceDetection", "singleFace",
        "faceCompleteness", "faceSize", "faceCentering", "sharpness",
        "motion", "exposure", "clipping", "lightingUniformity",
        "backlighting", "textureVisibility", "yaw", "pitch", "roll",
        "targetPose", "occlusion",
      ].map((name) => [
        name,
        { passed: true, score: 1, confidence: 1, value: 1, threshold: 1 },
      ]),
    );

    const forgedCapture = (stepId: string) => {
      const contentDigest = digestOf(forgedData[stepId]!);
      return {
        stepId,
        sessionId: "attacker-session",
        captureId: `attacker-capture-${stepId}`,
        frameId: `attacker-frame-${stepId}`,
        source: "camera",
        contentDigest,
        perceptualHash: phash[stepId]!,
        capturedAt: NOW - 5_000,
        width: 2576,
        height: 3435,
        yawDeg: yaw[stepId]!,
        quality: {
          passed: true,
          overallScore: 1,
          confidence: 1,
          metrics,
          blockingIssues: [],
          warnings: [],
          configVersion: QUALITY_CONFIG.version,
          provenance: {
            gate: "final",
            source: "camera",
            stepId,
            sessionId: "attacker-session",
            captureId: `attacker-capture-${stepId}`,
            frameId: `attacker-frame-${stepId}`,
            contentDigest,
            perceptualHash: phash[stepId]!,
            // Binds the final frame to the "armed preview". Also client-supplied.
            previewPerceptualHash: phash[stepId]!,
            capturedAt: NOW - 5_000,
          },
        },
      };
    };

    const forgedSession = {
      sessionId: "attacker-session",
      startedAt: NOW - 30_000,
      captures: {
        front: forgedCapture("front"),
        right: forgedCapture("right"),
        left: forgedCapture("left"),
      },
    } as never;

    const forgedImages: PlanImage[] = (["front", "right", "left"] as const).map(
      (stepId) => ({
        data: forgedData[stepId]!,
        mediaType: "image/jpeg" as const,
        stepId,
        captureId: `attacker-capture-${stepId}`,
        contentDigest: digestOf(forgedData[stepId]!),
      }),
    );

    expect(() =>
      assertBoundAnalysisInput(forgedSession, forgedImages, NOW),
    ).not.toThrow();
  });
});
