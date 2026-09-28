import { createHash } from "node:crypto";

import {
  STEP_ORDER,
  ScanQualityError,
  assertAnalysisReady,
  isPassedQualityResult,
  type AnalysisReadySession,
  type ScanSession,
  type StepId,
} from "@pore/shared/scan";

import type { PlanImage } from "./pipeline";

export class AnalysisRequestError extends Error {
  readonly code: string;
  readonly status: number;
  /**
   * Server-log-only context. `message` is written for the client and is echoed
   * verbatim by the route; anything that would enumerate our internal schema
   * belongs here instead, and the route logs it without ever serializing it
   * into a response body.
   */
  readonly detail?: string;

  constructor(
    message: string,
    code = "SCAN_QUALITY_REQUIRED",
    status = 422,
    detail?: string,
  ) {
    super(message);
    this.name = "AnalysisRequestError";
    this.code = code;
    this.status = status;
    if (detail) this.detail = detail;
  }
}

/**
 * Repeat the client session gate and bind each model payload to the exact bytes
 * whose final quality result passed. This runs before credentials/model calls.
 */
export function assertBoundAnalysisInput(
  session: ScanSession,
  images: PlanImage[],
  now: number = Date.now(),
): AnalysisReadySession {
  assertRuntimeScanSession(session);
  let ready: AnalysisReadySession;
  try {
    ready = assertAnalysisReady(session, now);
  } catch (error) {
    if (error instanceof ScanQualityError) {
      throw new AnalysisRequestError(error.message);
    }
    throw error;
  }

  if (images.length !== STEP_ORDER.length) {
    throw new AnalysisRequestError("Exactly three quality-validated scan images are required");
  }

  const captureIds = new Set<string>();
  for (let index = 0; index < STEP_ORDER.length; index++) {
    const expectedStep = STEP_ORDER[index]!;
    const image = images[index];
    const capture = ready.captures[expectedStep];
    if (!image || !capture) throw new AnalysisRequestError(`Missing ${expectedStep} capture`);
    if (
      typeof image.data !== "string" ||
      image.mediaType !== "image/jpeg" ||
      !isBoundedString(image.captureId, MAX_ID_CHARS) ||
      !isBoundedString(image.contentDigest, MAX_DIGEST_CHARS)
    ) {
      throw new AnalysisRequestError(
        `The ${expectedStep} image payload is malformed`,
        "INVALID_IMAGE",
        400,
      );
    }
    if (!isPassedQualityResult(capture.quality)) {
      throw new AnalysisRequestError(
        `The ${expectedStep} capture is missing complete current quality evidence`,
      );
    }
    if (image.stepId !== expectedStep || image.captureId !== capture.captureId) {
      throw new AnalysisRequestError("Image order or capture identity does not match the validated session");
    }
    if (captureIds.has(image.captureId)) {
      throw new AnalysisRequestError("A capture was reused for more than one pose");
    }
    captureIds.add(image.captureId);

    const digest = digestBase64(image.data);
    if (digest !== image.contentDigest || digest !== capture.contentDigest) {
      throw new AnalysisRequestError("Submitted image bytes do not match the quality-validated capture");
    }
  }

  return ready;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Ceilings for the identifier strings in a scan session.
 *
 * These were `typeof x === "string"` only, so a caller could send three 1-byte
 * images alongside multi-megabyte `contentDigest` values: they pass the
 * per-image ceiling (which measures `image.data`) and then get concatenated
 * into the request hash. The 6 MB body limit bounds the damage, but the intake
 * guard bounds every one of its strings for exactly this reason and these
 * should match. A SHA-256 hex digest is exactly 64 characters; the rest are
 * client-generated ids that have no reason to be long.
 */
const MAX_ID_CHARS = 128;
const MAX_DIGEST_CHARS = 64;

function isBoundedString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

/** Runtime boundary only: confirms the client sent the fields the gate reads. */
export function assertRuntimeScanSession(
  value: unknown,
): asserts value is ScanSession {
  if (
    !isRecord(value) ||
    !isBoundedString(value.sessionId, MAX_ID_CHARS) ||
    !Number.isFinite(value.startedAt)
  ) {
    throw new AnalysisRequestError("Scan session payload is malformed", "INVALID_SCAN_SESSION", 400);
  }
  if (!isRecord(value.captures)) {
    throw new AnalysisRequestError("Scan captures payload is malformed", "INVALID_SCAN_SESSION", 400);
  }
  for (const stepId of STEP_ORDER) {
    const capture = value.captures[stepId];
    if (
      !isRecord(capture) ||
      capture.stepId !== stepId ||
      !isBoundedString(capture.sessionId, MAX_ID_CHARS) ||
      !isBoundedString(capture.captureId, MAX_ID_CHARS) ||
      !isBoundedString(capture.frameId, MAX_ID_CHARS) ||
      !isBoundedString(capture.contentDigest, MAX_DIGEST_CHARS) ||
      !isBoundedString(capture.perceptualHash, MAX_ID_CHARS) ||
      !Number.isFinite(capture.capturedAt) ||
      !Number.isFinite(capture.width) ||
      !Number.isFinite(capture.height) ||
      !Number.isFinite(capture.yawDeg) ||
      !isRecord(capture.quality) ||
      !isRecord(capture.quality.provenance) ||
      !isRecord(capture.quality.metrics) ||
      !Array.isArray(capture.quality.blockingIssues) ||
      !Array.isArray(capture.quality.warnings)
    ) {
      throw new AnalysisRequestError(
        `The ${stepId} scan capture is malformed`,
        "INVALID_SCAN_SESSION",
        400,
      );
    }
  }
}

function digestBase64(data: string): string {
  const normalized = data.replace(/\s+/g, "");
  if (!normalized || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new AnalysisRequestError("Image data is not valid base64", "INVALID_IMAGE", 400);
  }
  const bytes = Buffer.from(normalized, "base64");
  if (bytes.length === 0) throw new AnalysisRequestError("Image data is empty", "INVALID_IMAGE", 400);
  return createHash("sha256").update(bytes).digest("hex");
}

export interface BoundPlanImage extends PlanImage {
  stepId: StepId;
}
