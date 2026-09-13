import { QUALITY_CONFIG } from "@pore/shared/scan";

export interface StrictFrameReadinessState {
  frameIds: string[];
  firstTimestampMs: number | null;
  lastTimestampMs: number | null;
  ready: boolean;
}

export interface StrictFrameCandidate {
  frameId: string;
  /** Monotonic camera-host timestamp, converted to milliseconds. */
  timestampMs: number;
  /** Time the packet reached the React Native thread. */
  receivedAt: number;
  now: number;
  passed: boolean;
}

export const EMPTY_STRICT_FRAME_READINESS: StrictFrameReadinessState = {
  frameIds: [],
  firstTimestampMs: null,
  lastTimestampMs: null,
  ready: false,
};

export function resetStrictFrameReadiness(): StrictFrameReadinessState {
  return EMPTY_STRICT_FRAME_READINESS;
}

/**
 * Advance readiness from one evaluated camera packet. Repeated, stale,
 * non-monotonic, failing, or widely-spaced packets break the streak. The
 * current packet may start a new streak after a long gap, but can never reuse
 * any packet from the previous streak.
 */
export function advanceStrictFrameReadiness(
  state: StrictFrameReadinessState,
  candidate: StrictFrameCandidate,
): StrictFrameReadinessState {
  const { motion } = QUALITY_CONFIG;
  const validIdentity =
    candidate.frameId.length > 0 &&
    Number.isFinite(candidate.timestampMs) &&
    candidate.timestampMs > 0;
  const stale =
    !Number.isFinite(candidate.receivedAt) ||
    candidate.receivedAt > candidate.now ||
    candidate.now - candidate.receivedAt > motion.maxFrameGapMs;
  const repeated = state.frameIds.includes(candidate.frameId);
  const nonMonotonic =
    state.lastTimestampMs != null &&
    candidate.timestampMs <= state.lastTimestampMs;

  if (
    !validIdentity ||
    stale ||
    repeated ||
    nonMonotonic ||
    !candidate.passed
  ) {
    return resetStrictFrameReadiness();
  }

  const afterGap =
    state.lastTimestampMs != null &&
    candidate.timestampMs - state.lastTimestampMs > motion.maxFrameGapMs;
  const base = afterGap ? resetStrictFrameReadiness() : state;
  const firstTimestampMs = base.firstTimestampMs ?? candidate.timestampMs;
  const frameIds = [
    ...base.frameIds,
    candidate.frameId,
  ].slice(-motion.consecutivePassingFrames);
  const ready =
    frameIds.length >= motion.consecutivePassingFrames &&
    candidate.timestampMs - firstTimestampMs >= motion.minStableDurationMs;

  return {
    frameIds,
    firstTimestampMs,
    lastTimestampMs: candidate.timestampMs,
    ready,
  };
}

/** A missing packet for too long invalidates the shutter and countdown. */
export function expireStrictFrameReadiness(
  state: StrictFrameReadinessState,
  lastReceivedAt: number | null,
  now: number,
): StrictFrameReadinessState {
  if (
    lastReceivedAt == null ||
    lastReceivedAt > now ||
    now - lastReceivedAt > QUALITY_CONFIG.motion.maxFrameGapMs
  ) {
    return resetStrictFrameReadiness();
  }
  return state;
}
