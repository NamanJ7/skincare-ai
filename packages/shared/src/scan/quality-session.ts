import { QUALITY_CONFIG, type QualityConfig } from "./quality-config";
import type {
  AcceptedCapture,
  AnalysisReadySession,
  QualityIssue,
  QualityMetric,
  QualityResult,
  ScanSession,
} from "./quality-contract";
import { perceptualHashDistance } from "./quality-checks";
import { highestPriorityCorrection } from "./quality-guidance";
import { STEP_ORDER } from "./steps";

export type SessionValidationResult = QualityResult;

/** Validate all three accepted captures immediately before analysis. */
export function validateScanSession(
  session: ScanSession,
  now: number = Date.now(),
  config: QualityConfig = QUALITY_CONFIG,
): SessionValidationResult {
  const captures = STEP_ORDER.map((stepId) => session.captures[stepId]);
  const complete = captures.every((capture): capture is AcceptedCapture => Boolean(capture));
  const present = captures.filter((capture): capture is AcceptedCapture => Boolean(capture));
  const ids = new Set(present.map((capture) => capture.captureId));
  const frames = new Set(present.map((capture) => capture.frameId));
  const identity = present.length > 0 && ids.size === present.length && frames.size === present.length && present.every((capture) =>
    capture.sessionId === session.sessionId &&
    capture.stepId === capture.quality.provenance.stepId &&
    capture.sessionId === capture.quality.provenance.sessionId &&
    capture.captureId === capture.quality.provenance.captureId &&
    capture.frameId === capture.quality.provenance.frameId &&
    capture.source === capture.quality.provenance.source &&
    capture.contentDigest === capture.quality.provenance.contentDigest &&
    capture.perceptualHash.toLowerCase() === (capture.quality.provenance.perceptualHash ?? "").toLowerCase() &&
    capture.quality.provenance.gate === "final" &&
    capture.quality.configVersion === config.version &&
    capture.quality.passed &&
    capture.quality.blockingIssues.length === 0 &&
    /^[a-f0-9]{64}$/i.test(capture.contentDigest) &&
    /^[a-f0-9]{16}$/i.test(capture.perceptualHash),
  );
  const previewBinding = present.length > 0 && present.every((capture) =>
    capture.source === "upload" || (
      /^[a-f0-9]{16}$/i.test(capture.quality.provenance.previewPerceptualHash ?? "") &&
      perceptualHashDistance(
        capture.quality.provenance.previewPerceptualHash!,
        capture.perceptualHash,
      ) <= config.duplicate.maxPreviewFinalPerceptualDistance
    ),
  );
  const sessionAge = now - session.startedAt;
  const fresh = Boolean(
    session.sessionId &&
    Number.isFinite(session.startedAt) &&
    session.startedAt <= now + config.integrity.maxFutureSkewMs &&
    sessionAge >= 0 &&
    sessionAge <= config.session.maxSessionAgeMs &&
    present.every((capture) =>
      Number.isFinite(capture.capturedAt) &&
      capture.capturedAt >= session.startedAt &&
      capture.capturedAt <= now + config.integrity.maxFutureSkewMs &&
      now - capture.capturedAt <= config.session.maxCaptureAgeMs,
    ),
  );

  let duplicate = false;
  for (let left = 0; left < present.length; left++) {
    for (let right = left + 1; right < present.length; right++) {
      const a = present[left]!;
      const b = present[right]!;
      if (a.contentDigest === b.contentDigest ||
        perceptualHashDistance(a.perceptualHash, b.perceptualHash) <= config.duplicate.maxPerceptualDistance) {
        duplicate = true;
      }
    }
  }

  const front = session.captures.front;
  const right = session.captures.right;
  const left = session.captures.left;
  const individualPose = Boolean(
    front && right && left &&
    front.yawDeg >= config.pose.frontYawDeg.min && front.yawDeg <= config.pose.frontYawDeg.max &&
    right.yawDeg >= config.pose.rightYawDeg.min && right.yawDeg <= config.pose.rightYawDeg.max &&
    left.yawDeg >= config.pose.leftYawDeg.min && left.yawDeg <= config.pose.leftYawDeg.max,
  );
  const yawSeparation = right && left ? Math.abs(right.yawDeg - left.yawDeg) : 0;
  const visualSeparation = right && left
    ? perceptualHashDistance(right.perceptualHash, left.perceptualHash)
    : 0;
  const distinctPoses = individualPose &&
    yawSeparation >= config.pose.minLeftRightYawSeparationDeg &&
    visualSeparation >= config.duplicate.minLeftRightPerceptualDistance;

  const issues: QualityIssue[] = [];
  if (!complete) issues.push(blocking("missing_pose", "sessionCompleteness", "Front, right, and left captures are required."));
  if (!identity) issues.push(blocking("wrong_session", "sessionIdentity", "Capture identity or final quality binding is invalid."));
  if (!previewBinding) issues.push(blocking("preview_mismatch", "sessionIdentity", "A camera capture does not match its armed preview frame."));
  if (!fresh) issues.push(blocking("stale_image", "sessionFreshness", "The scan or one of its captures is stale."));
  if (duplicate) issues.push(blocking("duplicate_image", "sessionDuplicates", "Two accepted images are exact or near duplicates."));
  if (complete && !distinctPoses) issues.push(blocking("pose_not_distinct", "poseSeparation", "Left and right poses are not meaningfully different."));

  const metrics: QualityResult["metrics"] = {
    sessionCompleteness: boolMetric(complete, `${present.length}/3`, 3),
    sessionIdentity: boolMetric(identity && previewBinding, identity && previewBinding, "matching IDs and preview bindings"),
    sessionFreshness: boolMetric(fresh, sessionAge, `<=${config.session.maxSessionAgeMs}ms`),
    sessionDuplicates: boolMetric(!duplicate, duplicate, "false"),
    poseSeparation: {
      passed: distinctPoses,
      score: distinctPoses ? 1 : Math.min(1, yawSeparation / config.pose.minLeftRightYawSeparationDeg),
      confidence: complete ? 1 : 0,
      value: `${yawSeparation.toFixed(1)}deg/${visualSeparation.toFixed(3)}`,
      threshold: `>=${config.pose.minLeftRightYawSeparationDeg}deg/>=${config.duplicate.minLeftRightPerceptualDistance}`,
    },
  };
  const values = Object.values(metrics).filter((candidate): candidate is QualityMetric => Boolean(candidate));
  const provenance = {
    gate: "session" as const,
    source: front?.source ?? "camera" as const,
    sessionId: session.sessionId,
    frameId: `session:${session.sessionId}`,
    capturedAt: now,
    stepId: "front" as const,
  };
  return {
    passed: issues.length === 0 && values.every((candidate) => candidate.passed),
    overallScore: values.reduce((sum, candidate) => sum + candidate.score, 0) / values.length,
    confidence: values.reduce((sum, candidate) => sum + candidate.confidence, 0) / values.length,
    metrics,
    blockingIssues: issues,
    warnings: [],
    correctiveAction: highestPriorityCorrection(issues, provenance),
    provenance,
    configVersion: config.version,
  };
}

export class ScanQualityError extends Error {
  readonly result: QualityResult;
  constructor(result: QualityResult) {
    super(result.correctiveAction?.message ?? "Scan quality validation failed");
    this.name = "ScanQualityError";
    this.result = result;
  }
}

export const AnalysisQualityError = ScanQualityError;

export function assertAnalysisReady(
  session: ScanSession,
  now: number = Date.now(),
  config: QualityConfig = QUALITY_CONFIG,
): AnalysisReadySession {
  const validation = validateScanSession(session, now, config);
  if (!validation.passed) throw new ScanQualityError(validation);
  return { ...session, analysisReady: true, validation };
}

export function canSubmitForAnalysis(
  session: ScanSession,
  now: number = Date.now(),
  config: QualityConfig = QUALITY_CONFIG,
): boolean {
  return validateScanSession(session, now, config).passed;
}

function blocking(
  code: QualityIssue["code"],
  metric: QualityIssue["metric"],
  detail: string,
): QualityIssue {
  return { code, metric, detail, severity: "blocking" };
}

function boolMetric(
  passed: boolean,
  value: QualityMetric["value"],
  threshold: QualityMetric["threshold"],
): QualityMetric {
  return { passed, score: passed ? 1 : 0, confidence: 1, value, threshold };
}
