"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CameraIcon } from "@/components/ui/icons";
import type { StepConfig } from "@pore/shared/scan";
import { decodeOriginalFile, processSource } from "@/lib/scan/capture";
import { inspectFinalImage } from "@/lib/scan/image-validator";
import { evaluateBrowserFrame } from "@/lib/scan/quality-adapter";
import { newCaptureId, newFrameId, sha256Blob } from "@/lib/scan/provenance";
import type { CapturedShot } from "@/lib/scan/types";

export function UploadFallback({
  sessionId,
  step,
  stepNumber,
  totalSteps,
  onShot,
  onExit,
  onUseCamera,
}: {
  sessionId: string;
  step: StepConfig;
  stepNumber: number;
  totalSteps: number;
  onShot: (shot: CapturedShot) => void;
  onExit: () => void;
  onUseCamera: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const operationRef = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => headingRef.current?.focus(), [step.id]);
  useEffect(() => () => { operationRef.current += 1; }, []);

  const handleFile = async (file: File) => {
    const operation = ++operationRef.current;
    setBusy(true);
    setError(null);
    const captureId = newCaptureId();
    let decoded: Awaited<ReturnType<typeof decodeOriginalFile>> | null = null;
    try {
      decoded = await decodeOriginalFile(file);
      const originalDigest = await sha256Blob(file);
      const originalBrowser = await inspectFinalImage(decoded.source, decoded.width, decoded.height, Date.now(), null);
      const original = evaluateBrowserFrame(originalBrowser, {
        gate: "final",
        source: "upload",
        sessionId,
        captureId,
        frameId: newFrameId(),
        stepId: step.id,
        contentDigest: originalDigest,
        byteLength: file.size,
      });
      if (!original.result.passed) throw new UploadQualityFailure(original.result.correctiveAction?.message);

      const analysis = await processSource(decoded.source, decoded.width, decoded.height);
      const analysisDigest = await sha256Blob(analysis.blob);
      const analysisBitmap = await createImageBitmap(analysis.blob);
      let submitted;
      try {
        const submittedBrowser = await inspectFinalImage(
          analysisBitmap,
          analysisBitmap.width,
          analysisBitmap.height,
          originalBrowser.capturedAt,
          null,
        );
        submitted = evaluateBrowserFrame(submittedBrowser, {
          gate: "final",
          source: "upload",
          sessionId,
          captureId,
          frameId: newFrameId(),
          stepId: step.id,
          contentDigest: analysisDigest,
          byteLength: analysis.blob.size,
        });
      } finally {
        analysisBitmap.close();
      }
      if (!submitted.result.passed) throw new UploadQualityFailure(submitted.result.correctiveAction?.message);
      if (operation !== operationRef.current) return;
      onShot({
        stepId: step.id,
        source: "upload",
        originalBlob: file,
        originalMediaType: file.type || "application/octet-stream",
        analysisBlob: analysis.blob,
        base64: analysis.base64,
        mediaType: analysis.mediaType,
        analysisWidth: analysis.width,
        analysisHeight: analysis.height,
        liveQuality: original.result,
        originalQuality: original.result,
        acceptance: {
          sessionId,
          captureId,
          frameId: submitted.evidence.provenance.frameId,
          stepId: step.id,
          source: "upload",
          capturedAt: originalBrowser.capturedAt,
          contentDigest: analysisDigest,
          perceptualHash: submitted.evidence.image!.perceptualHash,
          width: analysis.width,
          height: analysis.height,
          yawDeg: submitted.evidence.face!.yawDeg,
          quality: submitted.result,
        },
        previewPerceptualHash: original.evidence.image!.perceptualHash,
        previewUrl: URL.createObjectURL(file),
      });
    } catch (caught) {
      if (operation === operationRef.current) {
        setError(caught instanceof UploadQualityFailure
          ? caught.message
          : "We couldn't verify that image. Choose a different photo.");
      }
    } finally {
      decoded?.close();
      if (operation === operationRef.current) setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 py-6">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Step {stepNumber} of {totalSteps} · {step.label}</p>
        <h1 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-semibold outline-none">Upload your {step.label.toLowerCase()} photo</h1>
        <p className="text-ink-muted">{step.hint}</p>
      </div>
      <Card>
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-muted">
          <li>Use a recent, full-resolution photo with exactly one face</li>
          <li>Keep forehead, cheeks, jaw, and chin visible in even light</li>
          <li>The requested angle must be clear and free of blur or obstruction</li>
        </ul>
      </Card>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.target.value = "";
        }}
      />
      <div className="space-y-2">
        <Button size="lg" className="w-full" disabled={busy} onClick={() => inputRef.current?.click()}>{busy ? "Checking original and final files…" : "Choose photo"}</Button>
        <Button variant="secondary" size="lg" className="w-full" disabled={busy} onClick={onUseCamera}><CameraIcon size={17} aria-hidden />Use camera instead</Button>
        <button onClick={onExit} className="w-full rounded-pill py-3 font-semibold text-ink hover:bg-ink/5">Go back</button>
      </div>
      {error && <p role="alert" className="text-center text-sm text-escalate">{error}</p>}
    </div>
  );
}

class UploadQualityFailure extends Error {
  constructor(message = "This photo did not pass quality checks. Choose another.") {
    super(message);
  }
}
