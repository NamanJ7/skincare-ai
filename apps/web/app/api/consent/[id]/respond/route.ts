import { respondToConsent } from "@/lib/consent";

/** Hit by the parent-facing /consent/[id] page when they click Approve/Deny. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let body: { token?: unknown; decision?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  const decision = body.decision;
  if (!token || (decision !== "approve" && decision !== "deny")) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const status = await respondToConsent(id, token, decision);
  if (!status) {
    return Response.json({ error: "Invalid, expired, or already-used link" }, { status: 400 });
  }
  return Response.json({ status });
}
