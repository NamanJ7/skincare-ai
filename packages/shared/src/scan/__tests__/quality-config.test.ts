/**
 * Cross-threshold consistency for QUALITY_CONFIG.
 *
 * Each gate was individually sane, but nothing checked them *against each
 * other* — and two pairs disagreed, producing an unwinnable retake loop with
 * guidance the user could not act on. These are pure arithmetic invariants:
 * they cost nothing to run and they fail loudly the moment a threshold drifts.
 */
import { describe, expect, it } from "vitest";

import { QUALITY_CONFIG } from "../quality-config";

const { resolution, face, sampling } = QUALITY_CONFIG;

describe("both browser gates measure sharpness at the same scale", () => {
  // Gradient and Laplacian energy are scale-dependent, and one shared pair of
  // sharpness thresholds is applied to whatever canvas each gate sampled. When
  // live sampled 192 and final sampled 384, the live gate was the more
  // permissive of the two: the shutter could arm and the final gate could then
  // reject the identical pixels, with no guidance explaining the difference.
  it("samples live and final evidence at one width", () => {
    expect(sampling.liveWidth).toBe(sampling.finalWidth);
  });
});

describe("the analysis encode ceiling is separate from the framing reference", () => {
  // `analysisTargetWidth` is the conservative width the face-ratio floors are
  // pinned against. It is not a resize target, and using it as one silently
  // capped browser analysis images at 1024px.
  it("never encodes below the width the framing floors assume", () => {
    expect(resolution.analysisMaxWidth).toBeGreaterThanOrEqual(
      resolution.analysisTargetWidth,
    );
  });

  it("keeps the encode ceiling within the model's resolvable range", () => {
    // Above this the extra pixels cost tokens without adding detail the model
    // can use.
    expect(resolution.analysisMaxWidth).toBeLessThanOrEqual(2576);
  });
});

describe("the live gate is reachable on the smallest supported guidance frame", () => {
  // The live gate judges a guidance stream, which on native is VGA and is NOT
  // the image the shutter produces. Every live threshold must therefore be
  // satisfiable at `minLiveFrameShortEdge` and at the *minimum accepted*
  // framing ratio. A 720px live frame-size floor applied to a 480px-short-edge
  // VGA frame made `result.passed` permanently false, so the shutter never
  // unlocked and auto-capture never fired — on every device, silently.
  it("accepts the minimum accepted framing on a minimum-size frame", () => {
    const narrowestFaceWidthPx =
      face.sideWidthRatio.min * resolution.minLiveFrameShortEdge;
    expect(resolution.minLiveFaceWidthPx).toBeLessThanOrEqual(
      narrowestFaceWidthPx,
    );
  });

  it("keeps the live face-pixel floor no stricter than the final one", () => {
    expect(resolution.minLiveFaceWidthPx).toBeLessThanOrEqual(
      resolution.minFaceWidthPx,
    );
  });

  it("never judges the guidance frame against analysis-image floors", () => {
    // Regression guard: reintroducing a live frame-size floor at or above the
    // analysis floors would recreate the unreachable-shutter bug.
    expect(resolution.minLiveFrameShortEdge).toBeLessThan(resolution.minWidth);
    expect(resolution.minLiveFrameShortEdge).toBeLessThan(resolution.minHeight);
  });
});

describe("framing ratios can satisfy the face-pixel floor", () => {
  // The final gate is re-run against the downscaled analysis derivative, so the
  // *minimum accepted framing* must still yield enough face pixels there.
  // 0.24 x 1024 = 245.8px was below the 260px floor: a side capture could pass
  // framing, pass on its original pixels, then fail the derivative re-check.
  const minRatioForAnalysis =
    resolution.minFaceWidthPx / resolution.analysisTargetWidth;

  it("front framing floor yields enough face pixels on the derivative", () => {
    expect(face.frontWidthRatio.min).toBeGreaterThanOrEqual(minRatioForAnalysis);
  });

  it("side framing floor yields enough face pixels on the derivative", () => {
    expect(face.sideWidthRatio.min).toBeGreaterThanOrEqual(minRatioForAnalysis);
  });

  it("leaves a usable band between the framing floor and ceiling", () => {
    expect(face.frontWidthRatio.max).toBeGreaterThan(face.frontWidthRatio.min);
    expect(face.sideWidthRatio.max).toBeGreaterThan(face.sideWidthRatio.min);
  });
});

describe("a real 3:4 crop of a common webcam mode is judged consistently", () => {
  // The browser encodes the same crop it previews, so it declares no separate
  // still size and both gates read the identical dimensions. Whatever the
  // verdict, it must be reached live rather than after a capture.
  // coverCrop(w, h, 3/4) on a landscape stream keeps the full height and
  // narrows the width to height * 0.75.
  const cropWidth = (w: number, h: number) =>
    w / h > 3 / 4 ? Math.round(h * 0.75) : w;

  it("720p is rejected before a capture is taken", () => {
    expect(cropWidth(1280, 720)).toBe(540);
    expect(cropWidth(1280, 720) >= resolution.minWidth).toBe(false);
  });

  it("1080p clears the analysis floor", () => {
    expect(cropWidth(1920, 1080)).toBe(810);
    expect(cropWidth(1920, 1080) >= resolution.minWidth).toBe(true);
  });
});
