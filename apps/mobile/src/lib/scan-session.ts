/**
 * In-memory hand-off for the scan flow. Base64 images must never enter the
 * persisted onboarding context (it write-throughs to AsyncStorage on every
 * update), so capture/review stash them here and generating claims them once.
 */
import type { PlanImage, PlanInput } from "./api";
import type {
  FrameEvidence,
  QualityResult,
  StepId,
} from "@pore/shared/scan";
import type { ScanComparisonMetadata } from "./scan/comparison-metadata";

export interface ScanCaptureSession {
  sessionId: string;
  startedAt: number;
}

export interface ScanCaptureIdentity {
  sessionId: string;
  stepId: StepId;
  captureId: string;
  capturedAt: number;
  previewPerceptualHash?: string;
  previewFrameId?: string;
  previewHashMirrorApplied?: boolean;
  /** Yaw of the armed live frame, for the yaw-convention calibration log. */
  previewYawDeg?: number;
}

/** Exact temporary JPEG and strict result accepted for model analysis. */
export interface ValidatedCaptureArtifact extends ScanCaptureIdentity {
  kind: "verified";
  analysisUri: string;
  contentDigest: string;
  byteLength: number;
  evidence: FrameEvidence;
  result: QualityResult;
}

/** A photo that may be kept for the timeline but can never enter analysis. */
export interface TimelineOnlyCaptureArtifact extends ScanCaptureIdentity {
  kind: "timeline-only";
  reason: { code: string; message: string };
  result?: QualityResult;
}

export type ScanCaptureArtifact =
  | ValidatedCaptureArtifact
  | TimelineOnlyCaptureArtifact;

export interface ScanShot {
  /** Original still shown in review and optionally copied to the timeline. */
  uri: string;
  artifact: ScanCaptureArtifact;
}

/** A quality-validated submission ready for the fail-closed analysis endpoint. */
export interface PendingSubmission {
  session: PlanInput["scanSession"];
  images: PlanImage[];
}

/** Why a submission couldn't be assembled — carried so generating can set an
 * honest, reason-specific answer-based status instead of a silent fallback. */
export interface ScanBuildFailure {
  code: string;
  message: string;
  stepId?: "front" | "right" | "left";
}

/**
 * Everything generating needs to resolve one AnalysisStatus for this attempt:
 * the validated submission (or null), the persisted photo names for the
 * timeline, and — when no submission — why it couldn't be built.
 */
export interface PendingScanAttempt {
  submission: PendingSubmission | null;
  photoNames: string[];
  comparisonMetadata?: ScanComparisonMetadata;
  buildFailure?: ScanBuildFailure;
}

let pending: PendingScanAttempt | null = null;
let captureSession: ScanCaptureSession | null = null;

export function beginScanCaptureSession(
  sessionId: string,
  now: number = Date.now(),
): ScanCaptureSession {
  captureSession = { sessionId, startedAt: now };
  return captureSession;
}

export function getScanCaptureSession(): ScanCaptureSession | null {
  return captureSession;
}

export function setPendingScanAttempt(attempt: PendingScanAttempt): void {
  pending = attempt;
}

/** Read-and-clear, so images never outlive the generation call. */
export function takePendingScanAttempt(): PendingScanAttempt | null {
  const out = pending;
  pending = null;
  return out;
}

/** Raw still plus its immediate, discriminated validation artifact. */
let shots: ScanShot[] = [];

export function saveShots(next: ScanShot[]): void {
  shots = next;
}

export function getShots(): ScanShot[] {
  return shots;
}

/**
 * File disposer for discarded captures.
 *
 * Registered rather than imported so this module stays free of native
 * dependencies — the same pattern as setStorageMirror and setAnalyticsSink.
 * expo-file-system cannot be loaded outside the app runtime, and this module
 * is otherwise pure in-memory state that unit tests depend on.
 */
export type ScanPhotoDisposer = (uris: readonly (string | undefined)[]) => void;

let disposePhotos: ScanPhotoDisposer | undefined;

export function setScanPhotoDisposer(next: ScanPhotoDisposer | undefined): void {
  disposePhotos = next;
}

/** Every temp file the current shots own: the raw still and its analysis encode. */
function shotFileUris(): (string | undefined)[] {
  return shots.flatMap((shot) => [
    shot.uri,
    shot.artifact.kind === "verified" ? shot.artifact.analysisUri : undefined,
  ]);
}

/**
 * Discard the in-memory shots *and* the files behind them.
 *
 * Every scan-flow exit already funnels through here — retake, abandon, and
 * completion — so this is the one place that reliably reaches the
 * full-resolution stills and the analysis encodes the camera and
 * ImageManipulator leave in the cache dir. Without it those face photos
 * outlived the scan, outlived "Delete my data", and were bounded only by
 * whenever iOS decided to reclaim cache space.
 */
export function clearShots(): void {
  const uris = shotFileUris();
  shots = [];
  captureSession = null;
  try {
    disposePhotos?.(uris);
  } catch {
    // Disposal is best-effort by contract; never fail a scan exit on it.
  }
}
