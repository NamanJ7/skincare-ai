/**
 * Device-steadiness detector — the honest native stand-in for face stability
 * when no detector runs. Pure reducer over rotation-rate samples so it
 * unit-tests in Node; the DeviceMotion subscription lives in use-hold-still.
 * A steady phone at arm's length reads well under the threshold; walking or
 * repositioning spikes far above it.
 */

export interface MotionSample {
  /** Combined rotation-rate magnitude, deg/s. */
  magnitude: number;
  at: number;
}

export const HOLD_STILL_WINDOW_MS = 700;
/** Max rotation-rate magnitude (deg/s) counted as "holding still". */
export const HOLD_STILL_MAX_RATE = 15;

/** Keep only samples inside the window, newest last. */
export function pushMotionSample(history: MotionSample[], sample: MotionSample): MotionSample[] {
  const cutoff = sample.at - HOLD_STILL_WINDOW_MS;
  return [...history.filter((s) => s.at >= cutoff), sample];
}

/** Steady = enough coverage of the window and every sample under the cap. */
export function isDeviceSteady(history: MotionSample[]): boolean {
  if (history.length < 3) return false;
  const first = history[0];
  const last = history[history.length - 1];
  if (!first || !last) return false;
  if (last.at - first.at < HOLD_STILL_WINDOW_MS * 0.6) return false;
  return history.every((s) => s.magnitude <= HOLD_STILL_MAX_RATE);
}
