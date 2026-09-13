/**
 * Pure assembly of a quality-validated analysis submission.
 *
 * Takes the per-capture final-gate evaluations (produced by session-builder on
 * native, where the detector + pixels live) and turns them into the exact
 * `ScanSession` + digest-bound `PlanImage[]` the server's fail-closed guard
 * requires. This half is pure and DOM/native-free so the binding + validation
 * logic is unit-tested without a camera.
 *
 * Fail-closed by construction: any capture that didn't pass its final gate, or
 * a session that doesn't pass `validateScanSession`, returns an honest failure
 * with the corrective message — never a partial or fabricated submission.
 */
import {
  STEP_ORDER,
  validateScanSession,
  type AcceptedCapture,
  type FrameEvidence,
  type QualityResult,
  type ScanSession,
  type StepId,
} from "@pore/shared/scan";

import type { PlanImage } from "../api";
import {
  buildScanComparisonMetadata,
  type ScanComparisonMetadata,
} from "./comparison-metadata";

/** One captured pose, already measured by the native final gate. */
export interface CaptureEvaluation {
  stepId: StepId;
  captureId: string;
  frameId: string;
  capturedAt: number;
  source: "camera" | "upload";
  /** base64 of the exact analysis JPEG that will be submitted (no data: prefix). */
  base64: string;
  /** SHA-256 hex of the decoded `base64` bytes. */
  contentDigest: string;
  evidence: FrameEvidence;
  result: QualityResult;
}

export type SubmissionResult =
  | {
      ok: true;
      session: ScanSession;
      images: PlanImage[];
      comparisonMetadata: ScanComparisonMetadata;
    }
  | { ok: false; code: string; message: string; stepId?: StepId };

function fail(code: string, message: string, stepId?: StepId): SubmissionResult {
  return { ok: false, code, message, stepId };
}

export function assembleSubmission(
  sessionId: string,
  startedAt: number,
  evaluations: CaptureEvaluation[],
  now: number = Date.now(),
): SubmissionResult {
  const captures: Partial<Record<StepId, AcceptedCapture>> = {};
  const images: PlanImage[] = [];

  for (const stepId of STEP_ORDER) {
    const evaluation = evaluations.find((candidate) => candidate.stepId === stepId);
    if (!evaluation) return fail("incomplete_scan", `The ${stepId} photo is missing.`, stepId);

    const { result, evidence } = evaluation;
    if (!result.passed) {
      return fail(
        "capture_quality",
        result.correctiveAction?.message ?? `The ${stepId} photo didn't pass quality checks.`,
        stepId,
      );
    }

    const image = evidence.image;
    const face = evidence.face;
    if (!image || !face) {
      return fail("capture_quality", `The ${stepId} photo couldn't be measured. Retake it.`, stepId);
    }

    captures[stepId] = {
      sessionId,
      captureId: evaluation.captureId,
      frameId: evaluation.frameId,
      stepId,
      source: evaluation.source,
      capturedAt: evaluation.capturedAt,
      contentDigest: evaluation.contentDigest,
      perceptualHash: image.perceptualHash,
      width: image.width,
      height: image.height,
      yawDeg: face.yawDeg,
      quality: result,
    };

    images.push({
      data: evaluation.base64,
      mediaType: "image/jpeg",
      stepId,
      captureId: evaluation.captureId,
      contentDigest: evaluation.contentDigest,
    });
  }

  const session: ScanSession = { sessionId, startedAt, captures };
  const validation = validateScanSession(session, now);
  if (!validation.passed) {
    return fail(
      "session_invalid",
      validation.correctiveAction?.message ?? "The scan couldn't be validated. Please retake it.",
    );
  }

  const comparisonMetadata = buildScanComparisonMetadata(evaluations);
  if (!comparisonMetadata) {
    return fail(
      "capture_quality",
      "Capture conditions couldn't be recorded. Please retake the photos.",
    );
  }

  return { ok: true, session, images, comparisonMetadata };
}
