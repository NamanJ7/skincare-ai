"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/Button";
import { CheckIcon } from "@/components/ui/icons";
import type { StepConfig } from "@pore/shared/scan";
import type { CapturedShot } from "@/lib/scan/types";

export function PhotoReview({
  step,
  shot,
  appearance,
  onAccept,
  onRetake,
}: {
  step: StepConfig;
  shot: CapturedShot;
  appearance: "dark" | "light";
  onAccept: () => void;
  onRetake: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  const dark = appearance === "dark";
  const passed = shot.liveQuality.passed && shot.originalQuality.passed && shot.acceptance.quality.passed;
  const correction = shot.acceptance.quality.correctiveAction?.message;
  const mirror = shot.source === "camera" ? "[transform:scaleX(-1)]" : "";

  const photo = (
    <div className={`relative aspect-[3/4] w-full overflow-hidden bg-black ${dark ? "max-h-full rounded-[24px]" : "rounded-lg"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- private object URL */}
      <img src={shot.previewUrl} alt={`Your ${step.label.toLowerCase()} photo`} className={`absolute inset-0 h-full w-full object-cover ${mirror}`} />
    </div>
  );

  const banner = passed ? (
    <div className={`rounded-lg p-4 ${dark ? "bg-[rgba(50,72,63,0.5)]" : "bg-accent-soft"}`}>
      <div className="flex items-center gap-2 font-semibold">
        <span className={`flex h-6 w-6 items-center justify-center rounded-pill ${dark ? "bg-[#9FC2B0] text-[#0E0F0E]" : "bg-primary text-on-primary"}`}>
          <CheckIcon size={13} aria-hidden />
        </span>
        Quality checked
      </div>
      <ul className={`mt-2 space-y-1 text-sm ${dark ? "text-white/75" : "text-ink-muted"}`}>
        <li>Sharp</li>
        <li>Well lit</li>
        <li>Correct angle</li>
      </ul>
    </div>
  ) : (
    <div role="alert" className={`rounded-lg p-4 ${dark ? "bg-[rgba(197,112,93,0.28)]" : "bg-[#f7e8e3]"}`}>
      <p className="font-semibold">Retake required</p>
      <p className={`mt-1 text-sm ${dark ? "text-white/75" : "text-ink-muted"}`}>
        {correction ?? "This photo did not pass final quality validation."}
      </p>
    </div>
  );

  const actions = (
    <div className="space-y-2">
      {passed && <Button size="lg" className="w-full" onClick={onAccept}>Use this photo</Button>}
      <Button variant={passed ? "secondary" : "primary"} size="lg" className="w-full" onClick={onRetake}>Retake</Button>
    </div>
  );

  if (dark) {
    return (
      <div className="absolute inset-0 z-10 flex flex-col bg-[#0E0F0E] text-white">
        <div className="px-6 pb-2 pt-5 text-center">
          <h2 ref={headingRef} tabIndex={-1} className="font-display text-xl font-semibold outline-none">{step.label}</h2>
        </div>
        <div className="relative mx-auto flex w-full max-w-md flex-1 items-center justify-center px-4 py-2">{photo}</div>
        <div className="mx-auto w-full max-w-md space-y-3 px-6 pb-6 pt-3">{banner}{actions}</div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 py-6">
      <h1 ref={headingRef} tabIndex={-1} className="font-display text-2xl font-semibold outline-none">{step.label}</h1>
      {photo}{banner}{actions}
    </div>
  );
}
