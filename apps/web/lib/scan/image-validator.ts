/**
 * Browser detector/pixel evidence collection for the two scan gates.
 *
 * This module is deliberately policy-free. MediaPipe or canvas failures throw
 * and therefore fail closed; callers pass the resulting evidence to the pure
 * shared quality evaluator, which owns every acceptance threshold.
 */
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { QUALITY_CONFIG } from "@pore/shared/scan";

import {
  compareMotion,
  measureFace,
  measureImage,
  NO_MOTION_EVIDENCE,
  type BrowserFrameEvidence,
} from "./browser-evidence";
import type { FrozenCameraFrame } from "./capture";
import { ensureRunningMode } from "./face-landmarker";

export class QualityEvidenceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "QualityEvidenceError";
  }
}

/** Inspect the exact native-resolution crop retained for a possible shutter.
 * Running MediaPipe against the frozen crop keeps its normalized landmarks in
 * the same 3:4 coordinate space as the guide and pixel measurements. */
export function inspectPreviewFrame(
  detector: FaceLandmarker,
  frozen: FrozenCameraFrame,
  detectorTimestamp: number,
  previous: BrowserFrameEvidence | null,
): BrowserFrameEvidence {
  try {
    const result = detector.detectForVideo(frozen.source, detectorTimestamp);
    const face = measureFace(result);
    const image = measureImage(
      frozen.source,
      frozen.width,
      frozen.height,
      face,
      QUALITY_CONFIG.sampling.liveWidth,
    );
    const current = { face, image };
    const evidence: BrowserFrameEvidence = {
      capturedAt: frozen.capturedAt,
      sourceFrameTime: frozen.sourceFrameTime,
      face,
      image,
      motion: compareMotion(previous, current),
    };
    assertFiniteEvidence(evidence);
    return evidence;
  } catch (error) {
    throw new QualityEvidenceError("The live frame could not be quality checked", { cause: error });
  }
}

/** Re-run MediaPipe in IMAGE mode and re-read the exact full-resolution source.
 * Missing detector/model support is a hard failure, never an unchecked pass. */
export async function inspectFinalImage(
  source: CanvasImageSource,
  width: number,
  height: number,
  capturedAt: number,
  sourceFrameTime: number | null,
): Promise<BrowserFrameEvidence> {
  if (!width || !height) throw new QualityEvidenceError("The captured image has no pixels");
  const detector = await ensureRunningMode("IMAGE");
  if (!detector) throw new QualityEvidenceError("Face quality checks are unavailable");
  try {
    // Callers only provide browser raster sources (canvas, bitmap, or img).
    // CanvasImageSource also includes SVG in lib.dom, which MediaPipe's
    // narrower TexImageSource type excludes.
    const result = detector.detect(source as Parameters<FaceLandmarker["detect"]>[0]);
    const face = measureFace(result);
    const image = measureImage(
      source,
      width,
      height,
      face,
      QUALITY_CONFIG.sampling.finalWidth,
    );
    const evidence: BrowserFrameEvidence = {
      capturedAt,
      sourceFrameTime,
      face,
      image,
      // Final still-image policy does not infer stability from one image. The
      // accepted capture separately retains its multi-frame live gate result.
      motion: NO_MOTION_EVIDENCE,
    };
    assertFiniteEvidence(evidence);
    return evidence;
  } catch (error) {
    if (error instanceof QualityEvidenceError) throw error;
    throw new QualityEvidenceError("The captured image could not be quality checked", {
      cause: error,
    });
  }
}

export function assertFiniteEvidence(evidence: BrowserFrameEvidence): void {
  const numericValues = [
    evidence.capturedAt,
    evidence.face.center.x,
    evidence.face.center.y,
    evidence.face.widthRatio,
    evidence.face.heightRatio,
    evidence.face.yawDeg,
    evidence.face.pitchDeg,
    evidence.face.rollDeg,
    evidence.face.completeness,
    evidence.image.width,
    evidence.image.height,
    evidence.image.faceLumaMean,
    evidence.image.faceLumaP10,
    evidence.image.faceLumaP50,
    evidence.image.faceLumaP90,
    evidence.image.faceLumaStdDev,
    evidence.image.faceContrast,
    evidence.image.shadowClipping,
    evidence.image.highlightClipping,
    evidence.image.glareRatio,
    evidence.image.skinSharpness,
    evidence.image.skinLaplacianVariance,
    evidence.image.lightingAsymmetry,
    evidence.image.backlightDelta,
    evidence.motion.pixelMotion,
    evidence.motion.landmarkMotion,
  ];
  if (numericValues.some((value) => !Number.isFinite(value))) {
    throw new QualityEvidenceError("The captured image returned invalid quality measurements");
  }
  if (!/^[a-f0-9]{16}$/u.test(evidence.image.perceptualHash)) {
    throw new QualityEvidenceError("The captured image has no valid fingerprint");
  }
}
