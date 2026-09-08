import { z } from "zod";

import { sendConsentEmail } from "@/lib/consent-email";
import { issueToken } from "@/lib/consent";
import { clientKey, rateLimit } from "@/lib/rate-limit";

// node:crypto and the mailer both need the Node runtime.
export const runtime = "nodejs";

/**
 * Start a parental-consent request: sign a token and email the parent a link.
 *
 * Rate limited with the same limiter as /api/plan — this endpoint sends mail to
 * an address the caller supplies, so without a limit it is a spam relay pointed
 * at strangers.
 */
const RequestSchema = z
  .object({
    parentEmail: z.string().email().max(254),
    // Only the ages that route through consent. 15 is blocked upstream, 18 has
    // no consent step, so either value here means the client is wrong or lying.
    age: z.union([z.literal(16), z.literal(17)]),
  })
  .strict();

export async function POST(req: Request) {
  const limit = rateLimit(`consent:${clientKey(req)}`);
  if (!limit.ok) {
    console.warn(`/api/consent/request rate limited: ${clientKey(req)}`);
    return Response.json(
      { error: "Too many requests. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".");
    return Response.json(
      { error: `${path || "request"}: ${issue?.message ?? "is invalid"}` },
      { status: 400 },
    );
  }

  const origin = process.env.CONSENT_APP_ORIGIN ?? new URL(req.url).origin;

  try {
    const token = issueToken(parsed.data.parentEmail, parsed.data.age);
    await sendConsentEmail({
      to: parsed.data.parentEmail,
      age: parsed.data.age,
      approveUrl: `${origin}/consent/approve?token=${encodeURIComponent(token)}`,
    });
    // The token goes back to the app so it can be presented alongside the code
    // the parent reads out. On its own it grants nothing.
    return Response.json({ token });
  } catch (err) {
    // A missing CONSENT_SECRET or mailer lands here. The client learns only that
    // it failed, and the caller must treat that as "not approved".
    console.error("/api/consent/request failed:", err);
    return Response.json(
      { error: "Could not send the approval email. Please try again later." },
      { status: 500 },
    );
  }
}
