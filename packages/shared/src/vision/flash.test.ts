import { describe, it, expect } from "vitest";
import { flashIntensityForTone, FLASH_TUNING } from "./flash";
import type { SkinTone } from "../types/intake";

const TONES: SkinTone[] = ["very_fair", "fair", "medium", "olive", "brown", "deep"];

describe("flashIntensityForTone", () => {
  it("returns a value for every tone without throwing", () => {
    for (const tone of TONES) {
      expect(() => flashIntensityForTone(tone)).not.toThrow();
    }
  });

  it("increases duration monotonically as tone deepens", () => {
    const durations = TONES.map((t) => flashIntensityForTone(t).durationMs);
    for (let i = 1; i < durations.length; i++) {
      expect(durations[i]).toBeGreaterThanOrEqual(durations[i - 1]!);
    }
  });

  it("keeps duration within FLASH_TUNING bounds", () => {
    for (const tone of TONES) {
      const { durationMs } = flashIntensityForTone(tone);
      expect(durationMs).toBeGreaterThanOrEqual(FLASH_TUNING.minDurationMs);
      expect(durationMs).toBeLessThanOrEqual(FLASH_TUNING.maxDurationMs);
    }
  });

  it("keeps level within 0..1", () => {
    for (const tone of TONES) {
      const { level } = flashIntensityForTone(tone);
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(1);
    }
  });
});
