import {
  GUIDANCE_PRIORITY,
  type QualityCode,
  type QualityIssueCode,
  type QualityResult,
} from "@pore/shared/scan";

const PIXEL_CODE_MAP: Partial<Record<QualityIssueCode, QualityCode>> = {
  invalid_frame: "occluded",
  blank_or_covered: "occluded",
  corrupt_image: "occluded",
  no_face: "no_face",
  multiple_faces: "multiple_faces",
  face_out_of_frame: "out_of_frame",
  low_resolution: "too_far",
  too_far: "too_far",
  too_close: "too_close",
  wrong_pose: "turn_other_way",
  turn_more: "turn_more",
  turn_back: "turn_back",
  occluded: "occluded",
  backlit: "too_dark",
  too_dark: "too_dark",
  uneven_lighting: "too_dark",
  low_texture: "too_dark",
  too_bright: "too_bright",
  glare: "too_bright",
  blurry: "blurry",
  lens_dirty: "blurry",
  motion: "blurry",
  stability_incomplete: "blurry",
};

/** Map strict shared-gate failures into the legacy overlay state vocabulary. */
export function pixelOverrideCode(result: QualityResult): QualityCode | null {
  const blocking = new Set(result.blockingIssues.map((issue) => issue.code));
  for (const sourceCode of GUIDANCE_PRIORITY) {
    const mapped = PIXEL_CODE_MAP[sourceCode];
    if (mapped && blocking.has(sourceCode)) return mapped;
  }
  return null;
}

export interface OverrideConfirm {
  push: (code: QualityCode | null) => QualityCode | null;
  reset: () => void;
}

/** Require two unique failing frame packets before interrupting an armed UI. */
export function createOverrideConfirm(requiredConsecutive = 2): OverrideConfirm {
  let previous: QualityCode | null = null;
  let consecutive = 0;
  return {
    push(code) {
      if (code == null) {
        previous = null;
        consecutive = 0;
        return null;
      }
      consecutive = previous === code ? consecutive + 1 : 1;
      previous = code;
      return consecutive >= requiredConsecutive ? code : null;
    },
    reset() {
      previous = null;
      consecutive = 0;
    },
  };
}
