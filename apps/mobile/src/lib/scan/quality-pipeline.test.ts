import { encode } from "jpeg-js";
import { describe, expect, it } from "vitest";

import {
  assessImageStats,
  computeImageStats,
  STEP_ORDER,
  type QualityVerdict,
} from "@pore/shared/scan";

import { base64ToBytes } from "./base64";
import { decode } from "jpeg-js";

/**
 * Exercises the post-capture pipeline exactly as quality-check.ts runs it —
 * base64 → bytes → jpeg-js decode → shared stats → verdict — with jpeg-js
 * standing in for the ImageManipulator downscale (Expo-native, untestable in
 * Node). Same 64px-wide frames the shared thresholds are calibrated for.
 */
function verdictFor(width: number, height: number, at: (x: number, y: number) => number): QualityVerdict {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const v = at(x, y);
      rgba[i] = v;
      rgba[i + 1] = v;
      rgba[i + 2] = v;
      rgba[i + 3] = 255;
    }
  }
  const jpeg = encode({ width, height, data: rgba }, 95);
  const base64 = Buffer.from(jpeg.data).toString("base64");

  const decoded = decode(base64ToBytes(base64), { useTArray: true, formatAsRGBA: true });
  const stats = computeImageStats({
    data: new Uint8ClampedArray(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength),
    width: decoded.width,
    height: decoded.height,
  });
  return assessImageStats(stats);
}

describe("post-capture quality pipeline", () => {
  it("passes a well-lit textured shot (capped at acceptable — framing unverified)", () => {
    const v = verdictFor(64, 85, (x, y) => ((x + y) % 2 === 0 ? 100 : 170));
    expect(v).toEqual({ level: "acceptable", code: "ok", readyForAutoCapture: false });
  });

  it("blocks a severely dark shot", () => {
    const v = verdictFor(64, 85, () => 10);
    expect(v.code).toBe("too_dark");
    expect(v.level).toBe("blocked");
  });

  it("blocks a blown-out shot", () => {
    const v = verdictFor(64, 85, () => 250);
    expect(v.code).toBe("too_bright");
    expect(v.level).toBe("blocked");
  });

  it("flags a featureless (blurry) shot", () => {
    const v = verdictFor(64, 85, () => 128);
    expect(v.code).toBe("blurry");
  });
});

describe("angle order contract", () => {
  it("shared step order matches the persisted photo naming in lib/photos.ts", () => {
    // SCAN_ANGLES in src/lib/photos.ts (untestable here — imports expo-file-system)
    // names shots by capture index; both must stay front → right cheek → left cheek.
    expect(STEP_ORDER).toEqual(["front", "right", "left"]);
  });
});
