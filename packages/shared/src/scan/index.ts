/**
 * Pure scan-capture guidance logic shared by web (live MediaPipe loop) and
 * mobile (post-capture checks + Expo-web live loop). Everything here is
 * DOM-free; platform I/O (camera, canvas, detector init) stays in the apps.
 */
export * from "./types";
export * from "./steps";
export * from "./quality";
export * from "./image-stats";
export * from "./face-metrics";
export * from "./capture-machine";
export * from "./quality-config";
export * from "./quality-contract";
export * from "./quality-checks";
export * from "./quality-guidance";
export * from "./quality-pipeline";
export * from "./quality-session";
