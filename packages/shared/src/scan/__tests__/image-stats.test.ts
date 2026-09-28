import { describe, expect, it } from "vitest";

import { computeImageStats, type PixelSource } from "../image-stats";

/** Build an RGBA source from a per-pixel gray-level function. */
function graySource(width: number, height: number, at: (x: number, y: number) => number): PixelSource {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const v = at(x, y);
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

describe("computeImageStats", () => {
  it("measures mean luma of a flat gray frame", () => {
    const stats = computeImageStats(graySource(64, 48, () => 128));
    expect(stats.lumaMean).toBeCloseTo(128, 0);
    expect(stats.clippedHighlights).toBe(0);
    expect(stats.clippedShadows).toBe(0);
    expect(stats.sharpness).toBe(0); // no edges in a flat frame
  });

  it("flags crushed shadows and blown highlights", () => {
    const dark = computeImageStats(graySource(64, 48, () => 2));
    expect(dark.clippedShadows).toBe(1);
    const bright = computeImageStats(graySource(64, 48, () => 255));
    expect(bright.clippedHighlights).toBe(1);
  });

  it("scores a checkerboard much sharper than a gradient", () => {
    const checker = computeImageStats(graySource(64, 48, (x, y) => ((x + y) % 2 ? 200 : 60)));
    const gradient = computeImageStats(graySource(64, 48, (x) => Math.round((x / 64) * 255)));
    expect(checker.sharpness).toBeGreaterThan(gradient.sharpness * 10);
  });

  it("restricts sampling to the given region", () => {
    // Bright center, black border — face-box sampling should ignore the border.
    const src = graySource(64, 48, (x, y) =>
      x >= 16 && x < 48 && y >= 12 && y < 36 ? 200 : 0,
    );
    const center = computeImageStats(src, { x: 0.3, y: 0.3, width: 0.4, height: 0.4 });
    expect(center.lumaMean).toBeGreaterThan(190);
    const whole = computeImageStats(src, { x: 0, y: 0, width: 1, height: 1 });
    expect(whole.lumaMean).toBeLessThan(120);
  });

  it("clamps out-of-bounds regions instead of crashing", () => {
    const src = graySource(16, 16, () => 100);
    const stats = computeImageStats(src, { x: 0.8, y: 0.8, width: 0.6, height: 0.6 });
    expect(stats.lumaMean).toBeCloseTo(100, 0);
  });
});
