import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearVerificationCache,
  devBypassEnabled,
  verifyBearer,
} from "../supabase-auth";

const T0 = 1_700_000_000_000;

function request(authorization?: string): Request {
  return new Request("http://localhost/api/plan", {
    headers: authorization ? { authorization } : {},
  });
}

beforeEach(() => {
  clearVerificationCache();
  vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/**
 * This guards an endpoint that spends money, so it must never resolve to
 * "anonymous" — every uncertain path has to stop the request. The optional
 * variant that used to live beside it was deleted: it was unused, and its catch
 * degraded to "anonymous" on a network failure, which turns an auth-service
 * outage into an authorization bypass on any endpoint that trusts anonymous.
 */
describe("verifyBearer", () => {
  it("resolves a valid token to its user id", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "user-123", is_anonymous: false }), { status: 200 }),
    );
    expect(await verifyBearer(request("Bearer good"), T0)).toEqual({
      kind: "user",
      userId: "user-123",
      isAnonymous: false,
    });
  });

  it("rejects a missing Authorization header", async () => {
    expect(await verifyBearer(request(), T0)).toEqual({ kind: "invalid" });
  });

  it("rejects a present-but-invalid token", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{}", { status: 401 }),
    );
    expect(await verifyBearer(request("Bearer bad"), T0)).toEqual({
      kind: "invalid",
    });
  });

  it("rejects a 200 that carries no user id", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    );
    expect(await verifyBearer(request("Bearer odd"), T0)).toEqual({
      kind: "invalid",
    });
  });

  it("reports unavailable when the auth service is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    expect(await verifyBearer(request("Bearer good"), T0)).toEqual({
      kind: "unavailable",
    });
  });

  it("does not cache a transient outage against the token", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "user-123", is_anonymous: false }), { status: 200 }),
      );
    expect(await verifyBearer(request("Bearer good"), T0)).toEqual({
      kind: "unavailable",
    });
    expect(await verifyBearer(request("Bearer good"), T0 + 10)).toEqual({
      kind: "user",
      userId: "user-123",
      isAnonymous: false,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("reports unavailable — not anonymous — when config is missing", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("SUPABASE_ANON_KEY", "");
    expect(await verifyBearer(request("Bearer good"), T0)).toEqual({
      kind: "unavailable",
    });
  });
});

describe("devBypassEnabled", () => {
  it("is off unless explicitly opted into", () => {
    expect(devBypassEnabled()).toBe(false);
    vi.stubEnv("ALLOW_UNAUTHENTICATED_ANALYSIS", "true");
    expect(devBypassEnabled()).toBe(true);
  });

  it("is ignored in production no matter what the env says", () => {
    vi.stubEnv("ALLOW_UNAUTHENTICATED_ANALYSIS", "true");
    vi.stubEnv("NODE_ENV", "production");
    expect(devBypassEnabled()).toBe(false);
  });
});

describe("anonymous identity", () => {
  /**
   * Anonymous users are free to mint, so they meter against a stricter analysis
   * cap (supabase/migrations/20260818000009). Getting this flag wrong in the
   * permissive direction hands an attacker the full per-account allowance on
   * every throwaway identity, so an unknown must resolve to "anonymous".
   */
  beforeEach(() => {
    clearVerificationCache();
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
  });

  it("marks a converted account as not anonymous", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "user-123", is_anonymous: false }), {
        status: 200,
      }),
    );
    expect(await verifyBearer(request("Bearer good"), T0)).toEqual({
      kind: "user",
      userId: "user-123",
      isAnonymous: false,
    });
  });

  it("marks an anonymous session as anonymous", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "anon-1", is_anonymous: true }), {
        status: 200,
      }),
    );
    expect(await verifyBearer(request("Bearer good"), T0)).toEqual({
      kind: "user",
      userId: "anon-1",
      isAnonymous: true,
    });
  });

  it("treats a missing is_anonymous claim as anonymous, not as an account", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "user-123" }), { status: 200 }),
    );
    expect(await verifyBearer(request("Bearer good"), T0)).toMatchObject({
      isAnonymous: true,
    });
  });

  it("treats a non-boolean is_anonymous as anonymous", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "user-123", is_anonymous: "no" }), {
        status: 200,
      }),
    );
    expect(await verifyBearer(request("Bearer good"), T0)).toMatchObject({
      isAnonymous: true,
    });
  });
});

/**
 * Both of these are about how much trust we extend beyond what we verified.
 */
describe("credential and cache discipline", () => {
  function tokenExpiringAt(seconds: number): string {
    const payload = Buffer.from(JSON.stringify({ exp: seconds })).toString("base64url");
    return `header.${payload}.signature`;
  }

  it("presents the anon key, not the service-role key, to /auth/v1/user", async () => {
    vi.stubEnv("SUPABASE_ANON_KEY", "anon-key");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "user-123", is_anonymous: false }), { status: 200 }),
    );
    await verifyBearer(request("Bearer good"), T0);

    // The caller's own token is what authenticates this call; `apikey` only
    // identifies the project, so service-role here is privilege we never need.
    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.apikey).toBe("anon-key");
    expect(headers.authorization).toBe("Bearer good");
  });

  it("falls back to the service-role key when no anon key is configured", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "user-123", is_anonymous: false }), { status: 200 }),
    );
    await verifyBearer(request("Bearer good"), T0);
    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    expect((init.headers as Record<string, string>).apikey).toBe("service-key");
  });

  it("refuses to follow a redirect away from the configured auth host", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "user-123" }), { status: 200 }),
    );
    await verifyBearer(request("Bearer good"), T0);
    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    expect(init.redirect).toBe("error");
  });

  it("treats an unsafe SUPABASE_URL as unconfigured rather than a host to call", async () => {
    // Link-local is the cloud-metadata address; sending a project key there is
    // the failure mode lib/safe-url.ts exists to prevent.
    vi.stubEnv("SUPABASE_URL", "http://169.254.169.254");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await verifyBearer(request("Bearer good"), T0)).toEqual({
      kind: "unavailable",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("stops honouring a cached verification once the token's own exp passes", async () => {
    const token = tokenExpiringAt(Math.floor(T0 / 1000) + 30);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "user-123", is_anonymous: false }), { status: 200 }),
    );

    await verifyBearer(request(`Bearer ${token}`), T0);
    // Inside the token's lifetime: served from cache.
    await verifyBearer(request(`Bearer ${token}`), T0 + 10_000);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Past exp but well inside the 5-minute TTL — the old code kept accepting
    // this for another ~4.5 minutes, including on the account-delete endpoint.
    await verifyBearer(request(`Bearer ${token}`), T0 + 31_000);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("still applies its own TTL to a token with no readable exp", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "user-123", is_anonymous: false }), { status: 200 }),
    );
    await verifyBearer(request("Bearer opaque"), T0);
    await verifyBearer(request("Bearer opaque"), T0 + 60_000);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    await verifyBearer(request("Bearer opaque"), T0 + 5 * 60_000 + 1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("does not cache a token that is already expired", async () => {
    const token = tokenExpiringAt(Math.floor(T0 / 1000) - 1);
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "user-123", is_anonymous: false }), { status: 200 }),
    );
    await verifyBearer(request(`Bearer ${token}`), T0);
    await verifyBearer(request(`Bearer ${token}`), T0);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
