/**
 * Capture, measure, compress and store one guided photo.
 *
 * Photos are written to the app's own document directory and never uploaded to
 * storage. The base64 copy exists only for the duration of one /api/plan
 * request. The user can delete everything from inside the app.
 */
import type { CameraCapturedPicture } from "expo-camera";
import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import {
  captureHint,
  type CaptureAngle,
  type PhotoQuality,
  type SkinTone,
} from "@pore/shared";
import { measureCapture } from "./photoQuality";

/**
 * Claude downsamples vision inputs to a ~1568px max edge, so anything larger is
 * bytes burned for no resolution gain. 1280 leaves headroom and keeps each
 * photo around 200KB.
 */
const DELIVERY_PX = 1280;
const DELIVERY_COMPRESS = 0.75;

const DIR_NAME = "skin-photos";
const MANIFEST = "manifest.json";

export const CAPTURE_STEPS: { angle: CaptureAngle; title: string; hint: string }[] = [
  { angle: "front", title: "Look straight ahead", hint: "Fill the oval, chin level" },
  { angle: "left", title: "Turn slowly to your left", hint: "About 45° — keep your eyes on the screen" },
  { angle: "right", title: "Turn slowly to your right", hint: "About 45° — keep your eyes on the screen" },
];

export interface CapturedPhoto {
  angle: CaptureAngle;
  /** Local file URI in the app's document directory. */
  uri: string;
  /** base64 JPEG, held in memory for the request only — never written to disk. */
  data: string;
  quality: PhotoQuality;
  capturedAt: string;
}

/** A frame the gate rejected, with the one instruction that fixes it. */
export interface RejectedCapture {
  rejected: true;
  hint: string;
  quality: PhotoQuality;
}

export type CaptureOutcome = CapturedPhoto | RejectedCapture;

export function isRejected(o: CaptureOutcome): o is RejectedCapture {
  return "rejected" in o;
}

function photosDir(): Directory {
  return new Directory(Paths.document, DIR_NAME);
}

/**
 * Measure a raw camera frame, and if it passes, compress and store it.
 *
 * `illuminant` records whether the shot was lit by the app's screen flash — a
 * known, repeatable light — or by whatever the room had. Only screen-flash
 * captures are comparable to each other across sessions, so the distinction
 * travels with the photo instead of being assumed.
 */
export async function processCapture(
  picture: CameraCapturedPicture,
  angle: CaptureAngle,
  tone: SkinTone,
  illuminant: PhotoQuality["illuminant"],
  /**
   * Deliver the photo even if the gate rejected it. Used by the escape hatch
   * after two failed attempts on the same angle — the flags still travel with
   * the photo, so the model lowers its own confidence rather than us pretending
   * the shot was fine. Delivery runs through this one path either way, so a
   * forced photo carries real base64 like any other.
   */
  force = false,
): Promise<CaptureOutcome> {
  const score = await measureCapture(picture.uri, picture.width, picture.height, tone);
  const quality: PhotoQuality = {
    angle,
    score: score.score,
    flags: score.flags,
    illuminant,
  };

  const hint = captureHint(score.flags);
  if (hint && !force) return { rejected: true, hint, quality };

  const rendered = await ImageManipulator.manipulate(picture.uri)
    .resize({ width: DELIVERY_PX })
    .renderAsync();
  const delivered = await rendered.saveAsync({
    compress: DELIVERY_COMPRESS,
    format: SaveFormat.JPEG,
    base64: true,
  });
  if (!delivered.base64) throw new Error("Image manipulator returned no base64 data");

  return {
    angle,
    uri: await persist(delivered.uri, angle),
    data: delivered.base64,
    quality,
    capturedAt: new Date().toISOString(),
  };
}

/**
 * Copy a rendered photo into the app's document directory.
 *
 * Storage failures are not fatal: the capture still works, the photo is still
 * analysed, it just is not kept for later. Returning the source uri means the
 * review thumbnails keep rendering either way.
 */
async function persist(sourceUri: string, angle: CaptureAngle): Promise<string> {
  try {
    const dir = photosDir();
    if (!dir.exists) dir.create({ intermediates: true });

    const dest = new File(dir, `${angle}.jpg`);
    if (dest.exists) dest.delete();
    new File(sourceUri).copy(dest);
    return dest.uri;
  } catch {
    return sourceUri;
  }
}

/** Record what was captured and under what conditions, for later comparison. */
export function writeManifest(photos: CapturedPhoto[]): void {
  try {
    const dir = photosDir();
    if (!dir.exists) dir.create({ intermediates: true });
    const file = new File(dir, MANIFEST);
    if (file.exists) file.delete();
    file.create();
    file.write(
      JSON.stringify({
        version: 1,
        photos: photos.map((p) => ({
          angle: p.angle,
          capturedAt: p.capturedAt,
          quality: p.quality,
        })),
      }),
    );
  } catch {
    // The manifest is a convenience for a future session, never a blocker now.
  }
}

/** How many photos are on this device right now. Drives the "Your photos" row. */
export function storedPhotoCount(): number {
  try {
    const dir = photosDir();
    if (!dir.exists) return 0;
    return dir.list().filter((e) => e.name.endsWith(".jpg")).length;
  } catch {
    return 0;
  }
}

/** Remove every photo this app has stored. The user's copy of "forget me". */
export function deleteStoredPhotos(): void {
  const dir = photosDir();
  if (dir.exists) dir.delete();
}
