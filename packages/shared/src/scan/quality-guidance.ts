import type { CorrectiveAction, QualityIssue, QualityIssueCode, QualityProvenance } from "./quality-contract";

/** Highest priority first: users see only the first applicable correction. */
export const GUIDANCE_PRIORITY: readonly QualityIssueCode[] = [
  "corrupt_image",
  "invalid_frame",
  "blank_or_covered",
  "skin_not_measurable",
  "missing_pose",
  "wrong_session",
  "stale_image",
  "preview_mismatch",
  "no_face",
  "multiple_faces",
  "face_out_of_frame",
  "low_resolution",
  "too_far",
  "too_close",
  "wrong_pose",
  "turn_more",
  "turn_back",
  "pitch",
  "roll",
  "occluded",
  "backlit",
  "too_dark",
  "too_bright",
  "glare",
  "uneven_lighting",
  "low_texture",
  "lens_dirty",
  "blurry",
  "motion",
  "stability_incomplete",
  "duplicate_image",
  "pose_not_distinct",
] as const;

export function correctiveMessage(code: QualityIssueCode, provenance: QualityProvenance): string {
  const turnDirection = provenance.stepId === "right" ? "left" : provenance.stepId === "left" ? "right" : null;
  switch (code) {
    case "corrupt_image": return "We couldn't read that photo. Try again.";
    case "invalid_frame": return "We couldn't verify this camera frame. Try again.";
    case "blank_or_covered": return "Uncover your camera lens.";
    case "skin_not_measurable": return "Center your face in the guide and hold steady.";
    case "wrong_session": return "Start a new scan and retake this photo.";
    case "stale_image": return "This photo is out of date. Retake it.";
    case "preview_mismatch": return "The camera moved during capture. Retake the photo.";
    case "no_face": return "Position your face in the guide.";
    case "multiple_faces": return "Only one person should be visible.";
    case "face_out_of_frame": return "Center your face in the guide.";
    // Camera case covers two shortfalls — too few face pixels (moving closer
    // fixes it) and a frame that is simply too small (it does not). Say both,
    // rather than sending the user on retakes that cannot succeed.
    case "low_resolution": return provenance.source === "upload" ? "Choose a higher-resolution photo." : "Move closer, or try a higher-resolution camera.";
    case "too_far": return "Move closer.";
    case "too_close": return "Move farther away.";
    case "wrong_pose": return turnDirection ? `Turn slightly ${turnDirection}.` : "Look straight at the camera.";
    case "turn_more": return turnDirection ? `Turn slightly more to your ${turnDirection}.` : "Look straight at the camera.";
    case "turn_back": return "Turn back toward the camera slightly.";
    case "pitch": return "Keep the camera level with your face.";
    case "roll": return "Keep your head level.";
    case "occluded": return "Keep your forehead, cheeks, and chin clearly visible.";
    case "backlit": return "Reduce the light behind you.";
    case "too_dark": return "Face a window or move toward a brighter light.";
    case "too_bright": return "Move away from direct light.";
    case "glare": return "Change your angle to reduce glare.";
    case "uneven_lighting": return "Move toward more even lighting.";
    case "low_texture": return "Use softer light so your skin texture stays visible.";
    case "lens_dirty": return "Clean your camera lens and try again.";
    case "blurry": return "Hold still for a sharper photo.";
    case "motion":
    case "stability_incomplete": return "Hold still.";
    case "missing_pose": return "Retake the missing photo.";
    case "duplicate_image": return "These photos are too similar. Retake this angle.";
    case "pose_not_distinct": return "Turn farther so each cheek view is different.";
  }
}

export function highestPriorityCorrection(
  issues: readonly QualityIssue[],
  provenance: QualityProvenance,
): CorrectiveAction | null {
  const blocking = issues.filter((candidate) => candidate.severity === "blocking");
  for (const code of GUIDANCE_PRIORITY) {
    if (blocking.some((candidate) => candidate.code === code)) {
      return { code, message: correctiveMessage(code, provenance) };
    }
  }
  return null;
}
