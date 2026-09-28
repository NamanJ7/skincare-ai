import { describe, expect, it } from "vitest";

import { shapeAnalyticsEvent } from "./analytics";

describe("shapeAnalyticsEvent", () => {
  it("keeps only defined, provider-safe properties", () => {
    expect(
      shapeAnalyticsEvent(
        "paywall_viewed",
        { feature: "rescan", source: undefined, is_premium: false },
        "2026-07-13T12:00:00.000Z",
      ),
    ).toEqual({
      name: "paywall_viewed",
      occurredAt: "2026-07-13T12:00:00.000Z",
      properties: { feature: "rescan", is_premium: false },
    });
  });

  it("does not mutate the caller's properties", () => {
    const properties = { feature: "weekly_report", source: undefined };
    shapeAnalyticsEvent("premium_feature_locked", properties, "2026-07-13T12:00:00.000Z");
    expect(properties).toEqual({ feature: "weekly_report", source: undefined });
  });

  it("keeps the optional clarity score numeric", () => {
    expect(
      shapeAnalyticsEvent(
        "clarity_rating_submitted",
        { score: 5, context: "initial_plan" },
        "2026-07-15T16:00:00.000Z",
      ).properties,
    ).toEqual({ score: 5, context: "initial_plan" });
  });

  it("shapes scan-quality telemetry without image or answer data", () => {
    expect(
      shapeAnalyticsEvent(
        "scan_validation_completed",
        {
          step_id: "front",
          outcome: "verified",
          latency_ms: 842,
          quality_config_version: "2026-07-17.1",
        },
        "2026-07-17T16:00:00.000Z",
      ).properties,
    ).toEqual({
      step_id: "front",
      outcome: "verified",
      latency_ms: 842,
      quality_config_version: "2026-07-17.1",
    });
  });
});
