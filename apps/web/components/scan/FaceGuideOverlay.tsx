"use client";

/**
 * Face-shaped guide over the live preview: a dimming scrim with an oval
 * cutout, a dashed outline that turns soft green when the frame is good, and
 * step-specific hints (eye/chin ticks for the front view; a pulsing
 * turn-direction arrow for the cheek views).
 *
 * Purely presentational. Drawn in a 300×400 viewBox stretched over the 3:4
 * preview container, so coordinates are stable. `screenDirection` is already
 * expressed for the mirrored preview (it matches the user's own turn
 * direction) — see steps.ts.
 */
import { useId } from "react";

import type { StepConfig } from "@pore/shared/scan";

export type GuideState = "searching" | "adjust" | "good";

const STROKE: Record<GuideState, string> = {
  searching: "rgba(255,255,255,0.45)",
  adjust: "rgba(255,255,255,0.85)",
  good: "#9FC2B0",
};

export function FaceGuideOverlay({ step, state }: { step: StepConfig; state: GuideState }) {
  const maskId = useId();
  const side = step.guide === "side";
  const dir = step.screenDirection === "left" ? -1 : 1;

  // Oval ~62% of preview width, mirroring the mobile flow's 250×330 guide.
  const cx = side ? 150 + dir * 12 : 150;
  const cy = 188;
  const rx = 93;
  const ry = 126;
  const tilt = side ? dir * 5 : 0;
  const ellipseTransform = `rotate(${tilt} ${cx} ${cy})`;

  return (
    <svg
      viewBox="0 0 300 400"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        <mask id={maskId}>
          <rect width="300" height="400" fill="white" />
          <ellipse cx={cx} cy={cy} rx={rx} ry={ry} transform={ellipseTransform} fill="black" />
        </mask>
      </defs>

      {/* Scrim outside the face frame */}
      <rect width="300" height="400" fill="rgba(10,11,10,0.55)" mask={`url(#${maskId})`} />

      {/* Dashed guide outline — stroke color tracks capture readiness */}
      <ellipse
        cx={cx}
        cy={cy}
        rx={rx}
        ry={ry}
        transform={ellipseTransform}
        fill="none"
        stroke={STROKE[state]}
        strokeWidth="2.5"
        strokeDasharray="10 8"
        strokeLinecap="round"
        style={{ transition: "stroke 0.35s var(--ease-soft)" }}
      />

      {state === "good" && (
        <ellipse
          cx={cx}
          cy={cy}
          rx={rx + 5}
          ry={ry + 5}
          transform={ellipseTransform}
          fill="none"
          stroke="rgba(159,194,176,0.35)"
          strokeWidth="6"
          className="scan-fade-in"
        />
      )}

      {/* Front view: subtle eye-line and chin alignment ticks */}
      {!side && (
        <g stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round">
          <line x1="112" y1="168" x2="132" y2="168" />
          <line x1="168" y1="168" x2="188" y2="168" />
          <line x1="141" y1="292" x2="159" y2="292" />
        </g>
      )}

      {/* Cheek views: pulsing chevrons showing which way to turn */}
      {side && (
        <g
          stroke="rgba(255,255,255,0.9)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        >
          {[0, 1, 2].map((i) => {
            const x = 150 + dir * (rx + 22 + i * 16);
            return (
              <path
                key={i}
                d={`M${x - dir * 7} ${cy - 12} L${x} ${cy} L${x - dir * 7} ${cy + 12}`}
                className="scan-arrow"
                style={{ animationDelay: `${i * 0.18}s` }}
              />
            );
          })}
        </g>
      )}
    </svg>
  );
}
