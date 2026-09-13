/**
 * One calibration boundary for native detector Euler angles.
 *
 * Shared scan policy defines positive yaw as presenting the user's right cheek
 * and negative yaw as presenting the left cheek. Both the detector callback
 * used for guidance and the serialized frame used by the strict quality gate
 * must pass through these helpers or the two gates can disagree.
 *
 * ── Why mirroring is an argument, not a constant ───────────────────────────
 * The reference frame is the CAMERA OUTPUT presentation — the same reference
 * `orientPreviewPerceptualHash` normalizes toward. Live guidance does not run
 * on that: it reads raw analysis buffers, which on a front camera may arrive
 * mirrored relative to the output, while the saved still already is the output.
 * Horizontal mirroring inverts apparent yaw, so a single device-global sign
 * cannot serve both paths — and when they disagree, live guidance turns green
 * on a cheek the final pose gate then rejects, which reads to the user as an
 * unwinnable retake loop rather than as a bug. Each caller passes the mirror
 * state of the pixels it actually measured.
 *
 * Pitch is unaffected by horizontal mirroring, and is not read by the quality
 * ladder today, so its sign stays cosmetic.
 */

/** Flip to -1 if, in the camera output presentation, the cheeks are inverted. */
export const NATIVE_YAW_SIGN = 1;
export const NATIVE_PITCH_SIGN = 1;

/**
 * @param sourceIsMirrored true when the measured pixels are mirrored relative
 * to the camera output (raw front-camera analysis frames often are; a saved
 * still is not).
 */
export function normalizeNativeYaw(
  yawDeg: number,
  sourceIsMirrored: boolean = false,
): number {
  "worklet";
  return (sourceIsMirrored ? -NATIVE_YAW_SIGN : NATIVE_YAW_SIGN) * yawDeg;
}

export function normalizeNativePitch(pitchDeg: number): number {
  "worklet";
  return NATIVE_PITCH_SIGN * pitchDeg;
}
