import { generatePlan, type PlanInput } from "@/lib/pipeline";
import { check, clientKey, createStore } from "@/lib/rateLimit";
import { validateImages } from "@/lib/validateImages";

// The Anthropic SDK needs the Node runtime (not edge); two Opus calls can take
// a while, so give the function room.
export const runtime = "nodejs";
export const maxDuration = 60;

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

export async function POST(req: Request) {
  const gate = check(store, clientKey(req.headers), Date.now());
  if (!gate.allowed) {
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

  let body: Partial<PlanInput>;
  try {
    body = (await req.json()) as Partial<PlanInput>;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.intake) {
    return json({ error: "Missing `intake`" }, 400);
  }

  const validated = validateImages(body.images);
  if ("error" in validated) {
    return json({ error: validated.error }, 400);
  }

  store.inFlight += 1;
  try {
    const result = await generatePlan({
      images: validated.images,
      intake: body.intake,
    });
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
