/**
 * Bearer-token verification for API routes that require identity.
 *
 * Verification asks Supabase Auth directly (GET /auth/v1/user), which works for
 * both signing schemes without bundling a JWT library. We never verify the
 * signature ourselves — GoTrue is the authority — so the only thing this module
 * reads out of the token locally is `exp`, and only to *shorten* how long a
 * successful verification is cached.
 *
 * There is deliberately no "optional" variant. One used to live here, unused,
 * degrading to `{kind:"anonymous"}` when the auth service was unreachable. On an
 * endpoint that treats anonymous as authorized, that turns an outage into an
 * authorization bypass; keeping a one-import path to it next to the fail-closed
 * function was the whole risk. Every path below fails closed.
 */
import { safePublicHttpUrl } from "./safe-url";

export type BearerVerification =
  | { kind: "user"; userId: string; isAnonymous: boolean }
  | { kind: "invalid" };

/**
 * Outcome for endpoints that *require* identity: a caller we cannot positively
 * identify is either rejected (`invalid`) or told the service can't answer
 * right now (`unavailable`). `devBypass` is the single, explicitly opt-in
 * exception.
 */
export type RequiredVerification =
  | { kind: "user"; userId: string; isAnonymous: boolean }
  | { kind: "devBypass" }
  | { kind: "invalid" }
  | { kind: "unavailable" };

const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX = 500;

interface CacheEntry {
  /** Absolute expiry: the sooner of our own TTL and the token's own `exp`. */
  expiresAt: number;
  result: BearerVerification;
}

const cache = new Map<string, CacheEntry>();

/** Test seam: clears the verification cache. */
export function clearVerificationCache(): void {
  cache.clear();
}

/**
 * The token's own expiry, in ms. Parsed without verifying the signature — that
 * is safe here precisely because the value is only ever used to shorten our
 * trust window, never to extend it or to authorize anything. A forged `exp`
 * can make us re-ask GoTrue sooner, which is the harmless direction.
 */
function tokenExpiresAt(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1]!, "base64url").toString("utf8"),
    ) as { exp?: unknown };
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
}

function readCache(token: string, now: number): BearerVerification | null {
  const entry = cache.get(token);
  if (!entry) return null;
  if (now >= entry.expiresAt) {
    cache.delete(token);
    return null;
  }
  return entry.result;
}

function writeCache(token: string, result: BearerVerification, now: number) {
  if (cache.size >= CACHE_MAX) {
    // Drop the oldest entries rather than growing unboundedly.
    const first = cache.keys().next();
    if (!first.done) cache.delete(first.value);
  }
  // Without the `exp` clamp a token that expires one second after verification
  // stayed accepted for five more minutes — including on the irreversible
  // account-delete endpoint, where a just-revoked token could still fire it.
  const expiry = tokenExpiresAt(token);
  const expiresAt = Math.min(now + CACHE_TTL_MS, expiry ?? Number.POSITIVE_INFINITY);
  if (expiresAt <= now) return;
  cache.set(token, { expiresAt, result });
}

/**
 * Supabase Auth endpoint + the key to present.
 *
 * The key is the *anon* key by preference. `GET /auth/v1/user` authenticates
 * with the caller's own bearer token; `apikey` only identifies the project, so
 * sending the service-role key here transmits far more privilege than the call
 * needs on every single request. Service-role remains the fallback so a
 * deployment that only sets that one keeps working.
 *
 * The URL is validated, not merely read: it is the base for requests that carry
 * a project key, and a mis-set value silently points that key at another host.
 */
function authConfig(): { url: string; key: string } | null {
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = safePublicHttpUrl(process.env.SUPABASE_URL);
  if (!url || !key) return null;
  return { url: url.origin, key };
}

/**
 * Local-development escape hatch for running the analysis pipeline without a
 * Supabase project. It must be set deliberately, it is ignored in production,
 * and the route logs every request that uses it — the point is that running
 * the paid endpoint unauthenticated is a visible, explicit choice rather than
 * something that happens silently when an env var is missing.
 */
export function devBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.ALLOW_UNAUTHENTICATED_ANALYSIS === "true"
  );
}

/**
 * Identity for endpoints that spend money. Fails closed in every direction:
 * no token, a bad token, missing configuration, or an unreachable auth service
 * all stop the request rather than letting it through as "anonymous".
 */
export async function verifyBearer(
  req: Request,
  now: number = Date.now(),
): Promise<RequiredVerification> {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return devBypassEnabled() ? { kind: "devBypass" } : { kind: "invalid" };

  const cfg = authConfig();
  if (!cfg) {
    return devBypassEnabled() ? { kind: "devBypass" } : { kind: "unavailable" };
  }

  const token = match[1]!;
  const cached = readCache(token, now);
  if (cached) {
    if (cached.kind === "user") return cached;
    return { kind: "invalid" };
  }

  try {
    const res = await fetch(`${cfg.url}/auth/v1/user`, {
      headers: { authorization: `Bearer ${token}`, apikey: cfg.key },
      cache: "no-store",
      // This endpoint never legitimately redirects. Following one would replay
      // the caller's token — and our project key — against whatever host the
      // Location header names.
      redirect: "error",
    });
    if (!res.ok) {
      writeCache(token, { kind: "invalid" }, now);
      return { kind: "invalid" };
    }
    const user = (await res.json()) as {
      id?: string;
      is_anonymous?: boolean;
    };
    if (!user.id) {
      writeCache(token, { kind: "invalid" }, now);
      return { kind: "invalid" };
    }
    // An anonymous identity is free to mint, so it gets the stricter analysis
    // cap (see supabase/migrations/20260818000009). Absent or non-boolean means
    // we could not confirm this is a real account — treat it as anonymous,
    // which is the direction an unknown has to fail on a paid path.
    const result: BearerVerification = {
      kind: "user",
      userId: user.id,
      isAnonymous: user.is_anonymous !== false,
    };
    writeCache(token, result, now);
    return result;
  } catch {
    // Cannot verify: do not spend money on an unverified caller. Never cached —
    // a transient outage must not pin this token to a failure for five minutes.
    return { kind: "unavailable" };
  }
}
