import { getConsentStatus } from "@/lib/consent";

/** Polled by the mobile app's waiting screen. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const status = await getConsentStatus(id);
  if (!status) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ status });
}
