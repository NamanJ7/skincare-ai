import type { NextConfig } from "next";

/**
 * Static security headers.
 *
 * Content-Security-Policy is deliberately NOT here: a static header cannot
 * carry a nonce, which is what forced the old policy to keep `'unsafe-inline'`
 * on script-src. It now lives in middleware.ts / lib/csp.ts, built per request.
 * Everything below needs no nonce, so it stays a static rule — which also means
 * it still applies to the asset paths the middleware matcher skips.
 *
 * Verified by lib/__tests__/security-headers.test.ts. These are easy to weaken
 * by accident and impossible to notice from the UI.
 */
const SECURITY_HEADERS = [
  // Two years, preload-eligible. Vercel terminates TLS, so this is safe to send.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Superseded by the CSP's frame-ancestors, retained for older browsers.
  { key: "X-Frame-Options", value: "DENY" },
  // /scan needs the camera on this origin. Everything else is denied outright
  // rather than left to the browser default.
  {
    key: "Permissions-Policy",
    value: [
      "camera=(self)",
      "microphone=()",
      "geolocation=()",
      "payment=()",
      "usb=()",
      "magnetometer=()",
      "accelerometer=(self)",
      "gyroscope=(self)",
      "interest-cohort=()",
    ].join(", "),
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // COOP isolates us from an opener; this stops another site embedding our
  // responses as subresources. Cheap, and /scan handles facial imagery.
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  // Transpile the shared design-token / types package (it ships TS source).
  transpilePackages: ["@pore/shared"],
  // Nothing gains from advertising the framework version.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
