/**
 * Native default-resolution stub for the WEB guidance hook.
 *
 * The MediaPipe loop lives in use-live-guidance.web.ts and is only bundled for
 * web (ScanCamera.web.tsx). This file exists so TypeScript — which resolves the
 * non-suffixed module — has a definition; it is never bundled on native, where
 * the camera surface is ScanCamera.tsx and live guidance comes from the MLKit
 * face detector via use-native-guidance.ts instead. Returning DISABLED here is
 * therefore inert on native and simply the "no MediaPipe" value on web.
 */
import { DISABLED_GUIDANCE, type LiveGuidance, type LiveGuidanceOptions } from "./live-guidance-types";

export function useLiveGuidance(_options: LiveGuidanceOptions): LiveGuidance {
  return DISABLED_GUIDANCE;
}
