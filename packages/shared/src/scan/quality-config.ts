/**
 * Central calibration policy for every scan quality gate.
 *
 * Values are intentionally conservative. Calibrate them with consented,
 * labelled captures split by device, resolution, lighting, and skin tone. Do
 * not lower a threshold merely to make a demo pass; every change needs a
 * regression fixture and a config-version bump.
 */
export const QUALITY_CONFIG = {
  version: "2026-07-27.1",

  sampling: {
    /**
     * Width both browser gates normalize to before measuring pixels.
     *
     * live and final MUST match. Gradient and Laplacian energy are
     * scale-dependent — the same physical detail measured with a fixed
     * one-pixel stencil reads roughly four times weaker when the canvas
     * doubles. While live sampled 192 and final sampled 384 against one shared
     * sharpness threshold, the live gate was systematically the more permissive
     * of the two: a frame could arm the shutter and then fail the final gate on
     * the identical pixels, which is the unwinnable-retake shape this file
     * exists to prevent. Pinned by quality-config.test.ts.
     */
    liveWidth: 384,
    finalWidth: 384,
  },

  integrity: {
    /** A final JPEG below this size is commonly empty, truncated, or over-compressed. */
    minByteLength: 20_000,
    /** Minimum facial-region luma deviation; lower values are nearly uniform/covered. */
    minLumaStdDev: 7,
    /** Small allowance for device clocks completing just after the validation timestamp. */
    maxFutureSkewMs: 5_000,
  },

  resolution: {
    /**
     * Smallest guidance-frame short edge the live gate has to tolerate.
     *
     * Native streams VGA (640x480) analysis frames on purpose: the frame
     * processor budget buys nothing larger, and the live gate judges *readiness
     * to shoot*, not the photo. Any live threshold measured against the
     * guidance frame must therefore be satisfiable at this size and at the
     * minimum accepted framing ratio — pinned by quality-config.test.ts, which
     * exists because a 720px live floor applied to a VGA frame silently made
     * the shutter unreachable on every device.
     */
    minLiveFrameShortEdge: 480,
    /** Face-box width in guidance-frame pixels needed for live pixel evidence. */
    minLiveFaceWidthPx: 110,
    /**
     * Floors for the image that will actually be analyzed.
     *
     * On a live camera frame that is NOT the guidance frame — the platform
     * declares the still its photo output will produce as
     * `stillWidth`/`stillHeight`, and these floors are applied to that. Where
     * the previewed frame *is* the future capture (the browser encodes the same
     * crop it measured) no declaration is made and the frame dimensions are
     * used directly. The final gate always re-applies these to the real decoded
     * bytes, so a declaration can never launder an undersized capture.
     */
    minWidth: 720,
    minHeight: 720,
    minPixelCount: 720 * 720,
    /** Minimum face-box width in source pixels needed for skin texture analysis. */
    minFaceWidthPx: 260,
    /**
     * Reference width for the framing-vs-face-pixels sanity check.
     *
     * The final gate runs against the analysis derivative, so the framing
     * ratios must still yield `minFaceWidthPx` there — otherwise a capture can
     * pass framing on its original pixels and then fail the re-check. The real
     * derivative is capped far above this (see mobile's ANALYSIS_MAX_WIDTH);
     * this is the conservative width the ratio floors are pinned against by
     * quality-config.test.ts, not a resize target.
     */
    analysisTargetWidth: 1024,
    /**
     * Width the analysis derivative is actually encoded at.
     *
     * Deliberately separate from `analysisTargetWidth`, which is a conservative
     * *reference* for the framing-vs-face-pixels invariant and explicitly "not
     * a resize target" — yet the browser was using it as one, shipping 1024px
     * images to a model that resolves detail up to 2576px on the long edge.
     * Mobile already encodes at 2576 (apps/mobile/.../analysis-image.ts), so
     * the browser was handing the same model roughly 2.5x less linear
     * resolution for no reason. Raising the encode ceiling cannot loosen any
     * gate: the framing floors stay pinned to the smaller reference, and the
     * final gate re-measures whatever it is actually given.
     */
    analysisMaxWidth: 2576,
  },

  face: {
    /**
     * Face box width / frame width. Side poses tolerate a slightly smaller box,
     * but not below `minFaceWidthPx / analysisTargetWidth` (~0.254) — see above.
     */
    frontWidthRatio: { min: 0.28, max: 0.58 },
    sideWidthRatio: { min: 0.26, max: 0.58 },
    /** Maximum normalized displacement from the capture guide centre. */
    frontCenterTolerance: { x: 0.16, y: 0.18 },
    sideCenterTolerance: { x: 0.2, y: 0.18 },
    /** Share of the face/required landmarks that must remain inside the source image. */
    minCompleteness: 0.97,
  },

  sharpness: {
    /** Mean squared skin-region gradient after normalized sampling. */
    minGradientEnergy: 34,
    /** Four-neighbour Laplacian variance, resistant to a sharp background. */
    minLaplacianVariance: 52,
    /** Below either severe limit, guidance suggests cleaning/checking the lens. */
    severeGradientEnergy: 15,
    severeLaplacianVariance: 22,
  },

  motion: {
    /** Maximum normalized change in the facial pixel signature between fresh frames. */
    maxPixelMotion: 0.14,
    /** Maximum normalized face-landmark/pose displacement between fresh frames. */
    maxLandmarkMotion: 0.045,
    /** A single good frame never arms capture. */
    consecutivePassingFrames: 5,
    /** Passing frames must span real time, not five repeated callbacks. */
    minStableDurationMs: 700,
    /** A long sampling gap breaks the streak. */
    maxFrameGapMs: 450,
  },

  lighting: {
    /** Broad percentiles avoid a narrow mean-luma rule that penalizes darker skin. */
    minFaceLumaP10: 10,
    maxFaceLumaP90: 248,
    /** Clipped facial-skin shares, evaluated independently. */
    maxShadowClipping: 0.14,
    maxHighlightClipping: 0.1,
    /** Small blown clusters can be glare even when the overall exposure is acceptable. */
    maxGlareRatio: 0.055,
    /** Absolute bilateral luma difference normalized to the brighter side. */
    maxLightingAsymmetry: 0.24,
    /** Background minus face luma above this is strong backlighting. */
    maxBacklightDelta: 52,
    /** Texture/contrast floors confirm that facial detail remains measurable. */
    minFaceContrast: 18,
    minFaceLumaStdDev: 9,
  },

  pose: {
    /** Front pose is approximately straight ahead. */
    frontYawDeg: { min: -12, max: 12 },
    /** Positive yaw presents the right cheek; negative presents the left cheek. */
    rightYawDeg: { min: 30, max: 64 },
    leftYawDeg: { min: -64, max: -30 },
    maxAbsPitchDeg: 12,
    maxAbsRollDeg: 8,
    /** Left/right accepted yaw values must be meaningfully separated. */
    minLeftRightYawSeparationDeg: 58,
  },

  occlusion: {
    /** Estimated share of forehead/cheeks/chin blocked by hair, hand, mask, or glare. */
    maxFacialSkinOcclusion: 0.18,
  },

  duplicate: {
    /** Normalized dHash Hamming distance at/below this is a near duplicate. */
    maxPerceptualDistance: 0.09,
    /** Left/right views should differ visually as well as by measured yaw. */
    minLeftRightPerceptualDistance: 0.13,
    /** Final capture must still resemble the live frame that armed the shutter. */
    maxPreviewFinalPerceptualDistance: 0.34,
  },

  comparison: {
    /** Conditions must remain this similar before progress language is shown. */
    maxYawDeltaDeg: 8,
    maxFaceWidthRatioDelta: 0.08,
    maxFaceCenterDelta: 0.08,
    maxFaceLumaMeanDelta: 30,
    maxLightingAsymmetryDelta: 0.12,
    maxBacklightDeltaDifference: 30,
  },

  session: {
    /** Prevent delayed async captures or old drafts from entering a current scan. */
    maxCaptureAgeMs: 10 * 60 * 1_000,
    maxSessionAgeMs: 30 * 60 * 1_000,
  },
} as const;

export type QualityConfig = typeof QUALITY_CONFIG;
