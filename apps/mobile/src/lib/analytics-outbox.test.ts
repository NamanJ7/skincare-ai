import { describe, expect, it } from "vitest";

import { shapeAnalyticsEvent } from "./analytics";
import { appendToAnalyticsOutbox } from "./analytics-outbox";

describe("appendToAnalyticsOutbox", () => {
  it("keeps the newest events within the configured cap", () => {
    const first = shapeAnalyticsEvent("app_opened", {}, "2026-07-15T12:00:00.000Z");
    const second = shapeAnalyticsEvent("results_viewed", {}, "2026-07-15T12:01:00.000Z");
    const third = shapeAnalyticsEvent("routine_viewed", {}, "2026-07-15T12:02:00.000Z");

    expect(appendToAnalyticsOutbox([first, second], third, 2)).toEqual([
      second,
      third,
    ]);
  });

  it("always retains at least the newest event", () => {
    const event = shapeAnalyticsEvent("session_started");
    expect(appendToAnalyticsOutbox([], event, 0)).toEqual([event]);
  });
});
