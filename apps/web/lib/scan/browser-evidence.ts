/**
 * Browser-only image and landmark measurement.
 *
 * This module gathers evidence; it does not decide whether an image passes.
 * The pure shared quality policy owns thresholds and user guidance.
 */
import type { FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { QUALITY_CONFIG } from "@pore/shared/scan";

import { CAPTURE_ASPECT_RATIO, coverCrop } from "./capture";

const NOSE_TIP = 1;
const LEFT_EYE_OUTER = 33;
const RIGHT_EYE_OUTER = 263;
const NOSE_Y_BIAS = 0.08;

export interface NormalizedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BrowserFaceEvidence {
  faceCount: number;
  box: NormalizedBox | null;
  center: { x: number; y: number };
  widthRatio: number;
  heightRatio: number;
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
  /** Share of key face bounds that lies inside the image. */
  completeness: number;
}

export interface BrowserImageEvidence {
  width: number;
  height: number;
  pixelCount: number;
  /** Mean luma within cheek/forehead/chin skin regions, 0..255. */
  faceLumaMean: number;
  faceLumaP10: number;
  faceLumaP50: number;
  faceLumaP90: number;
  faceLumaStdDev: number;
  faceContrast: number;
  shadowClipping: number;
  highlightClipping: number;
  glareRatio: number;
  /** Mean squared luma gradient in skin regions. */
  skinSharpness: number;
  /** Variance of the 4-neighbour Laplacian in skin regions. */
  skinLaplacianVariance: number;
  leftFaceLuma: number;
  rightFaceLuma: number;
  lightingAsymmetry: number;
  backgroundLuma: number;
  backlightDelta: number;
  /** True for nearly constant, covered, or otherwise content-free frames. */
  blankOrUniform: boolean;
  /** Robust regional estimate for forehead/cheek/chin obstruction. Policy
   * applies the centralized maximum; this collector only reports evidence. */
  facialSkinOcclusion: number;
  /** 64-bit difference hash represented as 16 hexadecimal characters. */
  perceptualHash: string;
}

export interface BrowserMotionEvidence {
  /** Normalized 0..1 change of the 8x8 luma signature. */
  pixelMotion: number;
  /** Normalized landmark/pose displacement, 0..1. */
  landmarkMotion: number;
}

export interface BrowserFrameEvidence {
  capturedAt: number;
  sourceFrameTime: number | null;
  face: BrowserFaceEvidence;
  image: BrowserImageEvidence;
  motion: BrowserMotionEvidence;
}

export const NO_MOTION_EVIDENCE: BrowserMotionEvidence = {
  pixelMotion: 0,
  landmarkMotion: 0,
};

/** Draw the same centered 3:4 crop visible in the camera preview. */
export function drawVideoCrop(video: HTMLVideoElement, targetWidth = 320): HTMLCanvasElement {
  if (!video.videoWidth || !video.videoHeight) throw new Error("Video frame is not ready");
  const crop = coverCrop(video.videoWidth, video.videoHeight, CAPTURE_ASPECT_RATIO);
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(targetWidth, crop.width);
  canvas.height = Math.max(1, Math.round(canvas.width / CAPTURE_ASPECT_RATIO));
  const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(
    video,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
}

export function measureFace(result: FaceLandmarkerResult | null): BrowserFaceEvidence {
  const faces = result?.faceLandmarks ?? [];
  const landmarks = faces[0];
  if (!landmarks) {
    return {
      faceCount: faces.length,
      box: null,
      center: { x: 0.5, y: 0.5 },
      widthRatio: 0,
      heightRatio: 0,
      yawDeg: 0,
      pitchDeg: 0,
      rollDeg: 0,
      completeness: 0,
    };
  }

  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const point of landmarks) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  const width = Math.max(maxX - minX, 1e-6);
  const height = Math.max(maxY - minY, 1e-6);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const nose = landmarks[NOSE_TIP] ?? { x: cx, y: cy, z: 0, visibility: 0 };
  const yawRatio = clamp((2 * (nose.x - cx)) / width, -1, 1);
  const pitchRatio = clamp((2 * (cy + NOSE_Y_BIAS * height - nose.y)) / height, -1, 1);
  const leftEye = landmarks[LEFT_EYE_OUTER];
  const rightEye = landmarks[RIGHT_EYE_OUTER];
  const rollDeg =
    leftEye && rightEye
      ? toDegrees(Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x))
      : 0;
  const insideWidth = Math.max(0, Math.min(maxX, 1) - Math.max(minX, 0));
  const insideHeight = Math.max(0, Math.min(maxY, 1) - Math.max(minY, 0));

  return {
    faceCount: faces.length,
    box: { x: minX, y: minY, width, height },
    center: { x: cx, y: cy },
    widthRatio: width,
    heightRatio: height,
    yawDeg: toDegrees(Math.asin(yawRatio)),
    pitchDeg: toDegrees(Math.asin(pitchRatio)),
    rollDeg,
    completeness: clamp((insideWidth * insideHeight) / (width * height), 0, 1),
  };
}

/** Measure facial skin rather than the whole image. Strong edges from hair,
 * eyes, lips, clothing, or a sharp background are excluded from sharpness. */
export function measureImage(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  face: BrowserFaceEvidence,
  sampleWidth: number = QUALITY_CONFIG.sampling.finalWidth,
): BrowserImageEvidence {
  if (!sourceWidth || !sourceHeight) throw new Error("Image has no dimensions");
  const width = Math.min(sampleWidth, sourceWidth);
  const height = Math.max(2, Math.round((sourceHeight / sourceWidth) * width));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(source, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height);
  return measurePixelData(pixels, sourceWidth, sourceHeight, face);
}

export function measurePixelData(
  pixels: ImageData,
  originalWidth: number,
  originalHeight: number,
  face: BrowserFaceEvidence,
): BrowserImageEvidence {
  const { width, height, data } = pixels;
  const luma = new Float32Array(width * height);
  for (let i = 0; i < luma.length; i++) {
    const offset = i * 4;
    luma[i] = 0.299 * data[offset]! + 0.587 * data[offset + 1]! + 0.114 * data[offset + 2]!;
  }

  const regions = skinRegions(face.box);
  const skinMask = new Uint8Array(width * height);
  const faceValues: number[] = [];
  const leftValues: number[] = [];
  const rightValues: number[] = [];
  const regionSamples = regions.map(() => ({ luma: [] as number[], cb: [] as number[], cr: [] as number[] }));
  const faceMidX = face.box ? face.box.x + face.box.width / 2 : 0.5;

  for (const [regionIndex, region] of regions.entries()) {
    visitRegion(region, width, height, (x, y, index) => {
      if (skinMask[index]) return;
      skinMask[index] = 1;
      const value = luma[index]!;
      const offset = index * 4;
      const red = data[offset]!;
      const green = data[offset + 1]!;
      const blue = data[offset + 2]!;
      faceValues.push(value);
      regionSamples[regionIndex]!.luma.push(value);
      regionSamples[regionIndex]!.cb.push(128 - 0.168736 * red - 0.331264 * green + 0.5 * blue);
      regionSamples[regionIndex]!.cr.push(128 + 0.5 * red - 0.418688 * green - 0.081312 * blue);
      if ((x + 0.5) / width < faceMidX) leftValues.push(value);
      else rightValues.push(value);
    });
  }

  // With no usable face ROI, retain integrity evidence from the central frame
  // but never mistake it for verified face quality; faceCount still blocks.
  if (faceValues.length < 32) {
    visitRegion({ x: 0.2, y: 0.2, width: 0.6, height: 0.6 }, width, height, (_x, _y, index) => {
      skinMask[index] = 1;
      faceValues.push(luma[index]!);
    });
  }

  const sorted = [...faceValues].sort((a, b) => a - b);
  const mean = average(faceValues);
  const p10 = percentile(sorted, 0.1);
  const p50 = percentile(sorted, 0.5);
  const p90 = percentile(sorted, 0.9);
  const variance = average(faceValues.map((value) => (value - mean) ** 2));
  const stdDev = Math.sqrt(variance);
  let shadows = 0;
  let highlights = 0;
  let glare = 0;
  for (const value of faceValues) {
    if (value <= 8) shadows++;
    if (value >= 247) highlights++;
    if (value >= 235) glare++;
  }

  let gradientEnergy = 0;
  let laplacianSum = 0;
  let laplacianSqSum = 0;
  let edgeCount = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = y * width + x;
      if (!skinMask[index]) continue;
      const center = luma[index]!;
      const gx = luma[index + 1]! - luma[index - 1]!;
      const gy = luma[index + width]! - luma[index - width]!;
      gradientEnergy += gx * gx + gy * gy;
      const laplacian =
        luma[index - 1]! + luma[index + 1]! + luma[index - width]! + luma[index + width]! -
        4 * center;
      laplacianSum += laplacian;
      laplacianSqSum += laplacian * laplacian;
      edgeCount++;
    }
  }
  const gradientMean = edgeCount ? gradientEnergy / edgeCount : 0;
  const laplacianMean = edgeCount ? laplacianSum / edgeCount : 0;
  const laplacianVariance = edgeCount
    ? Math.max(0, laplacianSqSum / edgeCount - laplacianMean * laplacianMean)
    : 0;

  const backgroundValues: number[] = [];
  const box = face.box;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const nx = (x + 0.5) / width;
      const ny = (y + 0.5) / height;
      const insideFace =
        box && nx >= box.x && nx <= box.x + box.width && ny >= box.y && ny <= box.y + box.height;
      if (!insideFace) backgroundValues.push(luma[y * width + x]!);
    }
  }

  const leftMean = leftValues.length ? average(leftValues) : mean;
  const rightMean = rightValues.length ? average(rightValues) : mean;
  const backgroundMean = backgroundValues.length ? average(backgroundValues) : mean;
  const dynamicRange = p90 - p10;

  return {
    width: originalWidth,
    height: originalHeight,
    pixelCount: originalWidth * originalHeight,
    faceLumaMean: mean,
    faceLumaP10: p10,
    faceLumaP50: p50,
    faceLumaP90: p90,
    faceLumaStdDev: stdDev,
    faceContrast: dynamicRange,
    shadowClipping: shadows / faceValues.length,
    highlightClipping: highlights / faceValues.length,
    glareRatio: glare / faceValues.length,
    skinSharpness: gradientMean,
    skinLaplacianVariance: laplacianVariance,
    leftFaceLuma: leftMean,
    rightFaceLuma: rightMean,
    lightingAsymmetry: Math.abs(leftMean - rightMean) / 255,
    backgroundLuma: backgroundMean,
    backlightDelta: backgroundMean - mean,
    /**
     * A covered lens, not a flatly-lit face.
     *
     * This used to also fire on `dynamicRange < minFaceContrast`, but that is
     * the *texture* floor, and `checkLighting` already tests exactly the same
     * condition to raise `low_texture` ("Use softer light so your skin texture
     * stays visible"). Because `blank_or_covered` outranks `low_texture` in
     * GUIDANCE_PRIORITY by twenty-odd places, the honest message could never
     * win: a clearly visible face in flat light was told to "Uncover your
     * camera lens." Blankness is a luma-deviation question, which is the check
     * that remains — and `checkIntegrity` applies the same floor itself.
     */
    blankOrUniform: stdDev < QUALITY_CONFIG.integrity.minLumaStdDev,
    facialSkinOcclusion: estimateRegionalOcclusion(regionSamples),
    perceptualHash: differenceHash(luma, width, height),
  };
}

/** Recent-frame motion derived from both image content and face geometry. */
export function compareMotion(
  previous: Pick<BrowserFrameEvidence, "face" | "image"> | null,
  current: Pick<BrowserFrameEvidence, "face" | "image">,
): BrowserMotionEvidence {
  if (!previous || previous.face.faceCount !== 1 || current.face.faceCount !== 1) {
    return NO_MOTION_EVIDENCE;
  }
  const pixelMotion = hashDistance(
    previous.image.perceptualHash,
    current.image.perceptualHash,
  ) / 64;
  const centerDrift = Math.hypot(
    current.face.center.x - previous.face.center.x,
    current.face.center.y - previous.face.center.y,
  );
  const sizeDrift = Math.abs(current.face.widthRatio - previous.face.widthRatio);
  const poseDrift =
    (Math.abs(current.face.yawDeg - previous.face.yawDeg) +
      Math.abs(current.face.pitchDeg - previous.face.pitchDeg) +
      Math.abs(current.face.rollDeg - previous.face.rollDeg)) /
    180;
  const landmarkMotion = clamp(centerDrift * 4 + sizeDrift * 2 + poseDrift, 0, 1);
  return { pixelMotion, landmarkMotion };
}

export function hashDistance(left: string, right: string): number {
  if (left.length !== right.length || left.length === 0) return 64;
  let distance = 0;
  for (let i = 0; i < left.length; i++) {
    const a = Number.parseInt(left[i]!, 16);
    const b = Number.parseInt(right[i]!, 16);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return 64;
    distance += bitCount4(a ^ b);
  }
  return distance;
}

function skinRegions(box: NormalizedBox | null): NormalizedBox[] {
  if (!box) return [];
  const region = (x: number, y: number, width: number, height: number): NormalizedBox => ({
    x: box.x + x * box.width,
    y: box.y + y * box.height,
    width: width * box.width,
    height: height * box.height,
  });
  return [
    region(0.12, 0.43, 0.3, 0.25), // image-left cheek
    region(0.58, 0.43, 0.3, 0.25), // image-right cheek
    region(0.27, 0.08, 0.46, 0.2), // forehead, below hairline
    region(0.36, 0.72, 0.28, 0.14), // chin, above jaw edge
  ];
}

function visitRegion(
  region: NormalizedBox,
  width: number,
  height: number,
  visit: (x: number, y: number, index: number) => void,
): void {
  const x0 = Math.max(0, Math.floor(region.x * width));
  const y0 = Math.max(0, Math.floor(region.y * height));
  const x1 = Math.min(width, Math.ceil((region.x + region.width) * width));
  const y1 = Math.min(height, Math.ceil((region.y + region.height) * height));
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) visit(x, y, y * width + x);
  }
}

function differenceHash(luma: Float32Array, width: number, height: number): string {
  const bits: number[] = [];
  // 9 columns produce 8 horizontal comparisons per each of 8 rows.
  for (let y = 0; y < 8; y++) {
    const sourceY = Math.min(height - 1, Math.floor(((y + 0.5) / 8) * height));
    for (let x = 0; x < 8; x++) {
      const leftX = Math.min(width - 1, Math.floor(((x + 0.25) / 9) * width));
      const rightX = Math.min(width - 1, Math.floor(((x + 1.25) / 9) * width));
      bits.push(luma[sourceY * width + leftX]! >= luma[sourceY * width + rightX]! ? 1 : 0);
    }
  }
  let result = "";
  for (let i = 0; i < bits.length; i += 4) {
    const value = (bits[i]! << 3) | (bits[i + 1]! << 2) | (bits[i + 2]! << 1) | bits[i + 3]!;
    result += value.toString(16);
  }
  return result;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))]!;
}

function average(values: number[]): number {
  if (!values.length) return 0;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

/** A Tukey-fence outlier across the four deliberately feature-light facial
 * regions is evidence that a whole cheek/forehead/chin area is obscured by a
 * materially different surface. It is relative within this face (including
 * chroma), avoiding a fixed skin-colour model. */
function estimateRegionalOcclusion(
  regions: Array<{ luma: number[]; cb: number[]; cr: number[] }>,
): number {
  const populated = regions.filter((region) => region.luma.length > 0);
  if (populated.length < 3) return 1;
  const summaries = populated.map((region) => ({
    pixels: region.luma.length,
    luma: average(region.luma),
    cb: average(region.cb),
    cr: average(region.cr),
  }));
  const lumaFence = tukeyFence(summaries.map((summary) => summary.luma));
  const cbFence = tukeyFence(summaries.map((summary) => summary.cb));
  const crFence = tukeyFence(summaries.map((summary) => summary.cr));
  const total = summaries.reduce((sum, summary) => sum + summary.pixels, 0);
  const occluded = summaries.reduce((sum, summary) => {
    const outside =
      !insideFence(summary.luma, lumaFence) ||
      !insideFence(summary.cb, cbFence) ||
      !insideFence(summary.cr, crFence);
    return sum + (outside ? summary.pixels : 0);
  }, 0);
  return total ? clamp(occluded / total, 0, 1) : 1;
}

function tukeyFence(values: number[]): { min: number; max: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = interpolatedPercentile(sorted, 0.25);
  const q3 = interpolatedPercentile(sorted, 0.75);
  const iqr = q3 - q1;
  // 1.5 IQR is the standard Tukey outer-observation convention, used only
  // to normalize evidence; the product gate remains QUALITY_CONFIG.occlusion.
  return { min: q1 - 1.5 * iqr, max: q3 + 1.5 * iqr };
}

function insideFence(value: number, fence: { min: number; max: number }): boolean {
  return value >= fence.min && value <= fence.max;
}

function interpolatedPercentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const index = p * (sorted.length - 1);
  const low = Math.floor(index);
  const high = Math.ceil(index);
  if (low === high) return sorted[low]!;
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (index - low);
}

function bitCount4(value: number): number {
  value -= (value >> 1) & 0x5;
  value = (value & 0x3) + ((value >> 2) & 0x3);
  return value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}
