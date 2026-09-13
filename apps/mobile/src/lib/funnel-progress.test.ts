import { describe, expect, it } from "vitest";

import { FUNNEL_STEPS, funnelProgress } from "./funnel-progress";

describe("funnelProgress", () => {
  it("starts at the age/privacy choice without hiding remaining work", () => {
    const age = funnelProgress("age");
    expect(age.step).toBe(1);
    expect(age.from).toBe(0);
  });

  it("is strictly increasing, with `from` one step behind the fill", () => {
    let prev = 0;
    for (const step of FUNNEL_STEPS) {
      const p = funnelProgress(step);
      expect(p.from).toBeCloseTo((p.step - 1) / p.total);
      expect(p.step / p.total).toBeGreaterThan(prev);
      prev = p.step / p.total;
    }
  });

  it("keeps every question short of done — 100% belongs to the finished plan", () => {
    for (const step of [
      "age",
      "goal",
      "profile",
      "sensitivity",
      "safety",
      "scan",
      "plan",
    ] as const) {
      const p = funnelProgress(step);
      expect(p.step / p.total).toBeLessThan(1);
    }
    const notifications = funnelProgress("notifications");
    expect(notifications.step / notifications.total).toBe(1);
  });

  it("contains the eight required steps and excludes the replay tour", () => {
    expect(FUNNEL_STEPS).toEqual([
      "age",
      "goal",
      "profile",
      "sensitivity",
      "safety",
      "scan",
      "plan",
      "notifications",
    ]);
  });
});
