import {
  QUALITY_CONFIG,
  evaluateQuality,
  type FrameEvidence,
  type QualityResult,
  type StepId,
} from "@pore/shared/scan";

import { deriveMotionObservation, type NativeFramePacket } from "./native-frame-evidence";
import { perceptualHashSimilarity } from "./pixel-evidence";

export interface NativeEvidenceIdentity {
  gate: "live" | "final";
  sessionId: string;
  stepId: StepId;
  frameId: string;
  capturedAt: number;
  captureId?: string;
  contentDigest?: string;
  byteLength?: number;
  previewPerceptualHash?: string;
  /**
   * Size of the still the photo output is configured to capture. Live guidance
   * runs on a VGA analysis stream, so without this the resolution gate would
   * judge the guidance frame and reject every frame regardless of the photo.
   * The final gate re-measures the real decoded bytes, so an optimistic
   * declaration here can never let an undersized capture through.
   */
  stillWidth?: number;
  stillHeight?: number;
}

/** Single fail-closed authority used by both automatic and manual shutters. */
export function canArmNativeCapture(options: {
  result: Pick<QualityResult, "passed"> | null;
  evaluatedFrameId: string | null;
  currentFrameId: string | null;
  fresh: boolean;
  legacyReady: boolean;
}): boolean {
  return Boolean(
    options.legacyReady &&
      options.fresh &&
      options.result?.passed === true &&
      options.evaluatedFrameId &&
      options.evaluatedFrameId === options.currentFrameId,
  );
}

export function evaluateNativePacket(
  packet: NativeFramePacket,
  previous: NativeFramePacket | null,
  identity: NativeEvidenceIdentity,
): { evidence: FrameEvidence; result: QualityResult } {
  const pixels = packet.pixels;
  const face = packet.faces[0];
  const similarity = previous?.pixels && pixels
    ? perceptualHashSimilarity(previous.pixels.perceptualHash, pixels.perceptualHash)
    : 0;
  const motion = deriveMotionObservation(previous, packet, similarity);
  const box = face ? {
    x: face.bounds.x / face.frameWidth,
    y: face.bounds.y / face.frameHeight,
    width: face.bounds.width / face.frameWidth,
    height: face.bounds.height / face.frameHeight,
  } : null;
  const inside = box
    ? Math.max(0, Math.min(1, box.x + box.width) - Math.max(0, box.x)) *
      Math.max(0, Math.min(1, box.y + box.height) - Math.max(0, box.y)) /
      Math.max(box.width * box.height, 1e-6)
    : 0;
  // Measured from the pixels, not inferred from landmark presence. ML Kit
  // *estimates* its landmarks, so the old `0.875 - landmarkCoverage` proxy
  // stayed clean under a hand or a mask (never firing) while dropping far-side
  // landmarks on a strong profile (firing on exactly the poses that require
  // turning). `regionalOcclusion` compares the real forehead/cheek/chin pixels
  // instead. No face at all is still fully occluded.
  const occlusion = !face ? 1 : (pixels?.occlusionRatio ?? 0);
  const evidence: FrameEvidence = {
    provenance: {
      gate: identity.gate,
      source: "camera",
      sessionId: identity.sessionId,
      captureId: identity.captureId,
      frameId: identity.frameId,
      capturedAt: identity.capturedAt,
      stepId: identity.stepId,
      contentDigest: identity.contentDigest,
      perceptualHash: pixels?.perceptualHash,
      previewPerceptualHash: identity.previewPerceptualHash,
    },
    face: {
      faceCount: packet.faces.length,
      box,
      yawDeg: face?.yawDeg ?? 0,
      pitchDeg: face?.pitchDeg ?? 0,
      rollDeg: face?.rollDeg ?? 0,
      completeness: inside,
      occlusionRatio: occlusion,
    },
    image: pixels ? {
      width: packet.width,
      height: packet.height,
      pixelCount: packet.width * packet.height,
      ...(identity.stillWidth != null || identity.stillHeight != null
        ? { stillWidth: identity.stillWidth, stillHeight: identity.stillHeight }
        : {}),
      byteLength: identity.byteLength,
      decodeValid: true,
      blankOrUniform: pixels.nearlyUniform,
      faceLumaMean: pixels.meanLuma * 255,
      faceLumaP10: pixels.lumaP10,
      faceLumaP90: pixels.lumaP90,
      faceLumaStdDev: pixels.lumaStdDev,
      faceContrast: pixels.dynamicRange * 255,
      shadowClipping: pixels.shadowClipping,
      highlightClipping: pixels.highlightClipping,
      glareRatio: pixels.glareRatio,
      skinSharpness: pixels.gradientEnergy,
      skinLaplacianVariance: pixels.laplacianVariance,
      leftFaceLuma: pixels.leftFaceLuma,
      rightFaceLuma: pixels.rightFaceLuma,
      lightingAsymmetry: pixels.cheekLumaDifference,
      backgroundLuma: pixels.backgroundLuma,
      backlightDelta: pixels.backlightDelta,
      perceptualHash: pixels.perceptualHash,
    } : null,
    motion: identity.gate === "live" ? {
      pixelMotion: motion ? 1 - motion.perceptualSimilarity : 1,
      landmarkMotion: motion
        ? Math.min(1, motion.centerDelta + motion.sizeDelta + (motion.yawDeltaDeg + motion.pitchDeltaDeg + motion.rollDeltaDeg) / 180)
        : 1,
      stable: Boolean(
        motion &&
        1 - motion.perceptualSimilarity <= QUALITY_CONFIG.motion.maxPixelMotion &&
        motion.centerDelta + motion.sizeDelta +
          (motion.yawDeltaDeg + motion.pitchDeltaDeg + motion.rollDeltaDeg) / 180 <=
          QUALITY_CONFIG.motion.maxLandmarkMotion,
      ),
    } : null,
  };
  return { evidence, result: evaluateQuality(evidence) };
}
