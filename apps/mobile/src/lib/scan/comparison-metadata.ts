import {
  STEP_ORDER,
  type FrameEvidence,
  type QualityResult,
  type StepId,
} from "@pore/shared/scan";

/** Capture conditions retained so later scans are compared only like-for-like. */
export interface PoseComparisonMetadata {
  stepId: StepId;
  capturedAt: number;
  width: number;
  height: number;
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
  faceWidthRatio: number;
  faceCenterX: number;
  faceCenterY: number;
  faceLumaMean: number;
  lightingAsymmetry: number;
  backlightDelta: number;
  shadowClipping: number;
  highlightClipping: number;
  skinSharpness: number;
  skinLaplacianVariance: number;
  qualityScore: number;
  qualityConfidence: number;
}

export interface ScanComparisonMetadata {
  configVersion: string;
  poses: Record<StepId, PoseComparisonMetadata>;
}

export interface ComparisonMetadataInput {
  stepId: StepId;
  capturedAt: number;
  evidence: FrameEvidence;
  result: QualityResult;
}

export function buildScanComparisonMetadata(
  inputs: readonly ComparisonMetadataInput[],
): ScanComparisonMetadata | null {
  const poses: Partial<Record<StepId, PoseComparisonMetadata>> = {};
  let configVersion: string | null = null;

  for (const stepId of STEP_ORDER) {
    const input = inputs.find((candidate) => candidate.stepId === stepId);
    const face = input?.evidence.face;
    const image = input?.evidence.image;
    const box = face?.box;
    if (!input || !face || !image || !box || !input.result.passed) return null;
    if (configVersion != null && configVersion !== input.result.configVersion)
      return null;
    configVersion = input.result.configVersion;

    poses[stepId] = {
      stepId,
      capturedAt: input.capturedAt,
      width: image.width,
      height: image.height,
      yawDeg: face.yawDeg,
      pitchDeg: face.pitchDeg,
      rollDeg: face.rollDeg,
      faceWidthRatio: box.width,
      faceCenterX: box.x + box.width / 2,
      faceCenterY: box.y + box.height / 2,
      faceLumaMean: image.faceLumaMean,
      lightingAsymmetry: image.lightingAsymmetry,
      backlightDelta: image.backlightDelta,
      shadowClipping: image.shadowClipping,
      highlightClipping: image.highlightClipping,
      skinSharpness: image.skinSharpness,
      skinLaplacianVariance: image.skinLaplacianVariance,
      qualityScore: input.result.overallScore,
      qualityConfidence: input.result.confidence,
    };
  }

  if (!configVersion) return null;
  return {
    configVersion,
    poses: poses as Record<StepId, PoseComparisonMetadata>,
  };
}
