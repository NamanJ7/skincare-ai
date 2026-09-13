/**
 * Layer-1 in-process token bucket for the analysis endpoint.
 *
 * This is deliberately *not* the quota. It is a cheap, allocation-free first
 * gate that sheds obvious floods before we touch the network; the authoritative,
 * shared, race-safe limit lives in Postgres (see lib/quota.ts and the
 * claim_analysis_slot RPC). Treat this as a shock absorber, never as the
 * control that bounds spend — a serverless deployment runs many instances and
 * every cold start hands out a fresh bucket.
 */

import { createHash } from "node:crypto";

const CAPACITY = 3;
const REFILL_INTERVAL_MS = 60_000;
const BUCKET_MAX = 10_000;

/** Every unattributable caller shares one bucket, so "unknown" is never free. */
const SHARED_KEY = "unidentified";

interface Bucket {
  tokens: number;
  lastRefillAt: number;
}

const buckets = new Map<string, Bucket>();

/** Test seam: clears all buckets. */
export function clearRateLimits(): void {
  buckets.clear();
}

/** True when the request identified by `key` is allowed; consumes a token. */
export function checkRateLimit(key: string, now: number = Date.now()): boolean {
  let bucket = buckets.get(key);
  if (bucket) {
    // Re-insert so Map iteration order is least-recently-used first. The old
    // implementation evicted in *insertion* order, which let an attacker flood
    // BUCKET_MAX fresh keys to evict their own exhausted bucket and come back
    // with full capacity.
    buckets.delete(key);
  } else {
    if (buckets.size >= BUCKET_MAX) {
      const oldest = buckets.keys().next();
      if (!oldest.done) buckets.delete(oldest.value);
    }
    bucket = { tokens: CAPACITY, lastRefillAt: now };
  }
  buckets.set(key, bucket);

  const elapsed = now - bucket.lastRefillAt;
  if (elapsed > 0) {
    const refill = Math.floor(elapsed / REFILL_INTERVAL_MS);
    if (refill > 0) {
      bucket.tokens = Math.min(CAPACITY, bucket.tokens + refill);
      bucket.lastRefillAt += refill * REFILL_INTERVAL_MS;
    }
  }

  if (bucket.tokens <= 0) return false;
  bucket.tokens -= 1;
  return true;
}

/**
 * How many proxies we actually operate in front of this app. On Vercel that is
 * 1 (the edge). Only the hop contributed by our own outermost proxy can be
 * trusted; everything to its left is caller-supplied text.
 */
/**
 * Whether a proxy we operate is guaranteed to have rewritten the single-value
 * forwarded headers. `VERCEL` is set by the platform itself and is not
 * settable by a request; `TRUST_PLATFORM_FORWARDED_HEADER` is the opt-in for
 * an equivalent edge elsewhere.
 */
function onTrustedPlatform(): boolean {
  return (
    process.env.VERCEL === "1" ||
    process.env.TRUST_PLATFORM_FORWARDED_HEADER === "true"
  );
}

function trustedProxyHops(): number {
  const raw = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 1;
}

/**
 * Best-effort client identity for rate limiting.
 *
 * `x-forwarded-for` is a caller-writable chain: proxies *append*, so hop 0 is
 * whatever the client sent. Reading hop 0 (the previous behaviour) meant
 * `curl -H 'X-Forwarded-For: <random>'` minted an unlimited supply of fresh
 * buckets. We read from the right-hand end instead, which is the only part
 * our own infrastructure wrote.
 */
export function trustedClientIp(req: Request): string {
  // `x-vercel-forwarded-for` and `x-real-ip` are only trustworthy when an edge
  // we operate actually wrote them. Off Vercel — self-hosted, a preview box, or
  // any path that reaches the origin directly — they are plain caller-supplied
  // text, and reading them unconditionally reintroduced exactly the bug the
  // `x-forwarded-for` handling below was rewritten to fix. Worse, hashIp() of
  // this value is what lands in analysis_requests.ip_hash, so a spoofable
  // source lets a caller choose the pseudonym in their own audit trail.
  if (onTrustedPlatform()) {
    const platform = req.headers.get("x-vercel-forwarded-for")?.trim();
    if (platform) return platform.split(",")[0]!.trim() || SHARED_KEY;
  }

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    if (hops.length > 0) {
      const index = Math.max(0, hops.length - trustedProxyHops());
      const ip = hops[index];
      if (ip) return ip;
    }
  }

  if (onTrustedPlatform()) {
    const real = req.headers.get("x-real-ip")?.trim();
    if (real) return real;
  }

  return SHARED_KEY;
}

/**
 * Salted hash of a client IP, for the one place we persist it (the analysis
 * audit trail). Storing raw addresses alongside facial-scan activity would be
 * personal data we have no product reason to keep.
 *
 * Returns null when no salt is configured. An unsalted SHA-256 over the IPv4
 * space is 2^32 candidates — a seconds-long rainbow table, i.e. reversible —
 * so an empty salt does not produce a pseudonym, it produces a stored IP with
 * extra steps. Storing nothing is strictly better than storing that while the
 * schema comment promises "salted hash only".
 */
export function hashIp(ip: string): string | null {
  const salt = process.env.IP_HASH_SALT ?? "";
  // A trivially short salt is no better than none. 16 chars is well below what
  // .env.example asks for and well above anything guessable.
  if (salt.length < 16) return null;
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}
