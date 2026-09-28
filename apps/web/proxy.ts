/**
 * Mints a per-request CSP nonce so script-src no longer needs 'unsafe-inline'.
 *
 * Named proxy.ts, not middleware.ts: Next 16 deprecated the middleware file
 * convention in favour of this one. Same request-interception semantics.
 *
 * The policy is set on BOTH the forwarded request headers and the response:
 * Next's App Router reads the incoming `content-security-policy` header, pulls
 * the `nonce-…` value out of script-src, and stamps it onto the inline bootstrap
 * and flight-data scripts it emits. Setting it only on the response would ship a
 * policy that blocks Next's own scripts, i.e. a blank page.
 *
 * Tradeoff, accepted deliberately: reading the nonce opts a page out of static
 * rendering. The marketing pages are cheap and low-traffic, and a CSP that
 * actually constrains script execution is worth more here than a prerender.
 *
 * The non-CSP security headers stay in next.config.ts — they need no nonce, and
 * leaving them there keeps them on the static-asset paths this matcher skips.
 */
import { NextResponse, type NextRequest } from "next/server";

import { buildCsp } from "@/lib/csp";

export const config = {
  matcher: [
    /*
     * Documents only. Skipping /api keeps middleware off the metered analysis
     * path (a CSP on a JSON body does nothing anyway), and skipping the static
     * and mediapipe asset trees avoids minting a nonce per wasm chunk during a
     * scan. next.config.ts still covers all of these with the other headers.
     */
    "/((?!api|_next/static|_next/image|mediapipe|favicon.ico).*)",
  ],
};

/** 128 bits, base64. Must be unguessable or the nonce is decorative. */
function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export default function proxy(request: NextRequest) {
  const nonce = makeNonce();
  const csp = buildCsp({
    nonce,
    pathname: request.nextUrl.pathname,
    dev: process.env.NODE_ENV !== "production",
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("content-security-policy", csp);
  return response;
}
