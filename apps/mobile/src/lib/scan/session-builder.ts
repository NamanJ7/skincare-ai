/** Native immediate capture validator and exact-byte submission builder. */
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import {
  createImageFaceDetector,
  type ImageFaceDetector,
} from "react-native-vision-camera-face-detector";

import {
  STEP_ORDER,
  perceptualHashDistance,
  type StepId,
} from "@pore/shared/scan";

import type {
  ScanCaptureArtifact,
  ScanCaptureIdentity,
  ScanCaptureSession,
  ScanShot,
  TimelineOnlyCaptureArtifact,
  ValidatedCaptureArtifact,
} from "../scan-session";
import { analysisResizeWidth } from "./analysis-image";
import { recordCalibrationSample } from "./calibration-log";
import { sha256Bytes } from "./content-digest";
import { mirrorPerceptualHash } from "./pixel-evidence";
import {
  assembleSubmission,
  type CaptureEvaluation,
  type SubmissionResult,
} from "./session-assembly";
import { evaluateStaticPhoto } from "./static-photo-evidence";

export interface CaptureValidationInput extends ScanCaptureIdentity {
  uri: string;
}

let accurateDetector: ImageFaceDetector | null = null;

function getAccurateDetector(): ImageFaceDetector {
  if (!accurateDetector) {
    accurateDetector = createImageFaceDetector({
      performanceMode: "accurate",
      runLandmarks: true,
      runContours: true,
      runClassifications: false,
      minFaceSize: 0.15,
    });
  }
  return accurateDetector;
}

function timelineOnly(
  input: CaptureValidationInput,
  code: string,
  message: string,
  result?: TimelineOnlyCaptureArtifact["result"],
): TimelineOnlyCaptureArtifact {
  return {
    kind: "timeline-only",
    sessionId: input.sessionId,
    stepId: input.stepId,
    captureId: input.captureId,
    capturedAt: input.capturedAt,
    previewPerceptualHash: input.previewPerceptualHash,
    previewFrameId: input.previewFrameId,
    previewHashMirrorApplied: input.previewHashMirrorApplied,
    previewYawDeg: input.previewYawDeg,
    reason: { code, message },
    ...(result ? { result } : {}),
  };
}

/**
 * Compare the yaw the shutter armed on against the yaw measured on the saved
 * still. Same magnitude with opposite signs means the analysis buffer and the
 * camera output disagree on mirroring — the failure mode where guidance goes
 * green and the final pose gate then rejects the shot.
 */
function yawSignAgreement(
  armed: number | null,
  final: number | null,
): "agree" | "inverted" | "unavailable" {
  if (armed == null || final == null) return "unavailable";
  if (!Number.isFinite(armed) || !Number.isFinite(final)) return "unavailable";
  // Near-frontal poses carry no usable sign, so they are not evidence either way.
  if (Math.abs(armed) < 10 || Math.abs(final) < 10) return "unavailable";
  return Math.sign(armed) === Math.sign(final) ? "agree" : "inverted";
}

/**
 * Render the exact analysis JPEG (max 1536 px, 0.9 quality, never upscaled),
 * hash it, and run every strict final gate before the preview is accepted.
 */
export async function buildValidatedCaptureArtifact(
  input: CaptureValidationInput,
  captureSession: ScanCaptureSession,
): Promise<ScanCaptureArtifact> {
  if (
    input.sessionId !== captureSession.sessionId ||
    input.capturedAt < captureSession.startedAt
  ) {
    return timelineOnly(
      input,
      "wrong_session",
      "This photo belongs to an expired scan. Retake it to continue.",
    );
  }

  let detector: ImageFaceDetector;
  try {
    detector = getAccurateDetector();
  } catch {
    return timelineOnly(
      input,
      "unsupported",
      "On-device photo verification isn't available in this build.",
    );
  }

  try {
    const source = await ImageManipulator.manipulate(input.uri).renderAsync();
    let rendered = source;
    const resizeWidth = analysisResizeWidth(source.width);
    if (resizeWidth != null) {
      const context = ImageManipulator.manipulate(input.uri);
      context.resize({ width: resizeWidth });
      rendered = await context.renderAsync();
    }
    const saved = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      // Skin texture is the first thing JPEG quantization removes, and this is
      // the only encode between the sensor and the model.
      compress: 0.95,
      base64: true,
    });
    if (!saved.base64) {
      return timelineOnly(
        input,
        "processing_failed",
        "Pore couldn't prepare this photo. Retake it and try again.",
      );
    }

    const file = new File(saved.uri);
    const bytes = await file.bytes();
    const contentDigest = await sha256Bytes(bytes);
    const frameId = `file:${input.captureId}`;
    const { evidence, result } = await evaluateStaticPhoto(
      saved.uri,
      detector,
      {
        gate: "final",
        sessionId: input.sessionId,
        stepId: input.stepId,
        frameId,
        capturedAt: input.capturedAt,
        captureId: input.captureId,
        contentDigest,
        byteLength: bytes.length,
        previewPerceptualHash: input.previewPerceptualHash,
      },
      saved.width,
      saved.height,
    );

    if (__DEV__) {
      const preview = input.previewPerceptualHash;
      const finalHash = evidence.image?.perceptualHash;
      const previewFinalDistance =
        preview && finalHash
          ? perceptualHashDistance(preview, finalHash)
          : null;
      const alternatePreviewFinalDistance =
        preview && finalHash
          ? perceptualHashDistance(mirrorPerceptualHash(preview), finalHash)
          : null;
      const orientationAgreement =
        previewFinalDistance == null || alternatePreviewFinalDistance == null
          ? ("unavailable" as const)
          : previewFinalDistance === alternatePreviewFinalDistance
            ? ("tie" as const)
            : previewFinalDistance < alternatePreviewFinalDistance
              ? ("metadata" as const)
              : ("alternate" as const);
      const armedYawDeg = input.previewYawDeg ?? null;
      const finalYawDeg = evidence.face?.yawDeg ?? null;
      recordCalibrationSample({
        kind: "final_capture",
        at: input.capturedAt,
        stepId: input.stepId,
        previewFrameId: input.previewFrameId ?? null,
        previewHashMirrorApplied: input.previewHashMirrorApplied ?? null,
        previewPerceptualHash: preview ?? null,
        finalPerceptualHash: finalHash ?? null,
        previewFinalDistance,
        alternatePreviewFinalDistance,
        orientationAgreement,
        armedYawDeg,
        finalYawDeg,
        yawSignAgreement: yawSignAgreement(armedYawDeg, finalYawDeg),
        blockingIssues: result.blockingIssues.map((issue) => issue.code),
      });
    }

    if (!result.passed) {
      return timelineOnly(
        input,
        result.correctiveAction?.code ?? "capture_quality",
        result.correctiveAction?.message ??
          "This photo did not pass Pore's analysis checks. Retake it.",
        result,
      );
    }

    const artifact: ValidatedCaptureArtifact = {
      kind: "verified",
      sessionId: input.sessionId,
      stepId: input.stepId,
      captureId: input.captureId,
      capturedAt: input.capturedAt,
      previewPerceptualHash: input.previewPerceptualHash,
      previewFrameId: input.previewFrameId,
      previewHashMirrorApplied: input.previewHashMirrorApplied,
      analysisUri: saved.uri,
      contentDigest,
      byteLength: bytes.length,
      evidence,
      result,
    };
    return artifact;
  } catch (cause) {
    return timelineOnly(
      input,
      "processing_failed",
      cause instanceof Error
        ? cause.message
        : "Pore couldn't verify this photo. Retake it and try again.",
    );
  }
}

/** Re-read the already-verified JPEGs and prove their exact digests again. */
export async function buildAnalysisSubmission(
  shots: ScanShot[],
  captureSession: ScanCaptureSession,
): Promise<SubmissionResult> {
  if (shots.length !== STEP_ORDER.length) {
    return {
      ok: false,
      code: "incomplete_scan",
      message: "Three verified photos are required for a scan.",
    };
  }
  const evaluations: CaptureEvaluation[] = [];

  try {
    for (const stepId of STEP_ORDER) {
      const shot = shots.find(
        (candidate) => candidate.artifact.stepId === stepId,
      );
      if (!shot) {
        return {
          ok: false,
          code: "incomplete_scan",
          message: `The ${stepId} photo is missing.`,
          stepId,
        };
      }
      const artifact = shot.artifact;
      if (artifact.kind !== "verified") {
        return {
          ok: false,
          code: artifact.reason.code,
          message: artifact.reason.message,
          stepId,
        };
      }
      if (
        artifact.sessionId !== captureSession.sessionId ||
        artifact.capturedAt < captureSession.startedAt
      ) {
        return {
          ok: false,
          code: "wrong_session",
          message: `The ${stepId} photo belongs to an expired scan. Retake it.`,
          stepId,
        };
      }

      const file = new File(artifact.analysisUri);
      const [bytes, base64] = await Promise.all([file.bytes(), file.base64()]);
      const digest = await sha256Bytes(bytes);
      if (digest !== artifact.contentDigest) {
        return {
          ok: false,
          code: "digest_mismatch",
          message: `The ${stepId} photo changed after verification. Retake it.`,
          stepId,
        };
      }
      evaluations.push({
        stepId,
        captureId: artifact.captureId,
        frameId: artifact.evidence.provenance.frameId,
        capturedAt: artifact.capturedAt,
        source: "camera",
        base64,
        contentDigest: digest,
        evidence: artifact.evidence,
        result: artifact.result,
      });
    }
    // Inside the try on purpose: assembleSubmission runs the session validator
    // and the comparison metadata build, either of which can throw. Escaping
    // here would reject the caller's promise instead of returning a
    // SubmissionResult, and review.tsx has no other way to unwind.
    return assembleSubmission(
      captureSession.sessionId,
      captureSession.startedAt,
      evaluations,
    );
  } catch (cause) {
    return {
      ok: false,
      code: "processing_failed",
      message:
        cause instanceof Error
          ? cause.message
          : "Verified photos could not be prepared.",
    };
  }
}

export type { StepId };
