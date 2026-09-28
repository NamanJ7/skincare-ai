/**
 * On-device progress photos. Everything is best-effort (like storage.ts):
 * a failed copy means a missing thumbnail, never a crash — and on web, where
 * the new expo-file-system classes are unavailable, every call is a no-op.
 *
 * Only RELATIVE file names are ever persisted; iOS rewrites the app container
 * path on updates, so absolute URIs go stale. Resolve with photoUri() at read
 * time.
 */
import { Directory, File, Paths } from "expo-file-system";

import { setScanPhotoDisposer } from "./scan-session";

const PHOTOS_DIR = "photos";

function photosDir(): Directory {
  return new Directory(Paths.document, PHOTOS_DIR);
}

/** Resolve a stored relative name to a renderable file:// URI (null on web). */
export function photoUri(name: string): string | null {
  try {
    return new File(Paths.document, PHOTOS_DIR, name).uri;
  } catch {
    return null;
  }
}

/** Copy a temp photo into the photos dir; returns the NAME (not URI) or null. */
export async function persistPhoto(
  sourceUri: string,
  name: string,
): Promise<string | null> {
  try {
    const dir = photosDir();
    dir.create({ idempotent: true, intermediates: true });
    await new File(sourceUri).copy(new File(dir, name));
    return name;
  } catch {
    return null;
  }
}

/** Capture order, named by the cheek shown to the camera (turning your head
 * LEFT shows your RIGHT cheek) — must match STEP_ORDER in @pore/shared/scan. */
const SCAN_ANGLES = ["front", "right", "left"] as const;

/**
 * Persist up to three scan shots. A timeline entry is only returned when the
 * front image succeeds, so a side angle can never be mislabeled as the front
 * comparison photo.
 */
export async function persistScanShots(uris: string[]): Promise<string[]> {
  const ts = Date.now();
  if (!uris[0]) return [];
  const front = await persistPhoto(uris[0], `${ts}-${SCAN_ANGLES[0]}.jpg`);
  if (!front) return [];

  const names: string[] = [front];
  for (let i = 1; i < uris.length && i < SCAN_ANGLES.length; i++) {
    const name = await persistPhoto(uris[i], `${ts}-${SCAN_ANGLES[i]}.jpg`);
    if (name) names.push(name);
  }
  return names;
}

export async function persistCheckInPhoto(uri: string): Promise<string | null> {
  return persistPhoto(uri, `checkin-${Date.now()}.jpg`);
}

/** Remove selected persisted photos without exposing absolute container paths. */
export function deletePhotos(names: readonly string[]): boolean {
  let deleted = true;
  for (const name of names) {
    try {
      const file = new File(Paths.document, PHOTOS_DIR, name);
      if (file.exists) file.delete();
    } catch {
      deleted = false;
      // Best effort. The history record is still removed so stale files cannot
      // appear in the product; Delete all data remains a second cleanup path.
    }
  }
  return deleted;
}

/**
 * Delete transient capture files.
 *
 * The camera and every ImageManipulator encode write full-resolution face JPEGs
 * into the app's cache/tmp directory. Nothing used to remove them, so they
 * survived "Delete my data" indefinitely — iOS evicts a cache directory only
 * under storage pressure, which may never arrive. Accepts `file://` URIs and
 * is best-effort per file: one failure must not strand the rest.
 */
export function discardTempPhotos(uris: readonly (string | undefined)[]): void {
  for (const uri of uris) {
    if (!uri) continue;
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch {
      // Already gone, or outside our sandbox. Nothing useful to do.
    }
  }
}

/** Remove the photos dir and everything in it (Delete-all-data path). */
export function deleteAllPhotos(): boolean {
  let ok = true;
  try {
    const dir = photosDir();
    if (dir.exists) dir.delete();
  } catch {
    // Callers performing a user-requested deletion must surface this failure.
    ok = false;
  }
  // The documents dir is only half the story: full-resolution stills and
  // analysis encodes live in the cache dir. "Delete my data" claims to remove
  // every locally saved photo, so it has to reach those too.
  try {
    const cache = new Directory(Paths.cache);
    if (cache.exists) {
      for (const entry of cache.list()) {
        if (entry instanceof File && isImageName(entry.name)) entry.delete();
      }
    }
  } catch {
    ok = false;
  }
  return ok;
}

/**
 * Wire temp-file disposal into the scan session store.
 *
 * scan-session.ts stays free of native imports (it is pure in-memory state that
 * unit tests load directly), so it takes its disposer by registration — the
 * same pattern as setStorageMirror and setAnalyticsSink. Called once at app
 * start from app/_layout.tsx.
 */
export function installScanPhotoDisposer(): void {
  setScanPhotoDisposer(discardTempPhotos);
}

/** Cache entries we own well enough to delete: image encodes, nothing else. */
function isImageName(name: string): boolean {
  return /\.(jpe?g|png|webp|heic)$/i.test(name);
}
