import { describe, expect, it } from "vitest";

import {
  MAX_NOTE_LENGTH,
  addCheckIn,
  checkInDue,
  daysBetween,
  daysUntilDue,
  emptyCheckIns,
  hasRedFlags,
  latestCheckIn,
  normalizeCheckIns,
  previousCheckIn,
  type CheckIn,
} from "./check-in";

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

describe("addCheckIn", () => {
  it("keeps entries sorted ascending by date", () => {
    let log = addCheckIn(emptyCheckIns(), entry("2026-07-05"));
    log = addCheckIn(log, entry("2026-06-28"));
    expect(log.entries.map((e) => e.date)).toEqual(["2026-06-28", "2026-07-05"]);
    expect(latestCheckIn(log)?.date).toBe("2026-07-05");
    expect(previousCheckIn(log)?.date).toBe("2026-06-28");
  });

  it("replaces a same-day entry instead of duplicating", () => {
    let log = addCheckIn(emptyCheckIns(), entry("2026-07-05", { skinFeel: 2 }));
    log = addCheckIn(log, entry("2026-07-05", { skinFeel: 5 }));
    expect(log.entries).toHaveLength(1);
    expect(latestCheckIn(log)?.skinFeel).toBe(5);
  });

  it("does not mutate the previous log", () => {
    const before = emptyCheckIns();
    addCheckIn(before, entry("2026-07-05"));
    expect(before.entries).toEqual([]);
  });
});

describe("daysBetween", () => {
  it("counts whole days across month boundaries", () => {
    expect(daysBetween("2026-06-28", "2026-07-05")).toBe(7);
    expect(daysBetween("2026-07-05", "2026-07-05")).toBe(0);
  });
});

describe("checkInDue / daysUntilDue", () => {
  it("is due immediately when no check-in exists (baseline)", () => {
    expect(checkInDue(emptyCheckIns(), "2026-07-05")).toBe(true);
    expect(daysUntilDue(emptyCheckIns(), "2026-07-05")).toBe(0);
  });

  it("is due at exactly 7 days, not at 6", () => {
    const log = addCheckIn(emptyCheckIns(), entry("2026-06-28"));
    expect(checkInDue(log, "2026-07-04")).toBe(false);
    expect(daysUntilDue(log, "2026-07-04")).toBe(1);
    expect(checkInDue(log, "2026-07-05")).toBe(true);
    expect(daysUntilDue(log, "2026-07-05")).toBe(0);
  });

  it("never reports negative days until due", () => {
    const log = addCheckIn(emptyCheckIns(), entry("2026-06-01"));
    expect(daysUntilDue(log, "2026-07-05")).toBe(0);
  });
});

describe("hasRedFlags", () => {
  it("flags burning, pain, and spreading rash only", () => {
    expect(hasRedFlags(entry("2026-07-05", { irritationSigns: ["burning"] }))).toBe(true);
    expect(hasRedFlags(entry("2026-07-05", { irritationSigns: ["pain"] }))).toBe(true);
    expect(hasRedFlags(entry("2026-07-05", { irritationSigns: ["spreading_rash"] }))).toBe(true);
    expect(hasRedFlags(entry("2026-07-05", { irritationSigns: ["redness", "itching"] }))).toBe(false);
    expect(hasRedFlags(undefined)).toBe(false);
  });
});

describe("normalizeCheckIns", () => {
  // Storage and the cloud restore both return whatever an older build wrote.
  // A `{}` payload used to reach `checkIns.entries.length` on the Home tab.
  it("returns an empty log for payloads that are not a check-in log", () => {
    expect(normalizeCheckIns({}).entries).toEqual([]);
    expect(normalizeCheckIns(null).entries).toEqual([]);
    expect(normalizeCheckIns({ entries: "nope" }).entries).toEqual([]);
  });

  it("drops entries missing the fields the trend math reads", () => {
    const out = normalizeCheckIns({
      entries: [
        {
          date: "2026-07-27",
          createdAt: "2026-07-27T10:00:00.000Z",
          skinFeel: 4,
          breakouts: "few",
          irritationSigns: [],
          followedRoutine: "most",
        },
        { date: "2026-07-26" },
        null,
        { date: "2026-07-25", createdAt: "x", skinFeel: 3, breakouts: "none" },
      ],
    });
    expect(out.entries).toHaveLength(1);
    expect(out.entries[0].date).toBe("2026-07-27");
  });

  it("keeps entries sorted ascending by date", () => {
    const entry = (date: string) => ({
      date,
      createdAt: `${date}T10:00:00.000Z`,
      skinFeel: 3,
      breakouts: "none",
      irritationSigns: [],
      followedRoutine: "most",
    });
    const out = normalizeCheckIns({
      entries: [entry("2026-07-27"), entry("2026-07-20")],
    });
    expect(out.entries.map((e) => e.date)).toEqual(["2026-07-20", "2026-07-27"]);
  });
});

/**
 * The note is free text that goes to AsyncStorage and then verbatim into
 * `checkins.payload` jsonb, which has no length constraint of its own — and
 * pushCheckins re-uploads the whole entries array on every sync, so one pasted
 * megabyte is re-sent on every mutation thereafter. The cap lives here rather
 * than only on the TextField so it holds regardless of entry point.
 */
describe("note length", () => {
  const entry: CheckIn = {
    date: "2026-08-24",
    createdAt: "2026-08-24T10:00:00Z",
    skinFeel: 3,
    breakouts: "none",
    irritationSigns: [],
    followedRoutine: "most",
  };

  it("stores a normal note untouched", () => {
    const log = addCheckIn(emptyCheckIns(), { ...entry, note: "Travelled, dry air." });
    expect(log.entries[0]!.note).toBe("Travelled, dry air.");
  });

  it("truncates a note beyond the cap rather than storing it whole", () => {
    const log = addCheckIn(emptyCheckIns(), {
      ...entry,
      note: "x".repeat(MAX_NOTE_LENGTH + 5_000),
    });
    expect(log.entries[0]!.note).toHaveLength(MAX_NOTE_LENGTH);
  });

  it("keeps a note exactly at the cap", () => {
    const note = "y".repeat(MAX_NOTE_LENGTH);
    expect(addCheckIn(emptyCheckIns(), { ...entry, note }).entries[0]!.note).toBe(note);
  });

  it("leaves an absent note absent", () => {
    expect(addCheckIn(emptyCheckIns(), { ...entry }).entries[0]!.note).toBeUndefined();
  });
});
