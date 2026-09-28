"use client";

/**
 * The single live instruction line. One message at a time (the quality
 * ladder + damper guarantee that), announced politely to screen readers.
 * Fixed height so the camera layout never shifts as messages change.
 */
import type { GuideState } from "./FaceGuideOverlay";

export function CaptureQualityFeedback({
  message,
  state,
}: {
  message: string;
  state: GuideState;
}) {
  return (
    <div aria-live="polite" className="flex h-10 items-center justify-center">
      <p
        className={`rounded-pill px-4 py-1.5 text-center text-sm font-medium backdrop-blur-sm transition-colors duration-300 ${
          state === "good"
            ? "bg-[rgba(50,72,63,0.55)] text-[#CFE4D8]"
            : "bg-[rgba(0,0,0,0.45)] text-white"
        }`}
      >
        {message}
      </p>
    </div>
  );
}
