/**
 * Auto-capture state machine + feedback damper. Pure reducers driven by
 * frame timestamps — no timers, no DOM — so both are trivially testable.
 *
 * searching → aligning → stabilizing (good + stable ≥1s) → countdown (3‑2‑1)
 * → capturing. Any degraded or unstable frame during stabilizing/countdown
 * collapses back to aligning. A shutter event is ignored unless its caller
 * supplies a current strict-ready attestation.
 */
import type { QualityCode, QualityVerdict } from "./types";

export const STABLE_MS = 1000;
export const COUNTDOWN_MS = 3000;

export type CapturePhase =
  | "searching"
  | "aligning"
  | "stabilizing"
  | "countdown"
  | "capturing";

export interface CaptureMachineState {
  phase: CapturePhase;
  /** Timestamp when the current good+stable streak began. */
  goodSince: number | null;
  /** Timestamp when the countdown completes and capture fires. */
  countdownEndsAt: number | null;
}

export type CaptureEvent =
  | { type: "FRAME"; now: number; verdict: QualityVerdict; stable: boolean }
  | { type: "SHUTTER_PRESSED"; ready?: boolean }
  | { type: "RESET" };

export const initialCaptureState: CaptureMachineState = {
  phase: "searching",
  goodSince: null,
  countdownEndsAt: null,
};

export function captureMachineReducer(
  state: CaptureMachineState,
  event: CaptureEvent,
): CaptureMachineState {
  switch (event.type) {
    case "RESET":
      return initialCaptureState;

    case "SHUTTER_PRESSED":
      if (state.phase === "capturing") return state;
      if (event.ready !== true) return state;
      return { phase: "capturing", goodSince: null, countdownEndsAt: null };

    case "FRAME": {
      const { now, verdict, stable } = event;
      const ready = verdict.readyForAutoCapture;

      switch (state.phase) {
        case "searching":
          if (verdict.code !== "no_face") {
            return { ...initialCaptureState, phase: "aligning" };
          }
          return state;

        case "aligning":
          if (verdict.code === "no_face") return initialCaptureState;
          if (ready && stable) {
            return { phase: "stabilizing", goodSince: now, countdownEndsAt: null };
          }
          return state;

        case "stabilizing":
          if (!ready || !stable) {
            return { ...initialCaptureState, phase: "aligning" };
          }
          if (now - (state.goodSince ?? now) >= STABLE_MS) {
            return { phase: "countdown", goodSince: state.goodSince, countdownEndsAt: now + COUNTDOWN_MS };
          }
          return state;

        case "countdown":
          if (!ready || !stable) {
            // Alignment broke mid-countdown — collapse the ring, start over.
            return { ...initialCaptureState, phase: "aligning" };
          }
          if (now >= (state.countdownEndsAt ?? Infinity)) {
            return { phase: "capturing", goodSince: null, countdownEndsAt: null };
          }
          return state;

        case "capturing":
          return state;
      }
    }
  }
}

/** Seconds left to display (3, 2, 1) or null outside countdown. */
export function countdownRemaining(state: CaptureMachineState, now: number): number | null {
  if (state.phase !== "countdown" || state.countdownEndsAt == null) return null;
  return Math.max(1, Math.ceil((state.countdownEndsAt - now) / 1000));
}

// ---------------------------------------------------------------------------
// Feedback damper: a candidate instruction must persist `holdMs` before it
// replaces the displayed one, so the guidance line never flickers.
// ---------------------------------------------------------------------------

export interface DamperState {
  displayed: QualityCode;
  candidate: QualityCode | null;
  candidateSince: number;
}

export function createDamper(initial: QualityCode = "no_face"): DamperState {
  return { displayed: initial, candidate: null, candidateSince: 0 };
}

export const FEEDBACK_HOLD_MS = 500;

export function dampFeedback(
  state: DamperState,
  incoming: QualityCode,
  now: number,
  holdMs: number = FEEDBACK_HOLD_MS,
): DamperState {
  if (incoming === state.displayed) {
    return state.candidate === null ? state : { ...state, candidate: null };
  }
  if (incoming !== state.candidate) {
    return { ...state, candidate: incoming, candidateSince: now };
  }
  if (now - state.candidateSince >= holdMs) {
    return { displayed: incoming, candidate: null, candidateSince: 0 };
  }
  return state;
}

// ---------------------------------------------------------------------------
// Stability tracker: face centroid must stay within a small radius for the
// machine's `stable` input. Pure — caller feeds normalized centers.
// ---------------------------------------------------------------------------

export interface StabilitySample {
  x: number;
  y: number;
  widthRatio: number;
  at: number;
}

export const STABILITY_WINDOW_MS = 700;
/** Max normalized drift of the face center within the window. */
export const STABILITY_MAX_DRIFT = 0.015;

export function pushStabilitySample(
  history: StabilitySample[],
  sample: StabilitySample,
): StabilitySample[] {
  const cutoff = sample.at - STABILITY_WINDOW_MS;
  return [...history.filter((s) => s.at >= cutoff), sample];
}

export function isStable(history: StabilitySample[]): boolean {
  if (history.length < 3) return false;
  const first = history[0];
  const last = history[history.length - 1];
  if (!first || !last) return false;
  if (last.at - first.at < STABILITY_WINDOW_MS * 0.6) return false;
  let maxDrift = 0;
  for (const s of history) {
    const dx = s.x - first.x;
    const dy = s.y - first.y;
    const dw = (s.widthRatio - first.widthRatio) * 0.5;
    maxDrift = Math.max(maxDrift, Math.hypot(dx, dy) + Math.abs(dw));
  }
  return maxDrift <= STABILITY_MAX_DRIFT;
}
