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
      { status: 429, headers: { "retry-after": String(gate.retryAfterSeconds) } },
    );
  }

  let body: Partial<PlanInput>;
  try {
    body = (await req.json()) as Partial<PlanInput>;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.intake) {
    return Response.json({ error: "Missing `intake`" }, { status: 400 });
  }

  const validated = validateImages(body.images);
  if ("error" in validated) {
    return Response.json({ error: validated.error }, { status: 400 });
  }

  store.inFlight += 1;
  try {
    const result = await generatePlan({
      images: validated.images,
      intake: body.intake,
    });
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
