import { z } from "zod";

import { verifyCode } from "@/lib/consent";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * Check the code the parent read off the approval page.
 *
 * Rate limited because a 6-character code over a 32-character alphabet is
 * roughly a billion combinations — plenty against a human, not against an
 * unthrottled loop.
 */
const VerifySchema = z
  .object({ token: z.string().max(2048), code: z.string().max(16) })
  .strict();

export async function POST(req: Request) {
  const limit = rateLimit(`consent-verify:${clientKey(req)}`);
  if (!limit.ok) {
    console.warn(`/api/consent/verify rate limited: ${clientKey(req)}`);
    return Response.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = VerifySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  // verifyCode returns false for a missing secret, a bad signature, an expired
  // token and a wrong code alike. Nothing here can throw its way to an approval.
  const approved = verifyCode(parsed.data.token, parsed.data.code);
  if (!approved) {
    return Response.json({ error: "That code is not right, or it has expired." }, { status: 400 });
  }
  return Response.json({ approved: true });
}
