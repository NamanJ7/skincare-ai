/**
 * The three capture steps and all user-facing feedback copy.
 *
 * Step order and turn instructions match the mobile scan flow
 * (apps/mobile/src/app/scan-flow/capture.tsx): front → right cheek → left
 * cheek. Note the physics: turning your head to your LEFT shows the camera
 * your RIGHT cheek. The live preview is mirrored, so `screenDirection`
 * matches the user's own turn direction on screen.
 */
import type { QualityCode, StepConfig, StepId } from "./types";
import { QUALITY_CONFIG } from "./quality-config";

export const STEP_ORDER: StepId[] = ["front", "right", "left"];

export const STEP_CONFIGS: Record<StepId, StepConfig> = {
  front: {
    id: "front",
    index: 0,
    label: "Front view",
    title: "Look straight ahead",
    hint: "Center your face in the frame, keep your eyes open, and relax your face.",
    guide: "front",
    yaw: QUALITY_CONFIG.pose.frontYawDeg,
    faceWidthBand: QUALITY_CONFIG.face.frontWidthRatio,
    centerTolerance: QUALITY_CONFIG.face.frontCenterTolerance,
  },
  right: {
    id: "right",
    index: 1,
    label: "Right cheek",
    title: "Turn your head slightly to the left",
    hint: "Show your right cheek to the camera while keeping your chin level.",
    guide: "side",
    screenDirection: "left",
    yaw: QUALITY_CONFIG.pose.rightYawDeg,
    faceWidthBand: QUALITY_CONFIG.face.sideWidthRatio,
    centerTolerance: QUALITY_CONFIG.face.sideCenterTolerance,
  },
  left: {
    id: "left",
    index: 2,
    label: "Left cheek",
    title: "Turn your head slightly to the right",
    hint: "Show your left cheek to the camera while keeping your chin level.",
    guide: "side",
    screenDirection: "right",
    yaw: QUALITY_CONFIG.pose.leftYawDeg,
    faceWidthBand: QUALITY_CONFIG.face.sideWidthRatio,
    centerTolerance: QUALITY_CONFIG.face.sideCenterTolerance,
  },
};

const BASE_MESSAGES: Record<QualityCode, string> = {
  no_face: "Move into the frame",
  multiple_faces: "Only one face should be visible",
  out_of_frame: "Center your face in the guide",
  too_close: "Move back slightly",
  too_far: "Move a little closer",
  too_dark: "Try brighter, more even lighting",
  too_bright: "Too much light. Turn away from direct light",
  blurry: "Hold still for a sharper photo",
  face_forward: "Look straight at the camera",
  turn_more: "Turn a little more",
  turn_back: "Turn back toward the camera a little",
  turn_other_way: "Turn the other way",
  occluded: "Keep your forehead, cheeks, and chin visible",
  ok: "Hold still…",
};

/** Per-step overrides so turn guidance names the user's own direction. */
const STEP_MESSAGES: Partial<
  Record<StepId, Partial<Record<QualityCode, string>>>
> = {
  right: {
    turn_more: "Turn a little more to your left",
    turn_other_way: "Turn toward your left",
    ok: "Right cheek looks good. Hold still…",
  },
  left: {
    turn_more: "Turn a little more to your right",
    turn_other_way: "Turn toward your right",
    ok: "Left cheek looks good. Hold still…",
  },
  front: {
    ok: "Perfectly centered. Hold still…",
  },
};

export function feedbackMessage(stepId: StepId, code: QualityCode): string {
  return STEP_MESSAGES[stepId]?.[code] ?? BASE_MESSAGES[code];
}

/** Verdict copy on the per-shot review screen. */
export const REVIEW_COPY = {
  good: {
    front: "Great capture. Your face is centered and clearly visible.",
    right: "Great capture. Your right cheek is clearly visible.",
    left: "Great capture. Your left cheek is clearly visible.",
  } as Record<StepId, string>,
  acceptable:
    "This should still work, but brighter lighting may improve your results.",
  blocked: "This photo may be hard to analyze. We recommend retaking it.",
  unchecked:
    "We couldn't auto-check this photo. Make sure your face is clear and well lit.",
};
