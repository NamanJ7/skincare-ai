import { z } from "zod";

import { codeFor, readToken } from "@/lib/consent";
import { clientKey, rateLimit } from "@/lib/rate-limit";

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

export async function POST(req: Request) {
  const limit = rateLimit(`consent-approve:${clientKey(req)}`);
  if (!limit.ok) {
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

  const parsed = ApproveSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  if (!readToken(parsed.data.token)) {
    return Response.json({ error: "This link has expired or is not valid." }, { status: 400 });
  }
  return Response.json({ code: codeFor(parsed.data.token) });
}
