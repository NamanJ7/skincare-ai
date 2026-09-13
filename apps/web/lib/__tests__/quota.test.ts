import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  analysisRequestHash,
  claimAnalysisSlot,
  quotaConfigured,
  releaseAnalysisSlot,
} from "../quota";

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("claimAnalysisSlot", () => {
  it("passes through an allowed claim", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ outcome: "allowed", remaining: 2 }])),
    );
    expect(await claimAnalysisSlot("user", "hash", null, true)).toEqual({
      outcome: "allowed",
      remaining: 2,
    });
  });

  it.each(["duplicate", "quota_exceeded", "global_cap", "disabled"])(
    "passes through a %s claim",
    async (outcome) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify([{ outcome, remaining: 0 }])),
      );
      expect((await claimAnalysisSlot("user", "hash", null, true)).outcome).toBe(outcome);
    },
  );

  // The whole point of the control: an unavailable limiter must never degrade
  // into unlimited paid API usage.
  it("fails closed when the datastore is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    expect(await claimAnalysisSlot("user", "hash", null, true)).toEqual({
      outcome: "disabled",
      remaining: 0,
    });
  });

  it("fails closed on a non-2xx response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 500 }),
    );
    expect((await claimAnalysisSlot("user", "hash", null, true)).outcome).toBe("disabled");
  });

  it("fails closed on an unrecognised outcome", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ outcome: "surprise" }])),
    );
    expect((await claimAnalysisSlot("user", "hash", null, true)).outcome).toBe("disabled");
  });

  it("fails closed when the quota store is not configured", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect((await claimAnalysisSlot("user", "hash", null, true)).outcome).toBe("disabled");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("authenticates with the service role, never the anon key", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify([{ outcome: "allowed", remaining: 1 }])),
      );
    await claimAnalysisSlot("user", "hash", "iphash", true);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toContain("/rest/v1/rpc/claim_analysis_slot");
    expect((init?.headers as Record<string, string>).authorization).toBe(
      "Bearer service-key",
    );
  });
});

describe("releaseAnalysisSlot", () => {
  // A bookkeeping failure must not turn a successful, already-paid-for
  // analysis into an error for the user.
  it("never throws when the datastore is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    await expect(
      releaseAnalysisSlot("user", "hash", "succeeded", true),
    ).resolves.toBeUndefined();
  });
});

describe("analysisRequestHash", () => {
  it("is stable for the same scan and distinct across users and sessions", () => {
    const base = analysisRequestHash("user-a", "session-1", ["d1", "d2", "d3"]);
    expect(base).toBe(analysisRequestHash("user-a", "session-1", ["d1", "d2", "d3"]));
    expect(base).not.toBe(analysisRequestHash("user-b", "session-1", ["d1", "d2", "d3"]));
    expect(base).not.toBe(analysisRequestHash("user-a", "session-2", ["d1", "d2", "d3"]));
    expect(base).not.toBe(analysisRequestHash("user-a", "session-1", ["d1", "d2", "d9"]));
  });
});

describe("quotaConfigured", () => {
  it("reports configuration honestly", () => {
    expect(quotaConfigured()).toBe(true);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(quotaConfigured()).toBe(false);
  });
});
