import { generatePlan, type ImageMediaType, type PlanImage } from "@/lib/pipeline";
import { IntakeSchema, PhotoQualitySchema } from "@/lib/schemas";
import { clientKey, rateLimit } from "@/lib/rate-limit";

// The Anthropic SDK needs the Node runtime (not edge); two Opus calls can take
// a while, so give the function room.
export const runtime = "nodejs";
export const maxDuration = 60;

/** The guided capture takes three shots; anything more is not a real client. */
const MAX_IMAGES = 3;
/**
 * ~1MB of decoded image bytes per shot. Base64 inflates by 4/3, so three shots at
 * the cap plus intake stay under the ~4.5MB request body Vercel will accept — the
 * per-image and whole-body limits have to agree with the platform or a real user
 * gets an opaque platform 413 instead of the messages below. Real captures are
 * 200-400KB (resized to 1280px at 0.75 quality in apps/mobile/src/lib/photos.ts).
 */
const MAX_IMAGE_BYTES = 1024 * 1024;
/** Whole-body ceiling, checked before anything is read into memory. */
const MAX_BODY_BYTES = 4.5 * 1024 * 1024;
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
  // 1. Rate limit before anything else — a rejected caller should cost us nothing.
  const key = clientKey(req);
  const limit = rateLimit(key);
  const limitHeaders = {
    "RateLimit-Limit": String(limit.limit),
    "RateLimit-Remaining": String(limit.remaining),
    "RateLimit-Reset": String(limit.reset),
  };
  if (!limit.ok) {
    // Without this line, abuse of a paid endpoint is invisible until the bill arrives.
    console.warn(`/api/plan rate limited: ${key} (limit ${limit.limit}/10min)`);
    return Response.json(
      { error: "Too many requests. Please wait a few minutes and try again." },
      {
        status: 429,
        headers: { ...limitHeaders, "Retry-After": String(limit.retryAfter) },
      },
    );
  }

  // 2. Size-check the body before req.json() pulls it into memory. A missing
  //    content-length is rejected rather than trusted: both real clients always
  //    set it, and Vercel's platform cap does not exist under `next dev`.
  const declaredLength = req.headers.get("content-length");
  if (declaredLength === null) {
    return Response.json({ error: "`content-length` is required" }, { status: 411, headers: limitHeaders });
  }
  const bodyBytes = Number(declaredLength);
  if (!Number.isFinite(bodyBytes) || bodyBytes < 0) {
    return Response.json({ error: "`content-length` is malformed" }, { status: 400, headers: limitHeaders });
  }
  if (bodyBytes > MAX_BODY_BYTES) {
    return Response.json(
      { error: `Request body exceeds the ${MAX_BODY_BYTES / (1024 * 1024)}MB limit` },
      { status: 413, headers: limitHeaders },
    );
  }

  let body: { intake?: unknown; images?: unknown };
  try {
    body = (await req.json()) as { intake?: unknown; images?: unknown };
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: limitHeaders });
  }

  // 3. The intake is stringified into both prompts, so it is parsed, not trusted.
  const intake = IntakeSchema.safeParse(body.intake);
  if (!intake.success) {
    const issue = intake.error.issues[0];
    // Root-level issues (an unrecognized key, a non-object) carry an empty path.
    const path = issue?.path.join(".");
    const field = path ? `intake.${path}` : "intake";
    return Response.json(
      { error: `${field}: ${issue?.message ?? "is invalid"}` },
      { status: 400, headers: limitHeaders },
    );
  }

  const validated = validateImages(body.images);
  if ("error" in validated) {
    return Response.json({ error: validated.error }, { status: 400, headers: limitHeaders });
  }

  try {
    const result = await generatePlan({
      images: validated.images,
      intake: intake.data,
    });
    return Response.json(result, { headers: limitHeaders });
  } catch (err) {
    // Log the real error; return a fixed message. Anthropic SDK errors carry
    // request ids, model names and upstream detail that a caller has no business
    // seeing.
    console.error("/api/plan failed:", err);
    return Response.json(
      { error: "Could not generate a plan right now. Please try again." },
      { status: 500, headers: limitHeaders },
    );
  }
}
