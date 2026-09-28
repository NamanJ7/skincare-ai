/**
 * Core types for the guided skin-scan flow, shared by web and mobile.
 * Everything in @pore/shared/scan is pure and DOM-free so it can be
 * unit-tested in Node and bundled for React Native.
 */

export type StepId = "front" | "right" | "left";

export interface StepConfig {
  id: StepId;
  index: 0 | 1 | 2;
  /** Short chip label, e.g. "Right cheek". */
  label: string;
  /** Main instruction shown above the preview. */
  title: string;
  /** Supporting instruction. */
  hint: string;
  guide: "front" | "side";
  /**
   * Direction the guide arrow points ON SCREEN in the mirrored live preview.
   * The preview mirrors like a mirror, so this matches the direction the user
   * turns their own head ("turn left" → arrow points screen-left).
   */
  screenDirection?: "left" | "right";
  /**
   * Acceptable head yaw in degrees. Sign convention (see face-metrics.ts):
   * positive yaw = head turned toward the subject's LEFT = right cheek shown.
   */
  yaw: { min: number; max: number };
  /** Acceptable face-box width as a fraction of frame width. */
  faceWidthBand: { min: number; max: number };
  /** How far the face center may drift from frame center (normalized). */
  centerTolerance: { x: number; y: number };
}

/** Derived per-frame face measurements (un-mirrored frame space). */
export interface FaceMetrics {
  faceCount: number;
  /** Normalized [0..1] center of the face bounding box. */
  center: { x: number; y: number };
  /** Face bounding-box width / frame width. */
  widthRatio: number;
  /**
   * Head yaw in degrees. Positive = subject turned toward their own left,
   * presenting their RIGHT cheek to the camera. See face-metrics.ts.
   */
  yawDeg: number;
  /** Positive = looking up. */
  pitchDeg: number;
}

/** Lightweight exposure/sharpness stats from a downscaled frame sample. */
export interface ImageStats {
  /** Mean luma 0..255 over the sampled region. */
  lumaMean: number;
  /** Fraction of sampled pixels at/above 250 (blown highlights). */
  clippedHighlights: number;
  /** Fraction of sampled pixels at/below 8 (crushed shadows). */
  clippedShadows: number;
  /** Mean squared luma gradient — higher is sharper. Resolution-dependent;
   * thresholds are calibrated for the 64px-wide sampling canvas. */
  sharpness: number;
}

/** One instruction at a time — first failing rung of the priority ladder. */
export type QualityCode =
  | "no_face"
  | "multiple_faces"
  | "out_of_frame"
  | "too_close"
  | "too_far"
  | "too_dark"
  | "too_bright"
  | "blurry"
  | "face_forward" // front step: head is turned, should face straight
  | "turn_more" // side steps: not turned enough
  | "turn_back" // side steps: turned too far
  | "turn_other_way" // side steps: turned in the wrong direction
  | "occluded"
  | "ok";

export interface QualityVerdict {
  /**
   * good: auto-capture may arm. acceptable: capture allowed, gentle note.
   * blocked: recommend retake at review (user can still "Use anyway").
   */
  level: "good" | "acceptable" | "blocked";
  code: QualityCode;
  readyForAutoCapture: boolean;
}
