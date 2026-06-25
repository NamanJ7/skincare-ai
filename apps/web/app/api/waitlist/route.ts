import { mkdir, appendFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

export const runtime = "nodejs";

const WaitlistSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().max(180),
  skinWish: z.string().trim().min(8).max(1000),
  monthlySpend: z.string().trim().min(1).max(80),
  tried: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
  referralCode: z.string().trim().min(5).max(20),
});

export async function POST(req: Request) {
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = WaitlistSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Please complete every waitlist question." },
      { status: 400 },
    );
  }

  const dataDir = join(process.cwd(), ".data");
  const filePath = join(dataDir, "waitlist-submissions.jsonl");
  const record = {
    ...parsed.data,
    email: parsed.data.email.toLowerCase(),
    createdAt: new Date().toISOString(),
    userAgent: req.headers.get("user-agent") ?? "unknown",
  };

  try {
    await mkdir(dataDir, { recursive: true });
    await appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8");
  } catch (error) {
    console.error("/api/waitlist failed:", error);
    return Response.json({ error: "Could not save your spot." }, { status: 500 });
  }

  return Response.json({ ok: true, referralCode: parsed.data.referralCode });
}
