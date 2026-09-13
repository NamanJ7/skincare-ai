/**
 * Browser image capture and encoding.
 *
 * Camera and upload pixels are kept at their original resolution until the
 * strict final quality gate has passed. Only then are they resized and JPEG
 * encoded for the analysis API.
 */
import { QUALITY_CONFIG } from "@pore/shared/scan";

/**
 * Encode ceiling for the analysis derivative, never upscaled (see `processSource`).
 *
 * This used to read `analysisTargetWidth`, which is the *framing* reference and
 * is documented as not being a resize target — so the browser was quietly
 * capping analysis images at 1024px. Matching mobile's encode settings means
 * both surfaces hand the model the same fidelity.
 */
export const TARGET_WIDTH = QUALITY_CONFIG.resolution.analysisMaxWidth;
export const JPEG_QUALITY = 0.95;
/** Camera originals are encoded only after their native pixels pass the final
 * gate. This is deliberately higher than the analysis derivative quality. */
export const ORIGINAL_JPEG_QUALITY = 0.96;

/** The camera viewport is a 3:4 `object-cover` surface. */
export const CAPTURE_ASPECT_RATIO = 3 / 4;

export interface ProcessedImage {
  blob: Blob;
  /** Raw base64 (no data: prefix), suitable for PlanImage.data. */
  base64: string;
  width: number;
  height: number;
  mediaType: "image/jpeg";
}

export interface EncodedOriginal {
  blob: Blob;
  width: number;
  height: number;
  mediaType: "image/jpeg";
}

/** An immutable, uncompressed copy of one native video frame. */
export interface FrozenCameraFrame {
  source: HTMLCanvasElement;
  width: number;
  height: number;
  capturedAt: number;
  /** Media time reported by requestVideoFrameCallback, when available. */
  sourceFrameTime: number | null;
}

export interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
}

/** Freeze the exact centered crop visible through the camera viewport.
 * `drawImage` copies the pixels synchronously; later video frames cannot alter
 * the returned canvas while final validation is running. */
export function freezeVideoFrame(
  video: HTMLVideoElement,
  sourceFrameTime: number | null = null,
): FrozenCameraFrame {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  if (!sourceWidth || !sourceHeight || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    throw new Error("Capture source has no current frame");
  }

  const crop = coverCrop(sourceWidth, sourceHeight, CAPTURE_ASPECT_RATIO);
  const canvas = document.createElement("canvas");
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(
    video,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height,
  );

  return {
    source: canvas,
    width: canvas.width,
    height: canvas.height,
    capturedAt: Date.now(),
    sourceFrameTime,
  };
}

/** Backward-compatible convenience. New capture code should freeze, validate,
 * and call processSource only after validation passes. */
export async function captureFromVideo(video: HTMLVideoElement): Promise<ProcessedImage> {
  const frozen = freezeVideoFrame(video);
  return processSource(frozen.source, frozen.width, frozen.height);
}

/** Backward-compatible convenience. New upload code should use
 * decodeOriginalFile so validation happens before compression. */
export async function processFile(file: File): Promise<ProcessedImage> {
  const decoded = await decodeOriginalFile(file);
  try {
    return await processSource(decoded.source, decoded.width, decoded.height);
  } finally {
    decoded.close();
  }
}

/** Decode an upload with EXIF orientation applied without resizing or lossy
 * re-encoding. Call `close` after validation and encoding complete. */
export async function decodeOriginalFile(file: File): Promise<DecodedImage> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  } catch {
    // Older engines normally honor EXIF through CSS image-orientation.
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  }
}

/** Encode an already-validated image for analysis. */
export async function processSource(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): Promise<ProcessedImage> {
  if (!sourceWidth || !sourceHeight) throw new Error("Capture source has no dimensions");

  const scale = Math.min(1, TARGET_WIDTH / sourceWidth);
  const width = Math.round(sourceWidth * scale);
  const height = Math.round(sourceHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(source, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("JPEG encoding failed"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });

  return { blob, base64: await blobToBase64(blob), width, height, mediaType: "image/jpeg" };
}

/** Persist a validated camera canvas at its native crop resolution. This must
 * never be called before the final quality result has passed. Uploads retain
 * their original File instead of going through this encoder. */
export async function encodeValidatedCameraOriginal(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): Promise<EncodedOriginal> {
  if (!sourceWidth || !sourceHeight) throw new Error("Capture source has no dimensions");
  const canvas = document.createElement("canvas");
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(source, 0, 0, sourceWidth, sourceHeight);
  const blob = await canvasToBlob(canvas, "image/jpeg", ORIGINAL_JPEG_QUALITY);
  return { blob, width: sourceWidth, height: sourceHeight, mediaType: "image/jpeg" };
}

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Source rectangle equivalent to centered CSS `object-fit: cover`. */
export function coverCrop(sourceWidth: number, sourceHeight: number, targetAspect: number): CropRect {
  const sourceAspect = sourceWidth / sourceHeight;
  if (sourceAspect > targetAspect) {
    const width = Math.max(1, Math.round(sourceHeight * targetAspect));
    return { x: Math.floor((sourceWidth - width) / 2), y: 0, width, height: sourceHeight };
  }
  const height = Math.max(1, Math.round(sourceWidth / targetAspect));
  return { x: 0, y: Math.floor((sourceHeight - height) / 2), width: sourceWidth, height };
}

/** Blob to raw base64 without the data-URL prefix. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read blob"));
    reader.onload = () => {
      const url = reader.result as string;
      resolve(url.slice(url.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error("Image encoding failed"))),
      type,
      quality,
    );
  });
}
