import { PlanRefusedError, generatePlan } from "@/lib/pipeline";
import { MAX_BODY_BYTES, validatePlanRequest } from "@/lib/validatePlanRequest";

// The Anthropic SDK needs the Node runtime (not edge); two Opus calls can take
// a while, so give the function room.
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * A shared secret, and an honest account of what it is worth.
 *
 * `EXPO_PUBLIC_*` values are inlined into the app bundle, so anyone with the
 * binary can read this. It is not authentication and will not stop a determined
 * person. What it does stop is automated scanning — bots hunting for
 * unprotected LLM proxies — which is the overwhelming majority of what a public
 * endpoint like this actually sees.
 *
 * Unset means no check, so local development and the mock path keep working
 * with no configuration.
 */
const PLAN_API_KEY = process.env.PLAN_API_KEY;

/**
 * Best-effort burst limiting, in memory.
 *
 * Read this before trusting it: serverless instances do not share memory, so
 * this bounds a burst against ONE warm instance and does nothing about a
 * distributed or cold-start pattern. It is friction, not a guarantee. A real
 * limit needs a datastore, which this project does not have — see TODOS.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;
const hits = new Map<string, { count: number; resetAt: number }>();

function overRateLimit(ip: string, now = Date.now()): boolean {
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    // Keep the map from growing without bound on a long-lived instance.
    if (hits.size > 10_000) {
      for (const [key, value] of hits) if (now > value.resetAt) hits.delete(key);
    }
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_REQUESTS_PER_WINDOW;
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function POST(req: Request) {
  if (PLAN_API_KEY && req.headers.get("x-pore-key") !== PLAN_API_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (overRateLimit(clientIp(req))) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  // Refuse oversized payloads before deserializing anything.
  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return Response.json({ error: "Request body is too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validated = validatePlanRequest(body);
  if (!validated.ok) {
    return Response.json({ error: validated.error }, { status: validated.status });
  }

  try {
    return Response.json(await generatePlan(validated.input));
  } catch (err) {
    if (err instanceof PlanRefusedError) {
      // Not a server fault. 422 so the client can say "we couldn't read these"
      // rather than "something broke".
      console.warn("/api/plan refused:", err.category);
      return Response.json(
        { error: "We couldn't assess these photos. Try retaking them." },
        { status: 422 },
      );
    }
    // Never return `err.message`. These are almost always Anthropic SDK errors,
    // and their messages embed the provider's JSON body — billing state ("credit
    // balance is too low"), key validity, org rate-limit status, the model id.
    // That turns any 500 into a free probe of the account for whoever finds the URL.
    console.error("/api/plan failed:", err);
    return Response.json({ error: "Could not generate a plan" }, { status: 500 });
  }
}
