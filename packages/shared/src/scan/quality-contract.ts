import type { StepId } from "./types";

export type QualityGate = "live" | "final" | "session";

export interface NormalizedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface QualityProvenance {
  gate: QualityGate;
  source: "camera" | "upload";
  sessionId: string;
  captureId?: string;
  frameId: string;
  capturedAt: number;
  stepId: StepId;
  /** SHA-256 hex of the exact final bytes accepted/submitted. */
  contentDigest?: string;
  /** 64-bit difference hash (16 lowercase hexadecimal characters). */
  perceptualHash?: string;
  /** Live frame hash that armed capture, used to detect a stale final still. */
  previewPerceptualHash?: string;
}

export interface FaceEvidence {
  faceCount: number;
  box: NormalizedBox | null;
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
  /** Share of required facial bounds/landmarks visible inside the image. */
  completeness: number;
  /** Estimated blocked share of forehead, cheeks, chin, and jaw. */
  occlusionRatio: number;
}

export interface ImageEvidence {
  width: number;
  height: number;
  pixelCount: number;
  /**
   * Dimensions of the still this camera will capture, when that differs from
   * the frame measured here. Native guidance runs on a low-resolution analysis
   * stream while the shutter produces a much larger photo, so the live
   * resolution gate has to judge the still, not the stream. Omitted when the
   * measured frame IS the future capture (browser) or on a final gate, where
   * `width`/`height` already describe the real decoded bytes.
   */
  stillWidth?: number;
  stillHeight?: number;
  byteLength?: number;
  decodeValid: boolean;
  blankOrUniform: boolean;
  faceLumaMean: number;
  faceLumaP10: number;
  faceLumaP90: number;
  faceLumaStdDev: number;
  faceContrast: number;
  shadowClipping: number;
  highlightClipping: number;
  glareRatio: number;
  skinSharpness: number;
  skinLaplacianVariance: number;
  leftFaceLuma: number;
  rightFaceLuma: number;
  lightingAsymmetry: number;
  backgroundLuma: number;
  backlightDelta: number;
  perceptualHash: string;
}

export interface MotionEvidence {
  pixelMotion: number;
  landmarkMotion: number;
  stable: boolean;
}

export interface FrameEvidence {
  provenance: QualityProvenance;
  face: FaceEvidence | null;
  image: ImageEvidence | null;
  /** Required for live validation; final sharpness handles shutter motion. */
  motion?: MotionEvidence | null;
}

export type QualityMetricName =
  | "integrity"
  | "resolution"
  | "faceDetection"
  | "singleFace"
  | "faceCompleteness"
  | "faceSize"
  | "faceCentering"
  | "sharpness"
  | "motion"
  | "exposure"
  | "clipping"
  | "lightingUniformity"
  | "backlighting"
  | "textureVisibility"
  | "yaw"
  | "pitch"
  | "roll"
  | "targetPose"
  | "occlusion"
  | "sessionCompleteness"
  | "sessionIdentity"
  | "sessionFreshness"
  | "sessionDuplicates"
  | "poseSeparation";

export interface QualityMetric {
  passed: boolean;
  score: number;
  confidence: number;
  value?: number | string | boolean;
  threshold?: number | string;
  detail?: string;
}

export type QualityIssueCode =
  | "invalid_frame"
  | "blank_or_covered"
  | "corrupt_image"
  /**
   * Live-only: the frame decoded, but no facial-skin pixels could be sampled
   * from it. Distinct from `corrupt_image` because the fix is the user's
   * framing, not the file — telling someone their photo could not be read when
   * the camera is working is guidance they cannot act on.
   */
  | "skin_not_measurable"
  | "low_resolution"
  | "stale_image"
  | "wrong_session"
  | "preview_mismatch"
  | "no_face"
  | "multiple_faces"
  | "face_out_of_frame"
  | "too_far"
  | "too_close"
  | "wrong_pose"
  | "turn_more"
  | "turn_back"
  | "pitch"
  | "roll"
  | "occluded"
  | "backlit"
  | "too_dark"
  | "too_bright"
  | "glare"
  | "uneven_lighting"
  | "low_texture"
  | "blurry"
  | "lens_dirty"
  | "motion"
  | "stability_incomplete"
  | "missing_pose"
  | "duplicate_image"
  | "pose_not_distinct";

export interface QualityIssue {
  code: QualityIssueCode;
  metric: QualityMetricName;
  severity: "blocking" | "warning";
  detail: string;
}

export interface CorrectiveAction {
  code: QualityIssueCode;
  message: string;
}

export interface QualityResult {
  passed: boolean;
  overallScore: number;
  confidence: number;
  metrics: Partial<Record<QualityMetricName, QualityMetric>>;
  blockingIssues: QualityIssue[];
  warnings: QualityIssue[];
  correctiveAction: CorrectiveAction | null;
  provenance: QualityProvenance;
  configVersion: string;
}

export interface AcceptedCapture {
  sessionId: string;
  captureId: string;
  frameId: string;
  stepId: StepId;
  source: "camera" | "upload";
  capturedAt: number;
  contentDigest: string;
  perceptualHash: string;
  width: number;
  height: number;
  yawDeg: number;
  quality: QualityResult;
}

export interface ScanSession {
  sessionId: string;
  startedAt: number;
  captures: Partial<Record<StepId, AcceptedCapture>>;
}

export interface AnalysisReadySession extends ScanSession {
  analysisReady: true;
  validation: QualityResult;
}

export interface QualityCheckResult {
  metrics: Partial<Record<QualityMetricName, QualityMetric>>;
  issues: QualityIssue[];
  warnings?: QualityIssue[];
}
