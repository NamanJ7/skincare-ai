/**
 * Account-deletion tests.
 *
 * Two properties matter here and neither is a status code:
 *   1. Nothing is deleted unless the caller proved identity — the assertion is
 *      `expect(deleteAuthUser).not.toHaveBeenCalled()`.
 *   2. The identity deleted is the one in the *token*, never anything the
 *      caller put in the body. That is what makes cross-user deletion
 *      structurally impossible rather than merely checked.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearRateLimits } from "@/lib/rate-limit";

const verifyBearer = vi.hoisted(() => vi.fn());
const deleteAuthUser = vi.hoisted(() => vi.fn());
const deleteScanPhotos = vi.hoisted(() => vi.fn());
const adminConfigured = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase-auth", () => ({ verifyBearer }));
vi.mock("@/lib/account-delete", () => ({
  deleteAuthUser,
  deleteScanPhotos,
  adminConfigured,
}));

const { DELETE, OPTIONS } = await import("../route");

const USER = "11111111-1111-4111-8111-111111111111";
const VICTIM = "22222222-2222-4222-8222-222222222222";

function request(init: { token?: string; body?: unknown } = {}): Request {
  return new Request("https://pore.skin/api/account", {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
}

beforeEach(() => {
  clearRateLimits();
  verifyBearer.mockResolvedValue({ kind: "user", userId: USER });
  adminConfigured.mockReturnValue(true);
  deleteScanPhotos.mockResolvedValue({ ok: true, removed: 3 });
  deleteAuthUser.mockResolvedValue({ ok: true, alreadyGone: false });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("DELETE /api/account", () => {
  it("rejects a request with no token and deletes nothing", async () => {
    verifyBearer.mockResolvedValue({ kind: "invalid" });

    const res = await DELETE(request());

    expect(res.status).toBe(401);
    expect(deleteScanPhotos).not.toHaveBeenCalled();
    expect(deleteAuthUser).not.toHaveBeenCalled();
  });

  it("rejects an invalid token and deletes nothing", async () => {
    verifyBearer.mockResolvedValue({ kind: "invalid" });

    const res = await DELETE(request({ token: "forged" }));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: "Sign-in is required to delete an account.",
      code: "UNAUTHENTICATED",
    });
    expect(deleteAuthUser).not.toHaveBeenCalled();
  });

  it("refuses when the auth service cannot be reached, rather than guessing", async () => {
    verifyBearer.mockResolvedValue({ kind: "unavailable" });

    const res = await DELETE(request({ token: "real" }));

    expect(res.status).toBe(503);
    expect(deleteAuthUser).not.toHaveBeenCalled();
  });

  it("refuses a devBypass caller, which has no identity to delete", async () => {
    verifyBearer.mockResolvedValue({ kind: "devBypass" });

    const res = await DELETE(request());

    expect(res.status).toBe(401);
    expect(deleteAuthUser).not.toHaveBeenCalled();
  });

  it("ignores a user id supplied in the body and deletes only the token's user", async () => {
    const res = await DELETE(
      request({ token: "real", body: { user_id: VICTIM, userId: VICTIM, id: VICTIM } }),
    );

    expect(res.status).toBe(200);
    expect(deleteAuthUser).toHaveBeenCalledWith(USER);
    expect(deleteScanPhotos).toHaveBeenCalledWith(USER);
    expect(deleteAuthUser).not.toHaveBeenCalledWith(VICTIM);
    expect(deleteScanPhotos).not.toHaveBeenCalledWith(VICTIM);
  });

  it("removes storage objects before the auth identity", async () => {
    const order: string[] = [];
    deleteScanPhotos.mockImplementation(async () => {
      order.push("storage");
      return { ok: true, removed: 3 };
    });
    deleteAuthUser.mockImplementation(async () => {
      order.push("auth");
      return { ok: true, alreadyGone: false };
    });

    await DELETE(request({ token: "real" }));

    // Once the auth row is gone the objects are orphaned with no owner to
    // attribute them to, so storage has to be cleared first.
    expect(order).toEqual(["storage", "auth"]);
  });

  it("does not delete the identity when storage cleanup fails", async () => {
    deleteScanPhotos.mockResolvedValue({ ok: false, removed: 0 });

    const res = await DELETE(request({ token: "real" }));

    expect(res.status).toBe(500);
    expect(deleteAuthUser).not.toHaveBeenCalled();
  });

  it("reports failure when the identity delete fails, never a false success", async () => {
    deleteAuthUser.mockResolvedValue({ ok: false });

    const res = await DELETE(request({ token: "real" }));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "Could not finish deleting your account. Please try again.",
      code: "DELETE_FAILED",
    });
  });

  it("is idempotent: deleting an already-deleted account succeeds", async () => {
    deleteAuthUser.mockResolvedValue({ ok: true, alreadyGone: true });

    const res = await DELETE(request({ token: "real" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, objectsRemoved: 3 });
  });

  it("refuses when no service-role key is configured", async () => {
    adminConfigured.mockReturnValue(false);

    const res = await DELETE(request({ token: "real" }));

    // Reporting success without the credentials to actually delete would be
    // the worst possible lie on this endpoint.
    expect(res.status).toBe(503);
    expect(deleteScanPhotos).not.toHaveBeenCalled();
    expect(deleteAuthUser).not.toHaveBeenCalled();
  });

  it("throttles repeated deletion attempts from the same user", async () => {
    for (let i = 0; i < 3; i++) {
      expect((await DELETE(request({ token: "real" }))).status).toBe(200);
    }

    const res = await DELETE(request({ token: "real" }));

    expect(res.status).toBe(429);
    expect(deleteAuthUser).toHaveBeenCalledTimes(3);
  });

  it("never returns the response as cacheable", async () => {
    const res = await DELETE(request({ token: "real" }));
    expect(res.headers.get("cache-control")).toBe("no-store, max-age=0");
  });
});

/**
 * Same reasoning as the plan route: no CORS is the correct production posture
 * here, and this route is the one where a permissive policy would matter most —
 * it is irreversible. Note that `DELETE` is never a simple request, so a
 * preflight it cannot pass is itself a control.
 */
describe("CORS", () => {
  const ORIGIN = "http://127.0.0.1:8104";

  function preflight(origin?: string): Request {
    return new Request("https://pore.skin/api/account", {
      method: "OPTIONS",
      headers: origin ? { origin } : {},
    });
  }

  it("emits no Access-Control-* header by default, on success or failure", async () => {
    verifyBearer.mockResolvedValueOnce({ kind: "user", userId: USER });
    const ok = await DELETE(request({ token: "good" }));
    verifyBearer.mockResolvedValueOnce({ kind: "invalid" });
    const denied = await DELETE(request());

    for (const res of [ok, denied]) {
      const keys = [...res.headers.keys()].map((k) => k.toLowerCase());
      expect(keys.filter((k) => k.startsWith("access-control-"))).toEqual([]);
    }
  });

  it("refuses preflights with 405 when no allowlist is configured", async () => {
    const res = await OPTIONS(preflight(ORIGIN));
    expect(res.status).toBe(405);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(res.headers.get("allow")).toBe("DELETE, OPTIONS");
  });

  it("answers an allowlisted preflight scoped to DELETE, without credentials", async () => {
    vi.stubEnv("ALLOWED_ORIGINS", ORIGIN);
    const res = await OPTIONS(preflight(ORIGIN));
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(res.headers.get("access-control-allow-methods")).toBe("DELETE, OPTIONS");
    expect(res.headers.get("access-control-allow-headers")).toBe(
      "authorization, content-type",
    );
    expect(res.headers.get("access-control-allow-credentials")).toBeNull();
  });

  it("never reflects an unlisted origin onto a deletion response", async () => {
    vi.stubEnv("ALLOWED_ORIGINS", ORIGIN);
    const res = await DELETE(
      new Request("https://pore.skin/api/account", {
        method: "DELETE",
        headers: { authorization: "Bearer good", origin: "https://evil.com" },
      }),
    );
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("keeps Cache-Control: no-store alongside the CORS headers", async () => {
    vi.stubEnv("ALLOWED_ORIGINS", ORIGIN);
    const res = await DELETE(
      new Request("https://pore.skin/api/account", {
        method: "DELETE",
        headers: { authorization: "Bearer good", origin: ORIGIN },
      }),
    );
    expect(res.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
  });
});
