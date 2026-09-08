/**
 * The routine log: which steps were done, on which day.
 *
 * Same storage contract as `plan.ts` and `photos.ts` — the app's own document
 * directory, versioned JSON, synchronous reads, failures never fatal.
 *
 * One file rather than one per day: a year of use is tens of KB, so splitting
 * it would buy nothing and cost a directory scan on every launch.
 *
 * It sits at the document root, deliberately outside both `check-ins/` and
 * `skin-photos/`. Deleting one check-in should not erase the record of the days
 * you actually did your routine, and deleting photos already promises to leave
 * everything else alone.
 *
 * All the logic lives in `@pore/shared` (`progress/adherence`) where it is
 * tested; this file only reads and writes it.
 */
import { File, Paths } from "expo-file-system";

import { EMPTY_LOG, type RoutineLog } from "@pore/shared";

const FILE_NAME = "routine-log.json";
const VERSION = 1;

function logFile(): File {
  return new File(Paths.document, FILE_NAME);
}

/**
 * The log on this device, or an empty one.
 *
 * Returns `EMPTY_LOG` rather than a partial log on anything it cannot verify:
 * a half-read log would show someone ticks they never made, next to a progress
 * comparison. Losing the record is better than inventing one.
 */
export function loadLog(): RoutineLog {
  try {
    const file = logFile();
    if (!file.exists) return EMPTY_LOG;
    const parsed = JSON.parse(file.textSync()) as Partial<RoutineLog>;
    if (parsed.version !== VERSION) return EMPTY_LOG;
    if (!parsed.days || typeof parsed.days !== "object") return EMPTY_LOG;
    return { version: VERSION, days: parsed.days };
  } catch {
    return EMPTY_LOG;
  }
}

export function saveLog(log: RoutineLog): void {
  try {
    const file = logFile();
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify({ version: VERSION, days: log.days }));
  } catch {
    // A tick that fails to persist is a lost tick, not a broken screen.
  }
}

/** Drop the whole log — part of "start over", alongside clearing the plan. */
export function clearLog(): void {
  try {
    const file = logFile();
    if (file.exists) file.delete();
  } catch {
    // Nothing to do; the next save overwrites whatever is there.
  }
}
