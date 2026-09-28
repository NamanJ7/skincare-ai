/**
 * The CSP is now built per request (middleware.ts) so it can carry a nonce.
 * Two properties are worth pinning hard:
 *
 *  1. `'unsafe-inline'` must never come back to script-src. It was there for
 *     years with a comment claiming browsers would ignore it — they only do
 *     that when the same directive also carries a nonce/hash/'strict-dynamic',
 *     which the old policy did not, so the CSP was providing no script
 *     protection at all.
 *  2. `'wasm-unsafe-eval'` must never be dropped. Without it /scan cannot
 *     instantiate the MediaPipe landmarker and every capture fails quality
 *     validation for reasons that look nothing like a CSP problem.
 */
import { describe, expect, it } from "vitest";

import { buildCsp, isIsolatedPath } from "../csp";

const NONCE = "dGVzdC1ub25jZS0xMjM0";

function directives(pathname: string, dev = false): Map<string, string> {
  const value = buildCsp({ nonce: NONCE, pathname, dev });
  return new Map(
    value.split(";").map((part) => {
      const [name, ...rest] = part.trim().split(/\s+/);
      return [name!, rest.join(" ")];
    }),
  );
}

describe("script-src", () => {
  it.each(["/", "/pricing", "/scan", "/blog/some-post"])(
    "carries the nonce and never 'unsafe-inline' on %s",
    (pathname) => {
      const script = directives(pathname).get("script-src")!;
      expect(script).toContain(`'nonce-${NONCE}'`);
      expect(script).not.toContain("'unsafe-inline'");
    },
  );

  it("keeps wasm-unsafe-eval, which the MediaPipe face landmarker needs", () => {
    expect(directives("/scan").get("script-src")).toContain("'wasm-unsafe-eval'");
  });

  it("does not use strict-dynamic, which would ignore our host sources", () => {
    // next/script injects the Tally widget by host, and MediaPipe reaches its
    // wasm loader through a dynamic import chain. 'self' + nonce blocks both
    // real vectors without making either of those depend on propagation rules.
    expect(directives("/").get("script-src")).not.toContain("'strict-dynamic'");
  });

  it("never allows a wildcard script or connect source", () => {
    for (const pathname of ["/", "/scan"]) {
      const d = directives(pathname);
      expect(d.get("script-src")).not.toContain("*");
      expect(d.get("connect-src")).not.toContain("*");
    }
  });

  it("adds unsafe-eval only in development, for React Refresh", () => {
    expect(directives("/", true).get("script-src")).toContain("'unsafe-eval'");
    expect(directives("/", false).get("script-src")).not.toContain("'unsafe-eval'");
    expect(directives("/", false).get("connect-src")).not.toContain("ws:");
  });
});

describe("third-party origin isolation", () => {
  it.each(["/scan", "/scan/", "/scan/review"])(
    "%s permits no tally.so origin in any directive",
    (pathname) => {
      const value = buildCsp({ nonce: NONCE, pathname });
      // app/(site)/layout.tsx keeps the widget off /scan; the old global header
      // still *permitted* it there, leaving a ready-made exfiltration channel
      // (connect-src api.tally.so) on the page holding face photos.
      expect(value).not.toContain("tally.so");
    },
  );

  it("still permits tally.so on the marketing pages that load the widget", () => {
    const d = directives("/pricing");
    expect(d.get("script-src")).toContain("https://tally.so");
    expect(d.get("connect-src")).toContain("https://api.tally.so");
    expect(d.get("frame-src")).toContain("https://tally.so");
  });

  it("frame-src is 'none' on the isolated pages rather than merely empty", () => {
    expect(directives("/scan").get("frame-src")).toBe("'none'");
  });

  it.each([
    ["/scan", true],
    ["/scan/capture", true],
    ["/scandal", false],
    ["/", false],
  ])("isIsolatedPath(%s) === %s", (pathname, expected) => {
    expect(isIsolatedPath(pathname)).toBe(expected);
  });
});

describe("baseline directives", () => {
  it("refuses to be framed and blocks plugin content", () => {
    const d = directives("/");
    expect(d.get("frame-ancestors")).toBe("'none'");
    expect(d.get("object-src")).toBe("'none'");
    expect(d.get("default-src")).toBe("'self'");
    expect(d.get("base-uri")).toBe("'self'");
    expect(d.get("form-action")).toBe("'self'");
  });

  it("allows blob workers, which MediaPipe spawns", () => {
    expect(directives("/scan").get("worker-src")).toContain("blob:");
  });

  it("upgrades insecure requests", () => {
    expect(directives("/").has("upgrade-insecure-requests")).toBe(true);
  });
});
