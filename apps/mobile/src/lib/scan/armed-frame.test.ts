import { describe, expect, it } from "vitest";

import {
  ARMED_FRAME_MAX_AGE_MS,
  selectArmedFrame,
  type ReceivedNativeFrame,
} from "./armed-frame";
import type { NativeFramePacket } from "./native-frame-evidence";

function received(
  id: string,
  receivedAt: number,
  hash = "0123456789abcdef",
): ReceivedNativeFrame {
  const packet: NativeFramePacket = {
    frameId: id,
    timestamp: receivedAt / 1_000,
    width: 640,
    height: 480,
    faces: [],
    pixels: {
      meanLuma: 0.5,
      shadowClipping: 0,
      highlightClipping: 0,
      contrast: 0.2,
      sharpness: 0.1,
      gradientEnergy: 60,
      laplacianVariance: 90,
      lumaP10: 40,
      lumaP90: 200,
      lumaStdDev: 25,
      lightingUniformity: 1,
      cheekLumaDifference: 0,
      leftFaceLuma: 120,
      rightFaceLuma: 120,
      glareRatio: 0,
      backgroundLuma: 120,
      backlightDelta: 0,
      dynamicRange: 0.6,
      sampleCount: 100,
      perceptualHash: hash,
      nearlyUniform: false,
      occlusionRatio: 0,
    },
  };
  return { packet, receivedAt };
}

describe("selectArmedFrame", () => {
  it("prefers a fresh armed frame", () => {
    expect(
      selectArmedFrame(received("armed", 1_000, "aaaaaaaaaaaaaaaa"), 1_200)
        ?.packet.frameId,
    ).toBe("armed");
  });
  it("does not substitute a recent unarmed frame", () => {
    expect(selectArmedFrame(received("armed", 1), 1_100)).toBeNull();
  });
  it("returns null when the armed candidate is stale", () => {
    expect(selectArmedFrame(received("armed", 1), 2_000)).toBeNull();
  });
  it("accepts the freshness boundary", () => {
    expect(
      selectArmedFrame(
        received("armed", 1_000),
        1_000 + ARMED_FRAME_MAX_AGE_MS,
      ),
    ).not.toBeNull();
  });
});
