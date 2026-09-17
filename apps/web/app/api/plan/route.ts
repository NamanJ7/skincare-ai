import { generatePlan } from "@/lib/pipeline";
import { check, clientKey, createStore } from "@/lib/rateLimit";
import { IntakeSchema } from "@/lib/schemas";
import { validateImages } from "@/lib/validateImages";

// The Anthropic SDK needs the Node runtime (not edge); two Opus calls can take
// a while, so give the function room.
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Whole-body ceiling, checked from `content-length` before anything is read.
 *
 * Vercel refuses request bodies over ~4.5MB at the platform, so a higher number
 * here would be fiction: the caller would get an opaque platform 413 instead of
 * the messages below. Three images at `MAX_IMAGE_BYTES` plus an intake fit under
 * it with room.
 */
const MAX_BODY_BYTES = 4.5 * 1024 * 1024;

/**
 * Rate-limit counters, held for the life of this instance.
 *
 * Module scope rather than per-request, which is the whole point — but it also
 * means each serverless instance counts separately. See `lib/rateLimit.ts` for
 * what that does and does not buy.
 */
const store = createStore();

/**
 * The mobile app calls this from a different origin than the one serving it,
 * and it sends `content-type: application/json`, which is not a CORS-simple
 * content type — so the browser sends a preflight first. Without an OPTIONS
 * handler that preflight 405s and the request never happens.
 */
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
} as const;

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * The gates, in order. **The order is the protection**, not just the set:
 *
 *   1. rate limit      — a rejected caller costs us nothing
 *   2. content-length  — before req.json(), so no body is buffered for a caller
 *                        we are going to refuse anyway
 *   3. IntakeSchema    — the intake is JSON.stringify'd into *both* Claude
 *                        prompts, so an unbounded intake is an unbounded bill.
 *                        Rate limiting caps how many requests you pay for, not
 *                        how much each one costs.
 *   4. validateImages  — the image half, extracted so it can be tested directly
 *
 * Each rule returns its own message: "invalid request" tells a legitimate client
 * nothing, and this is the surface a mobile build hits when its encoding is off.
 * Every one of them goes out through `json()` — a rejection without the CORS
 * headers reaches a cross-origin caller as an opaque network error, so the
 * specific message would be written and never read.
 */
export async function POST(req: Request) {
  const gate = check(store, clientKey(req.headers), Date.now());
  if (!gate.allowed) {
    // Without this line, abuse of a paid endpoint is invisible until the bill.
    console.warn(`/api/plan rate limited (${gate.reason}):`, clientKey(req.headers));
    return Response.json(
      {
        error:
          gate.reason === "busy"
            ? "Too many plans are being generated right now. Try again in a moment."
            : "Too many requests. Try again shortly.",
      },
      {
        status: 429,
        headers: {
          ...CORS_HEADERS,
          "retry-after": String(gate.retryAfterSeconds),
          // Without this the header is present but unreadable cross-origin.
          "access-control-expose-headers": "retry-after",
        },
      },
    );
  }

  // A missing content-length is rejected rather than trusted: both real clients
  // always set it, and Vercel's platform cap does not exist under `next dev`.
  const declaredLength = req.headers.get("content-length");
  if (declaredLength === null) {
    return json({ error: "`content-length` is required" }, 411);
  }
  const bodyBytes = Number(declaredLength);
  if (!Number.isFinite(bodyBytes) || bodyBytes < 0) {
    return json({ error: "`content-length` is malformed" }, 400);
  }
  if (bodyBytes > MAX_BODY_BYTES) {
    return json(
      { error: `Request body exceeds the ${MAX_BODY_BYTES / (1024 * 1024)}MB limit` },
      413,
    );
  }

  let body: { intake?: unknown; images?: unknown };
  try {
    body = (await req.json()) as { intake?: unknown; images?: unknown };
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const intake = IntakeSchema.safeParse(body.intake);
  if (!intake.success) {
    const issue = intake.error.issues[0];
    // Root-level issues (an unrecognized key, a non-object) carry an empty path.
    const path = issue?.path.join(".");
    const field = path ? `intake.${path}` : "intake";
    return json({ error: `${field}: ${issue?.message ?? "is invalid"}` }, 400);
  }

  const validated = validateImages(body.images);
  if ("error" in validated) {
    return json({ error: validated.error }, 400);
  }

  store.inFlight += 1;
  try {
    const result = await generatePlan({ images: validated.images, intake: intake.data });
    return json(result, 200);
  } catch (err) {
    // The detail goes to the server log, not to the client: SDK errors carry
    // key state, model ids and internal paths, and the client has no use for
    // any of it beyond "try again".
    console.error("/api/plan failed:", err);
    // The upstream message is logged, never returned. It can carry request
    // ids, rate-limit text, and echoes of what was sent. What the client needs
    // is narrower and more useful: whether trying again could work. 503 says
    // yes, so the app can offer a retry that means something.
    return json({ error: "Could not build a plan right now" }, upstreamStatus(err));
  } finally {
    // Counts down on every exit, thrown or returned, or the limiter leaks a
    // slot per failure and the endpoint throttles itself shut.
    store.inFlight -= 1;
  }
}

/** Map an upstream failure onto the one bit the client acts on: retry or not. */
function upstreamStatus(err: unknown): number {
  const status = (err as { status?: unknown })?.status;
  if (typeof status === "number") {
    // Overloaded or rate-limited upstream: the same request may well succeed.
    if (status === 429 || status === 529 || status >= 500) return 503;
    // Our own credentials or request shape are wrong. Retrying will not fix it,
    // and it is not the caller's fault, so it stays a 500.
    if (status >= 400) return 500;
  }
  return 503;
}
