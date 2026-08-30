import { generatePlan, type ImageMediaType, type PlanImage, type PlanInput } from "@/lib/pipeline";
import { IntakeResponseSchema, PhotoQualitySchema } from "@/lib/schemas";

// The Anthropic SDK needs the Node runtime (not edge); two Opus calls can take
// a while, so give the function room.
export const runtime = "nodejs";
export const maxDuration = 60;

/** The guided capture takes three shots; anything more is not a real client. */
const MAX_IMAGES = 3;
/** ~8MB of decoded image bytes. Base64 inflates by 4/3. */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MEDIA_TYPES: ImageMediaType[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

/**
 * This is a trust boundary in front of a paid Opus endpoint, so it is explicit
 * and lives here rather than being folded into the pipeline. Each rule returns
 * its own message: "invalid request" tells a legitimate client nothing.
 */
function validateImages(raw: unknown): { images: PlanImage[] } | { error: string } {
  if (raw === undefined || raw === null) return { images: [] };
  if (!Array.isArray(raw)) return { error: "`images` must be an array" };
  if (raw.length > MAX_IMAGES) {
    return { error: `At most ${MAX_IMAGES} images are accepted, got ${raw.length}` };
  }

  const images: PlanImage[] = [];
  for (let i = 0; i < raw.length; i++) {
    const img = raw[i] as Partial<PlanImage> | null;
    if (!img || typeof img !== "object") return { error: `images[${i}] must be an object` };
    if (typeof img.data !== "string" || img.data.length === 0) {
      return { error: `images[${i}].data must be a non-empty base64 string` };
    }
    if (img.data.startsWith("data:")) {
      return { error: `images[${i}].data must be raw base64, without a data: URI prefix` };
    }
    // Base64 encodes 3 bytes per 4 characters; check before allocating anything.
    if ((img.data.length * 3) / 4 > MAX_IMAGE_BYTES) {
      return { error: `images[${i}] exceeds the ${MAX_IMAGE_BYTES / (1024 * 1024)}MB limit` };
    }
    if (img.mediaType !== undefined && !ALLOWED_MEDIA_TYPES.includes(img.mediaType)) {
      return {
        error: `images[${i}].mediaType must be one of ${ALLOWED_MEDIA_TYPES.join(", ")}`,
      };
    }

    // Capture quality is client-measured, so it is parsed rather than trusted.
    let quality: PlanImage["quality"];
    if (img.quality !== undefined) {
      const parsed = PhotoQualitySchema.safeParse(img.quality);
      if (!parsed.success) return { error: `images[${i}].quality is malformed` };
      quality = parsed.data;
    }

    images.push({ data: img.data, mediaType: img.mediaType, quality });
  }
  return { images };
}

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

  const intakeParsed = IntakeResponseSchema.safeParse(body.intake);
  if (!intakeParsed.success) {
    return Response.json({ error: "`intake` is malformed" }, { status: 400 });
  }

  const validated = validateImages(body.images);
  if ("error" in validated) {
    return Response.json({ error: validated.error }, { status: 400 });
  }

  try {
    const result = await generatePlan({
      images: validated.images,
      intake: intakeParsed.data,
    });
    return Response.json(result);
  } catch (err) {
    console.error("/api/plan failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
