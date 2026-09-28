import { describe, expect, it } from "vitest";

import {
  addCheckIn,
  emptyCheckIns,
  type CheckIn,
  type CheckInLog,
} from "./check-in";
import {
  photoTimeline,
  timelineLabel,
  type TimelineEntry,
} from "./photo-timeline";
import type { ScanHistory } from "./scan-history";

function entry(date: string, photoName?: string): CheckIn {
  return {
    date,
    createdAt: `${date}T12:00:00.000Z`,
    skinFeel: 3,
    breakouts: "few",
    irritationSigns: [],
    followedRoutine: "most",
    photoName,
  };
}

function checkIns(...entries: CheckIn[]): CheckInLog {
  return entries.reduce(addCheckIn, emptyCheckIns());
}

function scans(
  ...records: { date: string; photoNames: string[] }[]
): ScanHistory {
  return {
    scans: records.map((r) => ({ ...r, createdAt: `${r.date}T09:00:00.000Z` })),
  };
}

describe("photoTimeline", () => {
  it("merges scan front shots and check-in photos, oldest first", () => {
    const timeline = photoTimeline(
      scans({ date: "2026-07-01", photoNames: ["1-front.jpg", "1-right.jpg"] }),
      checkIns(entry("2026-07-08", "checkin-8.jpg")),
    );
    expect(timeline.map((t) => t.photoName)).toEqual([
      "1-front.jpg",
      "checkin-8.jpg",
    ]);
    expect(timeline[0].source).toBe("scan");
    expect(timeline[1].source).toBe("check_in");
  });

  it("drops entries without photos", () => {
    const timeline = photoTimeline(
      scans({ date: "2026-07-01", photoNames: [] }),
      checkIns(entry("2026-07-08")),
    );
    expect(timeline).toEqual([]);
  });

  it("does not substitute a side angle when the front photo is missing", () => {
    const timeline = photoTimeline(
      scans({
        date: "2026-07-01",
        photoNames: ["1-right.jpg", "1-left.jpg"],
      }),
      checkIns(),
    );
    expect(timeline).toEqual([]);
  });
});

describe("timelineLabel", () => {
  const baseline: TimelineEntry = {
    date: "2026-07-01",
    createdAt: "2026-07-01T09:00:00.000Z",
    photoName: "1-front.jpg",
    source: "scan",
  };
  const at = (date: string): TimelineEntry => ({ ...baseline, date });

  it("labels the baseline Day 1 and counts days, weeks, months from it", () => {
    expect(timelineLabel(baseline, baseline)).toBe("Day 1");
    expect(timelineLabel(baseline, at("2026-07-04"))).toBe("Day 4");
    expect(timelineLabel(baseline, at("2026-07-08"))).toBe("Week 1");
    expect(timelineLabel(baseline, at("2026-07-15"))).toBe("Week 2");
    expect(timelineLabel(baseline, at("2026-07-31"))).toBe("Month 1");
  });
});
