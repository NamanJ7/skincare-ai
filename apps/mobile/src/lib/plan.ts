/**
 * The generated plan, kept on this device so it survives closing the app.
 *
 * Same storage contract as `photos.ts`: the app's own document directory, plain
 * JSON carrying a `version`, and failures that are never fatal — a plan that
 * cannot be written is still shown for the rest of this session.
 *
 * The base64 photo bytes are deliberately NOT part of this file. They exist for
 * the duration of one /api/plan request and nothing else; only the JPEGs under
 * `skin-photos/` outlive it. Keep it that way — the privacy copy depends on it.
 *
 * The plan lives beside the photo directory rather than inside it, so deleting
 * photos and deleting the routine stay two separate choices for the user.
 */
import { File, Paths } from "expo-file-system";

import type { IntakeResponse } from "@pore/shared";
import type { PlanResult } from "./api";

const FILE_NAME = "plan.json";
const VERSION = 1;

/** What one saved plan looks like on disk. */
export interface StoredPlan {
  version: number;
  savedAt: string;
  /** The intake the plan was generated from, so a return visit isn't re-asked. */
  intake: IntakeResponse;
  plan: PlanResult;
}

function planFile(): File {
  return new File(Paths.document, FILE_NAME);
}

/** Persist the plan and the answers it came from. Overwrites any earlier plan. */
export function savePlan(intake: IntakeResponse, plan: PlanResult): void {
  try {
    const file = planFile();
    if (file.exists) file.delete();
    file.create();
    const stored: StoredPlan = {
      version: VERSION,
      savedAt: new Date().toISOString(),
      intake,
      plan,
    };
    file.write(JSON.stringify(stored));
  } catch {
    // Persistence is a convenience for the next launch, never a blocker now.
  }
}

/**
 * The saved plan, or null if there isn't one we can trust.
 *
 * Two reasons this is strict about shape. A file from an older schema read
 * half-way would put wrong findings in front of the user, which is the one
 * failure mode this app must not have. And this runs on the launch path, so a
 * malformed file that slipped through would crash the app on every start with
 * no way back out — "no saved plan" is always the safer answer.
 */
export function loadPlan(): StoredPlan | null {
  try {
    const file = planFile();
    if (!file.exists) return null;
    const parsed = JSON.parse(file.textSync()) as Partial<StoredPlan>;
    if (parsed.version !== VERSION) return null;
    if (!parsed.intake || !parsed.plan) return null;

    const { assessment, routine, adjustments } = parsed.plan;
    if (!assessment || !Array.isArray(assessment.findings)) return null;
    if (!Array.isArray(assessment.limitations) || !Array.isArray(assessment.photoQuality)) return null;
    if (!assessment.escalation) return null;
    if (!routine || !Array.isArray(routine.am) || !Array.isArray(routine.pm)) return null;
    if (!Array.isArray(adjustments)) return null;

    return parsed as StoredPlan;
  } catch {
    return null;
  }
}

/** Whether this device has a plan worth returning to. */
export function hasStoredPlan(): boolean {
  return loadPlan() !== null;
}

/** The user's copy of "forget my routine". */
export function clearPlan(): void {
  try {
    const file = planFile();
    if (file.exists) file.delete();
  } catch {
    // Nothing to do — the next save overwrites whatever is there.
  }
}
