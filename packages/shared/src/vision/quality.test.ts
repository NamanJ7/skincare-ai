import { describe, it, expect } from "vitest";
import { scoreFrame, captureHint, classifyIlluminant, CAPTURE_TUNING } from "./quality";
import type { SkinTone } from "../types/intake";

const W = 64;
const H = 64;

/** Build an RGBA buffer from a per-pixel colour function. */
function frame(fn: (x: number, y: number) => [number, number, number], w = W, h = H): Uint8Array {
  const px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = fn(x, y);
      const i = (y * w + x) * 4;
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = 255;
    }
  }
  return px;
}

const flat = (r: number, g: number, b: number) => frame(() => [r, g, b]);

/**
 * A well-lit mid-tone face fills the crop with skin chroma and carries real
 * high-frequency detail. A uniform RGB offset leaves Cb/Cr untouched, so the
 * checkerboard adds sharpness without moving the frame out of the skin envelope.
 */
const SKIN: [number, number, number] = [200, 150, 130];
function sharpSkin(base: [number, number, number] = SKIN): Uint8Array {
  const d = 20;
  return frame((x, y) => {
    const s = (x + y) % 2 === 0 ? d : -d;
    return [base[0] + s, base[1] + s, base[2] + s];
  });
}

describe("scoreFrame", () => {
  it("passes a sharp, well-lit, well-framed mid-tone capture", () => {
    const r = scoreFrame(sharpSkin(), W, H, "medium");
    expect(r.flags).toEqual([]);
    expect(r.score).toBe(1);
    expect(r.metrics.skinCoverage).toBeCloseTo(1, 2);
  });

  it("flags a soft frame as blurry", () => {
    // Flat fill has no high-frequency energy at all.
    const r = scoreFrame(flat(...SKIN), W, H, "medium");
    expect(r.flags).toContain("blurry");
    expect(r.metrics.sharpness).toBeLessThan(CAPTURE_TUNING.minSharpness);
  });

  it("flags an underexposed frame as dark", () => {
    const r = scoreFrame(flat(0, 0, 0), W, H, "medium");
    expect(r.flags).toContain("dark");
  });

  it("flags a blown-out frame as bright, not dark", () => {
    const r = scoreFrame(flat(255, 255, 255), W, H, "medium");
    expect(r.flags).toContain("bright");
    expect(r.flags).not.toContain("dark");
    expect(r.metrics.clippedFraction).toBeCloseTo(1, 2);
  });

  it("flags a hard side shadow as uneven lighting", () => {
    const half = frame((x, y) => {
      if (x < W / 2) return [0, 0, 0];
      const s = (x + y) % 2 === 0 ? 20 : -20;
      return [SKIN[0] + s, SKIN[1] + s, SKIN[2] + s];
    });
    const r = scoreFrame(half, W, H, "medium");
    expect(r.flags).toContain("uneven_light");
    expect(r.metrics.lightingImbalance).toBeGreaterThan(CAPTURE_TUNING.maxLightingImbalance);
  });

  it("flags a face that does not fill the frame as too far", () => {
    // Skin only in the top ~30% of rows; the rest is neutral grey background.
    const sparse = frame((_x, y) => (y < H * 0.3 ? SKIN : [128, 128, 128]));
    const r = scoreFrame(sparse, W, H, "medium");
    expect(r.flags).toContain("too_far");
    expect(r.metrics.skinCoverage).toBeLessThan(CAPTURE_TUNING.minSkinCoverage);
  });

  it("flags tinted light as a colour cast", () => {
    // Same face, blue channel pushed by a cool LED. Still detected as skin,
    // but its chroma has drifted off the skin centre.
    const r = scoreFrame(sharpSkin([200, 150, 160]), W, H, "medium");
    expect(r.flags).toContain("color_cast");
    expect(r.metrics.skinCoverage).toBeCloseTo(1, 2);
  });

  /**
   * The regression test for the bias this design exists to avoid. The same
   * correctly-exposed deep-skin capture must not be rejected as "too dark"
   * just because a fixed exposure floor was calibrated on lighter skin.
   */
  it("does not call a correctly exposed deep-skin capture too dark", () => {
    const deepSkin = sharpSkin([110, 78, 66]);
    const asDeep = scoreFrame(deepSkin, W, H, "deep");
    const asVeryFair = scoreFrame(deepSkin, W, H, "very_fair");

    expect(asDeep.flags).not.toContain("dark");
    // A fair-calibrated floor would have rejected the identical frame.
    expect(asVeryFair.flags).toContain("dark");
    // Identical pixels, so the measurement itself must not have moved.
    expect(asDeep.metrics.meanLuma).toBeCloseTo(asVeryFair.metrics.meanLuma, 6);
  });

  it("detects deep-tone skin without a luma gate shrinking coverage", () => {
    const r = scoreFrame(sharpSkin([110, 78, 66]), W, H, "deep");
    expect(r.metrics.skinCoverage).toBeGreaterThan(CAPTURE_TUNING.minSkinCoverage);
    expect(r.flags).not.toContain("too_far");
  });

  it("reports a gray-world illuminant estimate", () => {
    const r = scoreFrame(flat(120, 100, 80), W, H, "medium");
    expect(r.illuminant.r).toBeCloseTo(120, 6);
    expect(r.illuminant.g).toBeCloseTo(100, 6);
    expect(r.illuminant.b).toBeCloseTo(80, 6);
  });

  it("rejects a buffer whose length does not match the dimensions", () => {
    expect(() => scoreFrame(new Uint8Array(0), W, H, "medium")).toThrow(/expected/);
    expect(() => scoreFrame(new Uint8Array(4), 1, 1, "medium")).toThrow(/too small/);
  });

  it("scores every tone band without throwing", () => {
    const tones: SkinTone[] = ["very_fair", "fair", "medium", "olive", "brown", "deep"];
    for (const tone of tones) {
      expect(() => scoreFrame(sharpSkin(), W, H, tone)).not.toThrow();
    }
  });
});

describe("captureHint", () => {
  it("returns nothing for a clean frame", () => {
    expect(captureHint([])).toBeNull();
  });

  it("gives one instruction, prioritising blur", () => {
    expect(captureHint(["dark", "blurry"])).toMatch(/Hold still/);
  });

  it("names the specific fixable problem", () => {
    expect(captureHint(["too_far"])).toMatch(/closer/);
    expect(captureHint(["dark"])).toMatch(/dark/i);
  });
});

/**
 * The illuminant label is the only gate `isMeasurable` in the progress engine
 * applies before subtracting two sessions, so a wrong `screen_flash` is how the
 * app would end up confabulating progress. These lock in that the bias runs the
 * other way.
 */
describe("classifyIlluminant", () => {
  const { minFlashLumaRatio, minReferenceLuma } = CAPTURE_TUNING;

  it("calls a real lift screen_flash", () => {
    // A dim room at 60, lit to 110 — the light clearly contributed.
    expect(classifyIlluminant(60, 110)).toBe("screen_flash");
  });

  it("refuses to call daylight a flash", () => {
    // Outdoors: the screen adds nothing measurable, so the two sessions are not
    // comparable however faithfully the flash fired.
    expect(classifyIlluminant(180, 185)).toBe("ambient");
  });

  it("still recognises a flash in a dark room, where the reference is near zero", () => {
    expect(classifyIlluminant(1, 120)).toBe("screen_flash");
    expect(classifyIlluminant(0, 120)).toBe("screen_flash");
  });

  it("does not let a near-zero reference manufacture a flash out of a dark frame", () => {
    // Clamping the denominator must not turn "we captured nothing" into a claim.
    expect(classifyIlluminant(0, minReferenceLuma * minFlashLumaRatio * 0.9)).toBe("ambient");
  });

  it("treats the threshold as a floor, not a midpoint", () => {
    const ref = 100;
    expect(classifyIlluminant(ref, ref * minFlashLumaRatio)).toBe("screen_flash");
    expect(classifyIlluminant(ref, ref * minFlashLumaRatio - 0.01)).toBe("ambient");
  });

  it("falls back to ambient when a measurement is missing or nonsense", () => {
    expect(classifyIlluminant(Number.NaN, 120)).toBe("ambient");
    expect(classifyIlluminant(60, Number.NaN)).toBe("ambient");
    expect(classifyIlluminant(60, 0)).toBe("ambient");
    expect(classifyIlluminant(Number.POSITIVE_INFINITY, 120)).toBe("ambient");
  });
});
