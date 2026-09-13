"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/Button";
import { STEP_CONFIGS, STEP_ORDER, type QualityResult, type StepId } from "@pore/shared/scan";
import type { CapturedShot } from "@/lib/scan/types";

export function ScanReview({
  shots,
  validation,
  error,
  busy,
  onRetakeStep,
  onSave,
}: {
  shots: Partial<Record<StepId, CapturedShot>>;
  validation: QualityResult;
  error: string | null;
  busy: boolean;
  onRetakeStep: (stepId: StepId) => void;
  onSave: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  const blockedStep = validation.correctiveAction && !validation.passed
    ? STEP_ORDER.find((stepId) => validation.blockingIssues.some((issue) =>
        shots[stepId]?.acceptance.quality.blockingIssues.some((shotIssue) => shotIssue.code === issue.code),
      ))
    : undefined;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 py-6">
      <div className="space-y-2 text-center">
        <h1 ref={headingRef} tabIndex={-1} className="font-display text-3xl font-semibold outline-none">Review your skin scan photos</h1>
        <p className="text-ink-muted">Every image must remain quality checked and represent a distinct requested angle.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STEP_ORDER.map((stepId) => {
          const shot = shots[stepId];
          if (!shot) return null;
          const step = STEP_CONFIGS[stepId];
          const passed = shot.acceptance.quality.passed && shot.originalQuality.passed && shot.liveQuality.passed;
          return (
            <div key={stepId} className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-[var(--shadow-card)]">
              <div className="relative aspect-[3/4] bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element -- private object URL */}
                <img src={shot.previewUrl} alt={`Your ${step.label.toLowerCase()} photo`} className={`absolute inset-0 h-full w-full object-cover ${shot.source === "camera" ? "[transform:scaleX(-1)]" : ""}`} />
              </div>
              <div className="space-y-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{step.label}</p>
                  <span className={`rounded-pill px-2.5 py-0.5 text-xs font-semibold ${passed ? "bg-accent-soft text-primary" : "bg-[#f7e8e3] text-escalate"}`}>{passed ? "Quality checked" : "Retake required"}</span>
                </div>
                <button onClick={() => onRetakeStep(stepId)} disabled={busy} className="w-full rounded-pill border border-hairline py-1.5 text-sm font-semibold disabled:opacity-50">Retake</button>
              </div>
            </div>
          );
        })}
      </div>
      {!validation.passed && (
        <div role="alert" className="rounded-lg bg-[#f7e8e3] p-4 text-sm text-escalate">
          {validation.correctiveAction?.message ?? "This three-photo session is not ready for analysis."}
          {blockedStep ? <button className="ml-2 font-semibold underline" onClick={() => onRetakeStep(blockedStep)}>Retake now</button> : null}
        </div>
      )}
      {error && <p role="alert" className="text-center text-sm text-escalate">{error}</p>}
      <div className="mx-auto w-full max-w-md space-y-3">
        <Button size="lg" className="w-full" onClick={onSave} disabled={busy || !validation.passed}>{busy ? "Verifying your session…" : "Save validated scan"}</Button>
        <p className="text-center text-xs leading-relaxed text-ink-muted">This browser capture checks and saves photo quality locally. It does not submit a skin analysis. Pore provides educational skincare insights, not medical diagnoses.</p>
      </div>
    </div>
  );
}
