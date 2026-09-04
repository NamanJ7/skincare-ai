/**
 * The on-device routine record.
 *
 * This is the only memory the product has. It holds what the user was told to
 * do, what they actually did, and how their skin felt — and it never leaves the
 * phone. The types live here rather than in the mobile app because the
 * hydration logic beside them is the one piece of this that genuinely needs
 * testing, and this is where the test harness already runs.
 */

import type { IntakeResponse } from "../types/intake";
import type { Assessment } from "../types/assessment";
import type { PlanResult } from "../types/plan";
import type { Routine } from "../types/routine";
import type { ProgressAdjustment } from "../progress/engine";
import type { SkinCheckIn } from "../schedule/engine";

/** One capture session's blind assessment, tagged with when it was taken. */
export interface StoredAssessment {
  sessionId: string;
  capturedAt: string;
  assessment: Assessment;
}

/**
 * The one reminder the product sends.
 *
 * Evening only, because the morning routine happens anyway — you are already at
 * the sink — and the evening one is the one that gets skipped. A second
 * notification would be for us, not for the user.
 */
export interface ReminderSetting {
  enabled: boolean;
  /** Local hour, 0-23. */
  hour: number;
  /** Local minute, 0-59. */
  minute: number;
}

export interface Journal {
  version: 1;
  /** Date the routine began — the origin the whole ramp is measured from. */
  startedOn: string;
  /** `"YYYY-MM-DD:PM"` → step orders the user has checked off. */
  completed: Record<string, number[]>;
  /** `"YYYY-MM-DD:PM"` for sessions completed end to end. Drives the streak. */
  finished: string[];
  checkIns: SkinCheckIn[];
  /**
   * The questionnaire answers the plan was generated from.
   *
   * Persisted because the safety engine re-runs against them on every render.
   * Without it a restart silently recomputes the routine from defaults —
   * including `pregnancyOrBreastfeeding: false`, which would quietly undo the
   * one guarantee the engine exists to make.
   */
  intake?: IntakeResponse;
  /**
   * The plan generated at signup: the assessment, the safety-clamped routine,
   * and the adjustments made to it.
   *
   * Its absence means "we have never successfully generated a plan", and the UI
   * must say exactly that rather than substituting a demo.
   */
  plan?: PlanResult;
  /**
   * The first assessment, kept forever — it is the zero the whole product
   * measures against. Nothing overwrites it but a full erase.
   */
  baseline?: StoredAssessment;
  /** The most recent re-assessment. Two points is the whole comparison. */
  latest?: StoredAssessment;
  /**
   * The routine as it stands after any progress adaptation. Absent until the
   * first re-assessment, at which point it takes over from `plan.routine`.
   */
  routine?: Routine;
  /**
   * What the progress engine changed at the last re-assessment, and why.
   *
   * Stored rather than recomputed on render: `adaptRoutine` is a proposal
   * against a routine, so running it again on its own output would step the
   * same active up a second time. It runs once, when a measurement lands.
   */
  lastAdaptation?: ProgressAdjustment[];
  /**
   * The evening reminder, if the user has been asked.
   *
   * Absent means "never asked" — which is different from "asked and declined"
   * (`enabled: false`), because only the first of those should ever produce a
   * prompt.
   */
  reminder?: ReminderSetting;
}
