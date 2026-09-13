"use client";

/**
 * Screen 1 — preparation checklist. Mount also kicks off the MediaPipe
 * warmup so the detector is usually ready by the time the camera opens.
 */
import { useEffect, useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CameraIcon, CheckIcon, SunIcon } from "@/components/ui/icons";
import { preloadFaceLandmarker } from "@/lib/scan/face-landmarker";

const CHECKLIST: Array<{ icon: "check" | "sun" | "camera"; text: string }> = [
  { icon: "check", text: "Remove glasses, hats, and face masks" },
  { icon: "check", text: "Pull hair away from your face" },
  { icon: "sun", text: "Use bright, even lighting near a window" },
  { icon: "sun", text: "Avoid harsh shadows or direct flash" },
  { icon: "check", text: "Keep your face makeup-free when possible" },
  { icon: "camera", text: "Clean your camera lens" },
];

const ICONS = {
  check: CheckIcon,
  sun: SunIcon,
  camera: CameraIcon,
};

export function SkinScanIntro({
  onStart,
  capturedCount,
  banner,
}: {
  onStart: (mode: "camera" | "upload") => void;
  capturedCount: number;
  banner?: ReactNode;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    preloadFaceLandmarker();
    headingRef.current?.focus();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 py-6">
      {banner}

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Guided skin scan
        </p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-3xl font-semibold leading-tight outline-none sm:text-4xl"
        >
          Let&rsquo;s get a clear look at your skin
        </h1>
        <p className="text-ink-muted">
          Take three photos in natural, even lighting. We&rsquo;ll guide you through every angle.
        </p>
      </div>

      <Card>
        <ul className="space-y-3.5">
          {CHECKLIST.map(({ icon, text }) => {
            const Icon = ICONS[icon];
            return (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-accent-soft text-primary">
                  <Icon size={15} aria-hidden />
                </span>
                <span className="text-[15px]">{text}</span>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="space-y-3">
        <Button size="lg" className="w-full" onClick={() => onStart("camera")}>
          <CameraIcon size={18} aria-hidden />
          {capturedCount > 0 ? `Continue scan (${capturedCount} of 3 done)` : "Start skin scan"}
        </Button>
        <Button variant="secondary" size="lg" className="w-full" onClick={() => onStart("upload")}>
          Upload photos instead
        </Button>
        <p className="text-center text-xs text-ink-muted">
          Your photos are analyzed once and never stored.
        </p>
      </div>
    </div>
  );
}
