import { describe, expect, it } from "vitest";

import {
  GUIDANCE_ANNOUNCEMENT_INTERVAL_MS,
  announceGuidanceMessage,
  guidanceAnnouncementText,
  shouldAnnounceGuidance,
} from "./guidance-announcement";

describe("announceGuidanceMessage", () => {
  it("uses the richer native announcer when it is available", () => {
    const calls: unknown[][] = [];
    const announced = announceGuidanceMessage(
      {
        announceForAccessibilityWithOptions: (...args) => calls.push(args),
      },
      "Photo in 2",
      true,
    );

    expect(announced).toBe(true);
    expect(calls).toEqual([
      ["Photo in 2", { queue: false, priority: "default" }],
    ]);
  });

  it("falls back safely when the options API is absent on web", () => {
    const calls: string[] = [];
    expect(
      announceGuidanceMessage(
        { announceForAccessibility: (message) => calls.push(message) },
        "Move closer",
        false,
      ),
    ).toBe(true);
    expect(calls).toEqual(["Move closer"]);
    expect(announceGuidanceMessage({}, "Move closer", false)).toBe(false);
  });
});

describe("guidanceAnnouncementText", () => {
  it("prefers a concise countdown and ignores inactive guidance", () => {
    expect(guidanceAnnouncementText(true, "Hold still", 3)).toBe("Photo in 3");
    expect(guidanceAnnouncementText(false, "Hold still", null)).toBeNull();
  });

  it("normalizes instruction whitespace", () => {
    expect(guidanceAnnouncementText(true, "  Move   closer  ", null)).toBe("Move closer");
  });
});

describe("shouldAnnounceGuidance", () => {
  it("deduplicates unchanged messages", () => {
    expect(shouldAnnounceGuidance("Move closer", "Move closer", 5000, false)).toBe(false);
  });

  it("paces ordinary guidance but keeps countdowns timely", () => {
    expect(shouldAnnounceGuidance("Turn right", "Move closer", 200, false)).toBe(false);
    expect(
      shouldAnnounceGuidance(
        "Turn right",
        "Move closer",
        GUIDANCE_ANNOUNCEMENT_INTERVAL_MS,
        false,
      ),
    ).toBe(true);
    expect(shouldAnnounceGuidance("Photo in 2", "Photo in 3", 200, true)).toBe(true);
  });
});
