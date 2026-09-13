/**
 * Server-authoritative quota, idempotency and circuit breaker for the paid
 * analysis path. All state lives in Postgres so it is shared across serverless
 * instances, survives cold starts, and is race-safe under concurrency — none of
 * which the in-process token bucket (lib/rate-limit.ts) can offer.
 *
 * This module talks to PostgREST with the service-role key rather than pulling
 * in @supabase/supabase-js, matching the existing raw-fetch approach in
 * lib/supabase-auth.ts and keeping the web bundle dependency-free.
 *
 * Every failure path returns `disabled`. If we cannot confirm a caller is
 * entitled to spend two Opus calls, we do not spend them.
 */

import { createHash } from "node:crypto";

import { safePublicHttpUrl } from "./safe-url";

export type ClaimOutcome =
  | "allowed"
  | "duplicate"
  | "quota_exceeded"
  | "global_cap"
  | "disabled";

export interface ClaimResult {
  outcome: ClaimOutcome;
  remaining: number;
}

export type ReleaseStatus = "succeeded" | "failed" | "refunded";

/** Bound the quota round-trip so a slow datastore can't eat the request budget. */
const QUOTA_TIMEOUT_MS = 5_000;

function config(): { url: string; key: string } | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // Validated, not merely read. This URL is the base for requests carrying the
  // service-role key, so a value pointing at loopback, link-local (169.254.169.254)
  // or plaintext http is treated as *unconfigured* — which routes through the
  // existing fail-closed path (quotaConfigured() false -> 503) rather than
  // sending the key somewhere unintended.
  const url = safePublicHttpUrl(process.env.SUPABASE_URL);
  if (!url || !key) return null;
  return { url: url.origin, key };
}

/** Whether the durable quota store is configured at all. */
export function quotaConfigured(): boolean {
  return config() !== null;
}

/**
 * The only RPCs this module may call. A bare `string` here would let a future
 * caller push a caller-derived value into the request path, where `..` segments
 * reach any other PostgREST endpoint with the service-role key attached.
 */
type RpcName = "claim_analysis_slot" | "release_analysis_slot";

async function rpc(name: RpcName, args: Record<string, unknown>): Promise<unknown> {
  const cfg = config();
  if (!cfg) throw new Error("quota store not configured");
  const res = await fetch(`${cfg.url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: cfg.key,
      authorization: `Bearer ${cfg.key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
    // PostgREST does not redirect. Following one would replay the service-role
    // key against whatever host the Location header names.
    redirect: "error",
    signal: AbortSignal.timeout(QUOTA_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${name} failed: ${res.status}`);
  return res.json();
}

/**
 * Stable identity for one analysis attempt. Built from the validated capture
 * digests, so replaying a captured body — or resubmitting the same scan after a
 * client-side timeout — collides with the original claim instead of paying for
 * a second run.
 */
export function analysisRequestHash(
  userId: string,
  sessionId: string,
  contentDigests: readonly string[],
): string {
  return createHash("sha256")
    .update([userId, sessionId, ...contentDigests].join("|"))
    .digest("hex");
}

/**
 * Atomically check the breaker, claim the request for idempotency, and debit
 * both the per-user and deployment-wide daily counters. See
 * supabase/migrations/20260817000008_analysis_quota.sql — the conditional
 * upserts there are what make N concurrent callers resolve to exactly N_allowed.
 */
export async function claimAnalysisSlot(
  userId: string,
  requestHash: string,
  ipHash: string | null,
  isAnonymous: boolean,
): Promise<ClaimResult> {
  try {
    const rows = await rpc("claim_analysis_slot", {
      p_user_id: userId,
      p_request_hash: requestHash,
      p_ip_hash: ipHash,
      p_is_anonymous: isAnonymous,
    });
    const row = Array.isArray(rows) ? rows[0] : rows;
    const outcome = (row as { outcome?: string } | undefined)?.outcome;
    if (
      outcome === "allowed" ||
      outcome === "duplicate" ||
      outcome === "quota_exceeded" ||
      outcome === "global_cap" ||
      outcome === "disabled"
    ) {
      const remaining = Number((row as { remaining?: unknown }).remaining ?? 0);
      return { outcome, remaining: Number.isFinite(remaining) ? remaining : 0 };
    }
    // An unrecognised outcome is a contract mismatch, not a green light.
    console.error("claim_analysis_slot returned an unknown outcome");
    return { outcome: "disabled", remaining: 0 };
  } catch (err) {
    // Datastore unreachable, misconfigured, or slow. Fail closed: an
    // unavailable limiter must never degrade into unlimited paid usage.
    console.error("claim_analysis_slot failed:", err);
    return { outcome: "disabled", remaining: 0 };
  }
}

/**
 * Close out a claimed slot. `refunded` is for the case where the model was
 * never invoked (guard rejection, unconfigured vision service) — the user gets
 * their scan back. `failed` keeps the debit because the call was billed.
 *
 * Best-effort by design: a failure here must not turn a successful analysis
 * into an error for the user. The cost is a slot that stays consumed, which is
 * the safe direction to fail.
 */
export async function releaseAnalysisSlot(
  userId: string,
  requestHash: string,
  status: ReleaseStatus,
  isAnonymous: boolean,
): Promise<void> {
  try {
    await rpc("release_analysis_slot", {
      p_user_id: userId,
      p_request_hash: requestHash,
      p_status: status,
      p_is_anonymous: isAnonymous,
    });
  } catch (err) {
    console.error("release_analysis_slot failed:", err);
  }
}
