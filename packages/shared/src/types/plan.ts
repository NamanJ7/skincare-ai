/**
 * The `/api/plan` response — the shape both clients agree on.
 *
 * Lives here rather than in either app because the mobile client now persists
 * it to disk (see `journal/`), so the stored shape and the wire shape are the
 * same contract and must never drift apart.
 */

import type { Assessment } from "./assessment";
import type { Routine } from "./routine";
import type { SafetyAdjustment } from "../safety/engine";

/**
 * Whether the assessment came from the vision model or the deterministic mock.
 *
 * Surfaced to the user rather than swallowed: a mock reading is a fabrication,
 * and this product's whole claim is that it does not fabricate readings.
 */
export type PlanMode = "ai" | "mock";

export interface PlanResult {
  assessment: Assessment;
  routine: Routine;
  adjustments: SafetyAdjustment[];
  mode: PlanMode;
}
