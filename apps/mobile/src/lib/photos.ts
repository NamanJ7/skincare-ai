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
  type FrameScore,
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
  /**
   * Raw scoreFrame() measurements — never sent to /api/plan, kept on-device only
   * so real-capture data exists to calibrate CAPTURE_TUNING later. See TODOS.md.
   */
  metrics: FrameScore["metrics"];
  illuminantEstimate: FrameScore["illuminant"];
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

function sessionDir(sessionId: string): Directory {
  return new Directory(photosDir(), sessionId);
}

/** A filesystem-safe id for a new capture session, ordered by capture time. */
export function newSessionId(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
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
  /** Which capture session this photo belongs to — see `newSessionId`. */
  sessionId: string,
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
    uri: await persist(delivered.uri, angle, sessionId),
    data: delivered.base64,
    quality,
    capturedAt: new Date().toISOString(),
    metrics: score.metrics,
    illuminantEstimate: score.illuminant,
  };
}

/**
 * Copy a rendered photo into this session's own folder.
 *
 * Each session keeps its own `<sessionId>/` folder rather than sharing one flat
 * directory, so an earlier visit's photos survive a later one instead of being
 * overwritten — that history is what a future comparison view needs.
 *
 * Storage failures are not fatal: the capture still works, the photo is still
 * analysed, it just is not kept for later. Returning the source uri means the
 * review thumbnails keep rendering either way.
 */
async function persist(sourceUri: string, angle: CaptureAngle, sessionId: string): Promise<string> {
  try {
    const dir = sessionDir(sessionId);
    if (!dir.exists) dir.create({ intermediates: true });

    const dest = new File(dir, `${angle}.jpg`);
    if (dest.exists) dest.delete();
    new File(sourceUri).copy(dest);
    return dest.uri;
  } catch {
    return sourceUri;
  }
}

/** One completed capture session, as recorded in the top-level session index. */
export interface StoredSession {
  id: string;
  capturedAt: string;
}

const SESSIONS_INDEX = "sessions.json";

function readSessionIndex(): StoredSession[] {
  try {
    const file = new File(photosDir(), SESSIONS_INDEX);
    if (!file.exists) return [];
    const parsed = JSON.parse(file.textSync()) as { sessions?: StoredSession[] };
    return parsed.sessions ?? [];
  } catch {
    return [];
  }
}

/** Every capture session stored on this device, most recent first. */
export function listSessions(): StoredSession[] {
  return [...readSessionIndex()].reverse();
}

/** URI of one angle's photo from a past session, or undefined if it isn't there. */
export function sessionPhotoUri(sessionId: string, angle: CaptureAngle): string | undefined {
  const file = new File(sessionDir(sessionId), `${angle}.jpg`);
  return file.exists ? file.uri : undefined;
}

function appendToSessionIndex(session: StoredSession): void {
  try {
    const dir = photosDir();
    if (!dir.exists) dir.create({ intermediates: true });
    const sessions = [...readSessionIndex(), session];
    const file = new File(dir, SESSIONS_INDEX);
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify({ version: 1, sessions }));
  } catch {
    // The index is a convenience for a future session, never a blocker now.
  }
}

/**
 * Record what was captured and under what conditions, for later comparison,
 * and register the session in the top-level index so it can be listed later.
 *
 * `metrics`/`illuminantEstimate` (added in manifest version 2) are the raw
 * scoreFrame() measurements the app already computes but otherwise discards —
 * pulling this file off a real device is how CAPTURE_TUNING and the flash
 * verification procedure in TODOS.md actually get real numbers to work from.
 * Nothing in this app parses the manifest back in, so the version bump is
 * documentation only, no migration needed.
 */
export function writeManifest(photos: CapturedPhoto[], sessionId: string): void {
  const capturedAt = photos[0]?.capturedAt ?? new Date().toISOString();
  try {
    const dir = sessionDir(sessionId);
    if (!dir.exists) dir.create({ intermediates: true });
    const file = new File(dir, MANIFEST);
    if (file.exists) file.delete();
    file.create();
    file.write(
      JSON.stringify({
        version: 2,
        id: sessionId,
        capturedAt,
        photos: photos.map((p) => ({
          angle: p.angle,
          capturedAt: p.capturedAt,
          quality: p.quality,
          metrics: p.metrics,
          illuminantEstimate: p.illuminantEstimate,
        })),
      }),
    );
  } catch {
    // The manifest is a convenience for a future session, never a blocker now.
  }
  appendToSessionIndex({ id: sessionId, capturedAt });
}

/** How many photos are on this device right now, across every session. Drives the "Your photos" row. */
export function storedPhotoCount(): number {
  try {
    const dir = photosDir();
    if (!dir.exists) return 0;
    return dir
      .list()
      .filter((e): e is Directory => e instanceof Directory)
      .reduce((total, session) => total + session.list().filter((f) => f.name.endsWith(".jpg")).length, 0);
  } catch {
    return 0;
  }
}

/** How many photos one session has stored, for a per-session delete row. */
export function photoCountForSession(sessionId: string): number {
  try {
    return sessionDir(sessionId)
      .list()
      .filter((f) => f.name.endsWith(".jpg")).length;
  } catch {
    return 0;
  }
}

/** Remove every photo this app has stored, across every session. The user's copy of "forget me". */
export function deleteStoredPhotos(): void {
  const dir = photosDir();
  if (dir.exists) dir.delete();
}

/** The session index with one session removed — split out so it has a runnable check. */
export function dropSession(sessions: StoredSession[], id: string): StoredSession[] {
  return sessions.filter((s) => s.id !== id);
}

/** Remove one session's photos and manifest, and drop it from the top-level index. */
export function deleteSession(sessionId: string): void {
  try {
    const dir = sessionDir(sessionId);
    if (dir.exists) dir.delete();
  } catch {
    // Best effort, same as every other storage op in this file.
  }
  try {
    const file = new File(photosDir(), SESSIONS_INDEX);
    const sessions = dropSession(readSessionIndex(), sessionId);
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify({ version: 1, sessions }));
  } catch {
    // The index is a convenience for a future session, never a blocker now.
  }
}
