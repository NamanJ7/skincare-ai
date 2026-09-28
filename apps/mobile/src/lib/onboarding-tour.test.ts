import { describe, expect, it } from "vitest";

import { ONBOARDING_ROUTES, TOUR_BEATS } from "./onboarding-tour";

describe("replay-only Pore explainer", () => {
  it("tells the complete promise in three visual beats on one screen", () => {
    expect(TOUR_BEATS.map((beat) => beat.id)).toEqual([
      "guided-photo",
      "cosmetic-context",
      "safety-adjusted-routine",
    ]);
  });

  it("keeps the required goal route separate from the replay route", () => {
    expect(ONBOARDING_ROUTES.goal).toBe("/onboarding/goal");
    expect(ONBOARDING_ROUTES.explainer).toBe("/onboarding/intro?replay=1");
    expect(ONBOARDING_ROUTES).not.toHaveProperty("tour");
  });

  it("does not invent result scores or diagnostic claims", () => {
    expect(JSON.stringify(TOUR_BEATS)).not.toMatch(/score\s*[:=]\s*\d/i);
    expect(JSON.stringify(TOUR_BEATS)).not.toMatch(/diagnos(e|is)/i);
  });
});
