import { describe, expect, it } from "vitest";

import type { Assessment, ConcernFinding, ConcernKey, PhotoQuality } from "../types/assessment";
import { compareAssessments } from "./compare";

const DAY = 24 * 60 * 60 * 1000;
const T0 = "2026-01-01T09:00:00.000Z";
const at = (days: number) => new Date(new Date(T0).getTime() + days * DAY).toISOString();

function finding(
  concern: ConcernKey,
  appearanceLevel: ConcernFinding["appearanceLevel"],
  confidence = 0.9,
): ConcernFinding {
  return {
    concern,
    present: appearanceLevel !== "none",
    appearanceLevel,
    confidence,
    contributingFactors: [],
    regions: [],
  };
}

function quality(illuminant: PhotoQuality["illuminant"] = "screen_flash"): PhotoQuality[] {
  return (["front", "left", "right"] as const).map((angle) => ({
    angle,
    score: 0.9,
    flags: [],
    illuminant,
  }));
}

function assessment(
  findings: ConcernFinding[],
  overrides: Partial<Assessment> = {},
): Assessment {
  return {
    findings,
    escalation: { recommendProfessional: false, reasons: [] },
    summary: "",
    disclaimer: "",
    photoQuality: quality(),
    overallConfidence: 0.85,
    limitations: [],
    ...overrides,
  };
}

/** The common case: one concern, moderate then mild, 30 days and good light. */
function pair(
  before: ConcernFinding[],
  after: ConcernFinding[],
  days = 30,
  overrides: { before?: Partial<Assessment>; after?: Partial<Assessment> } = {},
) {
  return compareAssessments(
    assessment(before, overrides.before),
    T0,
    assessment(after, overrides.after),
    at(days),
  );
}

describe("refuses to compare when it shouldn't", () => {
  it("is not comparable when the check-ins are less than four weeks apart", () => {
    const r = pair([finding("acne_like_breakouts", "moderate")], [finding("acne_like_breakouts", "mild")], 13);
    expect(r.comparable).toBe(false);
    expect(r.daysBetween).toBe(13);
    expect(r.changes).toHaveLength(0);
    expect(r.reason).toMatch(/four weeks/);
  });

  it("allows exactly 28 days", () => {
    const r = pair([finding("acne_like_breakouts", "moderate")], [finding("acne_like_breakouts", "mild")], 28);
    expect(r.comparable).toBe(true);
  });

  it("is not comparable when the two sessions used different light", () => {
    const r = pair(
      [finding("acne_like_breakouts", "moderate")],
      [finding("acne_like_breakouts", "mild")],
      30,
      { after: { photoQuality: quality("ambient") } },
    );
    expect(r.comparable).toBe(false);
    expect(r.reason).toMatch(/same light/);
  });

  it("is not comparable when one session mixed illuminants", () => {
    const mixed: PhotoQuality[] = [
      { angle: "front", score: 0.9, flags: [], illuminant: "screen_flash" },
      { angle: "left", score: 0.9, flags: [], illuminant: "ambient" },
    ];
    const r = pair([finding("oiliness", "moderate")], [finding("oiliness", "mild")], 30, {
      before: { photoQuality: mixed },
    });
    expect(r.comparable).toBe(false);
  });

  it("is not comparable when photo quality is missing entirely", () => {
    const r = pair([finding("oiliness", "moderate")], [finding("oiliness", "mild")], 30, {
      before: { photoQuality: [] },
    });
    expect(r.comparable).toBe(false);
  });

  it("is not comparable when the earlier read was low confidence", () => {
    const r = pair([finding("oiliness", "moderate")], [finding("oiliness", "mild")], 30, {
      before: { overallConfidence: 0.3 },
    });
    expect(r.comparable).toBe(false);
    expect(r.reason).toMatch(/low-confidence/);
  });

  it("is not comparable when the later read was low confidence", () => {
    const r = pair([finding("oiliness", "moderate")], [finding("oiliness", "mild")], 30, {
      after: { overallConfidence: 0.3 },
    });
    expect(r.comparable).toBe(false);
  });

  it("is not comparable when the check-ins arrive out of order", () => {
    const r = compareAssessments(assessment([]), at(30), assessment([]), T0);
    expect(r.comparable).toBe(false);
    expect(r.reason).toMatch(/out of order/);
  });

  it("is not comparable when a timestamp is unreadable", () => {
    const r = compareAssessments(assessment([]), "not-a-date", assessment([]), T0);
    expect(r.comparable).toBe(false);
  });
});

describe("direction", () => {
  it("calls a drop in level less visible", () => {
    const r = pair([finding("dark_spot_appearance", "noticeable")], [finding("dark_spot_appearance", "mild")]);
    expect(r.changes).toHaveLength(1);
    expect(r.changes[0]).toMatchObject({ direction: "less_visible", from: "noticeable", to: "mild" });
  });

  it("calls a rise in level more visible", () => {
    const r = pair([finding("redness_appearance", "mild")], [finding("redness_appearance", "moderate")]);
    expect(r.changes[0]!.direction).toBe("more_visible");
  });

  it("calls an unchanged level steady", () => {
    const r = pair([finding("oiliness", "moderate")], [finding("oiliness", "moderate")]);
    expect(r.changes[0]!.direction).toBe("steady");
  });
});

describe("declines individual concerns rather than guessing", () => {
  it("is unclear when either finding is low confidence, and says which", () => {
    const r = pair(
      [finding("texture_congestion", "moderate", 0.2)],
      [finding("texture_congestion", "mild", 0.9)],
    );
    expect(r.changes[0]!.direction).toBe("unclear");
    expect(r.changes[0]!.caveat).toMatch(/earlier check-in/);
  });

  it("is unclear when the concern is missing from one side", () => {
    const r = pair([finding("uneven_tone", "moderate")], []);
    expect(r.changes[0]).toMatchObject({ direction: "unclear" });
    expect(r.changes[0]!.caveat).toMatch(/later check-in/);
  });

  it("omits concerns neither check-in saw", () => {
    const r = pair(
      [finding("acne_like_breakouts", "none"), finding("oiliness", "mild")],
      [finding("acne_like_breakouts", "none"), finding("oiliness", "none")],
    );
    expect(r.changes.map((c) => c.concern)).toEqual(["oiliness"]);
  });
});

describe("summary", () => {
  it("never uses clinical or shaming language", () => {
    const cases = [
      pair([finding("acne_like_breakouts", "noticeable")], [finding("acne_like_breakouts", "none")]),
      pair([finding("acne_like_breakouts", "none")], [finding("acne_like_breakouts", "noticeable")]),
      pair([finding("oiliness", "mild")], [finding("oiliness", "mild")]),
      pair([finding("oiliness", "mild", 0.1)], [finding("oiliness", "mild", 0.1)]),
      pair([], []),
      pair([finding("oiliness", "mild")], [finding("oiliness", "none")], 3),
    ];
    const banned = /\b(acne vulgaris|diagnos|severe|severity|lesion|disease|condition|worse|worsen|bad|ugly|cured?)\b/i;
    for (const r of cases) {
      expect(r.summary, r.summary).not.toMatch(banned);
      expect(r.summary.length).toBeGreaterThan(0);
    }
  });

  it("reports counts truthfully", () => {
    const r = pair(
      [finding("oiliness", "moderate"), finding("uneven_tone", "mild"), finding("redness_appearance", "mild")],
      [finding("oiliness", "mild"), finding("uneven_tone", "moderate"), finding("redness_appearance", "mild")],
    );
    expect(r.summary).toMatch(/1 looks less visible and 1 looks more visible/);
  });

  it("says so plainly when nothing changed", () => {
    const r = pair([finding("oiliness", "mild")], [finding("oiliness", "mild")]);
    expect(r.summary).toMatch(/about the same/);
  });
});
