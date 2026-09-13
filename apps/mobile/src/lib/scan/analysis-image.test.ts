import { describe, expect, it } from "vitest";

import { ANALYSIS_MAX_WIDTH, analysisResizeWidth } from "./analysis-image";

describe("analysis JPEG sizing", () => {
  it("never upscales a low-resolution source", () => {
    expect(analysisResizeWidth(640)).toBeNull();
    expect(analysisResizeWidth(ANALYSIS_MAX_WIDTH)).toBeNull();
  });

  it("caps only genuinely larger sources", () => {
    // A modern phone still is far wider than the cap; a 2048px source is not.
    expect(analysisResizeWidth(4032)).toBe(ANALYSIS_MAX_WIDTH);
    expect(analysisResizeWidth(2048)).toBeNull();
  });

  it("fails closed for invalid dimensions", () => {
    expect(() => analysisResizeWidth(0)).toThrow("dimensions");
    expect(() => analysisResizeWidth(Number.NaN)).toThrow("dimensions");
  });
});
