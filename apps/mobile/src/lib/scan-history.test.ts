import { describe, expect, it } from "vitest";

import type { Assessment } from "@pore/shared";

import {
  addScan,
  emptyScans,
  latestAnalyzedScan,
  latestScan,
  normalizeScans,
  removeScan,
  type ScanRecord,
} from "./scan-history";

function assessment(): Assessment {
  return {
    findings: [],
    escalation: { recommendProfessional: false, reasons: [] },
    summary: "A clear read.",
    disclaimer: "Cosmetic guidance only.",
  };
}

function record(patch: Partial<ScanRecord> & { createdAt: string }): ScanRecord {
  return { date: "2026-07-11", photoNames: ["a.jpg"], ...patch };
}

describe("latestAnalyzedScan", () => {
  it("skips a photo-only record and returns the last analyzed one", () => {
    let history = emptyScans();
    history = addScan(
      history,
      record({ createdAt: "2026-07-01T00:00:00.000Z", analyzed: true, assessment: assessment() }),
    );
    // A later, photo-only attempt (analysis failed) — newest overall, but not analyzed.
    history = addScan(history, record({ createdAt: "2026-07-11T00:00:00.000Z" }));

    expect(latestScan(history)?.createdAt).toBe("2026-07-11T00:00:00.000Z");
    expect(latestAnalyzedScan(history)?.createdAt).toBe("2026-07-01T00:00:00.000Z");
  });

  it("returns undefined when nothing was analyzed", () => {
    let history = emptyScans();
    history = addScan(history, record({ createdAt: "2026-07-11T00:00:00.000Z" }));
    expect(latestAnalyzedScan(history)).toBeUndefined();
  });

  it("ignores a record flagged analyzed but missing its assessment", () => {
    let history = emptyScans();
    history = addScan(history, record({ createdAt: "2026-07-11T00:00:00.000Z", analyzed: true }));
    expect(latestAnalyzedScan(history)).toBeUndefined();
  });
});

describe("removeScan", () => {
  it("removes only the selected record and preserves chronological order", () => {
    let history = addScan(
      emptyScans(),
      record({ createdAt: "2026-07-01T00:00:00.000Z", scanId: "first" }),
    );
    history = addScan(
      history,
      record({ createdAt: "2026-07-08T00:00:00.000Z", scanId: "second" }),
    );

    expect(removeScan(history, "2026-07-01T00:00:00.000Z").scans).toEqual([
      expect.objectContaining({ scanId: "second" }),
    ]);
    expect(removeScan(history, "missing")).toEqual(history);
  });
});

describe("normalizeScans", () => {
  // A `{}` payload used to reach `history.scans.filter(...)` in gate.ts at
  // first render, throwing before any screen could draw.
  it("returns an empty history for payloads that are not a history", () => {
    expect(normalizeScans({}).scans).toEqual([]);
    expect(normalizeScans(null).scans).toEqual([]);
    expect(normalizeScans({ scans: "nope" }).scans).toEqual([]);
  });

  it("drops records that cannot be placed on the timeline", () => {
    const out = normalizeScans({
      scans: [
        { date: "2026-07-27", createdAt: "2026-07-27T10:00:00.000Z", photoNames: [] },
        { date: "2026-07-26" },
        null,
        { createdAt: "2026-07-25T10:00:00.000Z", photoNames: [] },
      ],
    });
    expect(out.scans).toHaveLength(1);
    expect(out.scans[0].date).toBe("2026-07-27");
  });

  it("never invents `analyzed`, so a restored record cannot imply an analysis", () => {
    const out = normalizeScans({
      scans: [
        { date: "2026-07-27", createdAt: "2026-07-27T10:00:00.000Z", photoNames: ["a.jpg"] },
      ],
    });
    expect(out.scans[0].analyzed).toBeUndefined();
  });
});
