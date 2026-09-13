/** Web capture is intentionally timeline-only until it has a strict validator. */
import type {
  ScanCaptureArtifact,
  ScanCaptureIdentity,
  ScanCaptureSession,
  ScanShot,
} from "../scan-session";
import type { SubmissionResult } from "./session-assembly";

export interface CaptureValidationInput extends ScanCaptureIdentity {
  uri: string;
}

export async function buildValidatedCaptureArtifact(
  input: CaptureValidationInput,
  _captureSession: ScanCaptureSession,
): Promise<ScanCaptureArtifact> {
  return {
    kind: "timeline-only",
    sessionId: input.sessionId,
    stepId: input.stepId,
    captureId: input.captureId,
    capturedAt: input.capturedAt,
    previewPerceptualHash: input.previewPerceptualHash,
    previewFrameId: input.previewFrameId,
    previewHashMirrorApplied: input.previewHashMirrorApplied,
    reason: {
      code: "web_timeline_only",
      message:
        "Web photos are saved for your timeline only. Use the iOS app for a verified photo analysis.",
    },
  };
}

export async function buildAnalysisSubmission(
  _shots: ScanShot[],
  _captureSession: ScanCaptureSession,
): Promise<SubmissionResult> {
  return {
    ok: false,
    code: "web_timeline_only",
    message:
      "Web photos are timeline-only. Continue with an answer-based routine.",
  };
}
