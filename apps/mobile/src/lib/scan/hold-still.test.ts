import { describe, expect, it } from "vitest";

import {
  HOLD_STILL_MAX_RATE,
  HOLD_STILL_WINDOW_MS,
  isDeviceSteady,
  pushMotionSample,
  type MotionSample,
} from "./hold-still";

/** Build a history from [at, magnitude] pairs through the real reducer. */
function history(pairs: [number, number][]): MotionSample[] {
  let h: MotionSample[] = [];
  for (const [at, magnitude] of pairs) h = pushMotionSample(h, { magnitude, at });
  return h;
}

const CALM = HOLD_STILL_MAX_RATE - 5;
const SHAKY = HOLD_STILL_MAX_RATE * 4;

describe("isDeviceSteady", () => {
  it("is unsteady with too few samples", () => {
    expect(isDeviceSteady(history([[0, CALM], [100, CALM]]))).toBe(false);
  });

  it("is unsteady until the samples span most of the window", () => {
    expect(isDeviceSteady(history([[0, CALM], [100, CALM], [200, CALM]]))).toBe(false);
  });

  it("is steady after a calm window", () => {
    const h = history([[0, CALM], [200, CALM], [400, CALM], [600, CALM]]);
    expect(isDeviceSteady(h)).toBe(true);
  });

  it("one shaky sample breaks steadiness", () => {
    const h = history([[0, CALM], [200, CALM], [400, SHAKY], [600, CALM]]);
    expect(isDeviceSteady(h)).toBe(false);
  });

  it("recovers once shaky samples age out of the window", () => {
    let h = history([[0, SHAKY], [200, CALM], [400, CALM], [600, CALM]]);
    expect(isDeviceSteady(h)).toBe(false);
    // Advance past the window so the shaky sample is dropped.
    h = pushMotionSample(h, { magnitude: CALM, at: HOLD_STILL_WINDOW_MS + 250 });
    expect(isDeviceSteady(h)).toBe(true);
  });
});
