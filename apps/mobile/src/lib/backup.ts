/**
 * Take the record off this phone, and put it back.
 *
 * Everything this product measures is anchored to one number it can never
 * recompute: the baseline `Assessment`, written once at signup and deliberately
 * never replaced, because comparing against a moving zero would let slow drift
 * disappear. Until this file existed that number lived in a single JSON file in
 * one app's document directory, with no backup of any kind. A reinstall, a lost
 * phone or a switch to a different handset did not cost the user their routine —
 * it cost them the ability to ever measure progress again, permanently.
 *
 * There is no server to solve that with, and adding one would contradict the
 * privacy content that this app's own screens render. So the user gets the file.
 *
 * What travels: the answers, the plan, and the whole journal — the routine start
 * date, every tick-off, every check-in, the stored assessments and the persisted
 * adaptation. What does not: the photos. They are two orders of magnitude larger
 * than the rest put together, and the thing that cannot be rebuilt is the
 * assessment, not the JPEG it was read from. The UI says so; do not let the copy
 * drift into implying the photos are in here.
 */
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { readProfile, writeProfile, type Profile } from "@/lib/profile";
import { readJournal, writeJournalRaw, type Journal } from "@/lib/journal";

/**
 * Bumped when the bundle's shape changes. `importBundle` refuses anything it
 * does not recognise rather than guessing — a half-understood restore would
 * write a corrupt baseline, and a corrupt baseline is indistinguishable from a
 * real one until the comparison it ruins.
 */
const BUNDLE_VERSION = 1;

interface Bundle {
  kind: "pore-backup";
  version: number;
  exportedAt: string;
  profile: Profile;
  journal: Journal;
}

const FILE_NAME = "pore-backup.json";

export type ExportOutcome = { ok: true } | { ok: false; reason: string };

/** Write the bundle to a temporary file and hand it to the system share sheet. */
export async function exportBundle(): Promise<ExportOutcome> {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, reason: "This phone can't share files from apps." };
    }
    const bundle: Bundle = {
      kind: "pore-backup",
      version: BUNDLE_VERSION,
      exportedAt: new Date().toISOString(),
      profile: readProfile(),
      journal: readJournal(),
    };

    // Cache, not documents: this copy is for handing to another app, and the
    // originals it was made from are still where they were. Leaving it in the
    // document directory would make a second copy of the user's record that
    // "delete my data" does not know about.
    const file = new File(new Directory(Paths.cache), FILE_NAME);
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify(bundle));

    await Sharing.shareAsync(file.uri, {
      mimeType: "application/json",
      dialogTitle: "Save your Pore record",
      UTI: "public.json",
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: "We couldn't build the file. Nothing on this phone changed." };
  }
}

export type ImportOutcome =
  | { ok: true }
  | { ok: false; canceled: true }
  | { ok: false; canceled?: false; reason: string };

/**
 * Read a bundle back in, replacing what is on this phone.
 *
 * Deliberately a replace and not a merge. Two devices' journals cannot be
 * reconciled without a rule for which tick-off wins, and inventing one would put
 * days into the adherence record that nobody claimed — the number that gates
 * whether the routine is allowed to get *stronger*. Replace is the honest
 * operation, and the screen asks before it runs.
 */
export async function importBundle(): Promise<ImportOutcome> {
  let picked;
  try {
    picked = await File.pickFileAsync({ mimeTypes: ["application/json"] });
  } catch {
    return { ok: false, reason: "We couldn't open the file picker." };
  }
  if (picked.canceled) return { ok: false, canceled: true };

  try {
    const parsed = JSON.parse(picked.result.textSync()) as Partial<Bundle>;
    if (parsed.kind !== "pore-backup") {
      return { ok: false, reason: "That isn't a Pore record file." };
    }
    if (parsed.version !== BUNDLE_VERSION || !parsed.profile || !parsed.journal) {
      return {
        ok: false,
        reason: "That file was saved by a different version of Pore and can't be read here.",
      };
    }

    // Journal first. If the write of the second store fails, an intact journal
    // beside stale answers still holds the baseline; the reverse loses it.
    writeJournalRaw(parsed.journal);
    const { version: _version, ...profile } = parsed.profile;
    writeProfile(profile);
    return { ok: true };
  } catch {
    return { ok: false, reason: "That file couldn't be read." };
  }
}
