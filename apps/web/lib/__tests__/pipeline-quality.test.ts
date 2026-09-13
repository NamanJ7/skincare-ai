import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

import type { IntakeResponse } from "@pore/shared";
import {
  FINAL_REQUIRED_METRIC_NAMES,
  QUALITY_CONFIG,
  type QualityResult,
  type ScanSession,
  type StepId,
} from "@pore/shared/scan";

import { generatePlan, type PlanImage } from "../pipeline";

const intake: IntakeResponse = {
  age: 24,
  goals: ["general_health"],
  skinType: "normal",
  sensitivity: "medium",
  currentProducts: [],
  allergies: [],
  budget: "medium",
  fragrancePreference: "no_preference",
  pregnancyOrBreastfeeding: false,
  skinTone: "medium",
  darkMarkProne: false,
  climate: "temperate",
};

const startedAt = Date.now();
const hashes: Record<StepId, string> = {
  front: "0000000000000000",
  right: "ffffffffffffffff",
  left: "aaaaaaaaaaaaaaaa",
};
const yaws: Record<StepId, number> = { front: 0, right: 42, left: -42 };

function image(stepId: StepId): PlanImage {
  const data = Buffer.from(`not-a-real-photo-${stepId}`).toString("base64");
  return {
    data,
    mediaType: "image/jpeg",
    stepId,
    captureId: `capture-${stepId}`,
    contentDigest: createHash("sha256").update(Buffer.from(data, "base64")).digest("hex"),
  };
}

function passedQuality(stepId: StepId, planImage: PlanImage): QualityResult {
  return {
    passed: true,
    overallScore: 1,
    confidence: 1,
    metrics: Object.fromEntries(
      FINAL_REQUIRED_METRIC_NAMES.map((name) => [
        name,
        { passed: true, score: 1, confidence: 1 },
      ]),
    ) as QualityResult["metrics"],
    blockingIssues: [],
    warnings: [],
    correctiveAction: null,
    provenance: {
      gate: "final",
      source: "upload",
      sessionId: "session-test",
      captureId: planImage.captureId,
      frameId: `frame-${stepId}`,
      capturedAt: startedAt + 1_000,
      stepId,
      contentDigest: planImage.contentDigest,
      perceptualHash: hashes[stepId],
    },
    configVersion: QUALITY_CONFIG.version,
  };
}

const validImages = (["front", "right", "left"] as StepId[]).map(image);
const validSession: ScanSession = {
  sessionId: "session-test",
  startedAt,
  captures: Object.fromEntries(validImages.map((planImage) => {
    const stepId = planImage.stepId;
    return [stepId, {
      sessionId: "session-test",
      captureId: planImage.captureId,
      frameId: `frame-${stepId}`,
      stepId,
      source: "upload" as const,
      capturedAt: startedAt + 1_000,
      contentDigest: planImage.contentDigest,
      perceptualHash: hashes[stepId],
      width: 1024,
      height: 1365,
      yawDeg: yaws[stepId],
      quality: passedQuality(stepId, planImage),
    }];
  })) as ScanSession["captures"],
};

let previousKey: string | undefined;

beforeEach(() => {
  previousKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
});

afterEach(() => {
  if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = previousKey;
});

describe("scan analysis hard gate", () => {
  it.each([0, 1, 2, 4])("rejects %i images before analysis", async (count) => {
    const images = Array.from({ length: count }, (_, index) => validImages[index % 3]!);
    await expect(generatePlan({ images, intake, scanSession: validSession })).rejects.toThrow(
      "A validated three-photo scan is required",
    );
  });

  it("does not return an image-independent mock when the vision service is unavailable", async () => {
    await expect(
      generatePlan({ images: validImages, intake, scanSession: validSession }),
    ).rejects.toThrow("vision service is not configured");
  });

  it("rejects an empty image payload even when three array slots exist", async () => {
    await expect(
      generatePlan({
        images: [validImages[0]!, { ...validImages[1]!, data: "" }, validImages[2]!],
        intake,
        scanSession: validSession,
      }),
    ).rejects.toThrow("A validated three-photo scan is required");
  });

  it("rejects a client-forged pass with missing metric evidence", async () => {
    const front = validSession.captures.front!;
    const forged: ScanSession = {
      ...validSession,
      captures: {
        ...validSession.captures,
        front: {
          ...front,
          quality: { ...front.quality, metrics: {} },
        },
      },
    };
    await expect(
      generatePlan({ images: validImages, intake, scanSession: forged }),
    ).rejects.toThrow("missing complete current quality evidence");
  });

  it("rejects malformed runtime session fields as a client error", async () => {
    await expect(
      generatePlan({
        images: validImages,
        intake,
        scanSession: { sessionId: "bad" } as ScanSession,
      }),
    ).rejects.toThrow("malformed");
  });
});
