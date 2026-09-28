import { QUALITY_CONFIG, type QualityConfig } from "./quality-config";
import type { FrameEvidence, QualityMetric, QualityResult } from "./quality-contract";
import { highestPriorityCorrection } from "./quality-guidance";
import {
  checkFaceCount,
  checkFacialSharpness,
  checkFraming,
  checkIntegrity,
  checkLighting,
  checkMotionAndStability,
  checkOcclusion,
  checkPose,
  checkResolution,
} from "./quality-checks";

export interface EvaluateQualityOptions {
  config?: QualityConfig;
  now?: number;
}

/** Every independent signal produced by a FINAL capture evaluation. */
export const FINAL_REQUIRED_METRIC_NAMES = [
  "integrity",
  "resolution",
  "faceDetection",
  "singleFace",
  "faceCompleteness",
  "faceSize",
  "faceCentering",
  "sharpness",
  "motion",
  "exposure",
  "clipping",
  "lightingUniformity",
  "backlighting",
  "textureVisibility",
  "yaw",
  "pitch",
  "roll",
  "targetPose",
  "occlusion",
] as const satisfies readonly (keyof QualityResult["metrics"])[];

/** Compose every independent check. No missing signal is treated as a pass. */
export function evaluateQuality(
  evidence: FrameEvidence,
  options: EvaluateQualityOptions = {},
): QualityResult {
  const config = options.config ?? QUALITY_CONFIG;
  const checks = [
    checkIntegrity(evidence, config, options.now),
    checkFaceCount(evidence),
    checkFraming(evidence, evidence.provenance.stepId, config),
    checkResolution(evidence, config),
    checkPose(evidence, evidence.provenance.stepId, config),
    checkOcclusion(evidence, config),
    checkLighting(evidence, config),
    checkFacialSharpness(evidence, config),
    checkMotionAndStability(evidence, config),
  ];
  const metrics: QualityResult["metrics"] = {};
  const blockingIssues = [] as QualityResult["blockingIssues"];
  const warnings = [] as QualityResult["warnings"];
  for (const check of checks) {
    Object.assign(metrics, check.metrics);
    blockingIssues.push(...check.issues.filter((candidate) => candidate.severity === "blocking"));
    warnings.push(...(check.warnings ?? []), ...check.issues.filter((candidate) => candidate.severity === "warning"));
  }
  const values = Object.values(metrics).filter((candidate): candidate is QualityMetric => Boolean(candidate));
  const everyMetricPassed = values.length > 0 && values.every((candidate) => candidate.passed);
  const passed = blockingIssues.length === 0 && everyMetricPassed;
  const overallScore = values.length > 0
    ? values.reduce((sum, candidate) => sum + candidate.score, 0) / values.length
    : 0;
  const confidence = values.length > 0
    ? values.reduce((sum, candidate) => sum + candidate.confidence, 0) / values.length
    : 0;
  return {
    passed,
    overallScore,
    confidence,
    metrics,
    blockingIssues,
    warnings,
    correctiveAction: highestPriorityCorrection(blockingIssues, evidence.provenance),
    provenance: evidence.provenance,
    configVersion: config.version,
  };
}

export function isPassedQualityResult(result: QualityResult | null | undefined): result is QualityResult {
  return Boolean(
    result?.passed &&
    result.blockingIssues.length === 0 &&
    result.provenance.gate === "final" &&
    result.provenance.captureId &&
    result.provenance.contentDigest &&
    result.configVersion === QUALITY_CONFIG.version &&
    FINAL_REQUIRED_METRIC_NAMES.every((name) => {
      const metric = result.metrics[name];
      return Boolean(
        metric?.passed === true &&
          Number.isFinite(metric.score) &&
          metric.score >= 0 &&
          metric.score <= 1 &&
          Number.isFinite(metric.confidence) &&
          metric.confidence >= 0 &&
          metric.confidence <= 1,
      );
    }),
  );
}

export interface ConsecutiveFrameSnapshot {
  consecutivePasses: number;
  firstPassingAt: number | null;
  lastFrameAt: number | null;
  lastFrameId: string | null;
  ready: boolean;
}

export interface ConsecutiveFrameTracker {
  push: (evidence: FrameEvidence, result: QualityResult) => ConsecutiveFrameSnapshot;
  reset: () => ConsecutiveFrameSnapshot;
  snapshot: () => ConsecutiveFrameSnapshot;
}

/** Only unique, monotonically newer live frames can build a readiness streak. */
export function createConsecutiveFrameTracker(
  config: QualityConfig = QUALITY_CONFIG,
): ConsecutiveFrameTracker {
  let state: ConsecutiveFrameSnapshot = emptySnapshot();
  const reset = () => (state = emptySnapshot());
  return {
    push(evidence, result) {
      const { provenance } = evidence;
      const fresh = provenance.gate === "live" &&
        result.provenance.frameId === provenance.frameId &&
        result.provenance.sessionId === provenance.sessionId &&
        result.provenance.stepId === provenance.stepId &&
        result.passed &&
        provenance.frameId !== state.lastFrameId &&
        (state.lastFrameAt == null || (
          provenance.capturedAt > state.lastFrameAt &&
          provenance.capturedAt - state.lastFrameAt <= config.motion.maxFrameGapMs
        ));
      if (!fresh) return reset();
      const firstPassingAt = state.firstPassingAt ?? provenance.capturedAt;
      const consecutivePasses = state.consecutivePasses + 1;
      state = {
        consecutivePasses,
        firstPassingAt,
        lastFrameAt: provenance.capturedAt,
        lastFrameId: provenance.frameId,
        ready: consecutivePasses >= config.motion.consecutivePassingFrames &&
          provenance.capturedAt - firstPassingAt >= config.motion.minStableDurationMs,
      };
      return { ...state };
    },
    reset,
    snapshot: () => ({ ...state }),
  };
}

export const createConsecutivePassTracker = createConsecutiveFrameTracker;

export function isCaptureReady(snapshot: ConsecutiveFrameSnapshot): boolean {
  return snapshot.ready;
}

function emptySnapshot(): ConsecutiveFrameSnapshot {
  return { consecutivePasses: 0, firstPassingAt: null, lastFrameAt: null, lastFrameId: null, ready: false };
}
