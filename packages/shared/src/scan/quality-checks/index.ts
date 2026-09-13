import { QUALITY_CONFIG, type QualityConfig } from "../quality-config";
import type {
  FaceEvidence,
  FrameEvidence,
  QualityCheckResult,
  QualityIssue,
  QualityIssueCode,
  QualityMetric,
  QualityMetricName,
} from "../quality-contract";
import type { StepId } from "../types";

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const finite = (...values: number[]): boolean => values.every(Number.isFinite);

function metric(
  passed: boolean,
  score: number,
  confidence: number,
  value?: QualityMetric["value"],
  threshold?: QualityMetric["threshold"],
  detail?: string,
): QualityMetric {
  return { passed, score: clamp01(score), confidence: clamp01(confidence), value, threshold, detail };
}

function issue(code: QualityIssueCode, name: QualityMetricName, detail: string): QualityIssue {
  return { code, metric: name, severity: "blocking", detail };
}

function unavailable(name: QualityMetricName, detail: string): QualityMetric {
  return metric(false, 0, 0, undefined, undefined, `${name}: ${detail}`);
}

function faceOrUnavailable(evidence: FrameEvidence): FaceEvidence | null {
  return evidence.face && finite(
    evidence.face.faceCount,
    evidence.face.yawDeg,
    evidence.face.pitchDeg,
    evidence.face.rollDeg,
    evidence.face.completeness,
    evidence.face.occlusionRatio,
  ) ? evidence.face : null;
}

/** Decode/content/provenance validity. Missing or non-finite evidence fails closed. */
export function checkIntegrity(
  evidence: FrameEvidence,
  config: QualityConfig = QUALITY_CONFIG,
  now: number = Date.now(),
): QualityCheckResult {
  const { provenance, image } = evidence;
  const idsValid = provenance.sessionId.length > 0 && provenance.frameId.length > 0;
  const timeValid = finite(provenance.capturedAt) && provenance.capturedAt <= now + config.integrity.maxFutureSkewMs;
  const finalIdentityValid = provenance.gate !== "final" || (
    Boolean(provenance.captureId) &&
    /^[a-f0-9]{64}$/i.test(provenance.contentDigest ?? "")
  );
  const imageNumbers = image ? [
    image.width,
    image.height,
    image.pixelCount,
    image.faceLumaMean,
    image.faceLumaP10,
    image.faceLumaP90,
    image.faceLumaStdDev,
    image.faceContrast,
    image.shadowClipping,
    image.highlightClipping,
    image.glareRatio,
    image.skinSharpness,
    image.skinLaplacianVariance,
    image.leftFaceLuma,
    image.rightFaceLuma,
    image.lightingAsymmetry,
    image.backgroundLuma,
    image.backlightDelta,
  ] : [];
  const imageValid = Boolean(
    image && image.decodeValid && finite(...imageNumbers) &&
    /^[a-f0-9]{16}$/i.test(image.perceptualHash) &&
    image.perceptualHash.toLowerCase() === (provenance.perceptualHash ?? "").toLowerCase(),
  );
  const byteLengthValid = provenance.gate !== "final" || (
    image?.byteLength != null && Number.isFinite(image.byteLength) && image.byteLength >= config.integrity.minByteLength
  );
  const blank = image?.blankOrUniform === true || (
    image != null && image.faceLumaStdDev < config.integrity.minLumaStdDev
  );
  const previewMatch = provenance.gate !== "final" || provenance.source === "upload" || (
    /^[a-f0-9]{16}$/i.test(provenance.previewPerceptualHash ?? "") &&
    image != null &&
    perceptualHashDistance(provenance.previewPerceptualHash!, image.perceptualHash) <=
      config.duplicate.maxPreviewFinalPerceptualDistance
  );
  const passed = idsValid && timeValid && finalIdentityValid && imageValid && byteLengthValid && !blank && previewMatch;
  const issues: QualityIssue[] = [];
  if (!image || !image.decodeValid) {
    // Same missing evidence, two very different causes. At the final gate the
    // bytes really did fail to decode. On a live frame the camera is working —
    // the platform just could not sample facial skin from it (face too small,
    // too far off-centre, or a strong profile hiding a cheek). Reporting a
    // decode failure there hands the user an instruction they cannot act on.
    issues.push(
      provenance.gate === "live" && image == null
        ? issue("skin_not_measurable", "integrity", "No facial-skin pixels could be sampled from this frame.")
        : issue("corrupt_image", "integrity", "Image bytes did not decode."),
    );
  }
  else if (!imageValid || !idsValid || !timeValid || !finalIdentityValid || !byteLengthValid) {
    issues.push(issue("invalid_frame", "integrity", "Required frame identity or finite pixel evidence is missing."));
  } else if (blank) issues.push(issue("blank_or_covered", "integrity", "The frame is blank, covered, or nearly uniform."));
  else if (!previewMatch) issues.push(issue("preview_mismatch", "integrity", "Final pixels do not match the armed live frame."));
  return {
    metrics: {
      integrity: metric(passed, passed ? 1 : 0, image ? 1 : 0, passed, "valid decoded current frame"),
    },
    issues,
  };
}

/**
 * Analysis-image and detected-face pixel minimums.
 *
 * The two gates measure different things on purpose. A FINAL frame is the
 * capture, so its own dimensions are the analysis dimensions. A LIVE frame is
 * guidance: on native it is a VGA analysis stream feeding a multi-megapixel
 * photo output, so judging the stream's dimensions would reject every frame no
 * matter how good the photo would be. The platform therefore declares the still
 * it is configured to produce, and the frame's own pixels are held only to the
 * face-box floor the live measurements actually need.
 */
export function checkResolution(
  evidence: FrameEvidence,
  config: QualityConfig = QUALITY_CONFIG,
): QualityCheckResult {
  const image = evidence.image;
  const face = faceOrUnavailable(evidence);
  if (!image || !finite(image.width, image.height, image.pixelCount)) {
    return { metrics: { resolution: unavailable("resolution", "Resolution evidence is missing.") }, issues: [issue("low_resolution", "resolution", "Image resolution is unavailable.")] };
  }
  const live = evidence.provenance.gate === "live";
  // Face pixels are always measured on the frame that produced the face box.
  const faceWidthPx = face?.box ? face.box.width * image.width : 0;
  const minFaceWidth = live ? config.resolution.minLiveFaceWidthPx : config.resolution.minFaceWidthPx;

  // A declared still describes an image these measurements never saw, so a
  // partial or non-finite declaration fails closed rather than falling back to
  // the guidance frame it was meant to replace.
  const declared = live && (image.stillWidth != null || image.stillHeight != null);
  if (declared && !finite(image.stillWidth ?? Number.NaN, image.stillHeight ?? Number.NaN)) {
    return {
      metrics: { resolution: unavailable("resolution", "Declared capture dimensions are invalid.") },
      issues: [issue("low_resolution", "resolution", "The camera did not report a usable capture size.")],
    };
  }
  const analysisWidth = declared ? image.stillWidth! : image.width;
  const analysisHeight = declared ? image.stillHeight! : image.height;
  const analysisPixels = declared ? analysisWidth * analysisHeight : image.pixelCount;

  const { minWidth, minHeight, minPixelCount } = config.resolution;
  const passed = analysisWidth >= minWidth &&
    analysisHeight >= minHeight &&
    analysisPixels >= minPixelCount &&
    faceWidthPx >= minFaceWidth;
  return {
    metrics: {
      resolution: metric(
        passed,
        Math.min(1, analysisPixels / minPixelCount, faceWidthPx / minFaceWidth),
        face?.box ? 1 : 0.5,
        `${analysisWidth}x${analysisHeight}${declared ? " (capture)" : ""}; face ${Math.round(faceWidthPx)}px`,
        `>=${minWidth}x${minHeight}; face >=${minFaceWidth}px`,
      ),
    },
    issues: passed ? [] : [issue("low_resolution", "resolution", "The image or facial region has too few pixels.")],
  };
}

/** Face detector presence and exactly-one-face rule. */
export function checkFaceCount(evidence: FrameEvidence): QualityCheckResult {
  const face = faceOrUnavailable(evidence);
  const count = face?.faceCount;
  const detected = count != null && count > 0;
  const single = count === 1;
  const issues: QualityIssue[] = [];
  if (!detected) issues.push(issue("no_face", "faceDetection", "No valid face was detected."));
  else if (!single) issues.push(issue("multiple_faces", "singleFace", "More than one face was detected."));
  return {
    metrics: {
      faceDetection: metric(detected, detected ? 1 : 0, face ? 1 : 0, count ?? "missing", "at least one"),
      singleFace: metric(single, single ? 1 : 0, face ? 1 : 0, count ?? "missing", 1),
    },
    issues,
  };
}

/** Face completeness, distance, and centering. */
export function checkFraming(
  evidence: FrameEvidence,
  stepId: StepId,
  config: QualityConfig = QUALITY_CONFIG,
): QualityCheckResult {
  const face = faceOrUnavailable(evidence);
  if (!face || face.faceCount !== 1 || !face.box || !finite(face.box.x, face.box.y, face.box.width, face.box.height)) {
    return {
      metrics: {
        faceCompleteness: unavailable("faceCompleteness", "A single face box is required."),
        faceSize: unavailable("faceSize", "A single face box is required."),
        faceCentering: unavailable("faceCentering", "A single face box is required."),
      },
      issues: [],
    };
  }
  const side = stepId !== "front";
  const band = side ? config.face.sideWidthRatio : config.face.frontWidthRatio;
  const tolerance = side ? config.face.sideCenterTolerance : config.face.frontCenterTolerance;
  const cx = face.box.x + face.box.width / 2;
  const cy = face.box.y + face.box.height / 2;
  const completenessPassed = face.completeness >= config.face.minCompleteness;
  const sizePassed = face.box.width >= band.min && face.box.width <= band.max;
  const centered = Math.abs(cx - 0.5) <= tolerance.x && Math.abs(cy - 0.5) <= tolerance.y;
  const issues: QualityIssue[] = [];
  if (!completenessPassed) issues.push(issue("face_out_of_frame", "faceCompleteness", "Forehead, cheeks, jaw, or chin leave the frame."));
  if (!sizePassed) issues.push(issue(face.box.width < band.min ? "too_far" : "too_close", "faceSize", "Face size is outside the calibrated band."));
  if (!centered) issues.push(issue("face_out_of_frame", "faceCentering", "Face centre is outside the guide tolerance."));
  return {
    metrics: {
      faceCompleteness: metric(completenessPassed, clamp01(face.completeness), 1, face.completeness, config.face.minCompleteness),
      faceSize: metric(sizePassed, clamp01(face.box.width / band.min), 1, face.box.width, `${band.min}-${band.max}`),
      faceCentering: metric(centered, clamp01(1 - Math.hypot(cx - 0.5, cy - 0.5)), 1, `${cx.toFixed(3)},${cy.toFixed(3)}`, `±${tolerance.x},±${tolerance.y}`),
    },
    issues,
  };
}

/** Sharpness is measured only in cheek/forehead/chin skin regions. */
export function checkFacialSharpness(
  evidence: FrameEvidence,
  config: QualityConfig = QUALITY_CONFIG,
): QualityCheckResult {
  const image = evidence.image;
  if (!image || !finite(image.skinSharpness, image.skinLaplacianVariance)) {
    return { metrics: { sharpness: unavailable("sharpness", "Facial-skin sharpness evidence is missing.") }, issues: [issue("blurry", "sharpness", "Facial-skin sharpness could not be measured.")] };
  }
  const passed = image.skinSharpness >= config.sharpness.minGradientEnergy &&
    image.skinLaplacianVariance >= config.sharpness.minLaplacianVariance;
  const severe = image.skinSharpness < config.sharpness.severeGradientEnergy ||
    image.skinLaplacianVariance < config.sharpness.severeLaplacianVariance;
  return {
    metrics: {
      sharpness: metric(
        passed,
        Math.min(1, image.skinSharpness / config.sharpness.minGradientEnergy, image.skinLaplacianVariance / config.sharpness.minLaplacianVariance),
        1,
        `${image.skinSharpness.toFixed(1)}/${image.skinLaplacianVariance.toFixed(1)}`,
        `>=${config.sharpness.minGradientEnergy}/>=${config.sharpness.minLaplacianVariance}`,
      ),
    },
    issues: passed ? [] : [issue(severe ? "lens_dirty" : "blurry", "sharpness", "Facial skin is not sufficiently sharp.")],
  };
}

/** Face-region exposure, clipping, glare, uniformity, backlight, and texture. */
export function checkLighting(
  evidence: FrameEvidence,
  config: QualityConfig = QUALITY_CONFIG,
): QualityCheckResult {
  const image = evidence.image;
  if (!image) {
    const missing = unavailable("exposure", "Facial lighting evidence is missing.");
    return { metrics: { exposure: missing, clipping: missing, lightingUniformity: missing, backlighting: missing, textureVisibility: missing }, issues: [issue("too_dark", "exposure", "Facial lighting could not be measured.")] };
  }
  const valid = finite(
    image.faceLumaP10, image.faceLumaP90, image.faceLumaStdDev, image.faceContrast,
    image.shadowClipping, image.highlightClipping, image.glareRatio,
    image.lightingAsymmetry, image.backlightDelta,
  );
  if (!valid) return { metrics: { exposure: unavailable("exposure", "Lighting values are non-finite.") }, issues: [issue("invalid_frame", "exposure", "Lighting values are invalid.")] };
  const dark = image.faceLumaP10 < config.lighting.minFaceLumaP10;
  const bright = image.faceLumaP90 > config.lighting.maxFaceLumaP90;
  const exposurePassed = !dark && !bright;
  const clippingPassed = image.shadowClipping <= config.lighting.maxShadowClipping &&
    image.highlightClipping <= config.lighting.maxHighlightClipping &&
    image.glareRatio <= config.lighting.maxGlareRatio;
  const uniform = image.lightingAsymmetry <= config.lighting.maxLightingAsymmetry;
  const backlight = image.backlightDelta > config.lighting.maxBacklightDelta;
  const texture = image.faceContrast >= config.lighting.minFaceContrast &&
    image.faceLumaStdDev >= config.lighting.minFaceLumaStdDev;
  const issues: QualityIssue[] = [];
  if (backlight) issues.push(issue("backlit", "backlighting", "The background is much brighter than the face."));
  if (dark || image.shadowClipping > config.lighting.maxShadowClipping) issues.push(issue("too_dark", "exposure", "Facial skin contains excessive shadow loss."));
  if (bright || image.highlightClipping > config.lighting.maxHighlightClipping) issues.push(issue("too_bright", "exposure", "Facial skin contains excessive highlight loss."));
  if (image.glareRatio > config.lighting.maxGlareRatio) issues.push(issue("glare", "clipping", "Strong facial glare obscures skin detail."));
  if (!uniform) issues.push(issue("uneven_lighting", "lightingUniformity", "One side of the face is materially darker."));
  if (!texture) issues.push(issue("low_texture", "textureVisibility", "Lighting or processing erased measurable skin texture."));
  return {
    metrics: {
      exposure: metric(exposurePassed, exposurePassed ? 1 : 0, 1, `${image.faceLumaP10.toFixed(1)}-${image.faceLumaP90.toFixed(1)}`, `${config.lighting.minFaceLumaP10}-${config.lighting.maxFaceLumaP90}`),
      clipping: metric(clippingPassed, clamp01(1 - Math.max(image.shadowClipping / config.lighting.maxShadowClipping, image.highlightClipping / config.lighting.maxHighlightClipping, image.glareRatio / config.lighting.maxGlareRatio) / 2), 1, `${image.shadowClipping.toFixed(3)}/${image.highlightClipping.toFixed(3)}/${image.glareRatio.toFixed(3)}`),
      lightingUniformity: metric(uniform, clamp01(1 - image.lightingAsymmetry), 1, image.lightingAsymmetry, config.lighting.maxLightingAsymmetry),
      backlighting: metric(!backlight, clamp01(1 - Math.max(0, image.backlightDelta) / (config.lighting.maxBacklightDelta * 2)), 1, image.backlightDelta, config.lighting.maxBacklightDelta),
      textureVisibility: metric(texture, Math.min(1, image.faceContrast / config.lighting.minFaceContrast, image.faceLumaStdDev / config.lighting.minFaceLumaStdDev), 1, `${image.faceContrast.toFixed(1)}/${image.faceLumaStdDev.toFixed(1)}`),
    },
    issues,
  };
}

/** Target yaw plus level pitch/roll. */
export function checkPose(
  evidence: FrameEvidence,
  stepId: StepId,
  config: QualityConfig = QUALITY_CONFIG,
): QualityCheckResult {
  const face = faceOrUnavailable(evidence);
  if (!face || face.faceCount !== 1) {
    return { metrics: { yaw: unavailable("yaw", "Pose requires one face."), pitch: unavailable("pitch", "Pose requires one face."), roll: unavailable("roll", "Pose requires one face."), targetPose: unavailable("targetPose", "Pose requires one face.") }, issues: [] };
  }
  const band = stepId === "front" ? config.pose.frontYawDeg : stepId === "right" ? config.pose.rightYawDeg : config.pose.leftYawDeg;
  const yawPassed = face.yawDeg >= band.min && face.yawDeg <= band.max;
  const pitchPassed = Math.abs(face.pitchDeg) <= config.pose.maxAbsPitchDeg;
  const rollPassed = Math.abs(face.rollDeg) <= config.pose.maxAbsRollDeg;
  let yawCode: QualityIssueCode = "wrong_pose";
  if (stepId !== "front") {
    const signed = stepId === "right" ? face.yawDeg : -face.yawDeg;
    if (signed >= 0 && signed < Math.abs(band.min)) yawCode = "turn_more";
    else if (signed > Math.abs(band.max)) yawCode = "turn_back";
  }
  const issues: QualityIssue[] = [];
  if (!yawPassed) issues.push(issue(yawCode, "targetPose", `Yaw ${face.yawDeg.toFixed(1)}° does not match ${stepId}.`));
  if (!pitchPassed) issues.push(issue("pitch", "pitch", `Pitch ${face.pitchDeg.toFixed(1)}° exceeds tolerance.`));
  if (!rollPassed) issues.push(issue("roll", "roll", `Roll ${face.rollDeg.toFixed(1)}° exceeds tolerance.`));
  return {
    metrics: {
      yaw: metric(yawPassed, yawPassed ? 1 : clamp01(1 - Math.min(Math.abs(face.yawDeg - band.min), Math.abs(face.yawDeg - band.max)) / 90), 1, face.yawDeg, `${band.min}-${band.max}`),
      pitch: metric(pitchPassed, clamp01(1 - Math.abs(face.pitchDeg) / 45), 1, face.pitchDeg, `±${config.pose.maxAbsPitchDeg}`),
      roll: metric(rollPassed, clamp01(1 - Math.abs(face.rollDeg) / 45), 1, face.rollDeg, `±${config.pose.maxAbsRollDeg}`),
      targetPose: metric(yawPassed && pitchPassed && rollPassed, yawPassed && pitchPassed && rollPassed ? 1 : 0, 1, stepId),
    },
    issues,
  };
}

/** Live same-frame pixel/landmark stability. */
export function checkMotionAndStability(
  evidence: FrameEvidence,
  config: QualityConfig = QUALITY_CONFIG,
): QualityCheckResult {
  if (evidence.provenance.gate !== "live") {
    return { metrics: { motion: metric(true, 1, 1, "final sharpness gate", "not required") }, issues: [] };
  }
  const motion = evidence.motion;
  if (!motion || !finite(motion.pixelMotion, motion.landmarkMotion)) {
    return { metrics: { motion: unavailable("motion", "Fresh same-frame motion evidence is missing.") }, issues: [issue("stability_incomplete", "motion", "Stability has not been measured on fresh frames.")] };
  }
  const passed = motion.stable && motion.pixelMotion <= config.motion.maxPixelMotion &&
    motion.landmarkMotion <= config.motion.maxLandmarkMotion;
  return {
    metrics: { motion: metric(passed, clamp01(1 - Math.max(motion.pixelMotion / config.motion.maxPixelMotion, motion.landmarkMotion / config.motion.maxLandmarkMotion) / 2), 1, `${motion.pixelMotion.toFixed(3)}/${motion.landmarkMotion.toFixed(3)}`, `<=${config.motion.maxPixelMotion}/<=${config.motion.maxLandmarkMotion}`) },
    issues: passed ? [] : [issue("motion", "motion", "The face or camera moved between frames.")],
  };
}

/** Facial skin visibility/occlusion. */
export function checkOcclusion(
  evidence: FrameEvidence,
  config: QualityConfig = QUALITY_CONFIG,
): QualityCheckResult {
  const face = faceOrUnavailable(evidence);
  if (!face || face.faceCount !== 1) {
    return { metrics: { occlusion: unavailable("occlusion", "Occlusion requires one face.") }, issues: [] };
  }
  const passed = face.occlusionRatio <= config.occlusion.maxFacialSkinOcclusion;
  return {
    metrics: { occlusion: metric(passed, clamp01(1 - face.occlusionRatio), 1, face.occlusionRatio, config.occlusion.maxFacialSkinOcclusion) },
    issues: passed ? [] : [issue("occluded", "occlusion", "Pore couldn't verify enough of the forehead, cheeks, and chin.")],
  };
}

/** Normalized Hamming distance for two 64-bit hexadecimal difference hashes. */
export function perceptualHashDistance(a: string, b: string): number {
  if (!/^[a-f0-9]{16}$/i.test(a) || !/^[a-f0-9]{16}$/i.test(b)) return 1;
  let bits = 0;
  for (let index = 0; index < 16; index++) {
    let xor = Number.parseInt(a[index]!, 16) ^ Number.parseInt(b[index]!, 16);
    while (xor) {
      bits += xor & 1;
      xor >>>= 1;
    }
  }
  return bits / 64;
}
