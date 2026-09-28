import { describe, expect, it, vi } from "vitest";

import {
  calibrationLogSize,
  clearCalibrationLog,
  dumpCalibrationLog,
  recordCalibrationSample,
} from "./calibration-log";

const sample = (frameId: string) => ({
  kind: "live_frame" as const,
  at: 1,
  frameId,
  stepId: "front",
  code: "ok",
  overrideCode: null,
  packetAgeMs: 100,
  frameMirrored: false,
  perceptualHash: null,
  lumaP10: null,
  lumaP90: null,
  gradientEnergy: null,
  laplacianVariance: null,
  backlightDelta: null,
});

describe("calibration log", () => {
  it("keeps the newest 600 samples and dumps JSONL", () => {
    clearCalibrationLog();
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    for (let index = 0; index < 601; index++)
      recordCalibrationSample(sample(String(index)));
    expect(calibrationLogSize()).toBe(600);
    expect(dumpCalibrationLog().split("\n")[0]).toContain('"frameId":"1"');
    expect(
      dumpCalibrationLog({
        appVersion: "1",
        buildVersion: "2",
        deviceModel: "iPhone",
        osName: "iOS",
        osVersion: "18",
      }).split("\n")[0],
    ).toContain('"kind":"context"');
    log.mockRestore();
    clearCalibrationLog();
  });
});
