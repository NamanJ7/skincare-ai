/** Native guidance driven only by synchronized face + pixel frame packets. */
import { useCallback, useEffect, useRef, useState } from "react";

import {
  analyzeFrame,
  createDamper,
  dampFeedback,
  QUALITY_CONFIG,
  type FaceMetrics,
  type QualityCode,
  type QualityMetricName,
  type QualityResult,
  type StepConfig,
} from "@pore/shared/scan";

import {
  selectArmedFrame,
  type ArmedFrame,
  type ReceivedNativeFrame,
} from "./armed-frame";
import { recordCalibrationSample } from "./calibration-log";
import type {
  GuideState,
  LiveCheckState,
  LiveGuidance,
  LiveGuidanceDebug,
  LiveQualityStatus,
} from "./live-guidance-types";
import type { NativeFramePacket } from "./native-frame-evidence";
import { evaluateNativePacket } from "./native-quality-adapter";
import {
  EMPTY_STRICT_FRAME_READINESS,
  advanceStrictFrameReadiness,
  expireStrictFrameReadiness,
} from "./strict-frame-readiness";

const COUNTDOWN_MS = 3_000;
const CLOCK_TICK_MS = 100;

export interface NativeGuidance {
  guidance: LiveGuidance;
  getArmedFrame: () => ArmedFrame | null;
  /** Session/lifecycle/focus interruptions invalidate both shutters. */
  invalidateReadiness: () => void;
}

function metricsFromPacket(packet: NativeFramePacket): FaceMetrics {
  const face = packet.faces[0];
  return {
    faceCount: packet.faces.length,
    center: face
      ? { x: face.centerX, y: face.centerY }
      : { x: 0.5, y: 0.5 },
    widthRatio: face?.widthRatio ?? 0,
    yawDeg: face?.yawDeg ?? 0,
    pitchDeg: face?.pitchDeg ?? 0,
  };
}

function metricGroupState(
  result: QualityResult,
  names: QualityMetricName[],
): LiveCheckState {
  const metrics = names
    .map((name) => result.metrics[name])
    .filter((metric): metric is NonNullable<typeof metric> => metric != null);
  if (metrics.length === 0) return "waiting";
  return metrics.every((metric) => metric.passed) ? "pass" : "adjust";
}

function statusFromResult(result: QualityResult): LiveQualityStatus {
  return {
    face: metricGroupState(result, ["faceDetection", "singleFace"]),
    framing: metricGroupState(result, [
      "faceCompleteness",
      "faceSize",
      "faceCentering",
    ]),
    angle: metricGroupState(result, ["yaw", "pitch", "roll", "targetPose"]),
    light: metricGroupState(result, [
      "exposure",
      "clipping",
      "lightingUniformity",
      "backlighting",
      "textureVisibility",
    ]),
    sharpness: metricGroupState(result, ["sharpness", "motion"]),
  };
}

export function useNativeGuidance(options: {
  step: StepConfig;
  resetKey: string | number;
  active: boolean;
  packet: NativeFramePacket | null;
  packetReceivedAt: number | null;
  discontinuityVersion: number;
  evidenceError: string | null;
  /** Size of the still the shutter will produce; see NativeEvidenceIdentity. */
  stillWidth: number;
  stillHeight: number;
  onAutoCapture: () => boolean;
}): NativeGuidance {
  const {
    step,
    resetKey,
    active,
    packet,
    packetReceivedAt,
    discontinuityVersion,
    evidenceError,
    stillWidth,
    stillHeight,
    onAutoCapture,
  } = options;
  const [guidance, setGuidance] = useState<LiveGuidance>({
    enabled: true,
    detectorStatus: "loading",
    code: null,
    instruction: null,
    guideState: "searching",
    countdown: null,
    manualCaptureReady: false,
  });

  const activeRef = useRef(active);
  activeRef.current = active;
  const onAutoRef = useRef(onAutoCapture);
  onAutoRef.current = onAutoCapture;
  const latestRef = useRef<ReceivedNativeFrame | null>(null);
  const previousPacketRef = useRef<NativeFramePacket | null>(null);
  const armedRef = useRef<ReceivedNativeFrame | null>(null);
  const readinessRef = useRef(EMPTY_STRICT_FRAME_READINESS);
  const countdownStartedAtRef = useRef<number | null>(null);
  const captureFiredRef = useRef(false);
  const previousCodeRef = useRef<QualityCode>("no_face");
  const damperRef = useRef(createDamper("no_face"));
  const latestDebugRef = useRef<LiveGuidanceDebug | undefined>(undefined);

  const getArmedFrame = useCallback(
    () => selectArmedFrame(armedRef.current, Date.now()),
    [],
  );

  const invalidateReadiness = useCallback(() => {
    readinessRef.current = EMPTY_STRICT_FRAME_READINESS;
    armedRef.current = null;
    previousPacketRef.current = null;
    countdownStartedAtRef.current = null;
    captureFiredRef.current = false;
    setGuidance((current) => ({
      ...current,
      guideState:
        current.detectorStatus === "ready" ? "adjust" : "searching",
      countdown: null,
      manualCaptureReady: false,
    }));
  }, []);

  useEffect(() => {
    latestRef.current = null;
    previousPacketRef.current = null;
    armedRef.current = null;
    readinessRef.current = EMPTY_STRICT_FRAME_READINESS;
    countdownStartedAtRef.current = null;
    captureFiredRef.current = false;
    previousCodeRef.current = "no_face";
    damperRef.current = createDamper("no_face");
    latestDebugRef.current = undefined;
    setGuidance({
      enabled: true,
      detectorStatus: "loading",
      code: null,
      instruction: null,
      guideState: "searching",
      countdown: null,
      manualCaptureReady: false,
    });
  }, [active, resetKey]);

  useEffect(() => {
    invalidateReadiness();
  }, [discontinuityVersion, invalidateReadiness]);

  useEffect(() => {
    if (!evidenceError) return;
    invalidateReadiness();
    setGuidance((current) => ({
      ...current,
      instruction:
        "Camera quality checks paused. Keep Pore open while guidance restarts.",
    }));
  }, [evidenceError, invalidateReadiness]);

  useEffect(() => {
    if (!active || !packet || packetReceivedAt == null || evidenceError) return;
    const now = Date.now();
    const received: ReceivedNativeFrame = {
      packet,
      receivedAt: packetReceivedAt,
    };
    latestRef.current = received;

    const metrics = metricsFromPacket(packet);
    const rawVerdict = analyzeFrame(
      metrics,
      null,
      step,
      previousCodeRef.current,
    );
    previousCodeRef.current = rawVerdict.code;
    const strict = evaluateNativePacket(packet, previousPacketRef.current, {
      gate: "live",
      sessionId: `live:${String(resetKey)}`,
      stepId: step.id,
      frameId: packet.frameId,
      capturedAt: packetReceivedAt,
      stillWidth,
      stillHeight,
    });
    previousPacketRef.current = packet;

    const candidatePassed =
      rawVerdict.readyForAutoCapture && strict.result.passed;
    const priorReady = readinessRef.current.ready;
    const nextReadiness = advanceStrictFrameReadiness(readinessRef.current, {
      frameId: packet.frameId,
      timestampMs: packet.timestamp * 1_000,
      receivedAt: packetReceivedAt,
      now,
      passed: candidatePassed,
    });
    readinessRef.current = nextReadiness;

    if (nextReadiness.ready) {
      armedRef.current = received;
      if (!priorReady || countdownStartedAtRef.current == null) {
        countdownStartedAtRef.current = now;
        captureFiredRef.current = false;
      }
    } else {
      armedRef.current = null;
      countdownStartedAtRef.current = null;
      captureFiredRef.current = false;
    }

    damperRef.current = dampFeedback(
      damperRef.current,
      rawVerdict.code,
      now,
    );
    const displayedCode = damperRef.current.displayed;
    // The strict ladder is the authority on whether the shutter unlocks, so its
    // correction is the one that can actually clear the block. The legacy
    // ladder only sees face geometry, so deferring to it whenever it had an
    // opinion told users to "move a little closer" while the real blocker was
    // glare, backlight, roll, or resolution — an instruction that could never
    // work. Legacy copy now fills in only when the strict gate has nothing
    // specific to say.
    const instruction = !strict.result.passed
      ? (strict.result.correctiveAction?.message ?? null)
      : null;
    const guideState: GuideState =
      rawVerdict.code === "no_face"
        ? "searching"
        : nextReadiness.ready
          ? "good"
          : "adjust";

    const pixels = packet.pixels;
    const debug: LiveGuidanceDebug | undefined = __DEV__
      ? {
          phase: nextReadiness.ready
            ? countdownStartedAtRef.current != null
              ? "countdown"
              : "ready"
            : nextReadiness.frameIds.length > 0
              ? "verifying"
              : "aligning",
          rawVerdict,
          stable: candidatePassed,
          faceCount: metrics.faceCount,
          yawDeg: metrics.faceCount === 1 ? metrics.yawDeg : null,
          pitchDeg: metrics.faceCount === 1 ? metrics.pitchDeg : null,
          widthRatio: metrics.faceCount === 1 ? metrics.widthRatio : null,
          center: metrics.faceCount === 1 ? metrics.center : null,
          packetAgeMs: Math.max(0, now - packetReceivedAt),
          frameMirrored: packet.isMirrored ?? null,
          lumaP10: pixels?.lumaP10 ?? null,
          lumaP90: pixels?.lumaP90 ?? null,
          shadowClipping: pixels?.shadowClipping ?? null,
          highlightClipping: pixels?.highlightClipping ?? null,
          glareRatio: pixels?.glareRatio ?? null,
          gradientEnergy: pixels?.gradientEnergy ?? null,
          laplacianVariance: pixels?.laplacianVariance ?? null,
          backlightDelta: pixels?.backlightDelta ?? null,
          cheekLumaDifference: pixels?.cheekLumaDifference ?? null,
          overrideCode: null,
          armedHash: nextReadiness.ready
            ? pixels?.perceptualHash ?? null
            : null,
          evidenceError: null,
        }
      : undefined;
    latestDebugRef.current = debug;

    setGuidance((current) => ({
      enabled: true,
      detectorStatus: "ready",
      code: displayedCode,
      instruction,
      guideState,
      countdown: nextReadiness.ready ? current.countdown ?? 3 : null,
      manualCaptureReady: nextReadiness.ready,
      status: statusFromResult(strict.result),
      ...(debug ? { debug } : {}),
    }));

    if (__DEV__) {
      recordCalibrationSample({
        kind: "live_frame",
        at: now,
        frameId: packet.frameId,
        stepId: step.id,
        code: rawVerdict.code,
        overrideCode: null,
        packetAgeMs: Math.max(0, now - packetReceivedAt),
        frameMirrored: packet.isMirrored ?? null,
        perceptualHash: pixels?.perceptualHash ?? null,
        lumaP10: pixels?.lumaP10 ?? null,
        lumaP90: pixels?.lumaP90 ?? null,
        gradientEnergy: pixels?.gradientEnergy ?? null,
        laplacianVariance: pixels?.laplacianVariance ?? null,
        backlightDelta: pixels?.backlightDelta ?? null,
      });
    }
  }, [
    active,
    evidenceError,
    packet,
    packetReceivedAt,
    resetKey,
    step,
    stillHeight,
    stillWidth,
  ]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!activeRef.current) return;
      const now = Date.now();
      const latest = latestRef.current;
      const current = readinessRef.current;
      const unexpired = expireStrictFrameReadiness(
        current,
        latest?.receivedAt ?? null,
        now,
      );
      if (unexpired !== current) {
        invalidateReadiness();
        return;
      }

      const startedAt = countdownStartedAtRef.current;
      if (!current.ready || startedAt == null || captureFiredRef.current) return;
      const remainingMs = startedAt + COUNTDOWN_MS - now;
      if (remainingMs <= 0) {
        if (!getArmedFrame()) {
          invalidateReadiness();
          return;
        }
        if (onAutoRef.current()) {
          captureFiredRef.current = true;
          setGuidance((value) => ({
            ...value,
            countdown: null,
            manualCaptureReady: false,
          }));
        } else {
          countdownStartedAtRef.current = null;
          setGuidance((value) => ({ ...value, countdown: null }));
        }
        return;
      }
      const next = Math.max(1, Math.ceil(remainingMs / 1_000));
      setGuidance((value) =>
        value.countdown === next ? value : { ...value, countdown: next },
      );
    }, CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, [getArmedFrame, invalidateReadiness]);

  return { guidance, getArmedFrame, invalidateReadiness };
}
