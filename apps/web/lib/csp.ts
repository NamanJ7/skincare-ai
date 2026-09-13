/**
 * Content-Security-Policy, built per request so `script-src` can carry a nonce.
 *
 * Why this moved out of next.config.ts: a static header cannot contain a nonce,
 * so the policy there had to keep `'unsafe-inline'` for Next's App Router
 * bootstrap and flight-data scripts. `'unsafe-inline'` is only neutralised when
 * the *same directive* also carries a nonce, a hash, or `'strict-dynamic'` — the
 * old policy had none of the three, so it was honoured by every browser and the
 * CSP provided no script-injection defense at all. Middleware fixes that by
 * minting a nonce per request (see ../middleware.ts).
 *
 * Deliberately NOT using `'strict-dynamic'`:
 *  - it makes browsers ignore host-source expressions, which would break the
 *    `https://tally.so` widget that app/(site)/layout.tsx loads via next/script,
 *  - MediaPipe reaches its wasm loader through a dynamic `import()` chain, and
 *    same-origin host sources are a far more predictable way to permit that.
 * `'self'` + a per-request nonce already blocks both real vectors — injected
 * inline script and injected third-party script — and nothing can be uploaded
 * to this origin to be served back as JS.
 *
 * Load-bearing pieces, each of which breaks something silently if removed:
 *  - `'wasm-unsafe-eval'` — /scan instantiates the MediaPipe face landmarker
 *    from public/mediapipe/wasm/. Without it the entire scan-quality pipeline
 *    fails to start, and every capture fails for reasons that look nothing
 *    like a CSP problem.
 *  - `blob:` in worker-src / media-src / img-src — MediaPipe spawns workers
 *    from blob URLs and the capture preview renders from object URLs.
 *  - `frame-ancestors 'none'` — the modern X-Frame-Options (which is still
 *    sent from next.config.ts for old browsers).
 */

/** Third-party origins the marketing pages need — and /scan deliberately must not. */
const TALLY = "https://tally.so";
const TALLY_API = "https://api.tally.so";

export interface CspOptions {
  nonce: string;
  /** Request pathname; decides whether third-party origins are permitted. */
  pathname: string;
  /** Dev needs eval (React Refresh) and a websocket (HMR). Never in production. */
  dev?: boolean;
}

/**
 * True for pages that must never be able to reach a third party.
 *
 * app/(site)/layout.tsx already keeps the Tally widget off /scan, but a global
 * header undid half of that: the policy still *permitted* script/frame/connect
 * to tally.so on the one page that operates the camera and holds face photos in
 * IndexedDB, leaving a ready-made exfiltration channel for any future injection.
 */
export function isIsolatedPath(pathname: string): boolean {
  return pathname === "/scan" || pathname.startsWith("/scan/");
}

export function buildCsp({ nonce, pathname, dev = false }: CspOptions): string {
  const isolated = isIsolatedPath(pathname);

  const script = ["'self'", `'nonce-${nonce}'`, "'wasm-unsafe-eval'"];
  // webpack's dev build and React Refresh both evaluate code from strings.
  if (dev) script.push("'unsafe-eval'");
  if (!isolated) script.push(TALLY);

  const connect = ["'self'"];
  if (!isolated) connect.push(TALLY, TALLY_API);
  // HMR websocket. `ws:` only — never widened in a production build.
  if (dev) connect.push("ws:");

  const frame = isolated ? ["'none'"] : [TALLY];

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src ${script.join(" ")}`,
    // Tailwind and next/font both emit inline <style>. Style injection is not a
    // script-execution vector, and nonce-ing every emitted style is not something
    // the framework supports today.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self' data:",
    `connect-src ${connect.join(" ")}`,
    "worker-src 'self' blob:",
    `frame-src ${frame.join(" ")}`,
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}
