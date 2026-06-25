import { generatePlan, type PlanInput } from "@/lib/pipeline";

// The Anthropic SDK needs the Node runtime (not edge); two Opus calls can take
// a while, so give the function room.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: Partial<PlanInput>;
  try {
    body = (await req.json()) as Partial<PlanInput>;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.intake) {
    return Response.json({ error: "Missing `intake`" }, { status: 400 });
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
