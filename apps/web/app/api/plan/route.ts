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
      { status: 429, headers: { "retry-after": String(gate.retryAfterSeconds) } },
    );
  }

  // A missing content-length is rejected rather than trusted: both real clients
  // always set it, and Vercel's platform cap does not exist under `next dev`.
  const declaredLength = req.headers.get("content-length");
  if (declaredLength === null) {
    return Response.json({ error: "`content-length` is required" }, { status: 411 });
  }
  const bodyBytes = Number(declaredLength);
  if (!Number.isFinite(bodyBytes) || bodyBytes < 0) {
    return Response.json({ error: "`content-length` is malformed" }, { status: 400 });
  }
  if (bodyBytes > MAX_BODY_BYTES) {
    return Response.json(
      { error: `Request body exceeds the ${MAX_BODY_BYTES / (1024 * 1024)}MB limit` },
      { status: 413 },
    );
  }

  let body: { intake?: unknown; images?: unknown };
  try {
    body = (await req.json()) as { intake?: unknown; images?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const intake = IntakeSchema.safeParse(body.intake);
  if (!intake.success) {
    const issue = intake.error.issues[0];
    // Root-level issues (an unrecognized key, a non-object) carry an empty path.
    const path = issue?.path.join(".");
    const field = path ? `intake.${path}` : "intake";
    return Response.json(
      { error: `${field}: ${issue?.message ?? "is invalid"}` },
      { status: 400 },
    );
  }

  const validated = validateImages(body.images);
  if ("error" in validated) {
    return Response.json({ error: validated.error }, { status: 400 });
  }

  store.inFlight += 1;
  try {
    const result = await generatePlan({ images: validated.images, intake: intake.data });
    return Response.json(result);
  } catch (err) {
    // The detail goes to the server log, not to the client: SDK errors carry
    // key state, model ids and internal paths, and the client has no use for
    // any of it beyond "try again".
    console.error("/api/plan failed:", err);
    return Response.json({ error: "Could not generate a plan" }, { status: 500 });
  } finally {
    store.inFlight -= 1;
  }
}
