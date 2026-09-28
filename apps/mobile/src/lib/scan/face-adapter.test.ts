import { describe, expect, it } from "vitest";

import { faceMetricsFromDetections, YAW_SIGN, type DetectedFaceLike } from "./face-adapter";

function face(patch: Partial<DetectedFaceLike> = {}): DetectedFaceLike {
  return {
    bounds: { x: 100, y: 100, width: 200, height: 260 },
    yawAngle: 0,
    pitchAngle: 0,
    ...patch,
  };
}

describe("faceMetricsFromDetections", () => {
  it("reports an empty face when nothing is detected", () => {
    const m = faceMetricsFromDetections([], 400, 800);
    expect(m.faceCount).toBe(0);
    expect(m.widthRatio).toBe(0);
  });

  it("guards against a zero-sized view", () => {
    expect(faceMetricsFromDetections([face()], 0, 0).faceCount).toBe(0);
  });

  it("normalizes center + width against the view", () => {
    const m = faceMetricsFromDetections([face()], 400, 800);
    // center of a 200-wide box at x=100 → 200/400 = 0.5
    expect(m.center.x).toBeCloseTo(0.5);
    // center y: (100 + 130) / 800
    expect(m.center.y).toBeCloseTo(230 / 800);
    expect(m.widthRatio).toBeCloseTo(0.5);
  });

  it("keeps normalized values within [0,1]", () => {
    const m = faceMetricsFromDetections(
      [face({ bounds: { x: 380, y: 780, width: 200, height: 200 } })],
      400,
      800,
    );
    expect(m.center.x).toBeLessThanOrEqual(1);
    expect(m.widthRatio).toBeLessThanOrEqual(1);
  });

  it("treats the largest box as the subject but still counts faces", () => {
    const m = faceMetricsFromDetections(
      [
        face({ bounds: { x: 0, y: 0, width: 80, height: 100 }, yawAngle: 40 }),
        face({ bounds: { x: 100, y: 100, width: 200, height: 260 }, yawAngle: 5 }),
      ],
      400,
      800,
    );
    expect(m.faceCount).toBe(2);
    expect(m.yawDeg).toBe(YAW_SIGN * 5); // from the larger box
  });

  it("applies the yaw sign convention", () => {
    const m = faceMetricsFromDetections([face({ yawAngle: 45 })], 400, 800);
    expect(m.yawDeg).toBe(YAW_SIGN * 45);
  });
});
