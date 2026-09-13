import { describe, expect, it } from "vitest";

import { emptyLog, normalizeLog } from "./log";
import {
  ROUTINE_SESSION_RESUME_MS,
  finishRoutineSession,
  periodResolved,
  recordSessionDone,
  recordSessionSkip,
  routineSessionExpired,
  startRoutineSession,
} from "./routine-session";

const START = "2026-09-12T23:58:00.000Z";

function started() {
  return startRoutineSession(emptyLog(), {
    id: "session-1",
    date: "2026-09-12",
    period: "pm",
    source: "home",
    routineFingerprint: "routine-1",
    stepKeys: ["cleanser:base", "treatment:retinoid"],
    startedAt: START,
  });
}

describe("guided routine session state", () => {
  it("starts with scheduled totals and the first unresolved step", () => {
    const log = started();
    expect(log.activeSession?.currentIndex).toBe(0);
    expect(log.days["2026-09-12"].pm).toMatchObject({
      done: [],
      total: 2,
      scheduledStepKeys: ["cleanser:base", "treatment:retinoid"],
      source: "guided",
    });
  });

  it("records done and skip as distinct outcomes", () => {
    let log = recordSessionDone(started(), "cleanser:base", 1, START);
    log = recordSessionSkip(log, "treatment:retinoid", "not_now", 2, START);
    const period = log.days["2026-09-12"].pm;
    expect(period?.done).toEqual(["cleanser:base"]);
    expect(period?.skipped?.["treatment:retinoid"].reason).toBe("not_now");
    expect(periodResolved(period)).toBe(true);
  });

  it("marking a skipped step done clears its skip", () => {
    let log = recordSessionSkip(
      started(),
      "cleanser:base",
      "ran_out",
      1,
      START,
    );
    log = recordSessionDone(log, "cleanser:base", 1, START);
    expect(log.days["2026-09-12"].pm?.skipped).toBeUndefined();
    expect(log.days["2026-09-12"].pm?.done).toContain("cleanser:base");
  });

  it("finishes only after every step has an outcome", () => {
    const incomplete = finishRoutineSession(started(), START);
    expect(incomplete.activeSession).toBeDefined();
    let resolved = recordSessionDone(started(), "cleanser:base", 1, START);
    resolved = recordSessionSkip(
      resolved,
      "treatment:retinoid",
      "not_now",
      2,
      START,
    );
    resolved = finishRoutineSession(resolved, "2026-09-13T00:03:00.000Z");
    expect(resolved.activeSession).toBeUndefined();
    expect(resolved.days["2026-09-12"].pm?.completedAt).toBe(
      "2026-09-13T00:03:00.000Z",
    );
  });

  it("resumes for six hours and expires only after the boundary", () => {
    const session = started().activeSession!;
    expect(
      routineSessionExpired(
        session,
        new Date(Date.parse(START) + ROUTINE_SESSION_RESUME_MS),
      ),
    ).toBe(false);
    expect(
      routineSessionExpired(
        session,
        new Date(Date.parse(START) + ROUTINE_SESSION_RESUME_MS + 1),
      ),
    ).toBe(true);
  });

  it("drops malformed new session fields while preserving legacy history", () => {
    const normalized = normalizeLog({
      days: { "2026-09-12": { pm: { done: ["cleanser:base"], total: 1 } } },
      schedule: { fingerprint: 7, anchorDate: "bad" },
      activeSession: { id: "broken" },
    });
    expect(normalized.days["2026-09-12"].pm?.done).toEqual(["cleanser:base"]);
    expect(normalized.schedule).toBeUndefined();
    expect(normalized.activeSession).toBeUndefined();
  });

  it("keeps outcomes from an earlier routine when an updated session starts", () => {
    const before = emptyLog();
    before.days["2026-09-12"] = {
      pm: {
        done: ["retired:base"],
        total: 1,
        scheduledStepKeys: ["retired:base"],
      },
    };
    const updated = startRoutineSession(before, {
      id: "updated",
      date: "2026-09-12",
      period: "pm",
      source: "routine",
      routineFingerprint: "routine-2",
      stepKeys: ["cleanser:base"],
      startedAt: START,
    });
    expect(updated.days["2026-09-12"].pm?.done).toContain("retired:base");
    expect(periodResolved(updated.days["2026-09-12"].pm)).toBe(false);
  });
});
