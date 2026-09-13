/**
 * Covers the vision -> routine -> safety join that `generatePlan` composes once
 * a request clears the scan-quality gate (that gate's own contract is covered
 * by pipeline-quality.test.ts). The Anthropic client is mocked; images/session
 * are real, guard-passing fixtures rather than a stubbed guard, matching the
 * sibling file's approach.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

import type { Assessment, ConcernKey, IntakeResponse } from "@pore/shared";
import {
  FINAL_REQUIRED_METRIC_NAMES,
  QUALITY_CONFIG,
  type QualityResult,
  type ScanSession,
  type StepId,
} from "@pore/shared/scan";

const parseMock = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { parse: parseMock },
  })),
}));

vi.mock("@anthropic-ai/sdk/helpers/zod", () => ({
  zodOutputFormat: vi.fn((schema: unknown) => schema),
}));

import { generatePlan, type PlanImage } from "../pipeline";
import type { RoutineDraft } from "../schemas";
import { AnalysisRequestError } from "../scan-analysis-guard";

const intake: IntakeResponse = {
  age: 28,
  goals: ["acne"],
  sensitivity: "medium",
  currentProducts: [],
  allergies: [],
  pregnancyOrBreastfeeding: false,
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
    contentDigest: createHash("sha256")
      .update(Buffer.from(data, "base64"))
      .digest("hex"),
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
  captures: Object.fromEntries(
    validImages.map((planImage) => {
      const stepId = planImage.stepId;
      return [
        stepId,
        {
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
        },
      ];
    }),
  ) as ScanSession["captures"],
};

const CONCERNS = [
  "acne_like_breakouts",
  "oiliness",
  "dryness_flaking",
  "texture_congestion",
  "uneven_tone",
  "dark_spot_appearance",
  "redness_appearance",
  "fine_line_appearance",
  "irritation_signs",
] as const satisfies readonly ConcernKey[];

function makeAssessment(
  overrides: Partial<
    Record<ConcernKey, { present: boolean; confidence: number }>
  > = {},
): Assessment {
  return {
    findings: CONCERNS.map((concern) => {
      const o = overrides[concern];
      return {
        concern,
        present: o?.present ?? false,
        appearanceLevel: o?.present ? "moderate" : "none",
        confidence: o?.confidence ?? 0.9,
        contributingFactors: [],
        regions: o?.present ? ["cheeks"] : [],
        regionDetail: o?.present
          ? [{ region: "cheeks", appearanceLevel: "moderate" as const }]
          : [],
        // Corroborated across angles so the single-pose damp stays out of the
        // way of tests that are about something else.
        observedInPoses: o?.present ? (["front", "right", "left"] as const).slice() : [],
      };
    }),
    escalation: { recommendProfessional: false, reasons: [] },
    summary: "Skin looks generally healthy with a couple of areas to watch.",
    disclaimer: "Cosmetic guidance only, not a medical diagnosis.",
  };
}

/** Minimal AM/PM draft matching RoutineDraftSchema (nullable active/rampSchedule). */
function makeRoutineDraft(overrides: Partial<RoutineDraft> = {}): RoutineDraft {
  return {
    am: [
      {
        order: 1,
        category: "cleanser",
        active: null,
        frequencyPerWeek: 7,
        rampSchedule: null,
        rationale: "Gentle daily cleanse.",
        irritationRisk: "low",
      },
      // No AM sunscreen on purpose — asserts the safety engine adds one.
    ],
    pm: [
      {
        order: 1,
        category: "treatment",
        active: "salicylic_acid",
        frequencyPerWeek: 3,
        rampSchedule: "Start every other night.",
        rationale: "Targets visible congestion.",
        irritationRisk: "medium",
      },
      {
        order: 2,
        category: "moisturizer",
        active: null,
        frequencyPerWeek: 7,
        rampSchedule: null,
        rationale: "Support the barrier overnight.",
        irritationRisk: "low",
      },
    ],
    notes: [],
    ...overrides,
  };
}

describe("generatePlan (post-gate composition)", () => {
  let previousKey: string | undefined;

  beforeEach(() => {
    previousKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-key";
    parseMock.mockReset();
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previousKey;
  });

  it("composes a well-formed assessment + routine through every safety layer", async () => {
    parseMock
      .mockResolvedValueOnce({ parsed_output: makeAssessment() })
      .mockResolvedValueOnce({ parsed_output: makeRoutineDraft() });

    const result = await generatePlan({
      images: validImages,
      intake,
      scanSession: validSession,
    });

    expect(result.mode).toBe("ai");
    // The deterministic engine, not the model, guarantees this — the draft
    // above had no AM sunscreen step.
    expect(result.routine.am.some((s) => s.category === "sunscreen")).toBe(
      true,
    );
    expect(result.adjustments.some((a) => a.rule === "spf_required")).toBe(
      true,
    );
  });

  it("recovers a schema violation with one corrective retry", async () => {
    // Before this, a single stray value ended the scan: structured-output
    // parsing throws, and the SDK's own maxRetries covers transport only.
    parseMock
      .mockRejectedValueOnce(
        new Error('Failed to parse structured output: [{"code":"invalid_type"}]'),
      )
      .mockResolvedValueOnce({ parsed_output: makeAssessment() })
      .mockResolvedValueOnce({ parsed_output: makeRoutineDraft() });

    const result = await generatePlan({
      images: validImages,
      intake,
      scanSession: validSession,
    });

    expect(result.mode).toBe("ai");
    expect(parseMock).toHaveBeenCalledTimes(3);
    // The retry restates the assessment request with the failure appended.
    const retry = parseMock.mock.calls[1]![0] as {
      messages: { role: string; content: unknown }[];
    };
    expect(retry.messages).toHaveLength(2);
    expect(retry.messages[1]!.role).toBe("user");
    expect(String(retry.messages[1]!.content)).toContain("failed validation");
  });

  it("gives up after a second identical failure rather than looping", async () => {
    parseMock
      .mockResolvedValueOnce({ parsed_output: null })
      .mockResolvedValueOnce({ parsed_output: null });

    await expect(
      generatePlan({ images: validImages, intake, scanSession: validSession }),
    ).rejects.toMatchObject({ code: "ANALYSIS_INVALID_OUTPUT", status: 502 });
    expect(parseMock).toHaveBeenCalledTimes(2); // never reached the routine call
  });

  it("throws a typed, distinguishable error when the routine call keeps failing", async () => {
    parseMock
      .mockResolvedValueOnce({ parsed_output: makeAssessment() })
      .mockResolvedValueOnce({ parsed_output: null })
      .mockResolvedValueOnce({ parsed_output: null });

    await expect(
      generatePlan({ images: validImages, intake, scanSession: validSession }),
    ).rejects.toMatchObject({ code: "ANALYSIS_INVALID_OUTPUT", status: 502 });
  });

  it("reports a safety-classifier decline as its own outcome, without retrying", async () => {
    parseMock.mockResolvedValueOnce({ parsed_output: null, stop_reason: "refusal" });

    await expect(
      generatePlan({ images: validImages, intake, scanSession: validSession }),
    ).rejects.toMatchObject({ code: "ANALYSIS_DECLINED", status: 422 });
    expect(parseMock).toHaveBeenCalledTimes(1);
  });

  it("asks for server-side refusal recovery on both model calls", async () => {
    parseMock
      .mockResolvedValueOnce({ parsed_output: makeAssessment() })
      .mockResolvedValueOnce({ parsed_output: makeRoutineDraft() });

    await generatePlan({ images: validImages, intake, scanSession: validSession });

    for (const [params, options] of parseMock.mock.calls) {
      expect(params).toMatchObject({ fallbacks: "default" });
      expect(options).toMatchObject({
        headers: { "anthropic-beta": "server-side-fallback-2026-07-01" },
      });
    }
  });

  it("drops refusal recovery rather than the scan when the API rejects it", async () => {
    // A 400 about the parameter is a statement about the deployment, not the
    // response: it must not spend a structured attempt and must not fail a scan
    // that would otherwise have succeeded.
    const rejection = Object.assign(
      new Error("fallbacks: unsupported parameter"),
      { status: 400 },
    );
    parseMock
      .mockRejectedValueOnce(rejection)
      .mockResolvedValueOnce({ parsed_output: makeAssessment() })
      .mockResolvedValueOnce({ parsed_output: makeRoutineDraft() });

    const result = await generatePlan({
      images: validImages,
      intake,
      scanSession: validSession,
    });

    expect(result.mode).toBe("ai");
    // Retried immediately without the parameter, and the retry is clean.
    expect(parseMock.mock.calls[1]?.[0]).not.toHaveProperty("fallbacks");
    expect(parseMock.mock.calls[1]?.[1]).not.toHaveProperty("headers");
    // The corrective-retry budget was never touched, so the assessment call was
    // not asked to "fix" a response that was never the problem.
    expect(parseMock.mock.calls[1]?.[0].messages).toHaveLength(1);
  });

  it("normalizes an incomplete assessment instead of failing the scan", async () => {
    const partial = makeAssessment();
    partial.findings = partial.findings.slice(0, 4);
    parseMock
      .mockResolvedValueOnce({ parsed_output: partial })
      .mockResolvedValueOnce({ parsed_output: makeRoutineDraft() });

    const result = await generatePlan({
      images: validImages,
      intake,
      scanSession: validSession,
    });

    expect(result.assessment.findings).toHaveLength(CONCERNS.length);
    expect(parseMock).toHaveBeenCalledTimes(2); // no retry needed
  });

  it("strips an active tied only to a low-confidence finding, end-to-end", async () => {
    // Present, but below MIN_ACTIONABLE_CONFIDENCE (0.7) in assessment-policy.ts.
    parseMock
      .mockResolvedValueOnce({
        parsed_output: makeAssessment({
          acne_like_breakouts: { present: true, confidence: 0.4 },
        }),
      })
      .mockResolvedValueOnce({ parsed_output: makeRoutineDraft() });

    const result = await generatePlan({
      images: validImages,
      intake,
      scanSession: validSession,
    });

    expect(
      [...result.routine.am, ...result.routine.pm].some(
        (s) => s.active === "salicylic_acid",
      ),
    ).toBe(false);
    expect(
      result.adjustments.some((a) => a.rule === "assessment_evidence_removed"),
    ).toBe(true);
  });
});

describe("AnalysisRequestError shape", () => {
  it("carries a code and HTTP status the route can read directly", () => {
    const err = new AnalysisRequestError("x", "ANALYSIS_INVALID_OUTPUT", 502);
    expect(err.code).toBe("ANALYSIS_INVALID_OUTPUT");
    expect(err.status).toBe(502);
    expect(err).toBeInstanceOf(Error);
  });
});

describe("model-call failure handling", () => {
  let previousKey: string | undefined;

  beforeEach(() => {
    previousKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-key";
    parseMock.mockReset();
  });

  afterEach(() => {
    if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = previousKey;
  });

  const call = () =>
    generatePlan({ images: validImages, intake, scanSession: validSession });

  it("passes an abort signal to every model call so a hung call cannot run unbounded", async () => {
    parseMock
      .mockResolvedValueOnce({ parsed_output: makeAssessment() })
      .mockResolvedValueOnce({ parsed_output: makeRoutineDraft() });

    await call();

    expect(parseMock).toHaveBeenCalledTimes(2);
    for (const [, options] of parseMock.mock.calls) {
      expect(options?.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it("forwards the caller's signal, so a client disconnect cancels the model call", async () => {
    parseMock
      .mockResolvedValueOnce({ parsed_output: makeAssessment() })
      .mockResolvedValueOnce({ parsed_output: makeRoutineDraft() });

    const controller = new AbortController();
    await generatePlan({
      images: validImages,
      intake,
      scanSession: validSession,
      signal: controller.signal,
    });
    controller.abort();

    for (const [, options] of parseMock.mock.calls) {
      expect((options?.signal as AbortSignal).aborted).toBe(true);
    }
  });

  it("maps an aborted/timed-out call to a typed 504 rather than hanging", async () => {
    const abort = new Error("Request was aborted.");
    abort.name = "AbortError";
    parseMock.mockRejectedValueOnce(abort);

    await expect(call()).rejects.toMatchObject({
      code: "ANALYSIS_TIMEOUT",
      status: 504,
    });
  });

  it("surfaces an upstream rate limit as 429 instead of a generic failure", async () => {
    parseMock.mockRejectedValueOnce(Object.assign(new Error("rate limited"), { status: 429 }));

    await expect(call()).rejects.toMatchObject({
      code: "ANALYSIS_BUSY",
      status: 429,
    });
  });

  it("never leaks a structured-output validation message to the caller", async () => {
    // zodOutputFormat().parse throws on a schema violation; the raw message
    // enumerates our internal schema. It is fed back to the model on the retry
    // and must not reach the client on the way out.
    const schemaError = () =>
      new Error(
        'Failed to parse structured output: [{"code":"invalid_type","path":["findings",0,"confidence"]}]',
      );
    parseMock.mockRejectedValueOnce(schemaError()).mockRejectedValueOnce(schemaError());

    const error = await call().then(
      () => null,
      (cause: unknown) => cause as Error,
    );
    expect(error).toMatchObject({ code: "ANALYSIS_INVALID_OUTPUT", status: 502 });
    expect(error?.message).not.toContain("invalid_type");
    expect(error?.message).not.toContain("findings");
  });

  it("treats a persistently empty structured output as an invalid-output error", async () => {
    parseMock
      .mockResolvedValueOnce({ parsed_output: null })
      .mockResolvedValueOnce({ parsed_output: null });

    await expect(call()).rejects.toMatchObject({
      code: "ANALYSIS_INVALID_OUTPUT",
      status: 502,
    });
  });
});
