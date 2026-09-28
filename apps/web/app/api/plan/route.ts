import { corsHeaders, preflightResponse } from "@/lib/cors";
import { assertRuntimeIntake } from "@/lib/intake-guard";
import { generatePlan, type PlanInput, type PlanResult } from "@/lib/pipeline";
import {
  analysisRequestHash,
  claimAnalysisSlot,
  quotaConfigured,
  releaseAnalysisSlot,
} from "@/lib/quota";
import { readBoundedBody } from "@/lib/read-bounded-body";
import { checkRateLimit, hashIp, trustedClientIp } from "@/lib/rate-limit";
import {
  AnalysisRequestError,
  assertRuntimeScanSession,
} from "@/lib/scan-analysis-guard";
import { devBypassEnabled, verifyBearer } from "@/lib/supabase-auth";

// The Anthropic SDK needs the Node runtime (not edge); two Opus calls can take
// a while, so give the function room.
export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" } as const;

/**
 * Ceilings applied before anything expensive happens. Three guided JPEGs at
 * capture quality are ~1-2 MB each once base64-encoded; anything materially
 * larger is not a scan, and we should not spend CPU decoding it to find out.
 */
const MAX_BODY_BYTES = 6 * 1024 * 1024;
const MAX_IMAGE_BASE64_CHARS = 1_600_000;

interface Failure {
  status: number;
  error: string;
  code?: string;
}

function fail({ status, error, code }: Failure): Response {
  return Response.json(
    code ? { error, code } : { error },
    { status, headers: NO_STORE_HEADERS },
  );
}

/**
 * The wire contract, picked field by field.
 *
 * `PlanResult` is an internal type that the pipeline is free to grow — a debug
 * field, token accounting, the raw model text — and `Response.json(result)`
 * would ship every addition to clients the moment it landed. Naming the four
 * fields here means a new one has to be added deliberately, and the route test
 * pins the exact key set.
 */
function toPlanResponse(result: PlanResult) {
  return {
    assessment: result.assessment,
    routine: result.routine,
    adjustments: result.adjustments,
    mode: result.mode,
  };
}

/** One structured line per request. Never image bytes, tokens, or intake. */
function logOutcome(fields: Record<string, string | number | boolean>): void {
  console.log(JSON.stringify({ route: "/api/plan", ...fields }));
}

/**
 * Preflight. The Expo web preview needs this to reach the endpoint at all
 * (Authorization + a JSON content-type force one); native builds never send it.
 * Allowlisted origins only — see lib/cors.ts.
 */
export async function OPTIONS(req: Request) {
  return preflightResponse(req, ["POST"]);
}

/**
 * CORS is applied once, to whatever the handler returned, so a failure response
 * carries the same policy as a success — a browser that cannot read the body of
 * a 401 reports it as an opaque network error instead.
 */
export async function POST(req: Request) {
  const res = await handlePlan(req);
  for (const [key, value] of Object.entries(corsHeaders(req))) {
    res.headers.set(key, value);
  }
  return res;
}

async function handlePlan(req: Request): Promise<Response> {
  const startedAt = Date.now();

  // 1. Size ceiling first — the cheapest possible rejection, before we read a
  //    single byte of the body into memory. This is only the *declared* length,
  //    which a caller controls and can simply omit; the real bound is enforced
  //    on observed bytes at step 4 (see lib/read-bounded-body.ts).
  const declaredLength = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    logOutcome({ outcome: "too_large", bytes: declaredLength });
    return fail({
      status: 413,
      error: "Scan payload is too large.",
      code: "PAYLOAD_TOO_LARGE",
    });
  }

  // 2. Identity. This endpoint spends money, so it fails closed: an absent,
  //    invalid, or unverifiable token never reaches the model. The onboarding
  //    funnel still runs pre-account because the app signs in anonymously at
  //    boot (apps/mobile/src/state/session.tsx), so every caller has a real
  //    auth.uid() to meter against even before they create an account.
  const auth = await verifyBearer(req);
  if (auth.kind === "invalid") {
    logOutcome({ outcome: "unauthenticated" });
    return fail({
      status: 401,
      error: "Sign-in is required to analyze a scan.",
      code: "UNAUTHENTICATED",
    });
  }
  if (auth.kind === "unavailable") {
    logOutcome({ outcome: "auth_unavailable" });
    return fail({
      status: 503,
      error: "Skin analysis is briefly unavailable. Try again shortly.",
      code: "ANALYSIS_UNAVAILABLE",
    });
  }

  const clientIp = trustedClientIp(req);

  // 3. Layer-1 shock absorber. The authoritative limit is the Postgres claim
  //    below; this just sheds floods before we make any network call.
  if (!checkRateLimit(auth.kind === "user" ? auth.userId : clientIp)) {
    logOutcome({ outcome: "rate_limited" });
    return fail({
      status: 429,
      error: "Too many analysis requests. Try again in a minute.",
      code: "rate_limited",
    });
  }

  // 3b. Read the body under a real ceiling on *observed* bytes. A chunked
  //     request carries no content-length, so step 1 cannot bound it.
  const raw = await readBoundedBody(req, MAX_BODY_BYTES);
  if (!raw.ok) {
    if (raw.reason === "too_large") {
      logOutcome({ outcome: "too_large", bytes: MAX_BODY_BYTES });
      return fail({
        status: 413,
        error: "Scan payload is too large.",
        code: "PAYLOAD_TOO_LARGE",
      });
    }
    return fail({ status: 400, error: "Invalid JSON body" });
  }

  let body: Partial<PlanInput>;
  try {
    body = JSON.parse(raw.text) as Partial<PlanInput>;
  } catch {
    return fail({ status: 400, error: "Invalid JSON body" });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return fail({ status: 400, error: "Invalid JSON body" });
  }

  if (!body.intake) {
    return fail({ status: 400, error: "Missing `intake`" });
  }
  if (!body.scanSession) {
    return fail({
      status: 422,
      error: "Missing quality-validated scan session",
      code: "SCAN_QUALITY_REQUIRED",
    });
  }
  if (
    !Array.isArray(body.images) ||
    body.images.length !== 3 ||
    body.images.some((image) => !image?.data)
  ) {
    return fail({
      status: 422,
      error: "A complete, quality-validated front, left, and right scan is required",
      code: "SCAN_QUALITY_REQUIRED",
    });
  }

  // 4. Per-image ceiling, checked on the encoded string so we reject oversized
  //    input *before* base64-decoding it (the decode is the expensive part).
  if (
    body.images.some(
      (image) =>
        typeof image.data !== "string" ||
        image.data.length > MAX_IMAGE_BASE64_CHARS,
    )
  ) {
    logOutcome({ outcome: "image_too_large" });
    return fail({
      status: 413,
      error: "One of the scan images is too large.",
      code: "PAYLOAD_TOO_LARGE",
    });
  }

  // 5. Shape validation before any slot is claimed, so a malformed request
  //    can never consume a user's scan. generatePlan re-validates — that
  //    duplication is intentional and load-bearing.
  let intake: ReturnType<typeof assertRuntimeIntake>;
  try {
    assertRuntimeScanSession(body.scanSession);
    intake = assertRuntimeIntake(body.intake);
  } catch (err) {
    if (err instanceof AnalysisRequestError) {
      // `message` is authored for the caller. `detail` is where the guards put
      // anything that would enumerate our internal schema (which intake fields
      // failed, which pipeline stage gave up) — it is logged, never serialized.
      logOutcome({
        outcome: "rejected",
        code: err.code,
        ...(err.detail ? { detail: err.detail } : {}),
      });
      return fail({ status: err.status, error: err.message, code: err.code });
    }
    console.error("/api/plan rejected a malformed request:", err);
    return fail({
      status: 400,
      error: "That scan submission was not valid.",
      code: "INVALID_REQUEST",
    });
  }

  // 6. Claim a slot: breaker check, replay suppression, and an atomic debit of
  //    the per-user and deployment-wide daily counters, all in one transaction.
  const sessionId = body.scanSession.sessionId;
  // Sorted so a reordered replay of the same three captures collides with the
  // original claim rather than minting a second billable request.
  const digests = body.images
    .map((image) => String(image.contentDigest ?? ""))
    .sort();
  const userId = auth.kind === "user" ? auth.userId : null;
  // Anonymous identities are free to mint, so they meter against a stricter cap.
  const isAnonymous = auth.kind === "user" ? auth.isAnonymous !== false : true;
  const requestHash = analysisRequestHash(userId ?? "dev", sessionId, digests);

  let claimed = false;
  if (userId) {
    if (!quotaConfigured()) {
      // Verified user but no durable limiter: the only safe answer is no.
      logOutcome({ outcome: "quota_unconfigured", userId });
      return fail({
        status: 503,
        error: "Skin analysis is briefly unavailable. Try again shortly.",
        code: "ANALYSIS_UNAVAILABLE",
      });
    }
    const claim = await claimAnalysisSlot(
      userId,
      requestHash,
      hashIp(clientIp),
      isAnonymous,
    );
    if (claim.outcome !== "allowed") {
      logOutcome({ outcome: claim.outcome, userId });
      if (claim.outcome === "duplicate") {
        return fail({
          status: 409,
          error: "This scan has already been analyzed.",
          code: "DUPLICATE_REQUEST",
        });
      }
      if (claim.outcome === "quota_exceeded") {
        return fail({
          status: 429,
          error: "You've used your included scans for today.",
          code: "QUOTA_EXCEEDED",
        });
      }
      // global_cap and disabled are deployment-side conditions. The client
      // shows its honest "couldn't analyze" fallback — never a fabricated scan.
      return fail({
        status: 503,
        error: "Skin analysis is briefly unavailable. Try again shortly.",
        code: "ANALYSIS_UNAVAILABLE",
      });
    }
    claimed = true;
  } else if (devBypassEnabled()) {
    console.warn(
      "/api/plan: ALLOW_UNAUTHENTICATED_ANALYSIS is on — running an unmetered paid request. Never enable this outside local development.",
    );
  }

  // 7. Only now do we spend anything.
  try {
    const result = await generatePlan({
      images: body.images,
      intake,
      scanSession: body.scanSession,
      signal: req.signal,
    });
    if (claimed && userId)
      await releaseAnalysisSlot(userId, requestHash, "succeeded", isAnonymous);
    logOutcome({
      outcome: "succeeded",
      durationMs: Date.now() - startedAt,
      ...(userId ? { userId } : {}),
    });
    return Response.json(toPlanResponse(result), { headers: NO_STORE_HEADERS });
  } catch (err) {
    console.error("/api/plan failed:", err);
    // AnalysisRequestError is only ever raised before the Anthropic client is
    // constructed (the bound-input guard and the missing-API-key check in
    // lib/pipeline.ts), so no model call was billed and the scan is refunded.
    // Anything else may have been billed mid-flight, so the debit stands.
    const refundable = err instanceof AnalysisRequestError;
    if (claimed && userId) {
      await releaseAnalysisSlot(
        userId,
        requestHash,
        refundable ? "refunded" : "failed",
        isAnonymous,
      );
    }
    logOutcome({
      outcome: refundable ? "rejected" : "failed",
      durationMs: Date.now() - startedAt,
      ...(userId ? { userId } : {}),
    });
    if (err instanceof AnalysisRequestError) {
      if (err.detail) logOutcome({ outcome: "rejected", code: err.code, detail: err.detail });
      return fail({ status: err.status, error: err.message, code: err.code });
    }
    // Never echo `err.message`: an unexpected throw here is usually a schema
    // validation failure whose text enumerates our internal output schema.
    return fail({
      status: 500,
      error: "Skin analysis failed. Try again in a moment.",
      code: "ANALYSIS_FAILED",
    });
  }
}
