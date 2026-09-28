import { describe, expect, it } from "vitest";

import { QUALITY_CONFIG } from "@pore/shared/scan";

import {
  EMPTY_STRICT_FRAME_READINESS,
  advanceStrictFrameReadiness,
  expireStrictFrameReadiness,
} from "./strict-frame-readiness";

function push(
  state = EMPTY_STRICT_FRAME_READINESS,
  index = 0,
  overrides: Partial<Parameters<typeof advanceStrictFrameReadiness>[1]> = {},
) {
  const timestampMs = 1_000 + index * 180;
  return advanceStrictFrameReadiness(state, {
    frameId: `frame-${index}`,
    timestampMs,
    receivedAt: 10_000 + index * 180,
    now: 10_000 + index * 180,
    passed: true,
    ...overrides,
  });
}

describe("strict native frame readiness", () => {
  it("requires five unique passing packets spanning at least 700 ms", () => {
    let state = EMPTY_STRICT_FRAME_READINESS;
    for (let index = 0; index < 4; index++) state = push(state, index);
    expect(state.ready).toBe(false);
    state = push(state, 4);
    expect(state.frameIds).toHaveLength(
      QUALITY_CONFIG.motion.consecutivePassingFrames,
    );
    expect(state.ready).toBe(true);
  });

  it("does not arm five fast packets that do not span the minimum duration", () => {
    let state = EMPTY_STRICT_FRAME_READINESS;
    for (let index = 0; index < 5; index++) {
      state = push(state, index, { timestampMs: 1_000 + index * 100 });
    }
    expect(state.ready).toBe(false);
  });

  it("resets on a repeat, failure, or non-monotonic packet", () => {
    let state = push(push(EMPTY_STRICT_FRAME_READINESS, 0), 1);
    expect(
      push(state, 2, { frameId: "frame-1" }).frameIds,
    ).toHaveLength(0);
    expect(push(state, 2, { passed: false }).frameIds).toHaveLength(0);
    expect(push(state, 2, { timestampMs: 900 }).frameIds).toHaveLength(0);
  });

  it("starts a new streak after a long camera-frame gap", () => {
    const state = push(push(EMPTY_STRICT_FRAME_READINESS, 0), 1);
    const next = push(state, 4, { timestampMs: 2_000 });
    expect(next.frameIds).toEqual(["frame-4"]);
    expect(next.ready).toBe(false);
  });

  it("resets a streak when its latest packet becomes stale", () => {
    const state = push(EMPTY_STRICT_FRAME_READINESS, 0);
    expect(
      expireStrictFrameReadiness(
        state,
        10_000,
        10_000 + QUALITY_CONFIG.motion.maxFrameGapMs + 1,
      ).frameIds,
    ).toHaveLength(0);
  });
});
