/**
 * Abuse-control tests for the paid analysis endpoint.
 *
 * The assertion that matters in almost every case below is
 * `expect(generatePlan).not.toHaveBeenCalled()` — each control has to reject
 * *before* two Opus calls are billed, not merely return an error afterwards.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearRateLimits } from "@/lib/rate-limit";
import { AnalysisRequestError } from "@/lib/scan-analysis-guard";

const generatePlan = vi.hoisted(() => vi.fn());
const claimAnalysisSlot = vi.hoisted(() => vi.fn());
const releaseAnalysisSlot = vi.hoisted(() => vi.fn());
const quotaConfigured = vi.hoisted(() => vi.fn());
const verifyBearer = vi.hoisted(() => vi.fn());
const devBypassEnabled = vi.hoisted(() => vi.fn());

vi.mock("@/lib/pipeline", () => ({ generatePlan }));
vi.mock("@/lib/quota", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/quota")>()),
  claimAnalysisSlot,
  releaseAnalysisSlot,
  quotaConfigured,
}));
vi.mock("@/lib/supabase-auth", () => ({ verifyBearer, devBypassEnabled }));

const { POST, OPTIONS } = await import("../route");

const USER = "11111111-1111-4111-8111-111111111111";

function capture(stepId: string, digest: string) {
  return {
    stepId,
    sessionId: "session-1",
    captureId: `capture-${stepId}`,
    frameId: `frame-${stepId}`,
    contentDigest: digest,
    perceptualHash: "phash",
    capturedAt: 1_700_000_000_000,
    width: 1080,
    height: 1440,
    yawDeg: 0,
    quality: {
      provenance: {},
      metrics: {},
      blockingIssues: [],
      warnings: [],
    },
  };
}

/** A structurally valid request. Content correctness is the guard's job. */
function body(overrides: Record<string, unknown> = {}) {
  return {
    intake: {
      age: 28,
      goals: ["acne"],
      sensitivity: "medium",
      currentProducts: [],
      allergies: [],
      pregnancyOrBreastfeeding: false,
    },
    scanSession: {
      sessionId: "session-1",
      startedAt: 1_700_000_000_000,
      captures: {
        front: capture("front", "digest-front"),
        right: capture("right", "digest-right"),
        left: capture("left", "digest-left"),
      },
    },
    images: [
      { data: "AAAA", mediaType: "image/jpeg", stepId: "front", captureId: "capture-front", contentDigest: "digest-front" },
      { data: "BBBB", mediaType: "image/jpeg", stepId: "right", captureId: "capture-right", contentDigest: "digest-right" },
      { data: "CCCC", mediaType: "image/jpeg", stepId: "left", captureId: "capture-left", contentDigest: "digest-left" },
    ],
    ...overrides,
  };
}

function request(payload: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/plan", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(payload),
  });
}

beforeEach(() => {
  clearRateLimits();
  generatePlan.mockReset().mockResolvedValue({ mode: "ai" });
  claimAnalysisSlot.mockReset().mockResolvedValue({ outcome: "allowed", remaining: 2 });
  releaseAnalysisSlot.mockReset().mockResolvedValue(undefined);
  quotaConfigured.mockReset().mockReturnValue(true);
  verifyBearer
    .mockReset()
    .mockResolvedValue({ kind: "user", userId: USER, isAnonymous: false });
  devBypassEnabled.mockReset().mockReturnValue(false);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("authentication", () => {
  it("rejects an unauthenticated caller without touching the model", async () => {
    verifyBearer.mockResolvedValue({ kind: "invalid" });
    const res = await POST(request(body()));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "UNAUTHENTICATED" });
    expect(generatePlan).not.toHaveBeenCalled();
    expect(claimAnalysisSlot).not.toHaveBeenCalled();
  });

  it("fails closed when the auth service cannot be reached", async () => {
    verifyBearer.mockResolvedValue({ kind: "unavailable" });
    const res = await POST(request(body()));
    expect(res.status).toBe(503);
    expect(generatePlan).not.toHaveBeenCalled();
  });

  it("refuses a verified user when no durable quota store is configured", async () => {
    quotaConfigured.mockReturnValue(false);
    const res = await POST(request(body()));
    expect(res.status).toBe(503);
    expect(generatePlan).not.toHaveBeenCalled();
  });
});

describe("quota and replay", () => {
  it("runs the pipeline once on the happy path and books the spend", async () => {
    const res = await POST(request(body()));
    expect(res.status).toBe(200);
    expect(generatePlan).toHaveBeenCalledTimes(1);
    expect(releaseAnalysisSlot).toHaveBeenCalledWith(
      USER,
      expect.any(String),
      "succeeded",
      false,
    );
  });

  it("blocks a replayed request without a second model call", async () => {
    claimAnalysisSlot.mockResolvedValueOnce({ outcome: "allowed", remaining: 2 });
    claimAnalysisSlot.mockResolvedValueOnce({ outcome: "duplicate", remaining: 0 });

    const first = await POST(request(body()));
    const second = await POST(request(body()));

    expect(first.status).toBe(200);
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ code: "DUPLICATE_REQUEST" });
    expect(generatePlan).toHaveBeenCalledTimes(1);
  });

  it("derives the same request hash regardless of image order", async () => {
    await POST(request(body()));
    const reordered = body();
    reordered.images.reverse();
    await POST(request(reordered));

    const [, firstHash] = claimAnalysisSlot.mock.calls[0]!;
    const [, secondHash] = claimAnalysisSlot.mock.calls[1]!;
    expect(secondHash).toBe(firstHash);
  });

  it("stops an over-quota user before the model", async () => {
    claimAnalysisSlot.mockResolvedValue({ outcome: "quota_exceeded", remaining: 0 });
    const res = await POST(request(body()));
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ code: "QUOTA_EXCEEDED" });
    expect(generatePlan).not.toHaveBeenCalled();
  });

  it("stops everyone when the breaker is open", async () => {
    claimAnalysisSlot.mockResolvedValue({ outcome: "disabled", remaining: 0 });
    const res = await POST(request(body()));
    expect(res.status).toBe(503);
    expect(generatePlan).not.toHaveBeenCalled();
  });

  it("stops everyone at the deployment-wide daily cap", async () => {
    claimAnalysisSlot.mockResolvedValue({ outcome: "global_cap", remaining: 0 });
    const res = await POST(request(body()));
    expect(res.status).toBe(503);
    expect(generatePlan).not.toHaveBeenCalled();
  });

  it("refunds the slot when the guard rejects before any model call", async () => {
    generatePlan.mockRejectedValue(
      new AnalysisRequestError("bad capture", "SCAN_QUALITY_REQUIRED", 422),
    );
    const res = await POST(request(body()));
    expect(res.status).toBe(422);
    expect(releaseAnalysisSlot).toHaveBeenCalledWith(
      USER,
      expect.any(String),
      "refunded",
      false,
    );
  });

  it("keeps the debit when the model ran and then failed", async () => {
    generatePlan.mockRejectedValue(new Error("upstream 500"));
    const res = await POST(request(body()));
    expect(res.status).toBe(500);
    // The generic body must not leak internal schema detail.
    expect(await res.json()).toEqual({
      error: "Skin analysis failed. Try again in a moment.",
      code: "ANALYSIS_FAILED",
    });
    expect(releaseAnalysisSlot).toHaveBeenCalledWith(
      USER,
      expect.any(String),
      "failed",
      false,
    );
  });
});

describe("rate limiting", () => {
  it("sheds a burst before reaching the quota store", async () => {
    for (let i = 0; i < 3; i++) {
      expect((await POST(request(body()))).status).toBe(200);
    }
    const res = await POST(request(body()));
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ code: "rate_limited" });
    expect(generatePlan).toHaveBeenCalledTimes(3);
    expect(claimAnalysisSlot).toHaveBeenCalledTimes(3);
  });
});

describe("payload limits", () => {
  it("rejects an oversized declared body before parsing it", async () => {
    const res = await POST(
      request(body(), { "content-length": String(64 * 1024 * 1024) }),
    );
    expect(res.status).toBe(413);
    expect(generatePlan).not.toHaveBeenCalled();
    expect(verifyBearer).not.toHaveBeenCalled();
  });

  it("rejects an oversized chunked body that omits content-length", async () => {
    // Regression: the old guard was `Number(header ?? "")`, which is 0 when the
    // header is absent — and `0 > MAX` is false, so a Transfer-Encoding body
    // skipped the ceiling entirely and fell into an unbounded req.json().
    const payload = new TextEncoder().encode(
      JSON.stringify({ pad: "x".repeat(7 * 1024 * 1024) }),
    );
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < payload.length; i += 65_536) {
          controller.enqueue(payload.slice(i, i + 65_536));
        }
        controller.close();
      },
    });
    const chunked = new Request("http://localhost/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stream,
      // @ts-expect-error duplex is required by undici for a stream body.
      duplex: "half",
    });

    const res = await POST(chunked);

    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
    expect(generatePlan).not.toHaveBeenCalled();
    expect(claimAnalysisSlot).not.toHaveBeenCalled();
  });

  it("rejects an unbounded intake before consuming a slot", async () => {
    const bloated = body();
    // Unbounded free text used to be interpolated verbatim into both prompts.
    (bloated.intake as Record<string, unknown>).allergyNotes = "x".repeat(50_000);

    const res = await POST(request(bloated));

    expect(res.status).toBe(400);
    expect(generatePlan).not.toHaveBeenCalled();
    expect(claimAnalysisSlot).not.toHaveBeenCalled();
  });

  it("rejects an oversized image before base64 decoding it", async () => {
    const huge = body();
    huge.images[0]!.data = "A".repeat(2_000_000);
    const res = await POST(request(huge));
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
    expect(generatePlan).not.toHaveBeenCalled();
    expect(claimAnalysisSlot).not.toHaveBeenCalled();
  });
});

describe("input validation", () => {
  it.each([
    ["missing intake", { intake: undefined }],
    ["missing scanSession", { scanSession: undefined }],
    ["wrong image count", { images: [] }],
  ])("rejects %s without consuming a slot", async (_label, override) => {
    const res = await POST(request(body(override)));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(generatePlan).not.toHaveBeenCalled();
    expect(claimAnalysisSlot).not.toHaveBeenCalled();
  });

  it("rejects a malformed scan session without consuming a slot", async () => {
    const res = await POST(
      request(body({ scanSession: { sessionId: "x", startedAt: 1, captures: {} } })),
    );
    expect(res.status).toBe(400);
    expect(generatePlan).not.toHaveBeenCalled();
    expect(claimAnalysisSlot).not.toHaveBeenCalled();
  });

  it("rejects an intake the safety engine cannot reason about", async () => {
    const res = await POST(
      request(body({ intake: { age: 28, goals: ["acne"] } })),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(generatePlan).not.toHaveBeenCalled();
    expect(claimAnalysisSlot).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON", async () => {
    const res = await POST(
      new Request("http://localhost/api/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not json",
      }),
    );
    expect(res.status).toBe(400);
    expect(generatePlan).not.toHaveBeenCalled();
  });
});

/**
 * The API has never emitted a CORS header, and that is a security property
 * rather than a gap: auth is a bearer token, never a cookie, so with no policy
 * there are no ambient credentials a cross-origin page could cause to be sent.
 * The realistic way it gets undone is someone hitting the "Expo web preview
 * can't reach the API" wall and reaching for `*`. This is what fails then.
 */
describe("CORS", () => {
  const ORIGIN = "http://127.0.0.1:8104";

  function preflight(origin?: string) {
    return new Request("http://localhost/api/plan", {
      method: "OPTIONS",
      headers: origin ? { origin } : {},
    });
  }

  it("emits no Access-Control-* header on any response by default", async () => {
    for (const res of [
      await POST(request(body(), { origin: ORIGIN })),
      await POST(request({}, { origin: ORIGIN })),
    ]) {
      const keys = [...res.headers.keys()].map((k) => k.toLowerCase());
      expect(keys.filter((k) => k.startsWith("access-control-"))).toEqual([]);
    }
  });

  it("refuses preflights with 405 when no allowlist is configured", async () => {
    const res = await OPTIONS(preflight(ORIGIN));
    expect(res.status).toBe(405);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("answers a preflight from an allowlisted origin, scoped to POST", async () => {
    vi.stubEnv("ALLOWED_ORIGINS", ORIGIN);
    const res = await OPTIONS(preflight(ORIGIN));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(res.headers.get("access-control-allow-methods")).toBe("POST, OPTIONS");
    expect(res.headers.get("access-control-allow-credentials")).toBeNull();
  });

  it("never reflects an unlisted origin", async () => {
    vi.stubEnv("ALLOWED_ORIGINS", ORIGIN);
    const res = await POST(request(body(), { origin: "https://evil.com" }));
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("applies the policy to failures too, not only to successes", async () => {
    vi.stubEnv("ALLOWED_ORIGINS", ORIGIN);
    verifyBearer.mockResolvedValue({ kind: "invalid" });
    const res = await POST(request(body(), { origin: ORIGIN }));
    expect(res.status).toBe(401);
    // Otherwise the browser reports a 401 as an opaque network error.
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
  });
});

describe("response contract", () => {
  it("returns exactly the four public fields, never the whole PlanResult", async () => {
    // PlanResult is internal and free to grow. Response.json(result) would ship
    // every future addition — debug output, token accounting, raw model text —
    // to clients the moment it landed.
    generatePlan.mockResolvedValue({
      assessment: { a: 1 },
      routine: { r: 2 },
      adjustments: [],
      mode: "ai",
      debugPrompt: "SYSTEM: you are...",
      usage: { inputTokens: 900 },
    });
    const res = await POST(request(body()));
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(json).sort()).toEqual([
      "adjustments",
      "assessment",
      "mode",
      "routine",
    ]);
  });
});

describe("error bodies", () => {
  it("does not enumerate intake field names to the caller", async () => {
    const res = await POST(request(body({ intake: {} })));
    expect(res.status).toBe(400);
    const text = JSON.stringify(await res.json());
    for (const field of [
      "age",
      "goals",
      "sensitivity",
      "currentProducts",
      "allergies",
      "pregnancyOrBreastfeeding",
    ]) {
      expect(text).not.toContain(field);
    }
    expect(generatePlan).not.toHaveBeenCalled();
    expect(claimAnalysisSlot).not.toHaveBeenCalled();
  });

  it("rejects unbounded identifier strings before claiming a slot", async () => {
    // These pass the per-image ceiling (which measures image.data) and then get
    // concatenated into the request hash, so they need a bound of their own.
    const huge = "x".repeat(5_000);
    const payload = body();
    payload.scanSession.captures.front.captureId = huge;
    const res = await POST(request(payload));
    expect(res.status).toBe(400);
    expect(claimAnalysisSlot).not.toHaveBeenCalled();
    expect(generatePlan).not.toHaveBeenCalled();
  });

  it("rejects an over-long contentDigest (a sha256 hex is exactly 64 chars)", async () => {
    const payload = body();
    payload.scanSession.captures.left.contentDigest = "a".repeat(200);
    const res = await POST(request(payload));
    expect(res.status).toBe(400);
    expect(generatePlan).not.toHaveBeenCalled();
  });
});
