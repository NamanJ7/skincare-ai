import { isConsentApproved } from "@/lib/consent";
import { generatePlan, type PlanInput } from "@/lib/pipeline";

// The Anthropic SDK needs the Node runtime (not edge); two Opus calls can take
// a while, so give the function room.
export const runtime = "nodejs";
export const maxDuration = 60;

interface PlanRequestBody extends Partial<PlanInput> {
  /** Required when intake.age is under 18 -- see lib/consent.ts. The id
   *  alone isn't enough: it must match the parentEmail the consent request
   *  was created with, so an unrelated approved request can't be reused. */
  parentalConsent?: { id?: string; parentEmail?: string };
}

export async function POST(req: Request) {
  let body: PlanRequestBody;
  try {
    body = (await req.json()) as PlanRequestBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.intake) {
    return Response.json({ error: "Missing `intake`" }, { status: 400 });
  }

  // Deterministic safety clamp for actives lives in the shared engine; this
  // is the equivalent code-level guarantee for the photo pipeline itself --
  // no amount of client-side UI can be trusted to gate it.
  if (body.intake.age < 18) {
    const consentId = body.parentalConsent?.id;
    const parentEmail = body.parentalConsent?.parentEmail;
    const approved =
      consentId && parentEmail ? await isConsentApproved(consentId, parentEmail) : false;
    if (!approved) {
      return Response.json(
        { error: "Parental approval is required before running the photo pipeline" },
        { status: 403 },
      );
    }
  }

  try {
    const result = await generatePlan({
      images: body.images ?? [],
      intake: body.intake,
    });
    return Response.json(result);
  } catch (err) {
    console.error("/api/plan failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
