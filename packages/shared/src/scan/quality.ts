/**
 * The quality ladder — pure, DOM-free, unit-tested.
 *
 * Exactly one instruction at a time: the first failing rung wins, in the
 * product-defined priority order (no face → multiple faces → out of frame →
 * distance → lighting → blur → angle → occlusion). Soft gates: `blocked` is
 * reserved for clearly unusable frames; review still offers "Use anyway".
 *
 * Numeric checks use enter/exit bands keyed off the previous code so a value
 * hovering at a threshold doesn't flap between verdicts (the display-level
 * hold time lives in capture-machine.ts `dampFeedback`).
 */
import type { FaceMetrics, ImageStats, QualityCode, QualityVerdict, StepConfig } from "./types";

export const THRESHOLDS = {
  /** Mean luma below this is too dark; must recover above `lumaDarkExit`. */
  lumaDarkEnter: 70,
  lumaDarkExit: 85,
  lumaBrightEnter: 190,
  lumaBrightExit: 178,
  /** Fraction of clipped pixels that flags harsh light/shadows. */
  clippedEnter: 0.1,
  clippedExit: 0.07,
  /** Severe exposure → blocked. */
  lumaSevereDark: 40,
  lumaSevereBright: 225,
  /** Gradient-energy sharpness on the 64px sampling canvas. */
  sharpEnter: 28,
  sharpExit: 40,
  sharpSevere: 10,
  /** Degrees of slack applied when recovering from an angle verdict. */
  yawHysteresis: 4,
} as const;

function verdict(
  level: QualityVerdict["level"],
  code: QualityCode,
): QualityVerdict {
  return { level, code, readyForAutoCapture: level === "good" && code === "ok" };
}

/**
 * `face` null = detector unavailable (heuristics-only ladder subset).
 * `stats` null = no pixel sample yet this frame (skip exposure/blur rungs).
 * `prevCode` enables enter/exit hysteresis bands.
 */
export function analyzeFrame(
  face: FaceMetrics | null,
  stats: ImageStats | null,
  step: StepConfig,
  prevCode: QualityCode = "ok",
): QualityVerdict {
  // --- Face rungs (skipped entirely when the detector is unavailable) -----
  if (face) {
    if (face.faceCount === 0) return verdict("blocked", "no_face");
    if (face.faceCount > 1) return verdict("blocked", "multiple_faces");

    const dx = Math.abs(face.center.x - 0.5);
    const dy = Math.abs(face.center.y - 0.5);
    if (dx > step.centerTolerance.x || dy > step.centerTolerance.y) {
      return verdict("acceptable", "out_of_frame");
    }

    if (face.widthRatio > step.faceWidthBand.max) return verdict("acceptable", "too_close");
    if (face.widthRatio < step.faceWidthBand.min) return verdict("acceptable", "too_far");
  }

  // --- Lighting ------------------------------------------------------------
  if (stats) {
    const darkEnter = prevCode === "too_dark" ? THRESHOLDS.lumaDarkExit : THRESHOLDS.lumaDarkEnter;
    const brightEnter =
      prevCode === "too_bright" ? THRESHOLDS.lumaBrightExit : THRESHOLDS.lumaBrightEnter;
    const clipped = prevCode === "too_dark" || prevCode === "too_bright"
      ? THRESHOLDS.clippedExit
      : THRESHOLDS.clippedEnter;

    if (stats.lumaMean < THRESHOLDS.lumaSevereDark) return verdict("blocked", "too_dark");
    if (stats.lumaMean > THRESHOLDS.lumaSevereBright) return verdict("blocked", "too_bright");
    if (stats.lumaMean < darkEnter || stats.clippedShadows > clipped) {
      return verdict("acceptable", "too_dark");
    }
    if (stats.lumaMean > brightEnter || stats.clippedHighlights > clipped) {
      return verdict("acceptable", "too_bright");
    }

    // --- Blur ---------------------------------------------------------------
    const sharpEnter = prevCode === "blurry" ? THRESHOLDS.sharpExit : THRESHOLDS.sharpEnter;
    if (stats.sharpness < THRESHOLDS.sharpSevere) return verdict("blocked", "blurry");
    if (stats.sharpness < sharpEnter) return verdict("acceptable", "blurry");
  }

  // --- Angle ----------------------------------------------------------------
  if (face) {
    const slack =
      prevCode === "turn_more" || prevCode === "turn_back" ||
      prevCode === "turn_other_way" || prevCode === "face_forward"
        ? THRESHOLDS.yawHysteresis
        : 0;
    const min = step.yaw.min + slack;
    const max = step.yaw.max - slack;

    if (step.guide === "front") {
      if (face.yawDeg < min || face.yawDeg > max) return verdict("acceptable", "face_forward");
    } else {
      // Side steps: the band is entirely positive (right cheek) or entirely
      // negative (left cheek). Wrong-way turns beat "turn more" in clarity.
      const wantsPositive = step.yaw.min > 0;
      const signedYaw = wantsPositive ? face.yawDeg : -face.yawDeg;
      const lo = wantsPositive ? min : -max;
      const hi = wantsPositive ? max : -min;
      if (signedYaw < -10) return verdict("acceptable", "turn_other_way");
      if (signedYaw < lo) return verdict("acceptable", "turn_more");
      if (signedYaw > hi) return verdict("acceptable", "turn_back");
    }

    // FUTURE VISION-API INTEGRATION POINT: occlusion detection (hair, hands,
    // glasses, masks) belongs here — emit `occluded` as "acceptable" only.
  }

  // Detector unavailable and no pixel stats yet → nothing to judge.
  if (!face && !stats) return verdict("acceptable", "ok");

  // Heuristics-only mode can never fully verify framing, so cap at acceptable.
  if (!face) return { level: "acceptable", code: "ok", readyForAutoCapture: false };

  return verdict("good", "ok");
}

/**
 * Post-capture assessment from pixel stats alone — the lighting and blur
 * rungs with no face metrics. For platforms without a live detector (native
 * mobile judges the already-taken photo). Framing can't be verified, so a
 * clean result caps at `acceptable`, same as heuristics-only mode. No
 * hysteresis: a one-shot judgement has no previous frame to flap against.
 */
export function assessImageStats(stats: ImageStats): QualityVerdict {
  return analyzeFrame(null, stats, ASSESS_STEP);
}

/** Only the face rungs read the step config, and they're skipped here. */
const ASSESS_STEP: StepConfig = {
  id: "front",
  index: 0,
  label: "",
  title: "",
  hint: "",
  guide: "front",
  yaw: { min: -12, max: 12 },
  faceWidthBand: { min: 0, max: 1 },
  centerTolerance: { x: 1, y: 1 },
};
