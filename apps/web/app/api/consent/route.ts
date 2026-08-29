import { createConsentRequest } from "@/lib/consent";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: { parentEmail?: unknown; childAge?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parentEmail = typeof body.parentEmail === "string" ? body.parentEmail.trim() : "";
  const childAge = body.childAge;

  if (!parentEmail || !EMAIL.test(parentEmail)) {
    return Response.json({ error: "Invalid `parentEmail`" }, { status: 400 });
  }
  // Mirrors the mobile age gate: <16 is blocked before this screen, 18+
  // skips consent entirely, so a request should only ever be for 16-17.
  if (typeof childAge !== "number" || !Number.isInteger(childAge) || childAge < 16 || childAge > 17) {
    return Response.json({ error: "`childAge` must be 16 or 17" }, { status: 400 });
  }

  try {
    const { id } = await createConsentRequest({ parentEmail, childAge });
    return Response.json({ id });
  } catch (err) {
    console.error("/api/consent failed:", err);
    return Response.json({ error: "Failed to create consent request" }, { status: 500 });
  }
}
