/**
 * The trust boundary in front of a paid Opus endpoint.
 *
 * Pure and dependency-free on purpose: no Next, no Anthropic SDK, no API key.
 * A boundary you cannot test is a claim rather than a boundary, and this one
 * guards two sequential `claude-opus-4-8` calls that a stranger can trigger.
 *
 * The rule throughout: every request cost must be bounded by things WE decide,
 * never by things the caller sends. Images were already capped that way; the
 * intake was not, and an unknown field holding a few megabytes of text was
 * serialized into both calls.
 */
import { IntakeSchema, PhotoQualitySchema } from "./schemas";
import type { ImageMediaType, PlanImage, PlanInput } from "./pipeline";

/** The guided capture takes three shots; anything more is not a real client. */
export const MAX_IMAGES = 3;
/**
 * Matches the Anthropic API's own base64 image limit. It used to be 8MB, which
 * meant a 6MB image was accepted here, buffered, sent, and rejected upstream —
 * latency and bandwidth spent to produce an error.
 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** Three images at the cap, base64-inflated, plus room for the intake and JSON. */
export const MAX_BODY_BYTES = 24 * 1024 * 1024;

const ALLOWED_MEDIA_TYPES: ImageMediaType[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

/** Standard base64, no whitespace, correct padding. */
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export type ValidationResult =
  | { ok: true; input: PlanInput }
  | { ok: false; status: number; error: string };

function reject(error: string, status = 400): ValidationResult {
  return { ok: false, status, error };
}

/**
 * Validate a decoded request body.
 *
 * Validation errors stay specific — "invalid request" tells a legitimate client
 * nothing, and these messages describe the caller's own input rather than
 * anything about the server. That is the opposite of the 500 path, which must
 * stay generic.
 */
export function validatePlanRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return reject("Request body must be a JSON object");
  }
  const { images: rawImages, intake: rawIntake } = body as Record<string, unknown>;

  if (rawIntake === undefined || rawIntake === null) return reject("Missing `intake`");
  const intake = IntakeSchema.safeParse(rawIntake);
  if (!intake.success) {
    const issue = intake.error.issues[0];
    const path = issue?.path.join(".");
    return reject(path ? `intake.${path} is invalid` : "`intake` is invalid");
  }

  if (!Array.isArray(rawImages)) return reject("`images` must be an array");
  // An empty array used to pass, and still fired both Opus calls with the
  // vision prompt looking at nothing.
  if (rawImages.length === 0) return reject("At least one image is required");
  if (rawImages.length > MAX_IMAGES) {
    return reject(`At most ${MAX_IMAGES} images are accepted, got ${rawImages.length}`);
  }

  const images: PlanImage[] = [];
  for (let i = 0; i < rawImages.length; i++) {
    const img = rawImages[i] as Partial<PlanImage> | null;
    if (!img || typeof img !== "object") return reject(`images[${i}] must be an object`);
    if (typeof img.data !== "string" || img.data.length === 0) {
      return reject(`images[${i}].data must be a non-empty base64 string`);
    }
    if (img.data.startsWith("data:")) {
      return reject(`images[${i}].data must be raw base64, without a data: URI prefix`);
    }
    // Base64 encodes 3 bytes per 4 characters; check before allocating anything.
    if ((img.data.length * 3) / 4 > MAX_IMAGE_BYTES) {
      return reject(`images[${i}] exceeds the ${MAX_IMAGE_BYTES / (1024 * 1024)}MB limit`);
    }
    if (img.data.length % 4 !== 0 || !BASE64.test(img.data)) {
      return reject(`images[${i}].data is not valid base64`);
    }
    // Required rather than defaulted: the pipeline used to assume JPEG, so a
    // PNG sent without this was mislabeled to the API.
    if (img.mediaType === undefined) return reject(`images[${i}].mediaType is required`);
    if (!ALLOWED_MEDIA_TYPES.includes(img.mediaType)) {
      return reject(`images[${i}].mediaType must be one of ${ALLOWED_MEDIA_TYPES.join(", ")}`);
    }

    // Capture quality is client-measured, so it is parsed rather than trusted.
    let quality: PlanImage["quality"];
    if (img.quality !== undefined) {
      const parsed = PhotoQualitySchema.safeParse(img.quality);
      if (!parsed.success) return reject(`images[${i}].quality is malformed`);
      quality = parsed.data;
    }

    images.push({ data: img.data, mediaType: img.mediaType, quality });
  }

  return { ok: true, input: { images, intake: intake.data } };
}
