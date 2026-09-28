import type { Face } from "react-native-vision-camera-face-detector";

import type {
  FacialPixelEvidence,
  FacialSamplingGeometry,
  PixelEllipse,
  PixelPoint,
  PixelRect,
} from "./pixel-evidence";
import { normalizeNativePitch, normalizeNativeYaw } from "./native-pose";

/** Plain, serializable subset of ML Kit's native Face hybrid object. */
export interface NativeFaceObservation {
  bounds: PixelRect;
  frameWidth: number;
  frameHeight: number;
  centerX: number;
  centerY: number;
  widthRatio: number;
  heightRatio: number;
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
  landmarkCoverage: number;
  samplingGeometry?: FacialSamplingGeometry;
}

export interface NativeFramePacket {
  /** Monotonic camera-host timestamp plus dimensions; never a React render ID. */
  frameId: string;
  timestamp: number;
  width: number;
  height: number;
  /** Raw pixels need this horizontal transform to match the camera output. */
  isMirrored?: boolean;
  faces: NativeFaceObservation[];
  pixels: FacialPixelEvidence | null;
}

export interface NativeMotionObservation {
  sampleIntervalMs: number;
  centerDelta: number;
  sizeDelta: number;
  yawDeltaDeg: number;
  pitchDeltaDeg: number;
  rollDeltaDeg: number;
  perceptualSimilarity: number;
}

function landmarkCoverage(face: Face): number {
  "worklet";
  const marks = face.landmarks;
  if (marks == null) return 0;
  let count = 0;
  if (marks.LEFT_CHEEK != null) count += 1;
  if (marks.RIGHT_CHEEK != null) count += 1;
  if (marks.LEFT_EYE != null) count += 1;
  if (marks.RIGHT_EYE != null) count += 1;
  if (marks.NOSE_BASE != null) count += 1;
  if (marks.MOUTH_LEFT != null) count += 1;
  if (marks.MOUTH_RIGHT != null) count += 1;
  if (marks.MOUTH_BOTTOM != null) count += 1;
  return count / 8;
}

function finitePoint(point: PixelPoint | undefined): PixelPoint | undefined {
  "worklet";
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    return undefined;
  }
  return { x: point.x, y: point.y };
}

function ellipse(
  center: PixelPoint,
  radiusX: number,
  radiusY: number,
  role: PixelEllipse["role"],
): PixelEllipse {
  "worklet";
  return { center, radiusX, radiusY, role };
}

function contourEllipse(
  points: PixelPoint[] | undefined,
  role: PixelEllipse["role"],
  padX: number,
  padY: number,
): PixelEllipse | undefined {
  "worklet";
  if (!points || points.length === 0) return undefined;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const raw of points) {
    const point = finitePoint(raw);
    if (!point) continue;
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) return undefined;
  return ellipse(
    { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
    (maxX - minX) / 2 + padX,
    (maxY - minY) / 2 + padY,
    role,
  );
}

function facialSamplingGeometry(face: Face): FacialSamplingGeometry | undefined {
  "worklet";
  const bounds = face.bounds;
  const marks = face.landmarks;
  if (!marks) return undefined;
  const width = bounds.width;
  const height = bounds.height;
  const leftEye = finitePoint(marks.LEFT_EYE);
  const rightEye = finitePoint(marks.RIGHT_EYE);
  const leftCheek = finitePoint(marks.LEFT_CHEEK);
  const rightCheek = finitePoint(marks.RIGHT_CHEEK);
  const nose = finitePoint(marks.NOSE_BASE);
  const mouthLeft = finitePoint(marks.MOUTH_LEFT);
  const mouthRight = finitePoint(marks.MOUTH_RIGHT);
  const mouthBottom = finitePoint(marks.MOUTH_BOTTOM);
  if (!leftEye || !rightEye || !leftCheek || !rightCheek || !nose) {
    return undefined;
  }

  const eyeMidX = (leftEye.x + rightEye.x) / 2;
  const eyeMidY = (leftEye.y + rightEye.y) / 2;
  const skinRegions: PixelEllipse[] = [
    // Forehead begins below the estimated hairline and ends above the brows.
    ellipse(
      { x: eyeMidX, y: bounds.y + height * 0.2 },
      width * 0.23,
      height * 0.09,
      "forehead",
    ),
    ellipse(leftCheek, width * 0.16, height * 0.13, "left"),
    ellipse(rightCheek, width * 0.16, height * 0.13, "right"),
    ellipse(
      {
        x: mouthBottom?.x ?? eyeMidX,
        y: (mouthBottom?.y ?? bounds.y + height * 0.72) + height * 0.08,
      },
      width * 0.15,
      height * 0.075,
      "chin",
    ),
  ];

  const excludedRegions: PixelEllipse[] = [
    ellipse(leftEye, width * 0.12, height * 0.075, "exclude"),
    ellipse(rightEye, width * 0.12, height * 0.075, "exclude"),
    ellipse(nose, width * 0.1, height * 0.13, "exclude"),
  ];
  if (mouthLeft && mouthRight) {
    excludedRegions.push(
      ellipse(
        {
          x: (mouthLeft.x + mouthRight.x) / 2,
          y: mouthBottom?.y ?? (mouthLeft.y + mouthRight.y) / 2,
        },
        Math.max(width * 0.12, Math.abs(mouthRight.x - mouthLeft.x) * 0.65),
        height * 0.075,
        "exclude",
      ),
    );
  }

  const contours = face.contours;
  const contourGroups = [
    contours?.LEFT_EYE,
    contours?.RIGHT_EYE,
    contours?.LEFT_EYEBROW_TOP,
    contours?.LEFT_EYEBROW_BOTTOM,
    contours?.RIGHT_EYEBROW_TOP,
    contours?.RIGHT_EYEBROW_BOTTOM,
    contours?.NOSE_BRIDGE,
    contours?.NOSE_BOTTOM,
    contours?.UPPER_LIP_TOP,
    contours?.UPPER_LIP_BOTTOM,
    contours?.LOWER_LIP_TOP,
    contours?.LOWER_LIP_BOTTOM,
  ];
  for (const group of contourGroups) {
    const excluded = contourEllipse(
      group,
      "exclude",
      width * 0.025,
      height * 0.018,
    );
    if (excluded) excludedRegions.push(excluded);
  }

  const faceContour = contours?.FACE
    ?.map(finitePoint)
    .filter((point): point is PixelPoint => point != null);
  return {
    skinRegions,
    excludedRegions,
    ...(faceContour && faceContour.length >= 3 ? { faceContour } : {}),
  };
}

/**
 * Convert the native hybrid object while it is valid on the camera thread.
 *
 * `sourceIsMirrored` describes the pixels this face was detected in, so yaw
 * lands in the camera-output convention the shared pose bands assume — see
 * native-pose.ts. Live analysis buffers and the saved still can differ here.
 */
export function serializeFace(
  face: Face,
  sourceIsMirrored: boolean = false,
): NativeFaceObservation | null {
  "worklet";
  const frameWidth = face.frameWidth;
  const frameHeight = face.frameHeight;
  const bounds = face.bounds;
  if (
    !Number.isFinite(frameWidth) ||
    !Number.isFinite(frameHeight) ||
    frameWidth <= 0 ||
    frameHeight <= 0 ||
    !Number.isFinite(bounds.x) ||
    !Number.isFinite(bounds.y) ||
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height) ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    return null;
  }

  const samplingGeometry = facialSamplingGeometry(face);
  return {
    bounds: {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    },
    frameWidth,
    frameHeight,
    centerX: (bounds.x + bounds.width / 2) / frameWidth,
    centerY: (bounds.y + bounds.height / 2) / frameHeight,
    widthRatio: bounds.width / frameWidth,
    heightRatio: bounds.height / frameHeight,
    yawDeg: normalizeNativeYaw(face.yawAngle, sourceIsMirrored),
    pitchDeg: normalizeNativePitch(face.pitchAngle),
    // Mirroring inverts roll direction too, but the gate is a symmetric
    // magnitude band (|roll| <= maxAbsRollDeg), so the sign never reaches it.
    rollDeg: face.rollAngle,
    landmarkCoverage: landmarkCoverage(face),
    ...(samplingGeometry ? { samplingGeometry } : {}),
  };
}

/** Derive frame-to-frame motion without deciding whether it passes. */
export function deriveMotionObservation(
  previous: NativeFramePacket | null,
  current: NativeFramePacket,
  perceptualSimilarity: number,
): NativeMotionObservation | null {
  if (
    previous == null ||
    previous.faces.length !== 1 ||
    current.faces.length !== 1
  )
    return null;
  const before = previous.faces[0];
  const after = current.faces[0];
  const dx = after.centerX - before.centerX;
  const dy = after.centerY - before.centerY;
  return {
    sampleIntervalMs: Math.max(
      0,
      (current.timestamp - previous.timestamp) * 1000,
    ),
    centerDelta: Math.sqrt(dx * dx + dy * dy),
    sizeDelta: Math.abs(after.widthRatio - before.widthRatio),
    yawDeltaDeg: Math.abs(after.yawDeg - before.yawDeg),
    pitchDeltaDeg: Math.abs(after.pitchDeg - before.pitchDeg),
    rollDeltaDeg: Math.abs(after.rollDeg - before.rollDeg),
    perceptualSimilarity,
  };
}

export function isGenuinelyNewFrame(
  previous: NativeFramePacket | null,
  current: NativeFramePacket,
): boolean {
  return (
    Number.isFinite(current.timestamp) &&
    current.timestamp > 0 &&
    current.frameId.length > 0 &&
    (previous == null ||
      (current.frameId !== previous.frameId &&
        current.timestamp > previous.timestamp))
  );
}
