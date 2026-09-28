"use client";

/**
 * MediaPipe FaceLandmarker singleton. Lazy-loaded (dynamic import only —
 * never import "@mediapipe/tasks-vision" at module top level, it must stay
 * out of SSR), memoized across the whole scan flow, disposed on exit.
 *
 * Assets are self-hosted under /public/mediapipe (wasm runtime copied from
 * @mediapipe/tasks-vision@0.10.35, model from Google's face_landmarker
 * float16 v1) so a "photos never leave your device" page makes no
 * third-party requests mid-scan. Keep the package version and the wasm copy
 * in lockstep.
 */
import type { FaceLandmarker } from "@mediapipe/tasks-vision";

const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/face_landmarker.task";
const INIT_TIMEOUT_MS = 10_000;

type RunningMode = "VIDEO" | "IMAGE";

let instancePromise: Promise<FaceLandmarker | null> | null = null;
let instance: FaceLandmarker | null = null;
let currentMode: RunningMode = "VIDEO";

async function create(): Promise<FaceLandmarker | null> {
  try {
    const vision = await import("@mediapipe/tasks-vision");
    const fileset = await vision.FilesetResolver.forVisionTasks(WASM_PATH);
    const options = (delegate: "GPU" | "CPU") => ({
      baseOptions: { modelAssetPath: MODEL_PATH, delegate },
      runningMode: "VIDEO" as const,
      // 2, not 1: the ladder must be able to see a second face to warn on it.
      numFaces: 2,
    });
    try {
      instance = await vision.FaceLandmarker.createFromOptions(fileset, options("GPU"));
    } catch {
      instance = await vision.FaceLandmarker.createFromOptions(fileset, options("CPU"));
    }
    currentMode = "VIDEO";
    return instance;
  } catch {
    return null;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/** Fire-and-forget warmup — call from the intro screen while the user reads
 * the checklist so the detector is usually ready by first capture. */
export function preloadFaceLandmarker(): void {
  void getFaceLandmarker();
}

/** Resolves null when WASM/model init fails or times out — callers degrade
 * to heuristics-only guidance with manual capture. */
export function getFaceLandmarker(): Promise<FaceLandmarker | null> {
  if (!instancePromise) {
    instancePromise = withTimeout(create(), INIT_TIMEOUT_MS).then((r) => r ?? null);
  }
  return instancePromise;
}

/** VIDEO for the live loop, IMAGE for validating uploads. Centralized so the
 * two paths can't fight over the mode. */
export async function ensureRunningMode(mode: RunningMode): Promise<FaceLandmarker | null> {
  const lm = await getFaceLandmarker();
  if (!lm) return null;
  if (currentMode !== mode) {
    await lm.setOptions({ runningMode: mode });
    currentMode = mode;
  }
  return lm;
}

/** Free WASM memory when the scan flow unmounts. */
export function disposeFaceLandmarker(): void {
  instance?.close();
  instance = null;
  instancePromise = null;
  currentMode = "VIDEO";
}
