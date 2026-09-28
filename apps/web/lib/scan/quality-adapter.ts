/** Maps browser pixel/landmark measurements into the shared, testable policy. */
import {
  QUALITY_CONFIG,
  evaluateQuality,
  type FrameEvidence,
  type QualityProvenance,
  type QualityResult,
  type StepId,
} from "@pore/shared/scan";

import type { BrowserFrameEvidence } from "./browser-evidence";

export interface EvidenceIdentity {
  gate: "live" | "final";
  source: "camera" | "upload";
  sessionId: string;
  captureId?: string;
  frameId: string;
  stepId: StepId;
  contentDigest?: string;
  previewPerceptualHash?: string;
  byteLength?: number;
}

export interface EvaluatedBrowserFrame {
  evidence: FrameEvidence;
  result: QualityResult;
}

export function evaluateBrowserFrame(
  browser: BrowserFrameEvidence,
  identity: EvidenceIdentity,
): EvaluatedBrowserFrame {
  const provenance: QualityProvenance = {
    gate: identity.gate,
    source: identity.source,
    sessionId: identity.sessionId,
    captureId: identity.captureId,
    frameId: identity.frameId,
    capturedAt: browser.capturedAt,
    stepId: identity.stepId,
    contentDigest: identity.contentDigest,
    perceptualHash: browser.image.perceptualHash,
    previewPerceptualHash: identity.previewPerceptualHash,
  };
  const evidence: FrameEvidence = {
    provenance,
    face: {
      faceCount: browser.face.faceCount,
      box: browser.face.box,
      yawDeg: browser.face.yawDeg,
      pitchDeg: browser.face.pitchDeg,
      rollDeg: browser.face.rollDeg,
      completeness: browser.face.completeness,
      occlusionRatio: browser.image.facialSkinOcclusion,
    },
    image: {
      width: browser.image.width,
      height: browser.image.height,
      pixelCount: browser.image.pixelCount,
      byteLength: identity.byteLength,
      decodeValid: true,
      blankOrUniform:
        browser.image.blankOrUniform ||
        browser.image.faceLumaStdDev < QUALITY_CONFIG.integrity.minLumaStdDev ||
        browser.image.faceContrast < QUALITY_CONFIG.lighting.minFaceContrast,
      faceLumaMean: browser.image.faceLumaMean,
      faceLumaP10: browser.image.faceLumaP10,
      faceLumaP90: browser.image.faceLumaP90,
      faceLumaStdDev: browser.image.faceLumaStdDev,
      faceContrast: browser.image.faceContrast,
      shadowClipping: browser.image.shadowClipping,
      highlightClipping: browser.image.highlightClipping,
      glareRatio: browser.image.glareRatio,
      skinSharpness: browser.image.skinSharpness,
      skinLaplacianVariance: browser.image.skinLaplacianVariance,
      leftFaceLuma: browser.image.leftFaceLuma,
      rightFaceLuma: browser.image.rightFaceLuma,
      lightingAsymmetry: browser.image.lightingAsymmetry,
      backgroundLuma: browser.image.backgroundLuma,
      backlightDelta: browser.image.backlightDelta,
      perceptualHash: browser.image.perceptualHash,
    },
    motion:
      identity.gate === "live"
        ? {
            pixelMotion: browser.motion.pixelMotion,
            landmarkMotion: browser.motion.landmarkMotion,
            stable:
              browser.motion.pixelMotion <= QUALITY_CONFIG.motion.maxPixelMotion &&
              browser.motion.landmarkMotion <= QUALITY_CONFIG.motion.maxLandmarkMotion,
          }
        : null,
  };
  return { evidence, result: evaluateQuality(evidence) };
}
