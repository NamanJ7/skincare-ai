/**
 * Pixel measurements used by the native live and final quality gates.
 *
 * The important constraint here is that sharpness/exposure are sampled from
 * likely skin regions inside the detected face. A sharp background must never
 * compensate for a soft face. The live path feeds this helper the Y plane from
 * a VisionCamera frame; the static path feeds decoded RGBA pixels.
 */

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PixelPoint {
  x: number;
  y: number;
}

/**
 * `left`/`right` are the cheeks and keep their original meaning exactly — the
 * bilateral luma comparison behind `lightingAsymmetry` reads only those two.
 * `forehead`/`chin` used to share the generic `center` role; they are named now
 * so occlusion can be judged per region. `center` remains for any skin sample
 * that belongs to no named region.
 */
export type SkinRole = "forehead" | "left" | "right" | "chin" | "center";

export interface PixelEllipse {
  center: PixelPoint;
  radiusX: number;
  radiusY: number;
  role: SkinRole | "exclude";
}

/**
 * Detector-derived sampling geometry. Skin measurements are limited to the
 * forehead, cheeks, and chin ellipses, then feature contours/landmarks are
 * subtracted. This is a limited coverage signal, not a claim that every
 * possible mask, glasses frame, hand, or strand of hair was detected.
 */
export interface FacialSamplingGeometry {
  skinRegions: PixelEllipse[];
  excludedRegions: PixelEllipse[];
  faceContour?: PixelPoint[];
}

export interface FacialPixelEvidence {
  /** Mean facial-skin luma, normalized to 0..1. */
  meanLuma: number;
  /** Fraction of facial-skin samples with crushed shadow detail. */
  shadowClipping: number;
  /** Fraction of facial-skin samples with blown highlight detail. */
  highlightClipping: number;
  /** Facial-skin luma standard deviation, normalized to 0..1. */
  contrast: number;
  /** Mean squared local gradient in facial-skin regions, normalized to 0..1. */
  sharpness: number;
  /** Mean squared local gradient on the shared contract's 0..65025 scale. */
  gradientEnergy: number;
  /** Four-neighbour facial-skin Laplacian variance. */
  laplacianVariance: number;
  /** Facial luma percentiles on the native 0..255 scale. */
  lumaP10: number;
  lumaP90: number;
  /** Facial luma standard deviation on the native 0..255 scale. */
  lumaStdDev: number;
  /** 1 is evenly lit; 0 means the cheek samples are maximally different. */
  lightingUniformity: number;
  /** Absolute normalized difference between the two cheek means. */
  cheekLumaDifference: number;
  leftFaceLuma: number;
  rightFaceLuma: number;
  /** Small facial highlight clusters that can represent glasses/skin glare. */
  glareRatio: number;
  /** Mean non-face frame luma and its difference from the face. */
  backgroundLuma: number;
  backlightDelta: number;
  /** Dynamic range of the sampled facial-skin pixels, normalized to 0..1. */
  dynamicRange: number;
  /** Number of facial-skin pixels that contributed to the result. */
  sampleCount: number;
  /**
   * Share of named skin regions that look covered rather than lit.
   *
   * 0 also means "not enough regions to judge" — the geometry gates already
   * reject a face that is partly out of frame, so an unknown here must not
   * block on its own. See `regionalOcclusion` for what this can and cannot see.
   */
  occlusionRatio: number;
  /** Small luminance signature used only for duplicate/preview binding checks. */
  perceptualHash: string;
  /** True when a lens-cover/blank-frame pattern is present in the face crop. */
  nearlyUniform: boolean;
}

interface LumaSource {
  width: number;
  height: number;
  at: (x: number, y: number) => number;
}

interface Accumulator {
  count: number;
  sum: number;
  sumSquares: number;
  shadows: number;
  highlights: number;
  min: number;
  max: number;
  gradientSum: number;
  gradientCount: number;
  laplacianSum: number;
  laplacianSquares: number;
  laplacianCount: number;
  glare: number;
  leftSum: number;
  leftCount: number;
  rightSum: number;
  rightCount: number;
  /** Per-region luma and texture, indexed by REGION_ROLES. */
  regionSum: number[];
  regionCount: number[];
  regionGradientSum: number[];
  regionGradientCount: number[];
}

const SHADOW_LUMA = 10;
const HIGHLIGHT_LUMA = 245;
const HASH_SIZE = 8;

/** Named skin regions judged independently for occlusion. */
const REGION_ROLES: SkinRole[] = ["forehead", "left", "right", "chin"];

/**
 * Occlusion detection thresholds.
 *
 * WHAT THIS MEASURES. A hand, mask, or curtain of hair changes both the
 * brightness AND the texture of the skin underneath it. Directional lighting
 * changes brightness alone: it can legitimately drive one cheek up to
 * `maxLightingAsymmetry` (0.24, about 61 luma) away from the other and still be
 * an acceptable capture. So brightness by itself cannot separate the two, and
 * requiring BOTH a large luma departure and a texture departure is what stops
 * hard side light from reading as a covered cheek.
 *
 * WHAT IT CANNOT SEE. This is luma-only — the Y plane is all the frame
 * processor gets, so unlike the browser's luma+chroma test it will miss a
 * covering whose brightness and texture both resemble skin. It is a real
 * measurement rather than the landmark-presence proxy it replaces, but it is
 * not a guarantee, and no copy should imply one.
 */
const OCCLUSION_MIN_REGION_SAMPLES = 12;
const OCCLUSION_MIN_REGIONS = 3;
/** Above the 61-luma spread that in-tolerance side lighting can produce. */
const OCCLUSION_LUMA_DELTA = 70;
/** Flatter than skin (palm, fabric) or far busier than skin (hair). */
const OCCLUSION_TEXTURE_FLAT = 0.4;
const OCCLUSION_TEXTURE_BUSY = 3;

/**
 * Face-box width the sharpness thresholds are expressed in.
 *
 * Gradient and Laplacian energy are scale-dependent: the same face measured
 * with a 1px stencil reads very differently at 200px wide and at 1000px wide.
 * Deriving the stencil from face width instead of from a sample budget makes
 * the measurement mean "detail across 1/384th of a face" at every capture
 * distance and on every gate, so one calibrated threshold can serve both.
 */
const REFERENCE_FACE_WIDTH = 384;
/** Sampling work cap per frame, independent of the stencil above. */
const MAX_SKIN_SAMPLES = 12_000;

function clamp(value: number, min: number, max: number): number {
  "worklet";
  return Math.min(max, Math.max(min, value));
}

function isSkinSample(nx: number, ny: number): SkinRole | null {
  "worklet";
  // Forehead (avoids the outer hairline), both cheeks, and a small chin patch.
  if (nx >= 0.25 && nx <= 0.75 && ny >= 0.12 && ny <= 0.31) return "forehead";
  if (nx >= 0.12 && nx <= 0.43 && ny >= 0.4 && ny <= 0.72) return "left";
  if (nx >= 0.57 && nx <= 0.88 && ny >= 0.4 && ny <= 0.72) return "right";
  if (nx >= 0.34 && nx <= 0.66 && ny >= 0.72 && ny <= 0.86) return "chin";
  return null;
}

/** Index into the per-region accumulators, or -1 for an unnamed skin sample. */
function regionIndex(role: SkinRole): number {
  "worklet";
  if (role === "forehead") return 0;
  if (role === "left") return 1;
  if (role === "right") return 2;
  if (role === "chin") return 3;
  return -1;
}

function medianOf(values: number[]): number {
  "worklet";
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
    : (sorted[middle] ?? 0);
}

/**
 * Share of named skin regions that read as covered rather than merely lit.
 *
 * A region is flagged only when it departs from the median region on BOTH
 * brightness and texture — see the threshold block above for why the
 * conjunction is what makes this a usable signal instead of a lighting alarm.
 * Returns 0 when fewer than three regions carry enough samples to compare.
 */
export function regionalOcclusion(
  sums: number[],
  counts: number[],
  gradientSums: number[],
  gradientCounts: number[],
): number {
  "worklet";
  const lumaMeans: number[] = [];
  const textureMeans: number[] = [];
  const populated: number[] = [];
  for (let i = 0; i < REGION_ROLES.length; i++) {
    const count = counts[i] ?? 0;
    if (count < OCCLUSION_MIN_REGION_SAMPLES) continue;
    const gradientCount = gradientCounts[i] ?? 0;
    populated.push(i);
    lumaMeans.push((sums[i] ?? 0) / count);
    textureMeans.push(gradientCount > 0 ? (gradientSums[i] ?? 0) / gradientCount : 0);
  }
  if (populated.length < OCCLUSION_MIN_REGIONS) return 0;

  const lumaMedian = medianOf(lumaMeans);
  const textureMedian = medianOf(textureMeans);
  let flagged = 0;
  for (let i = 0; i < populated.length; i++) {
    const luma = lumaMeans[i] ?? 0;
    const texture = textureMeans[i] ?? 0;
    const lumaOutlier = Math.abs(luma - lumaMedian) > OCCLUSION_LUMA_DELTA;
    // A zero texture median means every region is flat; nothing to compare to.
    const textureOutlier =
      textureMedian > 0 &&
      (texture < textureMedian * OCCLUSION_TEXTURE_FLAT ||
        texture > textureMedian * OCCLUSION_TEXTURE_BUSY);
    if (lumaOutlier && textureOutlier) flagged += 1;
  }
  return flagged / populated.length;
}

function pointInEllipse(x: number, y: number, ellipse: PixelEllipse): boolean {
  "worklet";
  if (ellipse.radiusX <= 0 || ellipse.radiusY <= 0) return false;
  const dx = (x - ellipse.center.x) / ellipse.radiusX;
  const dy = (y - ellipse.center.y) / ellipse.radiusY;
  return dx * dx + dy * dy <= 1;
}

function pointInPolygon(x: number, y: number, points: PixelPoint[]): boolean {
  "worklet";
  if (points.length < 3) return true;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if (!a || !b) continue;
    const crosses =
      a.y > y !== b.y > y &&
      x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y || 1e-6) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function detectorSkinSample(
  x: number,
  y: number,
  geometry: FacialSamplingGeometry | undefined,
): SkinRole | null {
  "worklet";
  if (!geometry || geometry.skinRegions.length < 3) return null;
  if (
    geometry.faceContour &&
    !pointInPolygon(x, y, geometry.faceContour)
  ) {
    return null;
  }
  for (const excluded of geometry.excludedRegions) {
    if (pointInEllipse(x, y, excluded)) return null;
  }
  for (const region of geometry.skinRegions) {
    if (region.role !== "exclude" && pointInEllipse(x, y, region)) {
      return region.role;
    }
  }
  return null;
}

function makeHash(source: LumaSource, rect: PixelRect): string {
  "worklet";
  const cells: number[] = [];
  let total = 0;
  for (let gy = 0; gy < HASH_SIZE; gy++) {
    for (let gx = 0; gx < HASH_SIZE; gx++) {
      const x = clamp(
        Math.floor(rect.x + ((gx + 0.5) / HASH_SIZE) * rect.width),
        0,
        source.width - 1,
      );
      const y = clamp(
        Math.floor(rect.y + ((gy + 0.5) / HASH_SIZE) * rect.height),
        0,
        source.height - 1,
      );
      const value = source.at(x, y);
      cells.push(value);
      total += value;
    }
  }

  const mean = total / cells.length;
  let hash = "";
  for (let i = 0; i < cells.length; i += 4) {
    let nibble = 0;
    for (let bit = 0; bit < 4; bit++) {
      if ((cells[i + bit] ?? 0) >= mean) nibble |= 1 << (3 - bit);
    }
    hash += nibble.toString(16);
  }
  return hash;
}

function percentile(
  histogram: number[],
  count: number,
  quantile: number,
): number {
  "worklet";
  const target = Math.max(1, Math.ceil(count * quantile));
  let seen = 0;
  for (let value = 0; value < histogram.length; value++) {
    seen += histogram[value] ?? 0;
    if (seen >= target) return value;
  }
  return 255;
}

function sampleBackgroundLuma(source: LumaSource, face: PixelRect): number {
  "worklet";
  const step = Math.max(
    1,
    Math.floor(Math.sqrt((source.width * source.height) / 3_000)),
  );
  const marginX = face.width * 0.15;
  const marginY = face.height * 0.15;
  const left = face.x - marginX;
  const top = face.y - marginY;
  const right = face.x + face.width + marginX;
  const bottom = face.y + face.height + marginY;
  let sum = 0;
  let count = 0;
  for (let y = 0; y < source.height; y += step) {
    for (let x = 0; x < source.width; x += step) {
      if (x >= left && x <= right && y >= top && y <= bottom) continue;
      const value = source.at(x, y);
      if (!Number.isFinite(value)) continue;
      sum += value;
      count += 1;
    }
  }
  return count > 0 ? sum / count : 0;
}

function sampleSource(
  source: LumaSource,
  face: PixelRect,
  geometry?: FacialSamplingGeometry,
): FacialPixelEvidence | null {
  "worklet";
  if (
    !Number.isFinite(face.x) ||
    !Number.isFinite(face.y) ||
    !Number.isFinite(face.width) ||
    !Number.isFinite(face.height) ||
    face.width < 8 ||
    face.height < 8 ||
    source.width < 8 ||
    source.height < 8
  ) {
    return null;
  }

  const x0 = clamp(Math.floor(face.x), 0, source.width - 1);
  const y0 = clamp(Math.floor(face.y), 0, source.height - 1);
  const x1 = clamp(Math.ceil(face.x + face.width), x0 + 1, source.width);
  const y1 = clamp(Math.ceil(face.y + face.height), y0 + 1, source.height);
  const width = x1 - x0;
  const height = y1 - y0;
  // Two independent knobs that used to be one number. `step` caps work per
  // frame; `stencil` fixes the physical scale the gradients are measured at.
  // Sharing them tied the sharpness metric to the sample budget, so the same
  // face read differently at different distances and on different gates.
  const step = Math.max(
    1,
    Math.floor(Math.sqrt((width * height) / MAX_SKIN_SAMPLES)),
  );
  const stencil = Math.max(1, Math.round(width / REFERENCE_FACE_WIDTH));
  const acc: Accumulator = {
    count: 0,
    sum: 0,
    sumSquares: 0,
    shadows: 0,
    highlights: 0,
    min: 255,
    max: 0,
    gradientSum: 0,
    gradientCount: 0,
    laplacianSum: 0,
    laplacianSquares: 0,
    laplacianCount: 0,
    glare: 0,
    leftSum: 0,
    leftCount: 0,
    rightSum: 0,
    rightCount: 0,
    regionSum: [0, 0, 0, 0],
    regionCount: [0, 0, 0, 0],
    regionGradientSum: [0, 0, 0, 0],
    regionGradientCount: [0, 0, 0, 0],
  };
  const histogram: number[] = [];
  for (let i = 0; i < 256; i++) histogram.push(0);

  for (let y = y0; y < y1; y += step) {
    const ny = (y - y0) / height;
    for (let x = x0; x < x1; x += step) {
      const nx = (x - x0) / width;
      const detectorRegion = detectorSkinSample(x, y, geometry);
      const region = geometry
        ? detectorRegion
        : isSkinSample(nx, ny);
      if (region == null) continue;
      const value = source.at(x, y);
      if (!Number.isFinite(value)) continue;
      acc.count += 1;
      acc.sum += value;
      acc.sumSquares += value * value;
      const bucket = clamp(Math.round(value), 0, 255);
      histogram[bucket] = (histogram[bucket] ?? 0) + 1;
      acc.min = Math.min(acc.min, value);
      acc.max = Math.max(acc.max, value);
      if (value <= SHADOW_LUMA) acc.shadows += 1;
      if (value >= HIGHLIGHT_LUMA) acc.highlights += 1;
      if (value >= 235) acc.glare += 1;
      if (region === "left") {
        acc.leftSum += value;
        acc.leftCount += 1;
      } else if (region === "right") {
        acc.rightSum += value;
        acc.rightCount += 1;
      }
      const slot = regionIndex(region);
      if (slot >= 0) {
        acc.regionSum[slot] = (acc.regionSum[slot] ?? 0) + value;
        acc.regionCount[slot] = (acc.regionCount[slot] ?? 0) + 1;
      }

      if (x + stencil < x1 && y + stencil < y1) {
        const dx = source.at(x + stencil, y) - value;
        const dy = source.at(x, y + stencil) - value;
        const energy = dx * dx + dy * dy;
        acc.gradientSum += energy;
        acc.gradientCount += 2;
        if (slot >= 0) {
          acc.regionGradientSum[slot] = (acc.regionGradientSum[slot] ?? 0) + energy;
          acc.regionGradientCount[slot] = (acc.regionGradientCount[slot] ?? 0) + 1;
        }
      }
      if (
        x - stencil >= x0 &&
        x + stencil < x1 &&
        y - stencil >= y0 &&
        y + stencil < y1
      ) {
        const laplacian =
          4 * value -
          source.at(x - stencil, y) -
          source.at(x + stencil, y) -
          source.at(x, y - stencil) -
          source.at(x, y + stencil);
        acc.laplacianSum += laplacian;
        acc.laplacianSquares += laplacian * laplacian;
        acc.laplacianCount += 1;
      }
    }
  }

  if (acc.count < 64 || acc.leftCount === 0 || acc.rightCount === 0)
    return null;
  const mean = acc.sum / acc.count;
  const variance = Math.max(0, acc.sumSquares / acc.count - mean * mean);
  const leftMean = acc.leftSum / acc.leftCount;
  const rightMean = acc.rightSum / acc.rightCount;
  const cheekDifference = Math.abs(leftMean - rightMean) / 255;
  const sharpness =
    acc.gradientCount > 0
      ? acc.gradientSum / acc.gradientCount / (255 * 255)
      : 0;
  const gradientEnergy = sharpness * 255 * 255;
  const laplacianMean =
    acc.laplacianCount > 0 ? acc.laplacianSum / acc.laplacianCount : 0;
  const laplacianVariance =
    acc.laplacianCount > 0
      ? Math.max(
          0,
          acc.laplacianSquares / acc.laplacianCount -
            laplacianMean * laplacianMean,
        )
      : 0;
  const contrast = Math.sqrt(variance) / 255;
  const dynamicRange = (acc.max - acc.min) / 255;
  const occlusionRatio = regionalOcclusion(
    acc.regionSum,
    acc.regionCount,
    acc.regionGradientSum,
    acc.regionGradientCount,
  );
  const backgroundLuma = sampleBackgroundLuma(source, {
    x: x0,
    y: y0,
    width,
    height,
  });

  return {
    meanLuma: mean / 255,
    shadowClipping: acc.shadows / acc.count,
    highlightClipping: acc.highlights / acc.count,
    contrast,
    sharpness,
    gradientEnergy,
    laplacianVariance,
    lumaP10: percentile(histogram, acc.count, 0.1),
    lumaP90: percentile(histogram, acc.count, 0.9),
    lumaStdDev: Math.sqrt(variance),
    lightingUniformity: clamp(1 - cheekDifference, 0, 1),
    cheekLumaDifference: cheekDifference,
    leftFaceLuma: leftMean,
    rightFaceLuma: rightMean,
    glareRatio: acc.glare / acc.count,
    backgroundLuma,
    backlightDelta: backgroundLuma - mean,
    dynamicRange,
    sampleCount: acc.count,
    occlusionRatio,
    perceptualHash: makeHash(source, { x: x0, y: y0, width, height }),
    nearlyUniform: contrast < 0.018 || dynamicRange < 0.045,
  };
}

/** Sample a single-channel plane (the Y plane for VisionCamera YUV frames). */
export function sampleFacialSkinFromLumaPlane(
  bytes: Uint8Array,
  width: number,
  height: number,
  bytesPerRow: number,
  face: PixelRect,
  geometry?: FacialSamplingGeometry,
): FacialPixelEvidence | null {
  "worklet";
  if (bytesPerRow < width || bytes.length < bytesPerRow * height) return null;
  return sampleSource(
    {
      width,
      height,
      at: (x, y) => {
        "worklet";
        return bytes[y * bytesPerRow + x] ?? Number.NaN;
      },
    },
    face,
    geometry,
  );
}

/** Sample an RGBA image decoded from the final full-resolution file crop. */
export function sampleFacialSkinFromRgba(
  bytes: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  face: PixelRect,
  geometry?: FacialSamplingGeometry,
): FacialPixelEvidence | null {
  if (bytes.length < width * height * 4) return null;
  return sampleSource(
    {
      width,
      height,
      at: (x, y) => {
        const offset = (y * width + x) * 4;
        const r = bytes[offset] ?? Number.NaN;
        const g = bytes[offset + 1] ?? Number.NaN;
        const b = bytes[offset + 2] ?? Number.NaN;
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      },
    },
    face,
    geometry,
  );
}

export function scaleFacialSamplingGeometry(
  geometry: FacialSamplingGeometry | null | undefined,
  xScale: number,
  yScale: number,
): FacialSamplingGeometry | undefined {
  "worklet";
  if (!geometry || xScale <= 0 || yScale <= 0) return undefined;
  const scaleEllipse = (ellipse: PixelEllipse): PixelEllipse => {
    "worklet";
    return {
      center: {
        x: ellipse.center.x * xScale,
        y: ellipse.center.y * yScale,
      },
      radiusX: ellipse.radiusX * xScale,
      radiusY: ellipse.radiusY * yScale,
      role: ellipse.role,
    };
  };
  return {
    skinRegions: geometry.skinRegions.map(scaleEllipse),
    excludedRegions: geometry.excludedRegions.map(scaleEllipse),
    ...(geometry.faceContour
      ? {
          faceContour: geometry.faceContour.map((point) => ({
            x: point.x * xScale,
            y: point.y * yScale,
          })),
        }
      : {}),
  };
}

export function perceptualHashSimilarity(a: string, b: string): number {
  if (!/^[0-9a-f]{16}$/i.test(a) || !/^[0-9a-f]{16}$/i.test(b)) return 0;
  let equalBits = 0;
  for (let i = 0; i < a.length; i++) {
    const xor = Number.parseInt(a[i], 16) ^ Number.parseInt(b[i], 16);
    equalBits +=
      4 - ((xor >> 3) & 1) - ((xor >> 2) & 1) - ((xor >> 1) & 1) - (xor & 1);
  }
  return equalBits / 64;
}

/** Mirror an 8x8 hash by reversing the eight bits in each hash row. */
export function mirrorPerceptualHash(hash: string): string {
  if (!/^[0-9a-f]{16}$/i.test(hash)) return hash;
  let mirrored = "";
  for (let index = 0; index < hash.length; index += 2) {
    const row = Number.parseInt(hash.slice(index, index + 2), 16);
    let reversed = 0;
    for (let bit = 0; bit < 8; bit++)
      reversed |= ((row >> bit) & 1) << (7 - bit);
    mirrored += reversed.toString(16).padStart(2, "0");
  }
  return mirrored;
}

/** Normalize raw live-frame pixels to the camera output's presentation. */
export function orientPreviewPerceptualHash(
  hash: string,
  frameIsMirrored: boolean,
): string {
  return frameIsMirrored ? mirrorPerceptualHash(hash) : hash;
}
