import { describe, expect, it } from "vitest";

import type { Assessment } from "@pore/shared";

import {
  analysisSource,
  answersOnlyReason,
  checkInPhotoPrivacyLine,
  isCurrentScanAnalysis,
  photoPrivacyLine,
  photoStorageLine,
} from "./analysis-status";
import type { PlanResult } from "./api";
import type { OnboardingData } from "@/state/onboarding";

function assessment(): Assessment {
  return {
    findings: [],
    escalation: { recommendProfessional: false, reasons: [] },
    summary: "",
    disclaimer: "",
  };
}

function plan(scanId?: string): PlanResult {
  return {
    mode: "ai",
    routine: { am: [], pm: [], notes: [] },
    adjustments: [],
    assessment: assessment(),
    ...(scanId ? { scanId } : {}),
  };
}

const AT = "2026-07-11T00:00:00.000Z";

describe("isCurrentScanAnalysis", () => {
  it("is true when the plan's scanId matches the scan_analyzed status", () => {
    const data: OnboardingData = {
      plan: plan("scan-1"),
      analysisStatus: { kind: "scan_analyzed", scanId: "scan-1", analyzedAt: AT },
    };
    expect(isCurrentScanAnalysis(data)).toBe(true);
  });

  it("is false when the plan's scanId does not match the status", () => {
    const data: OnboardingData = {
      plan: plan("scan-1"),
      analysisStatus: { kind: "scan_analyzed", scanId: "scan-2", analyzedAt: AT },
    };
    expect(isCurrentScanAnalysis(data)).toBe(false);
  });

  it("is false for an answers_only status even if a stale plan lingers", () => {
    const data: OnboardingData = {
      plan: plan("scan-1"),
      scannedAt: AT,
      analysisStatus: { kind: "answers_only", reason: "analysis_failed", attemptedAt: AT },
    };
    expect(isCurrentScanAnalysis(data)).toBe(false);
  });

  it("honors a legacy profile (plan + scannedAt, no status)", () => {
    const data: OnboardingData = { plan: plan(), scannedAt: AT };
    expect(isCurrentScanAnalysis(data)).toBe(true);
  });

  it("is false with no plan", () => {
    expect(isCurrentScanAnalysis({})).toBe(false);
    expect(
      isCurrentScanAnalysis({
        analysisStatus: { kind: "answers_only", reason: "scan_skipped", attemptedAt: AT },
      }),
    ).toBe(false);
  });

  it("is false for a plan with no scanId, no scannedAt and no status", () => {
    expect(isCurrentScanAnalysis({ plan: plan() })).toBe(false);
  });
});

describe("answersOnlyReason / analysisSource", () => {
  it("returns the reason only for an answers_only status", () => {
    expect(
      answersOnlyReason({
        analysisStatus: { kind: "answers_only", reason: "quality_failed", attemptedAt: AT },
      }),
    ).toBe("quality_failed");
    expect(
      answersOnlyReason({
        plan: plan("scan-1"),
        analysisStatus: { kind: "scan_analyzed", scanId: "scan-1", analyzedAt: AT },
      }),
    ).toBeUndefined();
  });

  it("maps to a source label", () => {
    expect(
      analysisSource({
        plan: plan("scan-1"),
        analysisStatus: { kind: "scan_analyzed", scanId: "scan-1", analyzedAt: AT },
      }),
    ).toBe("scan");
    expect(analysisSource({})).toBe("answers");
  });
});

describe("photoPrivacyLine", () => {
  it("does not claim photos stay on device when analysis is configured", () => {
    const line = photoPrivacyLine(true);
    expect(line).toContain("processed securely for analysis");
    expect(line).not.toMatch(/stay on your device/i);
  });

  it("states local-only storage when analysis is not configured", () => {
    expect(photoPrivacyLine(false)).toBe(
      "Photos are saved on this device unless you delete them.",
    );
  });
});

describe("checkInPhotoPrivacyLine", () => {
  it("claims device-only storage while check-in photos have no upload path", () => {
    const line = checkInPhotoPrivacyLine(false);
    expect(line).toContain("stay on this device");
    expect(line).toContain("never uploaded");
  });

  it("never claims device-only storage if a check-in upload path is added", () => {
    const line = checkInPhotoPrivacyLine(true);
    expect(line).not.toMatch(/stay on (this|your) device/i);
    expect(line).not.toMatch(/never uploaded/i);
  });
});

describe("photoStorageLine", () => {
  it("only speaks to storage when analysis is configured (scan photos may upload)", () => {
    const line = photoStorageLine(true);
    expect(line).toContain("Saved on this device");
    expect(line).not.toMatch(/never uploaded/i);
    expect(line).not.toMatch(/stay on (this|your) device/i);
  });

  it("states never-uploaded when analysis is not configured", () => {
    expect(photoStorageLine(false)).toContain("never uploaded");
  });
});
