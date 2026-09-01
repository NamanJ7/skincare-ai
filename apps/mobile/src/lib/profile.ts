/**
 * The user's answers and their plan, kept on this device.
 *
 * Everything the safety engine needs to be correct — sensitivity, the pregnancy
 * flag, declared allergies, skin tone — is collected once during onboarding and
 * then needed on every single launch for the rest of the routine. Holding it in
 * React state meant it survived exactly as long as the process did: on the next
 * cold start `/today` fell back to a demo routine clamped against default
 * answers, so a pregnant user with sensitive skin could be shown a retinoid.
 *
 * So it lives on disk, next to the journal and the photos, under the same
 * promise: nothing here is uploaded. Storage is deliberately the same dumb shape
 * as `journal.ts` — one small JSON file, synchronous reads, best-effort writes.
 *
 * The base64 photo payloads are NOT persisted. They exist for the duration of
 * one `/api/plan` request and nothing else; a return visit captures fresh ones.
 */
import { Directory, File, Paths } from "expo-file-system";
import type { OnboardingData } from "@/state/onboarding";

const DIR_NAME = "profile";
const FILE_NAME = "profile.json";

/**
 * What actually gets written. `photos` is dropped on the way to disk — see the
 * note above — so this is the answers, the plan, and the one timestamp that
 * says onboarding was finished rather than abandoned halfway.
 */
export interface Profile extends Omit<OnboardingData, "photos"> {
  version: 1;
  /** Set when the questionnaire completes. Absent means onboarding is unfinished. */
  onboardedAt?: string;
}

function dir(): Directory {
  return new Directory(Paths.document, DIR_NAME);
}

function file(): File {
  return new File(dir(), FILE_NAME);
}

/** Read the stored profile, or an empty one on first run. Never throws. */
export function readProfile(): Profile {
  try {
    const f = file();
    if (!f.exists) return { version: 1 };
    return { ...(JSON.parse(f.textSync()) as Profile), version: 1 };
  } catch {
    return { version: 1 };
  }
}

/**
 * Persist the answers and plan, dropping the in-memory photo payloads.
 *
 * Best-effort like the journal: a dropped write costs the user a re-answer at
 * worst, and must never take the screen down with it.
 */
export function writeProfile(data: OnboardingData & { onboardedAt?: string }): void {
  try {
    const d = dir();
    if (!d.exists) d.create({ intermediates: true });
    const f = file();
    if (f.exists) f.delete();
    f.create();
    const { photos: _photos, ...rest } = data;
    f.write(JSON.stringify({ ...rest, version: 1 }));
  } catch {
    // Never fatal. The session in memory is still correct.
  }
}

/**
 * Whether this device has a finished onboarding to return to.
 *
 * Deliberately keyed on the questionnaire completing rather than on a plan
 * existing: when `/api/plan` is unreachable the app still has real answers, and
 * running the local safety engine against real answers beats sending someone
 * back through onboarding they already did.
 */
export function hasProfile(): boolean {
  return readProfile().onboardedAt !== undefined;
}

/** Erase the answers and the plan. The other half of "forget me". */
export function deleteProfile(): void {
  const d = dir();
  if (d.exists) d.delete();
}
