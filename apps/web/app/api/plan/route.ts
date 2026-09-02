import { generatePlan, type ImageMediaType, type PlanImage, type PlanInput } from "@/lib/pipeline";
import { PhotoQualitySchema } from "@/lib/schemas";

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

/**
 * The mobile app calls this from a different origin than the one serving it,
 * and it sends `content-type: application/json`, which is not a CORS-simple
 * content type — so the browser sends a preflight first. Without an OPTIONS
 * handler that preflight 405s and the request never happens, which is what the
 * Expo web build hits before any of the pipeline runs.
 */
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
} as const;

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  let body: Partial<PlanInput>;
  try {
    body = (await req.json()) as Partial<PlanInput>;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.intake) {
    return json({ error: "Missing `intake`" }, 400);
  }

  const validated = validateImages(body.images);
  if ("error" in validated) {
    return json({ error: validated.error }, 400);
  }

  try {
    const result = await generatePlan({
      images: validated.images,
      intake: body.intake,
    });
    return json(result, 200);
  } catch (err) {
    console.error("/api/plan failed:", err);
    // The upstream message is logged, never returned. It can carry request
    // ids, rate-limit text, and echoes of what was sent. What the client needs
    // is narrower and more useful: whether trying again could work. 503 says
    // yes, so the app can offer a retry that means something.
    return json({ error: "Could not build a plan right now" }, upstreamStatus(err));
  }
}

/** Map an upstream failure onto the one bit the client acts on: retry or not. */
function upstreamStatus(err: unknown): number {
  const status = (err as { status?: unknown })?.status;
  if (typeof status === "number") {
    // Overloaded or rate-limited upstream: the same request may well succeed.
    if (status === 429 || status === 529 || status >= 500) return 503;
    // Our own credentials or request shape are wrong. Retrying won't fix it,
    // and it is not the caller's fault, so it stays a 500.
    if (status >= 400) return 500;
  }
  return 503;
}
