import { describe, expect, it } from "vitest";

import { faceMetricsFromDetections } from "./face-adapter";
import { serializeFace } from "./native-frame-evidence";
import { normalizeNativeYaw } from "./native-pose";

const detection = {
  bounds: { x: 100, y: 100, width: 300, height: 400 },
  frameWidth: 600,
  frameHeight: 800,
  pitchAngle: 0,
  rollAngle: 0,
  landmarks: null,
};

describe("native yaw normalization", () => {
  it("uses the same yaw convention for live callbacks and strict packets", () => {
    const yawAngle = 38;
    const live = faceMetricsFromDetections(
      [{ bounds: detection.bounds, yawAngle, pitchAngle: 0 }],
      600,
      800,
    );
    const strict = serializeFace({ ...detection, yawAngle } as never);

    expect(live.yawDeg).toBe(normalizeNativeYaw(yawAngle));
    expect(strict?.yawDeg).toBe(live.yawDeg);
    expect(strict?.yawDeg).toBeGreaterThan(0);
  });

  it("inverts yaw for pixels mirrored relative to the camera output", () => {
    // Horizontal mirroring swaps which cheek is presented, so a detector
    // reading a mirrored buffer reports the opposite sign for the same pose.
    const yawAngle = 38;
    expect(normalizeNativeYaw(yawAngle, true)).toBe(-normalizeNativeYaw(yawAngle));
    expect(serializeFace({ ...detection, yawAngle } as never, true)?.yawDeg).toBe(
      -normalizeNativeYaw(yawAngle),
    );
  });

  it("agrees across a mirrored live buffer and an unmirrored still", () => {
    // The exact device shape that used to break: the analysis buffer arrives
    // mirrored while the saved photo is already in output presentation. With a
    // single global sign these landed in opposite pose bands, so live guidance
    // turned green on a cheek the final gate then rejected.
    const mirroredLiveYaw = -38; // detector's reading of the mirrored buffer
    const stillYaw = 38; // same pose, output presentation

    const live = serializeFace(
      { ...detection, yawAngle: mirroredLiveYaw } as never,
      true,
    );
    const still = serializeFace({ ...detection, yawAngle: stillYaw } as never, false);

    expect(live?.yawDeg).toBe(still?.yawDeg);
    expect(live?.yawDeg).toBeGreaterThan(0);
  });

  it("leaves pitch untouched by horizontal mirroring", () => {
    const upright = serializeFace({ ...detection, yawAngle: 0, pitchAngle: 7 } as never);
    const mirrored = serializeFace(
      { ...detection, yawAngle: 0, pitchAngle: 7 } as never,
      true,
    );
    expect(mirrored?.pitchDeg).toBe(upright?.pitchDeg);
  });
});
