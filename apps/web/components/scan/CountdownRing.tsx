"use client";

/**
 * 3-2-1 auto-capture countdown: a ring sweeping around the shutter plus a
 * large numeral over the preview. Reduced-motion users get the numeral only
 * (the ring sweep is suppressed in globals.css).
 */

const R = 40;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** Sweeping ring, sized to wrap the 72px shutter button. */
export function CountdownRing({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <svg
      width="88"
      height="88"
      viewBox="0 0 88 88"
      className="pointer-events-none absolute -inset-2"
      aria-hidden
    >
      <circle
        cx="44"
        cy="44"
        r={R}
        fill="none"
        stroke="#9FC2B0"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        transform="rotate(-90 44 44)"
        className="scan-ring"
        style={{ ["--scan-ring-c" as string]: `${CIRCUMFERENCE}` }}
      />
    </svg>
  );
}

/** Big center numeral, re-popped on each tick via `key={seconds}`. */
export function CountdownNumeral({ seconds }: { seconds: number | null }) {
  if (seconds == null) return null;
  return (
    <div
      role="timer"
      aria-live="assertive"
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <span
        key={seconds}
        className="scan-pop font-display text-7xl font-semibold text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.55)]"
      >
        {seconds}
      </span>
    </div>
  );
}
