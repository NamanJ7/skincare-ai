/**
 * A speed bump in front of a paid endpoint.
 *
 * `/api/plan` is public, unauthenticated, and makes two Opus calls per request
 * with up to three 8MB images attached. Anyone with the URL can spend the API
 * budget, and until now nothing stopped them.
 *
 * **Be honest about what this is.** The counters live in the process, so on
 * serverless each instance enforces its own limit and a cold start resets it.
 * A determined attacker spreading requests across instances gets a multiple of
 * these numbers. It stops the accidental case — a retry loop, a stuck client, a
 * scraper that does not care — and it is the most that can be done without
 * standing up shared state. When this endpoint carries real traffic, move the
 * counters to Redis/KV and keep this module's shape; `check` is pure apart from
 * the store it is handed, so only the store changes.
 */

/** Requests allowed per IP inside one window. Onboarding needs 1; a recheck 1. */
export const MAX_PER_WINDOW = 5;
/** The window, in ms. */
export const WINDOW_MS = 10 * 60 * 1000;
/**
 * How many plan generations this instance will run at once, over all callers.
 *
 * Two sequential Opus calls take tens of seconds, so a handful of concurrent
 * requests is already a lot of money in flight. This is the backstop for the
 * case the per-IP limit cannot see: many IPs at once.
 */
export const MAX_CONCURRENT = 4;

interface Window {
  /** When the current window started. */
  start: number;
  count: number;
}

export interface RateLimitStore {
  windows: Map<string, Window>;
  inFlight: number;
}

export function createStore(): RateLimitStore {
  return { windows: new Map(), inFlight: 0 };
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; reason: "per_ip" | "busy"; retryAfterSeconds: number };

/**
 * Decide whether one request may proceed, and count it if so.
 *
 * `now` is injected so the window arithmetic can be tested without a clock.
 */
export function check(store: RateLimitStore, key: string, now: number): RateLimitResult {
  // Bound the map. Without this a stream of unique IPs is its own memory leak,
  // which would be a worse bug than the one this module exists to fix.
  if (store.windows.size > 10_000) {
    for (const [k, w] of store.windows) {
      if (now - w.start >= WINDOW_MS) store.windows.delete(k);
    }
  }

  if (store.inFlight >= MAX_CONCURRENT) {
    return { allowed: false, reason: "busy", retryAfterSeconds: 30 };
  }

  const existing = store.windows.get(key);
  if (!existing || now - existing.start >= WINDOW_MS) {
    store.windows.set(key, { start: now, count: 1 });
    return { allowed: true };
  }

  if (existing.count >= MAX_PER_WINDOW) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.start + WINDOW_MS - now) / 1000));
    return { allowed: false, reason: "per_ip", retryAfterSeconds };
  }

  existing.count += 1;
  return { allowed: true };
}

/**
 * The caller's address, as far as we can tell.
 *
 * Behind a proxy the left-most `x-forwarded-for` entry is the client. It is
 * trivially spoofable by anyone talking to the origin directly, which is
 * another reason this is a speed bump rather than a security control.
 */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}
