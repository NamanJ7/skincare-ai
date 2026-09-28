/**
 * Post-capture photo quality check — the no-detector path that runs on every
 * platform. The captured photo is downscaled to the same 64px-wide sample the
 * shared thresholds are calibrated for, decoded in pure JS (no native pixel
 * access on Expo Go), and judged on lighting + sharpness only. Framing can't
 * be verified this way, so verdicts cap at "acceptable" — the preview screen
 * is the human framing check.
 *
 * Any checker failure resolves null. The capture UI treats that as unverified:
 * analysis stays blocked, while an explicit answer-only path remains available.
 */
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import { discardTempPhotos } from "@/lib/photos";
import { decode } from "jpeg-js";

import {
  assessImageStats,
  computeImageStats,
  type ImageStats,
  type QualityVerdict,
} from "@pore/shared/scan";

import { base64ToBytes } from "./base64";

/** Matches the sampling width the shared sharpness thresholds assume. */
const STATS_WIDTH = 64;
export const PHOTO_QUALITY_TIMEOUT_MS = 8_000;

export interface PhotoQualityResult {
  verdict: QualityVerdict;
  stats: ImageStats;
}

async function measurePhotoQuality(
  uri: string,
): Promise<PhotoQualityResult | null> {
  try {
    const context = ImageManipulator.manipulate(uri);
    context.resize({ width: STATS_WIDTH });
    const image = await context.renderAsync();
    // compress: 1 — quantization artifacts on a 64px sample would skew the
    // gradient-energy sharpness reading.
    const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 1, base64: true });
    // The encode is consumed as base64 below and the file is never read again.
    // Leaving it behind would strand a face crop in the cache dir forever.
    discardTempPhotos([saved.uri]);
    if (!saved.base64) return null;

    const { data, width, height } = decode(base64ToBytes(saved.base64), {
      useTArray: true,
      formatAsRGBA: true,
    });
    const stats = computeImageStats({
      data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
      width,
      height,
    });
    return { verdict: assessImageStats(stats), stats };
  } catch {
    return null;
  }
}

export async function checkPhotoQuality(
  uri: string,
  timeoutMs: number = PHOTO_QUALITY_TIMEOUT_MS,
): Promise<PhotoQualityResult | null> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      measurePhotoQuality(uri),
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
