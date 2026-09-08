/**
 * Best-effort rate limiting for /api/plan.
 *
 * ponytail: one in-memory Map, no dependency. On Vercel this is per-lambda-instance
 * and dies with a cold start, so it stops a script hammering the endpoint and
 * guarantees nothing against a distributed caller. That is deliberate and it is not
 * the primary control — the primary control is bounding what a single request can
 * cost (IntakeSchema + the size caps in route.ts). This is the backstop.
 *
 * Upgrade path when there is real traffic: Vercel Firewall rate-limit rules (no code),
 * or an Upstash-backed counter — replace the body of `rateLimit`, the signature stays.
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;

/** key -> timestamps of accepted requests inside the current window. */
const hits = new Map<string, number[]>();

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Unix seconds at which the window frees up. */
  reset: number;
  /** Seconds to wait. 0 when `ok`. */
  retryAfter: number;
}

/**
 * `key` is a caller identity, not necessarily an IP. When real auth lands it
 * becomes a user id and nothing else here changes.
 *
 * `now` is injectable so the window can be tested without sleeping.
 */
export function rateLimit(key: string, now: number = Date.now()): RateLimitResult {
  const cutoff = now - WINDOW_MS;

  // Sweep expired entries so the Map cannot grow without bound on a warm instance.
  // Deleting during Map iteration is well-defined.
  for (const [k, times] of hits) {
    const live = times.filter((t) => t > cutoff);
    if (live.length === 0) hits.delete(k);
    else hits.set(k, live);
  }

  const times = hits.get(key) ?? [];
  const reset = Math.ceil(((times[0] ?? now) + WINDOW_MS) / 1000);

  if (times.length >= MAX_REQUESTS) {
    return {
      ok: false,
      limit: MAX_REQUESTS,
      remaining: 0,
      reset,
      retryAfter: Math.max(1, reset - Math.floor(now / 1000)),
    };
  }

  times.push(now);
  hits.set(key, times);
  return {
    ok: true,
    limit: MAX_REQUESTS,
    remaining: MAX_REQUESTS - times.length,
    reset,
    retryAfter: 0,
  };
}

/**
 * Vercel sets both headers itself, so the first forwarded entry is the real client.
 * Never trust the whole chain — anything past the first hop is caller-supplied.
 */
export function clientKey(req: Request): string {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || "unknown";
}
