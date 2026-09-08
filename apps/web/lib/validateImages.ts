/**
 * The image half of the `/api/plan` trust boundary.
 *
 * Extracted from the route handler so it can be tested directly. This sits in
 * front of a paid Opus endpoint, and it was previously covered by manual probes
 * only.
 *
 * Each rule returns its own message on purpose: "invalid request" tells a
 * legitimate client nothing, and this is the surface a mobile build hits when
 * its own encoding is wrong.
 */
import type { ImageMediaType, PlanImage } from "./pipeline";
import { PhotoQualitySchema } from "./schemas";

/** The guided capture takes three shots; anything more is not a real client. */
export const MAX_IMAGES = 3;
/** ~8MB of decoded image bytes. Base64 inflates by 4/3. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const ALLOWED_MEDIA_TYPES: ImageMediaType[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export function validateImages(raw: unknown): { images: PlanImage[] } | { error: string } {
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
