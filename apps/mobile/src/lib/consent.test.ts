import { describe, expect, it } from "vitest";

import { CONSENT_VERSION, type ConsentRecord } from "@pore/shared";
import {
  createPhotoAnalysisConsent,
  hasCurrentPhotoAnalysisConsent,
} from "./consent";

describe("photo-analysis consent", () => {
  it("creates a current, non-training record with every disclosed purpose", () => {
    const record = createPhotoAnalysisConsent("2026-07-15T16:00:00.000Z");
    expect(record).toEqual({
      version: CONSENT_VERSION,
      purposes: [
        "skin_photo_analysis",
        "personalized_routine",
        "progress_comparison",
      ],
      privacyNoticeVersion: CONSENT_VERSION,
      processorDisclosureVersion: CONSENT_VERSION,
      trainingOptIn: false,
      acceptedAt: "2026-07-15T16:00:00.000Z",
    });
    expect(hasCurrentPhotoAnalysisConsent(record)).toBe(true);
  });

  it("fails closed for missing, stale, withdrawn, or partial consent", () => {
    const current = createPhotoAnalysisConsent("2026-07-15T16:00:00.000Z");
    expect(hasCurrentPhotoAnalysisConsent(undefined)).toBe(false);
    expect(
      hasCurrentPhotoAnalysisConsent({
        ...current,
        version: "2025-01-01",
      } as unknown as ConsentRecord),
    ).toBe(false);
    expect(
      hasCurrentPhotoAnalysisConsent({
        ...current,
        withdrawnAt: "2026-07-15T17:00:00.000Z",
      }),
    ).toBe(false);
    expect(
      hasCurrentPhotoAnalysisConsent({
        ...current,
        purposes: ["skin_photo_analysis"],
      }),
    ).toBe(false);
  });
});
