/**
 * Check-in memory: every visit's assessment and routine, kept on this device.
 *
 * One check-in = one guided-capture session plus the plan it produced, keyed by
 * the same `sessionId` the photos are stored under. That key is what makes
 * progress possible at all — findings and pixels from the same visit have to be
 * able to find each other.
 *
 * Same storage contract as `photos.ts`: the app's own document directory, plain
 * versioned JSON, synchronous reads, failures never fatal.
 *
 * Records live in `check-ins/`, deliberately NOT inside `skin-photos/`. That
 * directory is deleted wholesale by `deleteStoredPhotos()`, and the app promises
 * that deleting your photos leaves your routine alone.
 *
 * There is no index file. `newSessionId()` is an ISO timestamp with `:` and `.`
 * replaced, so filenames sort lexically and the directory listing IS the index.
 * That avoids the failure mode `sessions.json` already has, where a record can
 * exist on disk while the index write that should have announced it failed.
 *
 * The base64 photo bytes are never written here. They exist for the duration of
 * one /api/plan request; only the JPEGs outlive it. The privacy copy depends on
 * that staying true.
 */
import { Directory, File, Paths } from "expo-file-system";

import type { IntakeResponse } from "@pore/shared";
import type { PlanResult } from "./api";
import { deleteSessionPhotos, listSessions } from "./photos";

const DIR_NAME = "check-ins";
const LEGACY_FILE = "plan.json";
const VERSION = 2;

/** One stored check-in. */
export interface StoredCheckIn {
  version: number;
  /** The capture session whose photos produced this plan. */
  sessionId: string;
  savedAt: string;
  /** The intake it was generated from, so a return visit isn't re-asked. */
  intake: IntakeResponse;
  plan: PlanResult;
}

/** A check-in as listed, without loading the whole record. */
export interface CheckInSummary {
  sessionId: string;
  savedAt: string;
}

function checkInsDir(): Directory {
  return new Directory(Paths.document, DIR_NAME);
}

function recordFile(sessionId: string): File {
  return new File(checkInsDir(), `${sessionId}.json`);
}

/**
 * Validate a parsed record before trusting it.
 *
 * Strict on purpose, for the same reason it always was: this runs on the launch
 * path, so a record we cannot fully verify is treated as absent. A half-read
 * plan either crashes every start or puts the wrong findings in front of someone.
 */
function validate(parsed: Partial<StoredCheckIn> | null): StoredCheckIn | null {
  if (!parsed || parsed.version !== VERSION) return null;
  if (!parsed.sessionId || !parsed.savedAt || !parsed.intake || !parsed.plan) return null;

  const { assessment, routine, adjustments } = parsed.plan;
  if (!assessment || !Array.isArray(assessment.findings)) return null;
  if (!Array.isArray(assessment.limitations) || !Array.isArray(assessment.photoQuality)) return null;
  if (!assessment.escalation) return null;
  if (!routine || !Array.isArray(routine.am) || !Array.isArray(routine.pm)) return null;
  if (!Array.isArray(adjustments)) return null;

  return parsed as StoredCheckIn;
}

function readRecord(sessionId: string): StoredCheckIn | null {
  try {
    const file = recordFile(sessionId);
    if (!file.exists) return null;
    return validate(JSON.parse(file.textSync()) as Partial<StoredCheckIn>);
  } catch {
    return null;
  }
}

/** Session ids on disk, newest first. Filenames are sortable timestamps. */
function recordIds(): string[] {
  try {
    const dir = checkInsDir();
    if (!dir.exists) return [];
    return dir
      .list()
      .filter((e): e is File => e instanceof File && e.name.endsWith(".json"))
      .map((f) => f.name.slice(0, -".json".length))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

/**
 * Adopt a pre-history `plan.json` as the first check-in, once.
 *
 * Without this, bumping the schema would silently drop the routine of everyone
 * who already had one — an update that quietly eats your data is exactly the
 * kind of trust failure this whole feature exists to avoid.
 */
function migrateLegacyPlan(): void {
  try {
    const legacy = new File(Paths.document, LEGACY_FILE);
    if (!legacy.exists) return;
    if (recordIds().length > 0) {
      legacy.delete();
      return;
    }

    const parsed = JSON.parse(legacy.textSync()) as {
      version?: number;
      savedAt?: string;
      intake?: IntakeResponse;
      plan?: PlanResult;
    };
    if (parsed.version === 1 && parsed.intake && parsed.plan) {
      const savedAt = parsed.savedAt ?? new Date().toISOString();
      // Prefer the real capture session, so the migrated plan still points at
      // the photos that produced it; fall back to a stamp derived the same way
      // `newSessionId()` derives one.
      const sessionId = listSessions()[0]?.id ?? savedAt.replace(/[:.]/g, "-");
      write({ version: VERSION, sessionId, savedAt, intake: parsed.intake, plan: parsed.plan });
    }
    legacy.delete();
  } catch {
    // A failed migration must not stop the app from starting.
  }
}

function write(record: StoredCheckIn): void {
  const dir = checkInsDir();
  if (!dir.exists) dir.create({ intermediates: true });
  const file = recordFile(record.sessionId);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(record));
}

/** Persist one check-in, keyed to the capture session behind it. */
export function saveCheckIn(sessionId: string, intake: IntakeResponse, plan: PlanResult): void {
  try {
    write({ version: VERSION, sessionId, savedAt: new Date().toISOString(), intake, plan });
  } catch {
    // Persistence is a convenience for the next launch, never a blocker now.
  }
}

/** Every check-in on this device, newest first. Corrupt records are skipped. */
export function listCheckIns(): CheckInSummary[] {
  migrateLegacyPlan();
  const out: CheckInSummary[] = [];
  for (const sessionId of recordIds()) {
    const record = readRecord(sessionId);
    if (record) out.push({ sessionId, savedAt: record.savedAt });
  }
  return out;
}

/** One check-in by session id. */
export function loadCheckIn(sessionId: string): StoredCheckIn | null {
  return readRecord(sessionId);
}

/**
 * The most recent check-in we can trust — the app's current plan.
 *
 * Reads one file in the normal case rather than the whole history: this is the
 * launch path, and `OnboardingProvider` calls it synchronously before first paint.
 */
export function loadPlan(): StoredCheckIn | null {
  migrateLegacyPlan();
  for (const sessionId of recordIds()) {
    const record = readRecord(sessionId);
    if (record) return record;
  }
  return null;
}

/** Whether this device has a plan worth returning to. */
export function hasStoredPlan(): boolean {
  return loadPlan() !== null;
}

/** Remove one check-in and the photos it was based on. */
export function deleteCheckIn(sessionId: string): void {
  try {
    const file = recordFile(sessionId);
    if (file.exists) file.delete();
  } catch {
    // Fall through — the photos are the more sensitive half.
  }
  deleteSessionPhotos(sessionId);
}

/** The user's copy of "forget my routine" — every check-in, photos untouched. */
export function clearPlan(): void {
  try {
    const dir = checkInsDir();
    if (dir.exists) dir.delete();
    const legacy = new File(Paths.document, LEGACY_FILE);
    if (legacy.exists) legacy.delete();
  } catch {
    // Nothing to do — the next save recreates the directory.
  }
}
