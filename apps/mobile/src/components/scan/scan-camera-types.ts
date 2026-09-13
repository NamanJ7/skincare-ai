/**
 * Contract for the platform-split scan camera surface. capture.tsx renders
 * <ScanCamera> and stays platform-neutral: web resolves ScanCamera.web.tsx
 * (expo-camera + MediaPipe), native resolves ScanCamera.tsx (vision-camera +
 * MLKit face detector). Both drive the SAME shared guidance brain and report
 * the same LiveGuidance snapshots + capture URIs upward.
 */
import type { StepConfig } from "@pore/shared/scan";

import type { LiveGuidance } from "@/lib/scan/live-guidance-types";

export interface CaptureMeta {
  /** Identity assigned when the shutter is triggered, before file I/O resolves. */
  captureId: string;
  capturedAt: number;
  /** Hash from the fresh live frame that armed or immediately preceded capture. */
  previewPerceptualHash?: string;
  /** Development calibration metadata for tracing the live/final pair. */
  previewFrameId?: string;
  /** True when frame metadata required mirroring the raw live hash. */
  previewHashMirrorApplied?: boolean;
  /** Yaw of the armed live frame, for the yaw-convention calibration log. */
  previewYawDeg?: number;
}

export interface ScanCameraProps {
  step: StepConfig;
  /** Any change fully resets the capture machine (step advance / retake). */
  resetKey: string | number;
  /** False pauses guidance/auto-capture (e.g. the instant after a shot). */
  active: boolean;
  /** Fires once the preview is streaming. */
  onReady?: () => void;
  /** Latest guidance snapshot for the overlay + instruction line. */
  onGuidance?: (guidance: LiveGuidance) => void;
  /** Recoverable capture failures or camera-session failures for user-facing UI. */
  onError?: (error: ScanCameraError) => void;
  /** A captured still (file:// URI) — from the shutter OR auto-capture. */
  onCapture: (uri: string, meta: CaptureMeta) => void;
}

export interface ScanCameraError {
  kind: "capture" | "session";
  message: string;
}

export interface ScanCameraHandle {
  /** Start a manual capture; false means no safe frame was available. */
  capture: () => boolean;
}
