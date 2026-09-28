import { describe, expect, it } from "vitest";

import type { QualityIssueCode, QualityResult } from "@pore/shared/scan";

import { createOverrideConfirm, pixelOverrideCode } from "./live-pixel-guidance";

function result(...codes: QualityIssueCode[]): QualityResult {
  return {
    passed: false, overallScore: 0, confidence: 1, metrics: {}, warnings: [], correctiveAction: null,
    blockingIssues: codes.map((code) => ({ code, metric: "sharpness", severity: "blocking", detail: code })),
    provenance: { gate: "live", source: "camera", sessionId: "live", frameId: "frame", capturedAt: 1, stepId: "front" },
    configVersion: "test",
  };
}

describe("live pixel guidance", () => {
  it.each([
    ["dark face", result("too_dark"), "too_dark"],
    ["glare", result("glare"), "too_bright"],
    ["soft texture", result("blurry"), "blurry"],
    ["backlighting", result("backlit"), "too_dark"],
  ])("maps %s to the existing live copy", (_label, value, expected) => {
    expect(pixelOverrideCode(value)).toBe(expected);
  });

  it("maps face-domain failures and honors shared priority", () => {
    expect(pixelOverrideCode(result("no_face"))).toBe("no_face");
    expect(pixelOverrideCode(result("no_face", "backlit"))).toBe("no_face");
    expect(pixelOverrideCode(result("glare", "backlit"))).toBe("too_dark");
  });

  it("requires two consecutive packets before overriding", () => {
    const confirm = createOverrideConfirm();
    expect(confirm.push("too_dark")).toBeNull();
    expect(confirm.push("too_dark")).toBe("too_dark");
    expect(confirm.push(null)).toBeNull();
    expect(confirm.push("blurry")).toBeNull();
  });
});
