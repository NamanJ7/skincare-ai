/**
 * Contract between the capture screen and the platform-split live-guidance
 * hook (use-live-guidance.ts native stub / .web.ts MediaPipe loop). Platform
 * neutral — no DOM or MediaPipe imports here.
 */
import type { RefObject } from "react";

import type {
  QualityCode,
  QualityVerdict,
  StepConfig,
} from "@pore/shared/scan";

/** Oval + instruction styling states, mirroring the web FaceGuideOverlay. */
export type GuideState = "searching" | "adjust" | "good";

export type DetectorStatus = "loading" | "ready" | "unavailable";

export type LiveCheckState = "waiting" | "pass" | "adjust";

export interface LiveQualityStatus {
  face: LiveCheckState;
  framing: LiveCheckState;
  angle: LiveCheckState;
  light: LiveCheckState;
  sharpness: LiveCheckState;
}

export interface LiveGuidanceDebug {
  phase: string;
  rawVerdict: Pick<QualityVerdict, "code" | "level" | "readyForAutoCapture">;
  stable: boolean;
  faceCount: number;
  yawDeg: number | null;
  pitchDeg: number | null;
  widthRatio: number | null;
  center: { x: number; y: number } | null;
  packetAgeMs: number | null;
  frameMirrored: boolean | null;
  lumaP10: number | null;
  lumaP90: number | null;
  shadowClipping: number | null;
  highlightClipping: number | null;
  glareRatio: number | null;
  gradientEnergy: number | null;
  laplacianVariance: number | null;
  backlightDelta: number | null;
  cheekLumaDifference: number | null;
  overrideCode: QualityCode | null;
  armedHash: string | null;
  evidenceError: string | null;
}

export interface LiveGuidanceOptions {
  /** Wrapper View around CameraView; on web its DOM node contains the <video>. */
  containerRef: RefObject<unknown>;
  /** From CameraView onCameraReady — the loop waits for it. */
  cameraReady: boolean;
  step: StepConfig;
  /** Any change fully resets the capture machine (step advance, retake). */
  resetKey: string | number;
  /** False pauses the loop (e.g. while the shot preview is showing). */
  active: boolean;
  /** Auto-capture trigger; fires at most once per resetKey. */
  onAutoCapture: () => void;
}

export interface LiveGuidance {
  /** False = no live detector on this platform; UI shows static guidance. */
  enabled: boolean;
  detectorStatus: DetectorStatus;
  /** Damped feedback code for the instruction line (null before first frame). */
  code: QualityCode | null;
  /** More specific correction from the strict shared gate, when available. */
  instruction?: string | null;
  guideState: GuideState;
  /** 3..1 during the auto-capture countdown, else null. */
  countdown: number | null;
  /** Manual shutter is safe only when a fresh, quality-passing frame exists. */
  manualCaptureReady: boolean;
  /** Quiet status rail; every value comes from the current packet's metrics. */
  status?: LiveQualityStatus;
  /** Development-only evidence diagnostics; omitted in production. */
  debug?: LiveGuidanceDebug;
}

export const DISABLED_GUIDANCE: LiveGuidance = {
  enabled: false,
  detectorStatus: "unavailable",
  code: null,
  guideState: "searching",
  countdown: null,
  manualCaptureReady: false,
};
