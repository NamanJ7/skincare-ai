import { describe, expect, it } from "vitest";

import type { Assessment } from "../types/assessment";
import {
  assessmentHistory,
  baselineOf,
  latestOf,
  recordInHistory,
  type StoredAssessment,
} from "./history";

function assessment(summary: string): Assessment {
  return {
    findings: [],
    escalation: { recommendProfessional: false, reasons: [] },
    summary,
    disclaimer: "",
    photoQuality: [],
    overallConfidence: 0.9,
    limitations: [],
  };
}

function entry(id: string, day: string): StoredAssessment {
  return { sessionId: id, capturedAt: `2026-01-${day}T09:00:00.000Z`, assessment: assessment(id) };
}

describe("assessmentHistory (migration)", () => {
  it("returns nothing for an untouched record", () => {
    expect(assessmentHistory({})).toEqual([]);
  });

  it("carries a lone baseline through", () => {
    const b = entry("s1", "01");
    expect(assessmentHistory({ baseline: b })).toEqual([b]);
  });

  it("puts the legacy baseline first and the legacy latest second", () => {
    // Order in this array IS the claim about which reading came first. Getting
    // it backwards would make every comparison subtract the wrong way round.
    const b = entry("s1", "01");
    const l = entry("s2", "15");
    expect(assessmentHistory({ baseline: b, latest: l }).map((e) => e.sessionId)).toEqual([
      "s1",
      "s2",
    ]);
  });

  it("leaves an existing history untouched", () => {
    const history = [entry("s1", "01"), entry("s2", "15"), entry("s3", "20")];
    expect(assessmentHistory({ assessments: history })).toEqual(history);
  });

  it("does not duplicate an entry that is in both shapes", () => {
    // A half-finished write could leave both populated. Appending the legacy
    // copy again would put a second point at the same instant into any trend.
    const b = entry("s1", "01");
    const history = [b, entry("s2", "15")];
    expect(assessmentHistory({ assessments: history, baseline: b }).map((e) => e.sessionId)).toEqual(
      ["s1", "s2"],
    );
  });

  it("rescues a legacy baseline the history somehow lost", () => {
    const b = entry("s1", "01");
    const later = entry("s2", "15");
    expect(assessmentHistory({ assessments: [later], baseline: b }).map((e) => e.sessionId)).toEqual(
      ["s2", "s1"],
    );
  });
});

describe("baselineOf / latestOf", () => {
  it("has no latest until there are two readings", () => {
    const history = [entry("s1", "01")];
    expect(baselineOf(history)?.sessionId).toBe("s1");
    expect(latestOf(history)).toBeUndefined();
  });

  it("keeps the baseline fixed as the history grows", () => {
    const history = [entry("s1", "01"), entry("s2", "15"), entry("s3", "20")];
    expect(baselineOf(history)?.sessionId).toBe("s1");
    expect(latestOf(history)?.sessionId).toBe("s3");
  });
});

describe("recordInHistory", () => {
  it("appends a new session", () => {
    const history = recordInHistory([entry("s1", "01")], entry("s2", "15"));
    expect(history.map((e) => e.sessionId)).toEqual(["s1", "s2"]);
  });

  it("replaces a re-assessment of the same session in place", () => {
    // A retry of one capture set is a correction, not a second point in time.
    const history = recordInHistory([entry("s1", "01"), entry("s2", "15")], {
      ...entry("s2", "15"),
      assessment: { ...assessment("redone") },
    });
    expect(history).toHaveLength(2);
    expect(history[1]?.assessment.summary).toBe("redone");
  });

  it("never displaces the baseline", () => {
    const history = recordInHistory([entry("s1", "01")], entry("s2", "15"));
    expect(baselineOf(history)?.sessionId).toBe("s1");
  });
});
