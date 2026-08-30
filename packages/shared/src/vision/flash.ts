/**
 * Tone-aware flash dose for the guided-capture screen-flash illuminant.
 *
 * Both the native `flash="screen"` mode and the JS white-overlay fallback work
 * the same way: flood the display white and let the front camera catch the
 * reflected light. Screen brightness is already maxed at pure white either
 * way, so duration is the only lever either path can control without adding a
 * new dependency (e.g. expo-brightness) — see photo.tsx. Deeper tones reflect
 * less of that light back at a given output, so they get more dose.
 *
 * `level` is carried for a future platform that does expose a continuous
 * intensity control; nothing consumes it today (Expo SDK 56's CameraView
 * `flash` prop is a discrete on/off/auto/screen enum, confirmed against the
 * SDK 56 source — no numeric intensity API exists to apply it to).
 *
 * These numbers are provisional — seeded from the same "deeper tones need
 * more" reasoning as CAPTURE_TUNING's TONE_PROFILE, not measured on a real
 * device. They MUST be tuned against real captures before launch — see
 * TODOS.md.
 */
import type { SkinTone } from "../types/intake";

export interface FlashIntensity {
  /** 0..1 relative brightness the platform should target, if it can. Provisional. */
  level: number;
  /** How long the illuminant stays up before the shutter fires, ms. */
  durationMs: number;
}

export const FLASH_TUNING = {
  minDurationMs: 200,
  maxDurationMs: 320,
} as const;

const FLASH_TONE_PROFILE: Record<SkinTone, FlashIntensity> = {
  very_fair: { level: 0.6, durationMs: 200 },
  fair: { level: 0.7, durationMs: 220 },
  medium: { level: 0.8, durationMs: 240 },
  olive: { level: 0.85, durationMs: 260 },
  brown: { level: 0.95, durationMs: 280 },
  deep: { level: 1.0, durationMs: 300 },
};

export function flashIntensityForTone(tone: SkinTone): FlashIntensity {
  return FLASH_TONE_PROFILE[tone];
}
