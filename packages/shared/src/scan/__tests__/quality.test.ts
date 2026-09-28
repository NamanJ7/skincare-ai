import { describe, expect, it } from "vitest";

import { analyzeFrame, THRESHOLDS } from "../quality";
import { STEP_CONFIGS } from "../steps";
import type { FaceMetrics, ImageStats } from "../types";

const FRONT = STEP_CONFIGS.front;
const RIGHT = STEP_CONFIGS.right;
const LEFT = STEP_CONFIGS.left;

function face(overrides: Partial<FaceMetrics> = {}): FaceMetrics {
  return {
    faceCount: 1,
    center: { x: 0.5, y: 0.5 },
    widthRatio: 0.4,
    yawDeg: 0,
    pitchDeg: 0,
    ...overrides,
  };
}

function stats(overrides: Partial<ImageStats> = {}): ImageStats {
  return {
    lumaMean: 130,
    clippedHighlights: 0,
    clippedShadows: 0,
    sharpness: 120,
    ...overrides,
  };
}

describe("analyzeFrame — happy path", () => {
  it("returns good/ok for a well-framed front face", () => {
    const v = analyzeFrame(face(), stats(), FRONT);
    expect(v).toEqual({ level: "good", code: "ok", readyForAutoCapture: true });
  });

  it("returns good/ok for a correct right-cheek turn (positive yaw)", () => {
    const v = analyzeFrame(face({ yawDeg: 45 }), stats(), RIGHT);
    expect(v.code).toBe("ok");
    expect(v.readyForAutoCapture).toBe(true);
  });

  it("returns good/ok for a correct left-cheek turn (negative yaw)", () => {
    const v = analyzeFrame(face({ yawDeg: -45 }), stats(), LEFT);
    expect(v.code).toBe("ok");
  });
});

describe("analyzeFrame — priority ladder ordering", () => {
  it("no_face beats everything and is blocked", () => {
    const v = analyzeFrame(
      face({ faceCount: 0 }),
      stats({ lumaMean: 20, sharpness: 1 }),
      FRONT,
    );
    expect(v).toMatchObject({ level: "blocked", code: "no_face" });
  });

  it("multiple_faces beats framing and lighting", () => {
    const v = analyzeFrame(
      face({ faceCount: 2, center: { x: 0.9, y: 0.5 } }),
      stats({ lumaMean: 20 }),
      FRONT,
    );
    expect(v).toMatchObject({ level: "blocked", code: "multiple_faces" });
  });

  it("out_of_frame beats distance and lighting", () => {
    const v = analyzeFrame(
      face({ center: { x: 0.9, y: 0.5 }, widthRatio: 0.1 }),
      stats({ lumaMean: 20 }),
      FRONT,
    );
    expect(v.code).toBe("out_of_frame");
  });

  it("too_close / too_far beat lighting", () => {
    expect(analyzeFrame(face({ widthRatio: 0.7 }), stats({ lumaMean: 20 }), FRONT).code).toBe(
      "too_close",
    );
    expect(analyzeFrame(face({ widthRatio: 0.1 }), stats({ lumaMean: 20 }), FRONT).code).toBe(
      "too_far",
    );
  });

  it("lighting beats blur", () => {
    const v = analyzeFrame(face(), stats({ lumaMean: 50, sharpness: 1 }), FRONT);
    expect(v.code).toBe("too_dark");
  });

  it("blur beats angle", () => {
    const v = analyzeFrame(face({ yawDeg: 40 }), stats({ sharpness: 5 }), FRONT);
    expect(v.code).toBe("blurry");
  });

  it("angle is checked last before ok", () => {
    const v = analyzeFrame(face({ yawDeg: 40 }), stats(), FRONT);
    expect(v).toMatchObject({ level: "acceptable", code: "face_forward" });
  });
});

describe("analyzeFrame — soft gating levels", () => {
  it("severe exposure is blocked, mild is acceptable", () => {
    expect(analyzeFrame(face(), stats({ lumaMean: 30 }), FRONT).level).toBe("blocked");
    expect(analyzeFrame(face(), stats({ lumaMean: 60 }), FRONT).level).toBe("acceptable");
    expect(analyzeFrame(face(), stats({ lumaMean: 240 }), FRONT).level).toBe("blocked");
    expect(analyzeFrame(face(), stats({ lumaMean: 200 }), FRONT).level).toBe("acceptable");
  });

  it("severe blur is blocked, mild is acceptable", () => {
    expect(analyzeFrame(face(), stats({ sharpness: 5 }), FRONT).level).toBe("blocked");
    expect(analyzeFrame(face(), stats({ sharpness: 20 }), FRONT).level).toBe("acceptable");
  });

  it("clipped highlights flag too_bright even with normal mean", () => {
    const v = analyzeFrame(face(), stats({ clippedHighlights: 0.2 }), FRONT);
    expect(v.code).toBe("too_bright");
  });
});

describe("analyzeFrame — side-step angle guidance", () => {
  it("suggests turn_more when under-rotated", () => {
    expect(analyzeFrame(face({ yawDeg: 15 }), stats(), RIGHT).code).toBe("turn_more");
    expect(analyzeFrame(face({ yawDeg: -15 }), stats(), LEFT).code).toBe("turn_more");
  });

  it("suggests turn_back when over-rotated", () => {
    expect(analyzeFrame(face({ yawDeg: 80 }), stats(), RIGHT).code).toBe("turn_back");
    expect(analyzeFrame(face({ yawDeg: -80 }), stats(), LEFT).code).toBe("turn_back");
  });

  it("suggests turn_other_way when rotated in the wrong direction", () => {
    expect(analyzeFrame(face({ yawDeg: -30 }), stats(), RIGHT).code).toBe("turn_other_way");
    expect(analyzeFrame(face({ yawDeg: 30 }), stats(), LEFT).code).toBe("turn_other_way");
  });
});

describe("analyzeFrame — hysteresis bands", () => {
  it("requires brighter recovery after too_dark", () => {
    const luma = (THRESHOLDS.lumaDarkEnter + THRESHOLDS.lumaDarkExit) / 2; // between bands
    expect(analyzeFrame(face(), stats({ lumaMean: luma }), FRONT, "ok").code).toBe("ok");
    expect(analyzeFrame(face(), stats({ lumaMean: luma }), FRONT, "too_dark").code).toBe(
      "too_dark",
    );
  });

  it("requires sharper recovery after blurry", () => {
    const sharp = (THRESHOLDS.sharpEnter + THRESHOLDS.sharpExit) / 2;
    expect(analyzeFrame(face(), stats({ sharpness: sharp }), FRONT, "ok").code).toBe("ok");
    expect(analyzeFrame(face(), stats({ sharpness: sharp }), FRONT, "blurry").code).toBe("blurry");
  });

  it("requires deeper rotation to recover from turn_more", () => {
    const yaw = RIGHT.yaw.min + 2; // inside enter band, outside exit band
    expect(analyzeFrame(face({ yawDeg: yaw }), stats(), RIGHT, "ok").code).toBe("ok");
    expect(analyzeFrame(face({ yawDeg: yaw }), stats(), RIGHT, "turn_more").code).toBe(
      "turn_more",
    );
  });
});

describe("analyzeFrame — detector unavailable (heuristics only)", () => {
  it("never reports good and never arms auto-capture", () => {
    const v = analyzeFrame(null, stats(), FRONT);
    expect(v.level).toBe("acceptable");
    expect(v.readyForAutoCapture).toBe(false);
  });

  it("still catches lighting and blur problems", () => {
    expect(analyzeFrame(null, stats({ lumaMean: 50 }), FRONT).code).toBe("too_dark");
    expect(analyzeFrame(null, stats({ sharpness: 15 }), FRONT).code).toBe("blurry");
  });

  it("copes with having no signal at all", () => {
    const v = analyzeFrame(null, null, FRONT);
    expect(v.readyForAutoCapture).toBe(false);
  });
});
