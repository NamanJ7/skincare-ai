/**
 * Exposure + sharpness stats from a small downscaled frame sample.
 * Typed against a structural pixel source (not DOM ImageData) so it runs and
 * tests in Node. The caller samples the video onto a ~64px-wide canvas at
 * ~5fps; sharpness thresholds in quality.ts are calibrated to that size.
 */
import type { ImageStats } from "./types";

export interface PixelSource {
  /** RGBA bytes, 4 per pixel (ImageData.data is assignable). */
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Normalized region of interest, e.g. the detected face box. */
export interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Central 60% — used when no face box is known so a bright window at the
 * frame edge doesn't dominate the exposure reading. */
const DEFAULT_REGION: Region = { x: 0.2, y: 0.2, width: 0.6, height: 0.6 };

export function computeImageStats(src: PixelSource, region?: Region): ImageStats {
  const r = clampRegion(region ?? DEFAULT_REGION);
  const x0 = Math.floor(r.x * src.width);
  const y0 = Math.floor(r.y * src.height);
  const w = Math.max(2, Math.floor(r.width * src.width));
  const h = Math.max(2, Math.floor(r.height * src.height));

  // Luma plane for the crop.
  const luma = new Float32Array(w * h);
  let sum = 0;
  let clippedHi = 0;
  let clippedLo = 0;
  for (let y = 0; y < h; y++) {
    const row = (y0 + y) * src.width;
    for (let x = 0; x < w; x++) {
      const i = (row + x0 + x) * 4;
      // In-bounds: the region is clamped to the source dimensions.
      const l = 0.299 * src.data[i]! + 0.587 * src.data[i + 1]! + 0.114 * src.data[i + 2]!;
      luma[y * w + x] = l;
      sum += l;
      if (l >= 250) clippedHi++;
      else if (l <= 8) clippedLo++;
    }
  }
  const count = w * h;

  // Mean squared gradient (horizontal + vertical) as a cheap sharpness proxy.
  let energy = 0;
  let edges = 0;
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = y * w + x;
      // In-bounds by loop construction (x < w-1, y < h-1).
      const c = luma[i]!;
      const gx = luma[i + 1]! - c;
      const gy = luma[i + w]! - c;
      energy += gx * gx + gy * gy;
      edges++;
    }
  }

  return {
    lumaMean: sum / count,
    clippedHighlights: clippedHi / count,
    clippedShadows: clippedLo / count,
    sharpness: edges > 0 ? energy / edges : 0,
  };
}

function clampRegion(r: Region): Region {
  const x = Math.min(Math.max(r.x, 0), 0.9);
  const y = Math.min(Math.max(r.y, 0), 0.9);
  return {
    x,
    y,
    width: Math.min(Math.max(r.width, 0.05), 1 - x),
    height: Math.min(Math.max(r.height, 0.05), 1 - y),
  };
}
