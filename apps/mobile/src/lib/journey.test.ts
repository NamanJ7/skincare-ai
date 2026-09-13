import { describe, expect, it } from "vitest";

import { emptyCheckIns, type CheckIn, type CheckInLog } from "./check-in";
import { deriveJourney } from "./journey";
import { emptyLog, type DateKey, type RoutineLog } from "./log";
import { emptyScans, type ScanHistory, type ScanRecord } from "./scan-history";

const TODAY = "2026-07-16";

function scan(
  date: DateKey,
  createdAt: string,
  patch: Partial<ScanRecord> = {},
): ScanRecord {
  return {
    date,
    createdAt,
    photoNames: [`${date}-front.jpg`],
    ...patch,
  };
}

function checkIn(date: DateKey, patch: Partial<CheckIn> = {}): CheckIn {
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

function completeDays(...dates: DateKey[]): RoutineLog {
  return {
    days: Object.fromEntries(
      dates.map((date) => [
        date,
        { pm: { done: ["moisturizer:base"], total: 1 } },
      ]),
    ),
  };
}

function derive(
  patch: {
    log?: RoutineLog;
    checkIns?: CheckInLog;
    scans?: ScanHistory;
    today?: DateKey;
  } = {},
) {
  return deriveJourney({
    log: patch.log ?? emptyLog(),
    checkIns: patch.checkIns ?? emptyCheckIns(),
    scans: patch.scans ?? emptyScans(),
    today: patch.today ?? TODAY,
  });
}

describe("deriveJourney", () => {
  it("returns an honest empty summary when no persisted activity exists", () => {
    expect(derive()).toEqual({
      startDate: null,
      dayNumber: null,
      completedRoutineDays: 0,
      events: [],
    });
  });

  it("anchors the journey to the earliest persisted source", () => {
    const summary = derive({
      log: completeDays("2026-07-10"),
      checkIns: { entries: [checkIn("2026-07-08")] },
      scans: {
        scans: [
          scan("2026-07-06", "2026-07-06T18:00:00.000Z", {
            analyzed: true,
          }),
        ],
      },
    });

    expect(summary.startDate).toBe("2026-07-06");
    expect(summary.dayNumber).toBe(11);
    expect(summary.events[0]?.title).toBe("Journey started");
  });

  it("labels a photo-only scan as unanalyzed and never creates a comparison milestone", () => {
    const summary = derive({
      scans: {
        scans: [
          scan("2026-07-06", "2026-07-06T18:00:00.000Z", {
            analyzed: false,
          }),
        ],
      },
    });
    const scanEvent = summary.events.find((event) => event.kind === "scan");

    expect(scanEvent).toMatchObject({
      title: "First scan saved",
      analyzed: false,
    });
    expect(scanEvent?.detail).toContain("was not analyzed");
    expect(
      summary.events.some(
        (event) => event.title === "First comparison available",
      ),
    ).toBe(false);
  });

  it("propagates user-reported irritation without merging it into another lane", () => {
    const summary = derive({
      checkIns: {
        entries: [
          checkIn("2026-07-12", {
            irritationSigns: ["stinging"],
            photoName: "check-in.jpg",
          }),
        ],
      },
    });
    const event = summary.events.find((item) => item.kind === "check_in");

    expect(event).toMatchObject({
      lane: "self_report",
      irritation: true,
      photoName: "check-in.jpg",
    });
  });

  it("does not claim a comparison for analyzed records without usable findings", () => {
    const summary = derive({
      scans: {
        scans: [
          scan("2026-07-06", "2026-07-06T08:00:00.000Z", {
            analyzed: true,
          }),
          scan("2026-07-13", "2026-07-13T08:00:00.000Z", {
            analyzed: true,
          }),
        ],
      },
    });

    expect(
      summary.events.some(
        (event) => event.title === "First comparison available",
      ),
    ).toBe(false);
  });

  it("adds a routine-adjustment event only when a revision is persisted", () => {
    expect(
      derive({
        log: completeDays("2026-07-12"),
      }).events.some((event) => event.kind === "routine_revision"),
    ).toBe(false);

    const log = completeDays("2026-07-12");
    log.revision = {
      kind: "simplify_today",
      acceptedAt: "2026-07-12T09:00:00.000Z",
      effectiveDate: "2026-07-12",
      reason: "Keep today simple.",
    };
    expect(
      derive({ log }).events.find((event) => event.kind === "routine_revision"),
    ).toMatchObject({
      lane: "behavior",
      title: "Routine adjusted",
      detail: "Keep today simple.",
    });
  });

  it("uses stable same-day ordering across event sources", () => {
    const log = completeDays("2026-07-12");
    log.revision = {
      kind: "small_win",
      acceptedAt: "2026-07-12T07:00:00.000Z",
      effectiveDate: "2026-07-12",
      reason: "One step is enough.",
    };
    const summary = derive({
      log,
      checkIns: {
        entries: [
          checkIn("2026-07-12", {
            createdAt: "2026-07-12T08:00:00.000Z",
          }),
        ],
      },
      scans: {
        scans: [
          scan("2026-07-12", "2026-07-12T10:00:00.000Z", {
            analyzed: true,
            findings: [],
          }),
          scan("2026-07-12", "2026-07-12T09:00:00.000Z", {
            analyzed: true,
            findings: [],
          }),
        ],
      },
    });

    expect(summary.events.map((event) => event.id)).toEqual([
      "journey-start:2026-07-12",
      "routine-day:2026-07-12",
      "scan:2026-07-12T09:00:00.000Z",
      "scan:2026-07-12T10:00:00.000Z",
      "check-in:2026-07-12:2026-07-12T08:00:00.000Z",
      "routine-revision:2026-07-12T07:00:00.000Z",
      "milestone:first-comparison:2026-07-12T10:00:00.000Z",
    ]);
  });

  it("creates only persisted routine and comparison milestones", () => {
    const routineDates = [
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
      "2026-07-04",
      "2026-07-05",
      "2026-07-06",
      "2026-07-07",
    ];
    const summary = derive({
      log: completeDays(...routineDates),
      scans: {
        scans: [
          scan("2026-07-02", "2026-07-02T08:00:00.000Z", {
            analyzed: true,
            findings: [],
          }),
          scan("2026-07-09", "2026-07-09T08:00:00.000Z", {
            analyzed: true,
            findings: [],
          }),
        ],
      },
    });

    expect(summary.completedRoutineDays).toBe(7);
    expect(
      summary.events.filter((event) => event.kind === "routine_day"),
    ).toHaveLength(7);
    expect(
      summary.events.find(
        (event) => event.title === "Seven routine days completed",
      )?.date,
    ).toBe("2026-07-07");
    expect(
      summary.events.find(
        (event) => event.title === "First comparison available",
      )?.date,
    ).toBe("2026-07-09");
  });

  it("computes journey days with local calendar math across daylight-saving changes", () => {
    const summary = derive({
      log: completeDays("2026-03-08"),
      today: "2026-03-09",
    });

    expect(summary.dayNumber).toBe(2);
  });
});
