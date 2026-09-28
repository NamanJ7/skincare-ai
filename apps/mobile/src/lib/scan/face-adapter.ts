/**
 * Native face detector → shared FaceMetrics.
 *
 * The MediaPipe web path derives metrics from a mesh (see
 * @pore/shared/scan face-metrics.ts); on native we get MLKit's bounding box +
 * Euler head angles from react-native-vision-camera-face-detector instead. This
 * adapter maps that into the SAME FaceMetrics contract so the identical quality
 * ladder / capture machine runs on both platforms.
 *
 * Coordinate space: the detector runs with `autoMode` on, so `bounds` are
 * already scaled to the on-screen preview using the view's width/height — the
 * same normalized [0..1] space the shared thresholds assume. Center and
 * width-ratio are therefore mirror-invariant and safe.
 *
 * ── Yaw sign (the one on-device calibration point) ─────────────────────────
 * Shared convention (steps.ts / quality-config.ts): POSITIVE yaw presents the
 * subject's RIGHT cheek to the camera; the "Right cheek" step accepts +30..+64°.
 * MLKit reports head yaw directly, but its sign relative to a MIRRORED front
 * preview is device/version dependent. It is isolated in YAW_SIGN so a single
 * flip fixes it if calibration shows the cheeks reversed (the "Right cheek"
 * step should turn green when the user shows their right cheek). Pitch is not
 * read by the quality ladder today, so its sign is cosmetic.
 */
import type { FaceMetrics } from "@pore/shared/scan";

import {
  NATIVE_PITCH_SIGN,
  NATIVE_YAW_SIGN,
  normalizeNativePitch,
  normalizeNativeYaw,
} from "./native-pose";

/** Flip to -1 if on-device the right/left cheek steps are inverted. */
export const YAW_SIGN = NATIVE_YAW_SIGN;
export const PITCH_SIGN = NATIVE_PITCH_SIGN;

/** Structural subset of the detector's Face — kept dependency-free + testable. */
export interface DetectedFaceLike {
  bounds: { x: number; y: number; width: number; height: number };
  yawAngle: number;
  pitchAngle: number;
}

const NO_FACE: FaceMetrics = {
  faceCount: 0,
  center: { x: 0.5, y: 0.5 },
  widthRatio: 0,
  yawDeg: 0,
  pitchDeg: 0,
};

/**
 * Reduce a detector callback to FaceMetrics. The largest box is treated as the
 * subject (front-camera selfies have exactly one intended face); faceCount is
 * still reported so the "only one face" rung can fire.
 */
export function faceMetricsFromDetections(
  faces: DetectedFaceLike[],
  viewWidth: number,
  viewHeight: number,
  sourceIsMirrored: boolean = false,
): FaceMetrics {
  if (faces.length === 0 || viewWidth <= 0 || viewHeight <= 0) return NO_FACE;

  const subject = faces.reduce((a, b) => (b.bounds.width > a.bounds.width ? b : a));
  const { x, y, width, height } = subject.bounds;

  return {
    faceCount: faces.length,
    center: {
      x: clamp01((x + width / 2) / viewWidth),
      y: clamp01((y + height / 2) / viewHeight),
    },
    widthRatio: clamp01(width / viewWidth),
    yawDeg: normalizeNativeYaw(subject.yawAngle, sourceIsMirrored),
    pitchDeg: normalizeNativePitch(subject.pitchAngle),
  };
}

function clamp01(v: number): number {
  return Math.min(Math.max(v, 0), 1);
}
