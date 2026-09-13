/**
 * The most important assertions here are the negative ones.
 *
 * Production ships with no allowlist, and that is a security property, not a
 * gap: auth is a bearer header rather than a cookie, so with no CORS policy the
 * API is structurally CSRF-immune. The realistic way that gets undone is
 * someone hitting the "Expo web preview can't reach the API" wall and reaching
 * for `Access-Control-Allow-Origin: *`. These tests are what fails when they do.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { allowedOrigin, corsHeaders, preflightResponse } from "../cors";

const ORIGIN = "http://127.0.0.1:8104";

function request(origin?: string): Request {
  return new Request("http://localhost/api/plan", {
    method: "OPTIONS",
    headers: origin ? { origin } : {},
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("with no allowlist configured (the production default)", () => {
  it("emits no CORS headers at all", () => {
    expect(corsHeaders(request(ORIGIN))).toEqual({});
    expect(corsHeaders(request())).toEqual({});
  });

  it("refuses preflights with a plain 405 and no policy", () => {
    const res = preflightResponse(request(ORIGIN), ["POST"]);
    expect(res.status).toBe(405);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect(res.headers.get("access-control-allow-methods")).toBeNull();
    // Same shape Next returns for a route with no OPTIONS export.
    expect(res.headers.get("allow")).toBe("POST, OPTIONS");
  });

  it("treats an empty or whitespace-only env value as unset", () => {
    vi.stubEnv("ALLOWED_ORIGINS", "  ,  , ");
    expect(corsHeaders(request(ORIGIN))).toEqual({});
    expect(preflightResponse(request(ORIGIN), ["POST"]).status).toBe(405);
  });
});

describe("with an allowlist configured", () => {
  it("echoes an exact listed origin and varies on Origin", () => {
    vi.stubEnv("ALLOWED_ORIGINS", `${ORIGIN},https://staging.pore.skin`);
    expect(corsHeaders(request(ORIGIN))).toEqual({
      "Access-Control-Allow-Origin": ORIGIN,
      Vary: "Origin",
    });
  });

  it("never reflects an unlisted origin", () => {
    vi.stubEnv("ALLOWED_ORIGINS", ORIGIN);
    const headers = corsHeaders(request("https://evil.com"));
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    // Vary is still present so a cache cannot serve the allowed response here.
    expect(headers.Vary).toBe("Origin");
  });

  it.each([
    ["http://127.0.0.1:8105", "different port"],
    ["https://127.0.0.1:8104", "different scheme"],
    ["http://127.0.0.1:8104.evil.com", "suffix attack"],
    ["http://evil.com/?x=http://127.0.0.1:8104", "substring"],
  ])("rejects %s (%s) — matching is exact, never prefix or substring", (origin) => {
    vi.stubEnv("ALLOWED_ORIGINS", ORIGIN);
    expect(allowedOrigin(request(origin))).toBeNull();
  });

  it("constrains the preflight to the route's own methods and headers", () => {
    vi.stubEnv("ALLOWED_ORIGINS", ORIGIN);
    const res = preflightResponse(request(ORIGIN), ["POST"]);
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    expect(res.headers.get("access-control-allow-methods")).toBe("POST, OPTIONS");
    expect(res.headers.get("access-control-allow-headers")).toBe(
      "authorization, content-type",
    );
    expect(res.headers.get("vary")).toBe("Origin");
  });

  it("scopes methods per route rather than sending a blanket verb list", () => {
    vi.stubEnv("ALLOWED_ORIGINS", ORIGIN);
    expect(
      preflightResponse(request(ORIGIN), ["DELETE"]).headers.get(
        "access-control-allow-methods",
      ),
    ).toBe("DELETE, OPTIONS");
  });

  it("still refuses a preflight from an unlisted origin", () => {
    vi.stubEnv("ALLOWED_ORIGINS", ORIGIN);
    const res = preflightResponse(request("https://evil.com"), ["POST"]);
    expect(res.status).toBe(405);
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});

describe("wildcards and credentials", () => {
  it("refuses a literal `*` in the env var rather than honouring it", () => {
    vi.stubEnv("ALLOWED_ORIGINS", "*");
    expect(corsHeaders(request(ORIGIN))).toEqual({});
    expect(preflightResponse(request(ORIGIN), ["POST"]).status).toBe(405);
  });

  it("drops `*` but keeps the real entries alongside it", () => {
    vi.stubEnv("ALLOWED_ORIGINS", `*,${ORIGIN}`);
    expect(allowedOrigin(request(ORIGIN))).toBe(ORIGIN);
    expect(allowedOrigin(request("https://anything.com"))).toBeNull();
  });

  it.each([
    ["actual request", () => corsHeaders(request(ORIGIN))],
    ["preflight", () => Object.fromEntries(preflightResponse(request(ORIGIN), ["POST"]).headers)],
  ])("never sends Allow-Credentials on a %s", (_label, build) => {
    vi.stubEnv("ALLOWED_ORIGINS", ORIGIN);
    const headers = build() as Record<string, string>;
    const keys = Object.keys(headers).map((k) => k.toLowerCase());
    expect(keys).not.toContain("access-control-allow-credentials");
  });

  it("never emits `*` as the allowed origin under any configuration", () => {
    for (const value of ["*", `*,${ORIGIN}`, ORIGIN, ""]) {
      vi.stubEnv("ALLOWED_ORIGINS", value);
      const actual = corsHeaders(request(ORIGIN));
      expect(actual["Access-Control-Allow-Origin"]).not.toBe("*");
      expect(
        preflightResponse(request(ORIGIN), ["POST"]).headers.get(
          "access-control-allow-origin",
        ),
      ).not.toBe("*");
    }
  });
});
