export interface CalibrationLogContext {
  appVersion: string | null;
  buildVersion: string | null;
  deviceModel: string | null;
  osName: string | null;
  osVersion: string | null;
}

export interface CalibrationLiveSample {
  kind: "live_frame";
  at: number;
  frameId: string;
  stepId: string;
  code: string | null;
  overrideCode: string | null;
  packetAgeMs: number | null;
  frameMirrored: boolean | null;
  perceptualHash: string | null;
  lumaP10: number | null;
  lumaP90: number | null;
  gradientEnergy: number | null;
  laplacianVariance: number | null;
  backlightDelta: number | null;
}

export interface CalibrationFinalSample {
  kind: "final_capture";
  at: number;
  stepId: string;
  previewFrameId: string | null;
  previewHashMirrorApplied: boolean | null;
  previewPerceptualHash: string | null;
  finalPerceptualHash: string | null;
  previewFinalDistance: number | null;
  alternatePreviewFinalDistance: number | null;
  orientationAgreement: "metadata" | "alternate" | "tie" | "unavailable";
  /**
   * Yaw the live frame armed on vs. yaw measured on the saved still, plus which
   * step band the still landed in. A mirror convention that differs between the
   * analysis buffer and the camera output shows up here as two same-magnitude,
   * opposite-sign values — the signature of a scan where guidance goes green
   * and the final pose gate then rejects the shot.
   */
  armedYawDeg: number | null;
  finalYawDeg: number | null;
  yawSignAgreement: "agree" | "inverted" | "unavailable";
  blockingIssues: string[];
}

export type CalibrationLogSample =
  | CalibrationLiveSample
  | CalibrationFinalSample;

const CAPACITY = 600;
let samples: CalibrationLogSample[] = [];

export function recordCalibrationSample(sample: CalibrationLogSample): void {
  samples.push(sample);
  if (samples.length > CAPACITY)
    samples = samples.slice(samples.length - CAPACITY);
}

/** JSONL metrics and hashes only—never pixels or photos—for device QA. */
export function dumpCalibrationLog(context?: CalibrationLogContext): string {
  const rows = context
    ? [{ kind: "context", at: Date.now(), ...context }, ...samples]
    : samples;
  const output = rows.map((sample) => JSON.stringify(sample)).join("\n");
  console.info("[scan calibration]", output);
  return output;
}

export function clearCalibrationLog(): void {
  samples = [];
}

export function calibrationLogSize(): number {
  return samples.length;
}
