import type { NextConfig } from "next";

/**
 * Baseline security headers.
 *
 * Deliberately no Content-Security-Policy. app/layout.tsx loads Tally's widget
 * script, which injects inline script and style at runtime; a CSP tight enough to
 * be worth having would break every "Join the Waitlist" CTA — the site's only
 * conversion — and it would break in production, not in dev. Adding a CSP needs
 * its own pass with the widget in front of you.
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The marketing site never needs these; the camera lives in the Expo app.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Transpile the shared design-token / types package (it ships TS source).
  transpilePackages: ["@pore/shared"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
