import { describe, expect, it } from "vitest";

import { addCheckIn, emptyCheckIns, type CheckIn, type CheckInLog } from "./check-in";
import { deriveSkinStatus, statusFromPair } from "./skin-status";

function entry(date: string, patch: Partial<CheckIn> = {}): CheckIn {
  return {
    date,
    createdAt: `${date}T12:00:00.000Z`,
    skinFeel: 3,
    breakouts: "few",
    irritationSigns: [],
    followedRoutine: "most",
    ...patch,
  };
}

function checkIns(...entries: CheckIn[]): CheckInLog {
  return entries.reduce(addCheckIn, emptyCheckIns());
}

const TODAY = "2026-07-09";

describe("deriveSkinStatus", () => {
  it("starts brand-new users at Starting, never Needs Check-In", () => {
    expect(deriveSkinStatus(emptyCheckIns(), TODAY).status).toBe("starting");
  });

  it("stays Starting with only a baseline check-in", () => {
    expect(deriveSkinStatus(checkIns(entry("2026-07-08")), TODAY).status).toBe("starting");
  });

  it("flags Needs Check-In once the 7-day cadence lapses", () => {
    expect(deriveSkinStatus(checkIns(entry("2026-07-01")), "2026-07-09").status).toBe(
      "needs_check_in",
    );
  });

  it("reads Rebuilding when anything trended worse", () => {
    const log = checkIns(
      entry("2026-07-01", { breakouts: "none" }),
      entry("2026-07-08", { breakouts: "several" }),
    );
    expect(deriveSkinStatus(log, TODAY).status).toBe("rebuilding");
  });

  it("reads Improving when something moved better and nothing worse", () => {
    const log = checkIns(
      entry("2026-07-01", { breakouts: "several" }),
      entry("2026-07-08", { breakouts: "none" }),
    );
    expect(deriveSkinStatus(log, TODAY).status).toBe("improving");
  });

  it("reads Stabilizing when everything held steady", () => {
    const log = checkIns(entry("2026-07-01"), entry("2026-07-08"));
    expect(deriveSkinStatus(log, TODAY).status).toBe("stabilizing");
  });

  it("lets worse outrank better (rebuilding wins mixed weeks)", () => {
    const log = checkIns(
      entry("2026-07-01", { breakouts: "several", skinFeel: 2 }),
      entry("2026-07-08", { breakouts: "none", skinFeel: 1 }),
    );
    expect(deriveSkinStatus(log, TODAY).status).toBe("rebuilding");
  });

  it("carries copy for every status", () => {
    const result = deriveSkinStatus(emptyCheckIns(), TODAY);
    expect(result.label).toBe("Starting");
    expect(result.headline.length).toBeGreaterThan(0);
    expect(result.detail.length).toBeGreaterThan(0);
  });
});

describe("statusFromPair", () => {
  it("is starting without two check-ins", () => {
    expect(statusFromPair(undefined, undefined)).toBe("starting");
    expect(statusFromPair(entry(TODAY), undefined)).toBe("starting");
  });

  it("compares the given pair directly", () => {
    expect(statusFromPair(entry(TODAY, { skinFeel: 5 }), entry("2026-07-02", { skinFeel: 2 }))).toBe(
      "improving",
    );
    expect(statusFromPair(entry(TODAY, { skinFeel: 2 }), entry("2026-07-02", { skinFeel: 5 }))).toBe(
      "rebuilding",
    );
    expect(statusFromPair(entry(TODAY), entry("2026-07-02"))).toBe("stabilizing");
  });
});
