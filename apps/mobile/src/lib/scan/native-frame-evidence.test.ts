import { describe, expect, it } from "vitest";

import {
  deriveMotionObservation,
  isGenuinelyNewFrame,
  type NativeFaceObservation,
  type NativeFramePacket,
} from "./native-frame-evidence";

function face(overrides: Partial<NativeFaceObservation> = {}): NativeFaceObservation {
  return {
    bounds: { x: 100, y: 100, width: 200, height: 250 },
    frameWidth: 480,
    frameHeight: 640,
    centerX: 0.5,
    centerY: 0.5,
    widthRatio: 0.42,
    heightRatio: 0.39,
    yawDeg: 0,
    pitchDeg: 0,
    rollDeg: 0,
    landmarkCoverage: 1,
    ...overrides,
  };
}

function packet(timestamp: number, id = String(timestamp), f = face()): NativeFramePacket {
  return { frameId: id, timestamp, width: 480, height: 640, faces: [f], pixels: null };
}

describe("native frame identity", () => {
  it("only accepts a strictly newer frame and frame ID", () => {
    const first = packet(10, "a");
    expect(isGenuinelyNewFrame(null, first)).toBe(true);
    expect(isGenuinelyNewFrame(first, packet(10, "b"))).toBe(false);
    expect(isGenuinelyNewFrame(first, packet(11, "a"))).toBe(false);
    expect(isGenuinelyNewFrame(first, packet(11, "b"))).toBe(true);
  });
});

describe("native motion observation", () => {
  it("measures normalized face drift and pose deltas", () => {
    const motion = deriveMotionObservation(
      packet(1),
      packet(1.2, "new", face({ centerX: 0.53, centerY: 0.54, yawDeg: 8, rollDeg: 3 })),
      0.82,
    );
    expect(motion?.sampleIntervalMs).toBeCloseTo(200);
    expect(motion?.centerDelta).toBeCloseTo(0.05);
    expect(motion?.yawDeltaDeg).toBe(8);
    expect(motion?.rollDeltaDeg).toBe(3);
    expect(motion?.perceptualSimilarity).toBe(0.82);
  });

  it("does not fabricate stability without exactly one face in both frames", () => {
    const noFace = { ...packet(2), faces: [] };
    expect(deriveMotionObservation(noFace, packet(3), 1)).toBeNull();
  });
});
