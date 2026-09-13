/**
 * The static header policy, pinned. It is easy to weaken by accident and
 * impossible to notice from the UI — the camera permission in particular is
 * load-bearing for /scan: drop it and the scan-quality pipeline silently breaks
 * while every page still renders fine.
 *
 * Content-Security-Policy is deliberately NOT here any more. It is built per
 * request so it can carry a nonce (lib/csp.ts + middleware.ts) and is pinned by
 * lib/__tests__/csp.test.ts. This file asserts it has not crept back into the
 * static config, since two CSP headers would be enforced as an intersection and
 * the resulting behaviour is nobody's intent.
 */
import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

async function headerMap(): Promise<Map<string, string>> {
  const rules = await nextConfig.headers!();
  const applied = rules.filter((rule) => rule.source === "/:path*");
  expect(applied).toHaveLength(1);
  return new Map(applied[0]!.headers.map((h) => [h.key.toLowerCase(), h.value]));
}

describe("security headers", () => {
  it("applies to every route, not just pages", async () => {
    const rules = await nextConfig.headers!();
    expect(rules.some((rule) => rule.source === "/:path*")).toBe(true);
  });

  it.each([
    ["strict-transport-security", /max-age=\d{7,}/],
    ["x-content-type-options", /^nosniff$/],
    ["referrer-policy", /^strict-origin-when-cross-origin$/],
    ["x-frame-options", /^DENY$/],
    ["cross-origin-opener-policy", /^same-origin$/],
    // COOP isolates us from an opener; CORP stops another site embedding our
    // responses as subresources. /scan handles facial imagery.
    ["cross-origin-resource-policy", /^same-origin$/],
  ])("sets %s", async (key, pattern) => {
    expect((await headerMap()).get(key)).toMatch(pattern);
  });

  it("does not set a static CSP — it is nonce-built per request in middleware", async () => {
    expect((await headerMap()).has("content-security-policy")).toBe(false);
  });

  it("does not advertise the framework version", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  describe("permissions policy", () => {
    it("allows the camera on our own origin only", async () => {
      const value = (await headerMap()).get("permissions-policy")!;
      expect(value).toContain("camera=(self)");
      expect(value).not.toContain("camera=*");
    });

    it.each(["microphone", "geolocation", "payment", "usb"])(
      "denies %s outright",
      async (feature) => {
        expect((await headerMap()).get("permissions-policy")).toContain(
          `${feature}=()`,
        );
      },
    );
  });
});
