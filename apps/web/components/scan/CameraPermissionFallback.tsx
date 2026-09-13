"use client";

/**
 * Rendered instead of the live capture screen when the camera is denied,
 * missing, or unsupported. Always offers the upload path — nobody gets
 * stuck at a permission wall.
 */
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { CameraStatus } from "@/lib/scan/use-camera";

const COPY: Record<"denied" | "unavailable" | "unsupported", { title: string; body: string }> = {
  denied: {
    title: "Pore needs your camera",
    body: "The guided scan uses your front camera to help you line up each angle. Your photos are analyzed once and never stored. If you blocked access, enable the camera for this site in your browser settings, then try again.",
  },
  unavailable: {
    title: "We couldn't find a camera",
    body: "Your device doesn't seem to have an available camera right now. You can upload three photos instead — we'll still check them for you.",
  },
  unsupported: {
    title: "This browser can't open the camera",
    body: "Live capture isn't supported here. Try a recent version of Chrome or Safari, or upload three photos instead.",
  },
};

export function CameraPermissionFallback({
  status,
  onRetry,
  onUpload,
  onExit,
}: {
  status: Extract<CameraStatus, "denied" | "unavailable" | "unsupported">;
  onRetry: () => void;
  onUpload: () => void;
  onExit: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const copy = COPY[status];

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 py-6">
      <Card>
        <div className="space-y-3">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="font-display text-2xl font-semibold outline-none"
          >
            {copy.title}
          </h1>
          <p className="text-ink-muted">{copy.body}</p>
        </div>
      </Card>
      <div className="space-y-2">
        {status !== "unsupported" && (
          <Button size="lg" className="w-full" onClick={onRetry}>
            {status === "denied" ? "Allow camera" : "Try again"}
          </Button>
        )}
        <Button
          variant={status === "unsupported" ? "primary" : "secondary"}
          size="lg"
          className="w-full"
          onClick={onUpload}
        >
          Upload photos instead
        </Button>
        <button
          onClick={onExit}
          className="w-full rounded-pill py-3 font-semibold text-ink transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          Go back
        </button>
      </div>
    </div>
  );
}
