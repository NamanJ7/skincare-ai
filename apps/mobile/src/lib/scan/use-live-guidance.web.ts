/**
 * Web live guidance — the full MediaPipe loop from the Next.js scan flow,
 * driving the same shared quality ladder / damper / auto-capture machine
 * against expo-camera's underlying <video> element.
 *
 * Architecture (ported from apps/web CameraCapture): all high-frequency state
 * lives in the effect's closure; React state changes only when the damped
 * feedback code, guide state, or countdown tick changes. Landmarks run at
 * ~15fps (watchdog degrades to 5fps on slow devices), exposure/blur sampling
 * at ~5fps on a 64px canvas — the width the shared thresholds assume.
 *
 * The <video> lookup is the one expo-camera-internals dependency: the wrapper
 * View's DOM node is queried for a video tag after onCameraReady. If it never
 * appears, or WASM/model init fails (10s timeout), guidance reports
 * "unavailable" and the screen quietly falls back to native-style static
 * guidance with the manual shutter — detection failures never block the scan.
 *
 * Assets are self-hosted under /mediapipe (see apps/mobile/public/mediapipe,
 * copied from apps/web — keep in lockstep with @mediapipe/tasks-vision).
 */
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  analyzeFrame,
  captureMachineReducer,
  countdownRemaining,
  createDamper,
  dampFeedback,
  extractFaceMetrics,
  initialCaptureState,
  isStable,
  pushStabilitySample,
  computeImageStats,
  type FaceMetrics,
  type ImageStats,
  type QualityCode,
  type QualityVerdict,
  type Region,
  type StabilitySample,
} from "@pore/shared/scan";

import {
  type DetectorStatus,
  type GuideState,
  type LiveGuidance,
  type LiveGuidanceOptions,
} from "./live-guidance-types";

const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/face_landmarker.task";
const VISION_BUNDLE_PATH = "/mediapipe/vision_bundle.mjs";
const INIT_TIMEOUT_MS = 10_000;

const DETECT_INTERVAL_MS = 66; // ~15fps
const DETECT_INTERVAL_SLOW_MS = 200; // ~5fps once the watchdog trips
const DETECT_WATCHDOG_MS = 150;
const STATS_INTERVAL_MS = 200;
const STATS_WIDTH = 64;
const FIND_VIDEO_RETRY_MS = 250;
const FIND_VIDEO_GIVE_UP_MS = 8_000;

// --- FaceLandmarker singleton (lazy, memoized, GPU→CPU fallback) -----------

let instancePromise: Promise<FaceLandmarker | null> | null = null;
let instance: FaceLandmarker | null = null;

type VisionModule = typeof import("@mediapipe/tasks-vision");

/**
 * Metro can't transform tasks-vision's internal `import(t.toString())`, so
 * the package can't be bundled — instead the ESM bundle is self-hosted next
 * to the wasm/model (see public/mediapipe, kept in lockstep with the npm
 * version) and imported at runtime. The Function wrapper hides the dynamic
 * import from Metro's parser; browsers evaluate it natively.
 */
function loadVision(): Promise<VisionModule> {
  const dynamicImport = new Function("u", "return import(u)") as (
    u: string,
  ) => Promise<VisionModule>;
  return dynamicImport(VISION_BUNDLE_PATH);
}

/**
 * MediaPipe routes a harmless CPU-delegate diagnostic through console.error on
 * some browsers. Expo treats that as an app error and opens the red overlay,
 * even though the detector is ready. Keep genuine errors visible.
 */
function isNonFatalVisionDiagnostic(args: unknown[]): boolean {
  return args
    .map((value) => String(value))
    .join(" ")
    .includes("Created TensorFlow Lite XNNPACK delegate for CPU");
}

async function create(): Promise<FaceLandmarker | null> {
  const reportError = console.error;
  console.error = (...args: unknown[]) => {
    if (!isNonFatalVisionDiagnostic(args)) reportError(...args);
  };
  try {
    const vision = await loadVision();
    const fileset = await vision.FilesetResolver.forVisionTasks(WASM_PATH);
    const options = (delegate: "GPU" | "CPU") => ({
      baseOptions: { modelAssetPath: MODEL_PATH, delegate },
      runningMode: "VIDEO" as const,
      // 2, not 1: the ladder must be able to see a second face to warn on it.
      numFaces: 2,
    });
    try {
      instance = await vision.FaceLandmarker.createFromOptions(
        fileset,
        options("GPU"),
      );
    } catch {
      instance = await vision.FaceLandmarker.createFromOptions(
        fileset,
        options("CPU"),
      );
    }
    return instance;
  } catch {
    return null;
  } finally {
    console.error = reportError;
  }
}

function getFaceLandmarker(): Promise<FaceLandmarker | null> {
  if (!instancePromise) {
    instancePromise = Promise.race([
      create(),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), INIT_TIMEOUT_MS),
      ),
    ]).then((r) => r ?? null);
  }
  return instancePromise;
}

function disposeFaceLandmarker(): void {
  instance?.close();
  instance = null;
  instancePromise = null;
}

// --- Helpers ----------------------------------------------------------------

/** Bias the exposure/blur sample to the face box when one is known. */
function faceRegion(metrics: FaceMetrics | null): Region | undefined {
  if (!metrics || metrics.faceCount === 0 || metrics.widthRatio <= 0)
    return undefined;
  const w = metrics.widthRatio;
  const h = w * 1.3;
  return {
    x: metrics.center.x - w / 2,
    y: metrics.center.y - h / 2,
    width: w,
    height: h,
  };
}

function guideStateOf(phase: string, verdict: QualityVerdict): GuideState {
  if (phase === "searching" || verdict.code === "no_face") return "searching";
  if (
    phase === "stabilizing" ||
    phase === "countdown" ||
    verdict.readyForAutoCapture
  ) {
    return "good";
  }
  return "adjust";
}

// --- Hook --------------------------------------------------------------------

export function useLiveGuidance(options: LiveGuidanceOptions): LiveGuidance {
  const { containerRef, cameraReady, step, resetKey, active, onAutoCapture } =
    options;

  const [detectorStatus, setDetectorStatus] =
    useState<DetectorStatus>("loading");
  const [code, setCode] = useState<QualityCode | null>(null);
  const [guideState, setGuideState] = useState<GuideState>("searching");
  const [countdown, setCountdown] = useState<number | null>(null);

  // Loop-read, render-written refs so the effect never re-runs for these.
  const stepRef = useRef(step);
  stepRef.current = step;
  const activeRef = useRef(active);
  activeRef.current = active;
  const onAutoCaptureRef = useRef(onAutoCapture);
  onAutoCaptureRef.current = onAutoCapture;

  useEffect(() => {
    if (!cameraReady) return;
    let disposed = false;
    let raf = 0;

    let detector: FaceLandmarker | null = null;
    let video: HTMLVideoElement | null = null;
    const searchStartedAt = performance.now();

    // Per-step frame-loop state — reset with the effect on resetKey change.
    let machine = initialCaptureState;
    let damper = createDamper("no_face");
    let history: StabilitySample[] = [];
    let lastMetrics: FaceMetrics | null = null;
    let lastStats: ImageStats | null = null;
    let prevCode: QualityCode = "no_face";
    let detectInterval = DETECT_INTERVAL_MS;
    let lastDetectAt = 0;
    let lastStatsAt = 0;
    let lastVideoFindAt = 0;
    let captured = false;

    const statsCanvas = document.createElement("canvas");
    const statsCtx = statsCanvas.getContext("2d", { willReadFrequently: true });

    const findVideo = (): HTMLVideoElement | null => {
      const node = containerRef.current;
      if (node instanceof HTMLElement) return node.querySelector("video");
      return null;
    };

    const tick = () => {
      if (disposed) return;
      raf = requestAnimationFrame(tick);
      if (!activeRef.current) return;

      const now = performance.now();
      if (!video) {
        if (now - lastVideoFindAt < FIND_VIDEO_RETRY_MS) return;
        lastVideoFindAt = now;
        video = findVideo();
        if (!video) {
          if (now - searchStartedAt > FIND_VIDEO_GIVE_UP_MS) {
            disposed = true;
            cancelAnimationFrame(raf);
            setDetectorStatus("unavailable");
          }
          return;
        }
      }
      if (video.readyState < 2 || video.videoWidth === 0) return;

      // Landmarks (~15fps, watchdog-degraded on slow devices).
      if (detector && now - lastDetectAt >= detectInterval) {
        lastDetectAt = now;
        try {
          const result = detector.detectForVideo(video, now);
          lastMetrics = extractFaceMetrics(result);
        } catch {
          lastMetrics = null;
        }
        if (performance.now() - now > DETECT_WATCHDOG_MS) {
          detectInterval = DETECT_INTERVAL_SLOW_MS;
        }
      }

      // Exposure/blur sample (~5fps) on a 64px-wide canvas.
      if (statsCtx && now - lastStatsAt >= STATS_INTERVAL_MS) {
        lastStatsAt = now;
        const h = Math.max(
          2,
          Math.round((STATS_WIDTH * video.videoHeight) / video.videoWidth),
        );
        statsCanvas.width = STATS_WIDTH;
        statsCanvas.height = h;
        try {
          statsCtx.drawImage(video, 0, 0, STATS_WIDTH, h);
          const pixels = statsCtx.getImageData(0, 0, STATS_WIDTH, h);
          lastStats = computeImageStats(pixels, faceRegion(lastMetrics));
        } catch {
          lastStats = null;
        }
      }

      const verdict = analyzeFrame(
        lastMetrics,
        lastStats,
        stepRef.current,
        prevCode,
      );
      prevCode = verdict.code;

      if (lastMetrics?.faceCount === 1) {
        history = pushStabilitySample(history, {
          x: lastMetrics.center.x,
          y: lastMetrics.center.y,
          widthRatio: lastMetrics.widthRatio,
          at: now,
        });
      } else {
        history = [];
      }

      machine = captureMachineReducer(machine, {
        type: "FRAME",
        now,
        verdict,
        stable: isStable(history),
      });
      damper = dampFeedback(damper, verdict.code, now);

      // Sync React state only on actual changes to avoid re-render churn.
      const displayed = damper.displayed;
      setCode((c) => (c === displayed ? c : displayed));
      const gs = guideStateOf(machine.phase, verdict);
      setGuideState((g) => (g === gs ? g : gs));
      const remaining = countdownRemaining(machine, now);
      setCountdown((c) => (c === remaining ? c : remaining));

      if (machine.phase === "capturing" && !captured) {
        captured = true;
        onAutoCaptureRef.current();
      }
    };

    setDetectorStatus((s) => (s === "ready" ? s : "loading"));
    void getFaceLandmarker().then((lm) => {
      if (disposed) return;
      detector = lm;
      setDetectorStatus(lm ? "ready" : "unavailable");
      if (lm) raf = requestAnimationFrame(tick);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
    };
    // stepRef/activeRef/onAutoCaptureRef carry the frequently-changing values.
  }, [cameraReady, resetKey, containerRef]);

  // Free WASM memory when the capture screen unmounts entirely.
  useEffect(() => disposeFaceLandmarker, []);

  // Keep the snapshot identity stable between detector state changes. The camera
  // reports this object through an effect, so recreating it on every parent
  // render causes a parent/child update loop.
  return useMemo(
    () => ({
      enabled: detectorStatus !== "unavailable",
      detectorStatus,
      code,
      guideState,
      countdown,
      // Web submissions use the upload path and do not require native armed-frame
      // provenance. Keep its manual shutter behavior unchanged.
      manualCaptureReady: true,
    }),
    [code, countdown, detectorStatus, guideState],
  );
}
