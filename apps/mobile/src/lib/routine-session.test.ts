import { describe, expect, it } from "vitest";

import { emptyLog, normalizeLog } from "./log";
import {
  ROUTINE_SESSION_CLOCK_SKEW_MS,
  ROUTINE_SESSION_RESUME_MS,
  abandonRoutineSession,
  finishRoutineSession,
  periodResolved,
  recordSessionDone,
  recordSessionSkip,
  routineSessionEntry,
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

  it("expires a session whose start sits in the future after a clock change", () => {
    const session = started().activeSession!;
    const at = (offset: number) => new Date(Date.parse(START) + offset);
    expect(routineSessionExpired(session, at(-ROUTINE_SESSION_CLOCK_SKEW_MS))).toBe(false);
    expect(routineSessionExpired(session, at(-ROUTINE_SESSION_CLOCK_SKEW_MS - 1))).toBe(true);
    expect(routineSessionExpired(session, at(-24 * 60 * 60 * 1000))).toBe(true);
  });
});

describe("routineSessionEntry", () => {
  const live = () => started().activeSession!;
  const base = {
    requested: "pm" as const,
    explicit: true,
    todayPeriod: undefined,
    dueCount: 2,
    now: new Date("2026-09-13T00:30:00.000Z"),
  };

  it("resumes a PM session that crossed midnight on a PM reminder", () => {
    expect(routineSessionEntry({ ...base, session: live() })).toBe("resume");
  });

  it("switches to the notified period instead of resuming a different one", () => {
    expect(
      routineSessionEntry({ ...base, session: live(), requested: "am" }),
    ).toBe("switch");
  });

  it("resumes whatever is live when no period was asked for", () => {
    expect(
      routineSessionEntry({
        ...base,
        session: live(),
        requested: "am",
        explicit: false,
      }),
    ).toBe("resume");
  });

  it("expires before deciding anything else", () => {
    expect(
      routineSessionEntry({
        ...base,
        session: live(),
        requested: "am",
        now: new Date(Date.parse(START) + ROUTINE_SESSION_RESUME_MS + 1),
      }),
    ).toBe("expire");
  });

  it("shows a completed period instead of starting a duplicate session", () => {
    expect(
      routineSessionEntry({
        ...base,
        session: undefined,
        todayPeriod: {
          done: ["cleanser:base"],
          total: 1,
          completedAt: "2026-09-12T21:00:00.000Z",
        },
      }),
    ).toBe("completed");
  });

  it("starts only when something is due", () => {
    expect(routineSessionEntry({ ...base, session: undefined })).toBe("start");
    expect(
      routineSessionEntry({ ...base, session: undefined, dueCount: 0 }),
    ).toBe("none");
  });

  it("keeps step outcomes when a switched-away session is closed", () => {
    const log = abandonRoutineSession(
      recordSessionDone(started(), "cleanser:base", 1, START),
    );
    expect(log.activeSession).toBeUndefined();
    expect(log.days["2026-09-12"].pm?.done).toEqual(["cleanser:base"]);
  });
});
