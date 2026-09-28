/**
 * Landmark result → FaceMetrics. Structurally typed against MediaPipe's
 * FaceLandmarkerResult so this stays pure and testable without the package.
 *
 * ── Yaw sign convention (THE one place it is defined) ──────────────────────
 * Frames fed to the detector are UN-mirrored (true anatomy): the subject's
 * right cheek appears on the image's left. Positive yaw = subject turned
 * toward their own LEFT = right cheek presented to the camera = nose tip
 * displaced toward image-RIGHT relative to the face-box center.
 *
 * Yaw is estimated geometrically from that nose displacement (asin of the
 * normalized offset). It is coarse but its sign is derivable from first
 * principles — no dependence on MediaPipe's transformation-matrix axis
 * conventions. The bands in steps.ts (32–68°) are wide on purpose.
 * FUTURE VISION-API INTEGRATION POINT: replace with head pose from
 * facialTransformationMatrixes once its sign is calibrated on-device.
 */
import type { FaceMetrics } from "./types";

export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
}

/** Structural subset of MediaPipe's FaceLandmarkerResult. */
export interface LandmarkResultLike {
  faceLandmarks: NormalizedLandmark[][];
}

/** MediaPipe face-mesh nose tip index. */
const NOSE_TIP = 1;
/** Neutral faces carry the nose tip below box center by roughly this share
 * of box height; subtracted so pitch reads ~0 at rest. Advisory only. */
const NOSE_Y_BIAS = 0.08;

export function extractFaceMetrics(result: LandmarkResultLike | null): FaceMetrics | null {
  if (!result) return null;
  const faces = result.faceLandmarks;
  const landmarks = faces[0];
  if (!landmarks) {
    return { faceCount: 0, center: { x: 0.5, y: 0.5 }, widthRatio: 0, yawDeg: 0, pitchDeg: 0 };
  }
  let minX = 1, maxX = 0, minY = 1, maxY = 0;
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const width = maxX - minX;
  const height = maxY - minY;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const nose = landmarks[NOSE_TIP] ?? { x: cx, y: cy, z: 0 };
  const yawRatio = clamp((2 * (nose.x - cx)) / Math.max(width, 1e-6), -1, 1);
  const pitchRatio = clamp(
    (2 * (cy + NOSE_Y_BIAS * height - nose.y)) / Math.max(height, 1e-6),
    -1,
    1,
  );

  return {
    faceCount: faces.length,
    center: { x: cx, y: cy },
    widthRatio: width,
    yawDeg: toDegrees(Math.asin(yawRatio)),
    pitchDeg: toDegrees(Math.asin(pitchRatio)),
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}
