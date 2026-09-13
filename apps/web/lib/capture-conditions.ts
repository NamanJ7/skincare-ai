/**
 * Measured capture optics -> model brief + deterministic confidence ceilings.
 *
 * WHY THIS EXISTS
 *
 * Every accepted capture already carries a full `QualityResult`: 19 metrics
 * measured off the real pixels, re-validated server-side, and bound to the
 * submitted bytes by SHA-256. Until now the pipeline validated all of it and
 * then sent the model nothing but the images — while the rubric asked the model
 * to *estimate* how good the lighting and focus were so it could calibrate
 * `confidence`. That estimated number is the one value
 * `MIN_ACTIONABLE_CONFIDENCE` gates every active on. The system was asking the
 * model to imagine something it had already measured.
 *
 * So this module does two things:
 *
 *  1. Tells the model what the optics actually were, in named limitations
 *     rather than scores. There is no "quality: 0.82" here on purpose — a
 *     composite score would be precision the measurement does not support.
 *  2. Caps confidence for the concerns a given limitation can *fake*, and only
 *     those. Glare and shine are the same pixels; crushed shadows read as
 *     pigment; soft focus both erases and invents texture. A model cannot be
 *     more certain than the optics allow, whatever number it returns.
 *
 * FAIL-SOFT, NEVER FAIL-WRONG. Any scalar this module cannot read produces no
 * brief line and no ceiling, so the worst case is exactly today's behaviour.
 * `capture-conditions.test.ts` pins the metric formats so drift breaks loudly
 * instead of silently disabling the ceilings.
 */
import {
  QUALITY_CONFIG,
  STEP_ORDER,
  type AnalysisReadySession,
  type QualityResult,
  type StepId,
} from "@pore/shared/scan";
import type { Assessment, ConcernKey } from "@pore/shared";

/**
 * A limitation that can make the camera lie about the skin. Named for the
 * optical cause, not the concern, because one cause can fake several concerns.
 */
export type CaptureLimitation =
  | "side_lighting"
  | "backlight"
  | "glare"
  | "shadow_loss"
  | "soft_focus"
  | "flat_light";

export interface PoseConditions {
  stepId: StepId;
  limitations: CaptureLimitation[];
  /** Human-readable, measured phrases for the prompt. Empty when clean. */
  notes: string[];
}

export interface CaptureConditions {
  poses: PoseConditions[];
  /** How many of the three captures each limitation affected. */
  affectedPoseCount: Partial<Record<CaptureLimitation, number>>;
}

/**
 * A metric that passed can still be close to its limit. These say how close is
 * close enough to matter: a ceiling metric within 70% of its cap, or a floor
 * metric within 35% above its floor.
 */
const MARGINAL_OF_CEILING = 0.7;
const MARGINAL_ABOVE_FLOOR = 1.35;

/**
 * A limitation present in every capture is a property of the whole session and
 * should stop an active outright; one bad angle out of three should not. The
 * two- and three-pose ceilings sit below `MIN_ACTIONABLE_CONFIDENCE` (0.7); the
 * single-pose ceiling stays above it and is informational.
 */
const CEILING_BY_AFFECTED_POSES: Record<number, number> = { 1: 0.8, 2: 0.65, 3: 0.55 };

/**
 * Which concerns each optical limitation can manufacture or erase.
 *
 * Every row is a physical claim about the sensor, not a guess. Keep it that
 * way: an entry that cannot be explained in one sentence does not belong here.
 */
const LIMITATION_CONCERNS: Record<CaptureLimitation, readonly ConcernKey[]> = {
  // Specular highlight and "shine" are indistinguishable in a single frame.
  glare: ["oiliness"],
  // Directional light manufactures tonal variation across the face.
  side_lighting: ["redness_appearance", "uneven_tone", "dark_spot_appearance"],
  backlight: ["redness_appearance", "uneven_tone", "dark_spot_appearance"],
  // Crushed shadows read as pigment.
  shadow_loss: ["dark_spot_appearance", "uneven_tone"],
  // Soft focus erases fine relief and invents it out of noise.
  soft_focus: ["texture_congestion", "fine_line_appearance", "acne_like_breakouts"],
  // Flat light hides the relief these concerns are read from.
  flat_light: ["texture_congestion", "fine_line_appearance", "dryness_flaking"],
};

/**
 * Concerns that lighting alone can produce, so a sighting at exactly one angle
 * is weak evidence. `prompts.ts` already asks the model to discount these; this
 * is the same rule enforced rather than requested.
 */
const LIGHTING_FAKEABLE: readonly ConcernKey[] = [
  "redness_appearance",
  "uneven_tone",
  "dark_spot_appearance",
  "oiliness",
];

/** Confidence a lighting-fakeable concern keeps when only one angle saw it. */
const UNCORROBORATED_CEILING = 0.6;

/** Scalars recovered from a pose's metrics. `null` means "could not read". */
interface PoseScalars {
  lightingAsymmetry: number | null;
  backlightDelta: number | null;
  shadowClipping: number | null;
  highlightClipping: number | null;
  glareRatio: number | null;
  gradientEnergy: number | null;
  laplacianVariance: number | null;
  faceContrast: number | null;
  faceLumaStdDev: number | null;
}

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Pull the Nth number out of a metric's composite `value` string.
 *
 * `quality-checks/index.ts` packs several scalars into one display string
 * (sharpness as "gradient/laplacian", clipping as "shadow/highlight/glare").
 * Parsing a formatted string is a coupling, so it is confined to this one
 * function and pinned by a test that builds the strings through the real check
 * functions rather than by hand.
 */
function packed(value: unknown, index: number, expected: number): number | null {
  if (typeof value !== "string") return null;
  const parts = value.split("/");
  if (parts.length !== expected) return null;
  const parsed = Number.parseFloat(parts[index] ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

export function readPoseScalars(quality: QualityResult): PoseScalars {
  const metrics = quality.metrics;
  return {
    lightingAsymmetry: numeric(metrics.lightingUniformity?.value),
    backlightDelta: numeric(metrics.backlighting?.value),
    shadowClipping: packed(metrics.clipping?.value, 0, 3),
    highlightClipping: packed(metrics.clipping?.value, 1, 3),
    glareRatio: packed(metrics.clipping?.value, 2, 3),
    gradientEnergy: packed(metrics.sharpness?.value, 0, 2),
    laplacianVariance: packed(metrics.sharpness?.value, 1, 2),
    faceContrast: packed(metrics.textureVisibility?.value, 0, 2),
    faceLumaStdDev: packed(metrics.textureVisibility?.value, 1, 2),
  };
}

const nearCeiling = (value: number | null, limit: number): boolean =>
  value != null && value >= limit * MARGINAL_OF_CEILING;

const nearFloor = (value: number | null, floor: number): boolean =>
  value != null && value <= floor * MARGINAL_ABOVE_FLOOR;

function assessPose(stepId: StepId, quality: QualityResult): PoseConditions {
  const s = readPoseScalars(quality);
  const { lighting, sharpness } = QUALITY_CONFIG;
  const limitations: CaptureLimitation[] = [];
  const notes: string[] = [];

  if (nearCeiling(s.lightingAsymmetry, lighting.maxLightingAsymmetry)) {
    limitations.push("side_lighting");
    notes.push(
      `uneven side lighting (left and right cheek brightness differ by ${Math.round(
        s.lightingAsymmetry! * 255,
      )} of 255)`,
    );
  }
  if (nearCeiling(s.backlightDelta, lighting.maxBacklightDelta)) {
    limitations.push("backlight");
    notes.push(
      `light behind the face (background is ${Math.round(s.backlightDelta!)} luma brighter than the skin)`,
    );
  }
  if (
    nearCeiling(s.glareRatio, lighting.maxGlareRatio) ||
    nearCeiling(s.highlightClipping, lighting.maxHighlightClipping)
  ) {
    limitations.push("glare");
    const share = Math.max(s.glareRatio ?? 0, s.highlightClipping ?? 0);
    notes.push(`specular glare on ${(share * 100).toFixed(1)}% of facial skin`);
  }
  if (nearCeiling(s.shadowClipping, lighting.maxShadowClipping)) {
    limitations.push("shadow_loss");
    notes.push(
      `lost shadow detail on ${(s.shadowClipping! * 100).toFixed(1)}% of facial skin`,
    );
  }
  if (
    nearFloor(s.gradientEnergy, sharpness.minGradientEnergy) ||
    nearFloor(s.laplacianVariance, sharpness.minLaplacianVariance)
  ) {
    limitations.push("soft_focus");
    notes.push("soft focus on the skin, close to the sharpness floor");
  }
  if (
    nearFloor(s.faceContrast, lighting.minFaceContrast) ||
    nearFloor(s.faceLumaStdDev, lighting.minFaceLumaStdDev)
  ) {
    limitations.push("flat_light");
    notes.push("very flat lighting, so surface relief is barely modelled");
  }

  return { stepId, limitations, notes };
}

/** Read the measured optics of a validated session. */
export function captureConditions(session: AnalysisReadySession): CaptureConditions {
  const poses: PoseConditions[] = [];
  const affectedPoseCount: Partial<Record<CaptureLimitation, number>> = {};

  for (const stepId of STEP_ORDER) {
    const capture = session.captures[stepId];
    if (!capture) continue;
    const pose = assessPose(stepId, capture.quality);
    poses.push(pose);
    for (const limitation of pose.limitations) {
      affectedPoseCount[limitation] = (affectedPoseCount[limitation] ?? 0) + 1;
    }
  }

  return { poses, affectedPoseCount };
}

/**
 * The prompt block. Named limitations with the measured figure behind them, and
 * an explicit instruction not to mistake an optical artefact for a skin finding.
 */
export function describeCaptureConditions(conditions: CaptureConditions): string | null {
  if (conditions.poses.length === 0) return null;
  const lines = conditions.poses.map((pose) =>
    pose.notes.length === 0
      ? `- ${pose.stepId}: no optical limitations measured.`
      : `- ${pose.stepId}: ${pose.notes.join("; ")}.`,
  );
  return [
    "Measured capture conditions, from Pore's own optical checks on these exact images:",
    ...lines,
    "These describe the CAMERA, not the skin. Lower your confidence for anything a listed limitation could explain, and never report a limitation itself as a skin concern.",
  ].join("\n");
}

/** Highest confidence each concern may claim, given what the optics allow. */
export function confidenceCeilings(
  conditions: CaptureConditions,
): Partial<Record<ConcernKey, number>> {
  const ceilings: Partial<Record<ConcernKey, number>> = {};
  for (const [limitation, count] of Object.entries(conditions.affectedPoseCount)) {
    const ceiling = CEILING_BY_AFFECTED_POSES[Math.min(count ?? 0, 3)];
    if (ceiling == null) continue;
    for (const concern of LIMITATION_CONCERNS[limitation as CaptureLimitation]) {
      // The most limited reading wins when several limitations overlap.
      ceilings[concern] = Math.min(ceilings[concern] ?? 1, ceiling);
    }
  }
  return ceilings;
}

const LIMITATION_REASON: Record<CaptureLimitation, string> = {
  side_lighting: "uneven side lighting in these photos limits this read",
  backlight: "light behind the face in these photos limits this read",
  glare: "glare on the skin in these photos limits this read",
  shadow_loss: "lost shadow detail in these photos limits this read",
  soft_focus: "soft focus in these photos limits this read",
  flat_light: "very flat lighting in these photos limits this read",
};

function reasonsFor(
  concern: ConcernKey,
  conditions: CaptureConditions,
): string[] {
  return (Object.keys(conditions.affectedPoseCount) as CaptureLimitation[])
    .filter((limitation) => LIMITATION_CONCERNS[limitation].includes(concern))
    .map((limitation) => LIMITATION_REASON[limitation]);
}

/**
 * Clamp the model's confidence to what the evidence supports.
 *
 * Two independent limits, both applied:
 *
 *  - measured optics, per concern (above);
 *  - cross-pose corroboration: a lighting-fakeable concern seen at exactly one
 *    of three angles is weak evidence. An empty pose list on a present finding
 *    is self-contradictory and is treated the same way.
 *
 * Confidence is only ever lowered, and the reason is appended to
 * `contributingFactors` so the user-facing "why" stays true to what happened.
 */
export function applyConfidenceLimits(
  assessment: Assessment,
  conditions: CaptureConditions,
): Assessment {
  const ceilings = confidenceCeilings(conditions);

  return {
    ...assessment,
    findings: assessment.findings.map((finding) => {
      if (!finding.present) return finding;

      const reasons: string[] = [];
      let confidence = finding.confidence;

      const opticalCeiling = ceilings[finding.concern];
      if (opticalCeiling != null && confidence > opticalCeiling) {
        confidence = opticalCeiling;
        reasons.push(...reasonsFor(finding.concern, conditions));
      }

      const uncorroborated =
        LIGHTING_FAKEABLE.includes(finding.concern) &&
        finding.observedInPoses.length <= 1;
      if (uncorroborated && confidence > UNCORROBORATED_CEILING) {
        confidence = UNCORROBORATED_CEILING;
        reasons.push(
          "only one of the three angles showed this, so it may be how the light fell",
        );
      }

      if (reasons.length === 0) return finding;
      return {
        ...finding,
        confidence,
        contributingFactors: [...finding.contributingFactors, ...reasons],
      };
    }),
  };
}

export type { PoseScalars };
