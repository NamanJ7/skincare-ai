/**
 * Tone-aware flash dose for the guided-capture screen-flash illuminant.
 *
 * Both the native `flash="screen"` mode and the JS white-overlay fallback work
 * the same way: flood the display white and let the front camera catch the
 * reflected light. Deeper tones reflect less of that light back at a given
 * output, so they get more dose along both levers this product controls:
 *
 * - `level` — actual screen brightness (0..1), applied via expo-brightness in
 *   photo.tsx before either flash path fires. Expo SDK 56's CameraView `flash`
 *   prop itself has no numeric intensity API (confirmed against the SDK 56
 *   source — it's a discrete on/off/auto/screen enum), so this goes around it
 *   at the OS level instead of waiting for one to exist.
 * - `durationMs` — how long the illuminant stays up before the shutter fires.
 *
 * Whether raising app-level brightness actually affects the native
 * `flash="screen"` mode's own light output (vs. only the JS overlay, which is
 * unambiguously affected since it paints the same screen) is unconfirmed
 * until tested on a device — see TODOS.md.
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
