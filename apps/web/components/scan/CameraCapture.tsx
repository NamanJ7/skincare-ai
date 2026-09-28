"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";

import {
  createConsecutiveFrameTracker,
  type QualityResult,
  type StepConfig,
} from "@pore/shared/scan";

import { CameraPermissionFallback } from "./CameraPermissionFallback";
import { CaptureQualityFeedback } from "./CaptureQualityFeedback";
import { FaceGuideOverlay, type GuideState } from "./FaceGuideOverlay";
import { PhotoReview } from "./PhotoReview";
import {
  encodeValidatedCameraOriginal,
  freezeVideoFrame,
  processSource,
} from "@/lib/scan/capture";
import { ensureRunningMode } from "@/lib/scan/face-landmarker";
import { inspectFinalImage, inspectPreviewFrame } from "@/lib/scan/image-validator";
import { evaluateBrowserFrame, type EvaluatedBrowserFrame } from "@/lib/scan/quality-adapter";
import { newCaptureId, newFrameId, sha256Blob } from "@/lib/scan/provenance";
import { useCamera } from "@/lib/scan/use-camera";
import type { BrowserFrameEvidence } from "@/lib/scan/browser-evidence";
import type { CapturedShot } from "@/lib/scan/types";

const EVALUATION_INTERVAL_MS = 180;

export function CameraCapture({
  sessionId,
  step,
  stepNumber,
  totalSteps,
  pendingShot,
  onShot,
  onAccept,
  onRetake,
  onExit,
  onUploadInstead,
}: {
  sessionId: string;
  step: StepConfig;
  stepNumber: number;
  totalSteps: number;
  pendingShot: CapturedShot | null;
  onShot: (shot: CapturedShot) => void;
  onAccept: () => void;
  onRetake: () => void;
  onExit: () => void;
  onUploadInstead: () => void;
}) {
  const { videoRef, status, start, stop, switchCamera, hasMultipleCameras } = useCamera();
  const detectorRef = useRef<FaceLandmarker | null>(null);
  const previousFrameRef = useRef<BrowserFrameEvidence | null>(null);
  const trackerRef = useRef(createConsecutiveFrameTracker());
  const armedFrameRef = useRef<EvaluatedBrowserFrame | null>(null);
  const operationRef = useRef(0);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [detectorStatus, setDetectorStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [result, setResult] = useState<QualityResult | null>(null);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [finalError, setFinalError] = useState<string | null>(null);

  useEffect(() => {
    start();
    return stop;
  }, [start, stop]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step.id]);

  const resetEvaluation = useCallback(() => {
    operationRef.current += 1;
    previousFrameRef.current = null;
    trackerRef.current.reset();
    armedFrameRef.current = null;
    setReady(false);
    setResult(null);
    setFinalError(null);
  }, []);

  const handleRetake = useCallback(() => {
    resetEvaluation();
    onRetake();
  }, [onRetake, resetEvaluation]);

  useEffect(() => {
    let cancelled = false;
    if (pendingShot || status !== "active") return;
    void ensureRunningMode("VIDEO").then((detector) => {
      if (cancelled) return;
      detectorRef.current = detector;
      setDetectorStatus(detector ? "ready" : "unavailable");
      if (!detector) {
        trackerRef.current.reset();
        setReady(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pendingShot, status, step.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (status !== "active" || pendingShot || capturing || !video || detectorStatus !== "ready") return;
    let disposed = false;
    let rafId = 0;
    let videoFrameId = 0;
    let lastEvaluationAt = 0;

    const evaluate = (now: number, mediaTime: number | null) => {
      if (disposed) return;
      schedule();
      if (now - lastEvaluationAt < EVALUATION_INTERVAL_MS || video.readyState < 2) return;
      lastEvaluationAt = now;
      const detector = detectorRef.current;
      if (!detector) return;
      try {
        const frozen = freezeVideoFrame(video, mediaTime);
        const browser = inspectPreviewFrame(detector, frozen, now, previousFrameRef.current);
        previousFrameRef.current = browser;
        const evaluated = evaluateBrowserFrame(browser, {
          gate: "live",
          source: "camera",
          sessionId,
          frameId: newFrameId(),
          stepId: step.id,
        });
        const snapshot = trackerRef.current.push(evaluated.evidence, evaluated.result);
        setResult(evaluated.result);
        setReady(snapshot.ready);
        if (snapshot.ready) armedFrameRef.current = evaluated;
        else armedFrameRef.current = null;
      } catch {
        previousFrameRef.current = null;
        trackerRef.current.reset();
        armedFrameRef.current = null;
        setReady(false);
        setResult(null);
        setFinalError("We couldn't verify this camera frame. Hold still and try again.");
      }
    };

    const schedule = () => {
      if (disposed) return;
      if ("requestVideoFrameCallback" in video) {
        videoFrameId = video.requestVideoFrameCallback((now, metadata) => evaluate(now, metadata.mediaTime));
      } else {
        rafId = requestAnimationFrame((now) => evaluate(now, null));
      }
    };
    schedule();
    return () => {
      disposed = true;
      if (videoFrameId && "cancelVideoFrameCallback" in video) video.cancelVideoFrameCallback(videoFrameId);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [capturing, detectorStatus, pendingShot, sessionId, status, step.id, videoRef]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") (pendingShot ? handleRetake : onExit)();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingShot, handleRetake, onExit]);

  const capture = async () => {
    const video = videoRef.current;
    const armed = armedFrameRef.current;
    if (!video || !ready || !armed || capturing) return;
    const operation = ++operationRef.current;
    setCapturing(true);
    setReady(false);
    setFinalError(null);
    try {
      const frozen = freezeVideoFrame(video);
      const captureId = newCaptureId();
      const original = await encodeValidatedCameraOriginal(frozen.source, frozen.width, frozen.height);
      const originalDigest = await sha256Blob(original.blob);
      const originalBitmap = await createImageBitmap(original.blob);
      let originalEvaluated: EvaluatedBrowserFrame;
      let analysis;
      try {
        const originalBrowser = await inspectFinalImage(
          originalBitmap,
          originalBitmap.width,
          originalBitmap.height,
          frozen.capturedAt,
          frozen.sourceFrameTime,
        );
        originalEvaluated = evaluateBrowserFrame(originalBrowser, {
          gate: "final",
          source: "camera",
          sessionId,
          captureId,
          frameId: newFrameId(),
          stepId: step.id,
          contentDigest: originalDigest,
          previewPerceptualHash: armed.evidence.image!.perceptualHash,
          byteLength: original.blob.size,
        });
        if (!originalEvaluated.result.passed) {
          throw new FinalQualityFailure(originalEvaluated.result);
        }
        analysis = await processSource(originalBitmap, originalBitmap.width, originalBitmap.height);
      } finally {
        originalBitmap.close();
      }

      // Compression is part of the submitted file identity. Decode and re-run
      // the final gate so encoding can never erase accepted facial detail.
      const analysisDigest = await sha256Blob(analysis.blob);
      const analysisBitmap = await createImageBitmap(analysis.blob);
      let submitted: EvaluatedBrowserFrame;
      try {
        const submittedBrowser = await inspectFinalImage(
          analysisBitmap,
          analysisBitmap.width,
          analysisBitmap.height,
          frozen.capturedAt,
          frozen.sourceFrameTime,
        );
        submitted = evaluateBrowserFrame(submittedBrowser, {
          gate: "final",
          source: "camera",
          sessionId,
          captureId,
          frameId: newFrameId(),
          stepId: step.id,
          contentDigest: analysisDigest,
          previewPerceptualHash: armed.evidence.image!.perceptualHash,
          byteLength: analysis.blob.size,
        });
      } finally {
        analysisBitmap.close();
      }
      if (!submitted.result.passed) throw new FinalQualityFailure(submitted.result);
      if (operation !== operationRef.current) return;
      onShot({
        stepId: step.id,
        source: "camera",
        originalBlob: original.blob,
        originalMediaType: original.mediaType,
        analysisBlob: analysis.blob,
        base64: analysis.base64,
        mediaType: analysis.mediaType,
        analysisWidth: analysis.width,
        analysisHeight: analysis.height,
        liveQuality: armed.result,
        originalQuality: originalEvaluated.result,
        acceptance: {
          sessionId,
          captureId,
          frameId: submitted.evidence.provenance.frameId,
          stepId: step.id,
          source: "camera",
          capturedAt: frozen.capturedAt,
          contentDigest: analysisDigest,
          perceptualHash: submitted.evidence.image!.perceptualHash,
          width: analysis.width,
          height: analysis.height,
          yawDeg: submitted.evidence.face!.yawDeg,
          quality: submitted.result,
        },
        previewPerceptualHash: armed.evidence.image!.perceptualHash,
        previewUrl: URL.createObjectURL(original.blob),
      });
    } catch (error) {
      if (operation !== operationRef.current) return;
      const message = error instanceof FinalQualityFailure
        ? error.result.correctiveAction?.message ?? "This photo did not pass quality checks. Retake it."
        : "We couldn't verify the final photo. Retake it.";
      setFinalError(message);
      trackerRef.current.reset();
      armedFrameRef.current = null;
      previousFrameRef.current = null;
      setResult(null);
      void ensureRunningMode("VIDEO").then((detector) => {
        detectorRef.current = detector;
        setDetectorStatus(detector ? "ready" : "unavailable");
      });
    } finally {
      // Unconditional: if `operationRef` was bumped mid-capture (a reset, or a
      // second shutter press) the success path and this both used to be skipped,
      // latching `capturing` true forever — which stops the evaluation loop from
      // restarting and leaves the shutter permanently disabled with no error.
      // Staleness only matters for the paths that write result state, above.
      setCapturing(false);
    }
  };

  if (status === "denied" || status === "unavailable" || status === "unsupported") {
    return (
      <CameraPermissionFallback
        status={status}
        onRetry={start}
        onUpload={onUploadInstead}
        onExit={onExit}
      />
    );
  }

  const starting = status !== "active";
  const guideState: GuideState = ready
    ? "good"
    : result?.blockingIssues.some((issue) => issue.code === "no_face")
      ? "searching"
      : "adjust";
  const instruction = finalError ?? (starting
    ? "Starting camera…"
    : detectorStatus === "loading"
      ? "Preparing quality checks…"
      : detectorStatus === "unavailable"
        ? "Quality checks are unavailable on this device."
        : ready
          ? "Ready — capture now."
          : result?.correctiveAction?.message ?? "Hold still while quality is checked.");

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0E0F0E] text-white">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <button onClick={onExit} className="rounded-pill px-3 py-1.5 text-sm font-medium text-white/85 hover:bg-white/10">
          ← Back
        </button>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
          Step {stepNumber} of {totalSteps}
        </p>
        <div className="w-[68px]" aria-hidden />
      </div>
      <div className="flex gap-1.5 px-4 sm:px-6" role="progressbar" aria-valuemin={1} aria-valuemax={totalSteps} aria-valuenow={stepNumber}>
        {Array.from({ length: totalSteps }, (_, index) => (
          <div key={index} className={`h-1 flex-1 rounded-pill ${index < stepNumber ? "bg-[#9FC2B0]" : "bg-white/20"}`} />
        ))}
      </div>
      <div className="px-6 pb-2 pt-4 text-center">
        <h1 ref={headingRef} tabIndex={-1} className="font-display text-xl font-semibold outline-none">{step.title}</h1>
        <p className="mt-1 text-sm text-white/70">{step.hint}</p>
      </div>
      <div className="relative mx-auto flex w-full max-w-md flex-1 items-center justify-center px-4 py-2">
        <div className="relative aspect-[3/4] max-h-full w-full overflow-hidden rounded-[24px] bg-black">
          <video ref={videoRef} autoPlay muted playsInline aria-label="Camera preview" className="absolute inset-0 h-full w-full object-cover [transform:scaleX(-1)]" />
          {!starting && <FaceGuideOverlay step={step} state={guideState} />}
        </div>
      </div>
      <div className="px-6 pb-6 pt-2">
        <CaptureQualityFeedback message={instruction} state={guideState} />
        <div className="mt-3 flex items-center justify-between">
          <button onClick={onUploadInstead} disabled={capturing} className="w-20 text-left text-sm text-white/70 disabled:opacity-40">Upload</button>
          <button
            aria-label="Take photo"
            aria-disabled={!ready || capturing}
            disabled={!ready || capturing || starting || detectorStatus !== "ready"}
            onClick={() => void capture()}
            className="flex h-[72px] w-[72px] items-center justify-center rounded-pill border-4 border-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <span className="block h-14 w-14 rounded-pill bg-white" />
          </button>
          {hasMultipleCameras ? (
            <button aria-label="Switch camera" disabled={capturing} onClick={switchCamera} className="flex w-20 justify-end text-sm text-white/70 disabled:opacity-40">Switch</button>
          ) : <div className="w-20" aria-hidden />}
        </div>
        <p className="mt-3 h-4 text-center text-xs text-white/45">
          {capturing ? "Validating the full-resolution photo…" : ready ? "Quality checked" : "Capture unlocks after several stable passing frames"}
        </p>
      </div>
      {pendingShot && (
        <PhotoReview step={step} shot={pendingShot} appearance="dark" onAccept={onAccept} onRetake={handleRetake} />
      )}
    </div>
  );
}

class FinalQualityFailure extends Error {
  constructor(readonly result: QualityResult) {
    super(result.correctiveAction?.message ?? "Final quality validation failed");
  }
}
