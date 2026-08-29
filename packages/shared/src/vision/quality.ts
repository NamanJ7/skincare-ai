/**
 * Capture measurement — the deterministic half of "is this photo usable?".
 *
 * The published gap in this category (~0.90 AUROC in specialist settings vs
 * ~0.81 from uncontrolled smartphone capture) is attributed to input image
 * quality, not model capability. So the camera is treated as an instrument:
 * every frame is measured before it is allowed to become an assessment, and
 * what was measured travels with the photo so the model can lower its own
 * confidence instead of guessing confidently.
 *
 * This module is pure maths over an RGBA buffer. All I/O (capture, crop,
 * decode) lives in the mobile app; keeping the scoring here means vitest
 * covers it, including the darker-skin regression case.
 */
import type { SkinTone } from "../types/intake";

export type PhotoQualityFlag =
  | "dark"
  | "bright"
  | "blurry"
  | "uneven_light"
  | "color_cast"
  | "too_far";

/** Mean linear RGB over the frame — a gray-world estimate of the light source. */
export interface Illuminant {
  r: number;
  g: number;
  b: number;
}

export interface FrameScore {
  /** 0..1 composite. 1 is a frame with nothing wrong with it. */
  score: number;
  flags: PhotoQualityFlag[];
  /** Raw measurements, kept so thresholds can be retuned against real captures. */
  metrics: {
    meanLuma: number;
    clippedFraction: number;
    sharpness: number;
    lightingImbalance: number;
    skinCoverage: number;
    chromaDistance: number;
  };
  illuminant: Illuminant;
}

/**
 * Every threshold in one place, on purpose.
 *
 * These values are seeded from theory, not from this product's camera. A real
 * front camera under real light will not match the paper. They MUST be tuned
 * on device captures across the full tone range before launch — see TODOS.md.
 */
/**
 * Every tone-independent threshold in one place, on purpose.
 *
 * These values are seeded from theory, not from this product's camera. A real
 * front camera under real light will not match the paper. They MUST be tuned
 * on device captures across the full tone range before launch — see TODOS.md.
 */
export const CAPTURE_TUNING = {
  /** Mean luma above which highlights are washing out the skin surface. */
  maxMeanLuma: 205,
  /** Fraction of pixels crushed to 0 or blown to 255 before we reject. */
  maxClippedFraction: 0.15,
  /**
   * Variance of the Laplacian below which the frame reads as soft. Motion blur
   * is the top cause of invented texture findings, so this is the highest-value
   * check in the set.
   */
  minSharpness: 120,
  /** Relative left/right mean-luma gap that indicates a hard side shadow. */
  maxLightingImbalance: 0.25,
  /** Skin-chroma pixels as a fraction of the analysis crop. Below this: too far. */
  minSkinCoverage: 0.55,
  /** Distance in (Cb,Cr) from the skin centre before we call it a colour cast. */
  maxChromaDistance: 22,
} as const;

/**
 * Skin chroma is close to tone-invariant — what changes with tone is luma, not
 * hue. So there is one centre for everybody rather than six invented ones, and
 * a colour cast is measured as drift away from it.
 */
const SKIN_CENTRE = { cb: 102, cr: 152 } as const;

/**
 * Per-tone capture profile.
 *
 * `minMeanLuma` is the one that matters. Under an identical light, deeper skin
 * legitimately reads lower mean luma than fair skin. A single fixed exposure
 * floor is therefore not a neutral check: it tells darker-skinned users their
 * perfectly good photo is "too dark", over and over, and it is exactly the
 * shape of bias this category is already documented as having. The floor moves
 * with the declared tone instead.
 *
 * The chroma envelope widens slightly for deeper tones as well. Note there is
 * deliberately NO luma gate on skin detection — the classic detectors add one,
 * and it is the other half of the same bug.
 */
const TONE_PROFILE: Record<
  SkinTone,
  { minMeanLuma: number; cbMin: number; cbMax: number; crMin: number; crMax: number }
> = {
  very_fair: { minMeanLuma: 92, cbMin: 80, cbMax: 125, crMin: 133, crMax: 168 },
  fair: { minMeanLuma: 84, cbMin: 79, cbMax: 126, crMin: 133, crMax: 170 },
  medium: { minMeanLuma: 72, cbMin: 77, cbMax: 127, crMin: 133, crMax: 173 },
  olive: { minMeanLuma: 66, cbMin: 76, cbMax: 129, crMin: 131, crMax: 173 },
  brown: { minMeanLuma: 56, cbMin: 74, cbMax: 132, crMin: 129, crMax: 175 },
  deep: { minMeanLuma: 46, cbMin: 72, cbMax: 135, crMin: 126, crMax: 177 },
};

const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
const chromaB = (r: number, g: number, b: number) => 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
const chromaR = (r: number, g: number, b: number) => 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

/**
 * Measure one RGBA frame. `px` is the analysis crop — a centre region of the
 * capture taken at near-native resolution and only then downscaled, because
 * sharpness lives in high-frequency detail that a full-frame downscale destroys.
 */
export function scoreFrame(px: Uint8Array, w: number, h: number, tone: SkinTone): FrameScore {
  if (w <= 2 || h <= 2) throw new Error(`Analysis crop too small: ${w}x${h}`);
  if (px.length !== w * h * 4) {
    throw new Error(`Pixel buffer is ${px.length} bytes, expected ${w * h * 4} for ${w}x${h} RGBA`);
  }

  const n = w * h;
  const lum = new Float64Array(n);
  let sumLuma = 0;
  let clipped = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;

  // Skin-chroma accumulation, gated on the tone's envelope.
  const env = TONE_PROFILE[tone];
  let skinCount = 0;
  let skinCb = 0;
  let skinCr = 0;

  for (let i = 0; i < n; i++) {
    const r = px[i * 4]!;
    const g = px[i * 4 + 1]!;
    const b = px[i * 4 + 2]!;
    const y = luma(r, g, b);

    lum[i] = y;
    sumLuma += y;
    sumR += r;
    sumG += g;
    sumB += b;
    if (y <= 2 || y >= 253) clipped++;

    const cb = chromaB(r, g, b);
    const cr = chromaR(r, g, b);
    if (cb >= env.cbMin && cb <= env.cbMax && cr >= env.crMin && cr <= env.crMax) {
      skinCount++;
      skinCb += cb;
      skinCr += cr;
    }
  }

  const meanLuma = sumLuma / n;
  const clippedFraction = clipped / n;
  const skinCoverage = skinCount / n;

  // Colour cast: how far the detected skin sits from where this tone should sit.
  // With no skin found there is nothing to measure a cast against, so report 0
  // and let the coverage flag carry the failure.
  const chromaDistance =
    skinCount === 0
      ? 0
      : Math.hypot(skinCb / skinCount - SKIN_CENTRE.cb, skinCr / skinCount - SKIN_CENTRE.cr);

  // Variance of the Laplacian over the interior. High-frequency energy is the
  // signal; a soft frame has almost none.
  let lapSum = 0;
  let lapSqSum = 0;
  let lapCount = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const v = 4 * lum[i]! - lum[i - 1]! - lum[i + 1]! - lum[i - w]! - lum[i + w]!;
      lapSum += v;
      lapSqSum += v * v;
      lapCount++;
    }
  }
  const lapMean = lapCount ? lapSum / lapCount : 0;
  const sharpness = lapCount ? lapSqSum / lapCount - lapMean * lapMean : 0;

  // Left vs right mean luma. A hard side shadow reads downstream as tonal
  // unevenness that is a property of the room, not the face.
  const half = Math.floor(w / 2);
  let leftSum = 0;
  let rightSum = 0;
  let leftN = 0;
  let rightN = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < half) {
        leftSum += lum[y * w + x]!;
        leftN++;
      } else {
        rightSum += lum[y * w + x]!;
        rightN++;
      }
    }
  }
  const leftMean = leftN ? leftSum / leftN : 0;
  const rightMean = rightN ? rightSum / rightN : 0;
  const brighter = Math.max(leftMean, rightMean);
  const lightingImbalance = brighter > 0 ? Math.abs(leftMean - rightMean) / brighter : 0;

  const flags: PhotoQualityFlag[] = [];
  if (meanLuma < env.minMeanLuma) flags.push("dark");
  if (meanLuma > CAPTURE_TUNING.maxMeanLuma || clippedFraction > CAPTURE_TUNING.maxClippedFraction) {
    flags.push("bright");
  }
  if (sharpness < CAPTURE_TUNING.minSharpness) flags.push("blurry");
  if (lightingImbalance > CAPTURE_TUNING.maxLightingImbalance) flags.push("uneven_light");
  if (skinCoverage < CAPTURE_TUNING.minSkinCoverage) flags.push("too_far");
  if (skinCount > 0 && chromaDistance > CAPTURE_TUNING.maxChromaDistance) flags.push("color_cast");

  return {
    // Each flag is a real reason to distrust the frame, so they cost equally.
    // The composite is what the UI shows; the flags are what gets acted on.
    score: Math.max(0, 1 - flags.length / 6),
    flags,
    metrics: { meanLuma, clippedFraction, sharpness, lightingImbalance, skinCoverage, chromaDistance },
    illuminant: { r: sumR / n, g: sumG / n, b: sumB / n },
  };
}

/** Copy for a failed frame — one specific, fixable instruction, never a list. */
export function captureHint(flags: PhotoQualityFlag[]): string | null {
  if (flags.includes("blurry")) return "Hold still — that one came out soft";
  if (flags.includes("dark")) return "Too dark — face a window or turn a light on";
  if (flags.includes("bright")) return "Too bright — step out of direct light";
  if (flags.includes("too_far")) return "Move a little closer, fill the oval";
  if (flags.includes("uneven_light")) return "One side is in shadow — face the light straight on";
  if (flags.includes("color_cast")) return "That light is tinting your skin — try daylight";
  return null;
}
