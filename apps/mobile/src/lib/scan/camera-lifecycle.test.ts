import { describe, expect, it } from "vitest";

import { shouldRunCameraSession } from "./camera-lifecycle";

describe("shouldRunCameraSession", () => {
  it("runs only for a requested, focused, foreground camera", () => {
    expect(shouldRunCameraSession(true, true, "active")).toBe(true);
    expect(shouldRunCameraSession(false, true, "active")).toBe(false);
    expect(shouldRunCameraSession(true, false, "active")).toBe(false);
    expect(shouldRunCameraSession(true, true, "inactive")).toBe(false);
    expect(shouldRunCameraSession(true, true, "background")).toBe(false);
  });
});
