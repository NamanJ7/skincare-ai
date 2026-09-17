import { z } from "zod";

import { codeFor, readToken } from "@/lib/consent";
import { check, clientKey, createStore } from "@/lib/rateLimit";

export const runtime = "nodejs";

/**
 * Reveal the approval code to the parent. Deliberately POST, never GET.
 *
 * Mail scanners and link-preview bots fetch every URL in an email. If opening
 * the link were enough to expose the code, a scanner would effectively grant
 * consent on the parent's behalf without a human ever reading it. Requiring a
 * POST means a person had to press the button.
 */
const ApproveSchema = z.object({ token: z.string().max(2048) }).strict();

/** This route's own counters — see the note in `../request/route.ts`. */
const store = createStore();

export async function POST(req: Request) {
  const gate = check(store, clientKey(req.headers), Date.now());
  if (!gate.allowed) {
    return Response.json(
      { error: "Too many requests. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(gate.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ApproveSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  if (!readToken(parsed.data.token)) {
    return Response.json({ error: "This link has expired or is not valid." }, { status: 400 });
  }
  return Response.json({ code: codeFor(parsed.data.token) });
}
