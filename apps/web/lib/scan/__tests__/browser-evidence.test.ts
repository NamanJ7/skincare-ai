import { describe, expect, it } from "vitest";

import {
  hashDistance,
  measurePixelData,
  type BrowserFaceEvidence,
} from "../browser-evidence";

const FACE: BrowserFaceEvidence = {
  faceCount: 1,
  box: { x: 0.2, y: 0.12, width: 0.6, height: 0.75 },
  center: { x: 0.5, y: 0.495 },
  widthRatio: 0.6,
  heightRatio: 0.75,
  yawDeg: 0,
  pitchDeg: 0,
  rollDeg: 0,
  completeness: 1,
};

describe("facial-region browser evidence", () => {
  it("rejects the sharp-background illusion by measuring skin ROIs", () => {
    const blurryFace = frame((x, y) => {
      const inFace = x >= 13 && x < 51 && y >= 8 && y < 56;
      return inFace ? 128 : (x + y) % 2 ? 0 : 255;
    });
    const texturedFace = frame((x, y) => {
      const inFace = x >= 13 && x < 51 && y >= 8 && y < 56;
      return inFace ? ((x % 4 < 2) === (y % 4 < 2) ? 92 : 164) : 128;
    });

    const blurry = measurePixelData(blurryFace, 1280, 960, FACE);
    const sharp = measurePixelData(texturedFace, 1280, 960, FACE);

    expect(blurry.skinSharpness).toBeLessThan(1);
    expect(blurry.skinLaplacianVariance).toBeLessThan(1);
    expect(sharp.skinSharpness).toBeGreaterThan(blurry.skinSharpness + 100);
    expect(sharp.skinLaplacianVariance).toBeGreaterThan(blurry.skinLaplacianVariance + 100);
  });

  it("derives clipping and lighting asymmetry from the face, not background", () => {
    const pixels = frame((x) => (x < 32 ? 4 : 251));
    const evidence = measurePixelData(pixels, 640, 480, FACE);

    expect(evidence.shadowClipping).toBeGreaterThan(0.4);
    expect(evidence.highlightClipping).toBeGreaterThan(0.4);
    expect(evidence.lightingAsymmetry).toBeGreaterThan(0.9);
  });

  it("calls a flatly-lit face low-texture, not a covered lens", () => {
    // Skin at a plausible brightness with very little modelling. The user can
    // act on "use softer light"; they cannot act on "uncover your lens", and
    // blank_or_covered outranks low_texture in guidance, so conflating the two
    // guaranteed the wrong message won.
    // Mostly even mid-tone skin, with the occasional pore or nostril shadow:
    // real luma deviation, but a narrow p10-p90 band.
    const flatlyLit = measurePixelData(
      frame((x, y) => {
        const speck = (x * 7 + y * 13) % 17;
        if (speck === 0) return (x + y) % 2 ? 97 : 167;
        return 130 + (speck % 5);
      }),
      1280,
      960,
      FACE,
    );

    expect(flatlyLit.blankOrUniform).toBe(false);
    // Still correctly reported as short on texture, via the honest signal.
    expect(flatlyLit.faceContrast).toBeLessThan(18);

    const coveredLens = measurePixelData(frame(() => 8), 1280, 960, FACE);
    expect(coveredLens.blankOrUniform).toBe(true);
  });

  it("produces comparable perceptual hashes for duplicate checks", () => {
    const first = measurePixelData(frame((x, y) => x * 3 + y), 640, 480, FACE);
    const same = measurePixelData(frame((x, y) => x * 3 + y), 640, 480, FACE);
    const different = measurePixelData(frame((x, y) => 255 - x * 3 - y), 640, 480, FACE);

    expect(hashDistance(first.perceptualHash, same.perceptualHash)).toBe(0);
    expect(hashDistance(first.perceptualHash, different.perceptualHash)).toBeGreaterThan(0);
  });
});

function frame(luma: (x: number, y: number) => number): ImageData {
  const width = 64;
  const height = 64;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = Math.max(0, Math.min(255, luma(x, y)));
      const offset = (y * width + x) * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }
  return { width, height, data, colorSpace: "srgb" } as ImageData;
}
