/**
 * CORS, off by default.
 *
 * The API has never sent a single `Access-Control-Allow-*` header, and that is
 * the correct production posture — not an oversight. Auth is a bearer token in
 * an `Authorization` header, never a cookie, so there are no ambient
 * credentials for a browser to attach to a cross-origin request. Combined with
 * `/api/account` deriving identity from the token alone, that makes the API
 * structurally CSRF-immune, and adding a permissive policy is the one edit that
 * could undo it.
 *
 * What this module adds is the ability to name *specific* origins for
 * development and preview builds — the Expo web preview on 127.0.0.1:8104 could
 * not call /api/plan at all, because `Authorization` + a JSON content-type force
 * a preflight and no route exported OPTIONS. With `ALLOWED_ORIGINS` unset (the
 * production default) every function here emits exactly nothing, so behaviour is
 * byte-identical to before.
 *
 * Three rules that are not negotiable:
 *  - `*` is never emitted, and is refused if someone puts it in the env var. It
 *    is meaningless alongside `Authorization` anyway (the spec forbids the
 *    combination), so a wildcard here would only ever be false comfort.
 *  - The `Origin` header is matched against the list and echoed exactly; it is
 *    never reflected back unvalidated.
 *  - `Access-Control-Allow-Credentials` is never sent. Nothing here uses cookie
 *    auth, and an echoed origin plus credentials is the classic footgun.
 */

/** Headers a caller may actually send us. Nothing else is worth permitting. */
const ALLOWED_REQUEST_HEADERS = "authorization, content-type";

/** How long a browser may cache the preflight. 10 minutes. */
const MAX_AGE_SECONDS = 600;

function allowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0 && origin !== "*");
}

/** The request's Origin if — and only if — it is explicitly allowlisted. */
export function allowedOrigin(req: Request): string | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  const list = allowedOrigins();
  if (list.length === 0) return null;
  return list.includes(origin) ? origin : null;
}

/**
 * Response headers for an actual (non-preflight) cross-origin request. Empty
 * when no allowlist is configured or the origin is not on it.
 *
 * `Vary: Origin` is present whenever an allowlist exists at all, so a shared
 * cache can never serve one origin's allowed response to another origin.
 */
export function corsHeaders(req: Request): Record<string, string> {
  if (allowedOrigins().length === 0) return {};
  const origin = allowedOrigin(req);
  if (!origin) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
  };
}

/**
 * Handle a preflight. Returns 204 with a policy scoped to `methods` for an
 * allowlisted origin, and 405 for everything else — including every request
 * when no allowlist is configured, which is the production default and matches
 * what Next already did for a route with no OPTIONS export.
 */
export function preflightResponse(req: Request, methods: string[]): Response {
  const origin = allowedOrigin(req);
  if (!origin) {
    return new Response(null, {
      status: 405,
      headers: { Allow: [...methods, "OPTIONS"].join(", ") },
    });
  }
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      // Scoped per route, not a blanket verb list: /api/plan is POST-only and
      // /api/account is DELETE-only.
      "Access-Control-Allow-Methods": [...methods, "OPTIONS"].join(", "),
      "Access-Control-Allow-Headers": ALLOWED_REQUEST_HEADERS,
      "Access-Control-Max-Age": String(MAX_AGE_SECONDS),
      Vary: "Origin",
    },
  });
}
