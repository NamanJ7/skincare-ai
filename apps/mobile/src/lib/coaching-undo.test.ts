import type { Routine } from "@pore/shared";
import { describe, expect, it } from "vitest";

import {
  COACHING_HISTORY_LIMIT,
  canUndoRevision,
  emptyLog,
  normalizeLog,
  withAppliedRevision,
  withUndoneRevision,
  type RoutineRevision,
} from "./log";

const DATE = "2026-07-10";

const lighter: Routine = {
  am: [],
  pm: [
    { order: 1, category: "cleanser", frequencyPerWeek: 7, rationale: "", irritationRisk: "low" },
    { order: 2, category: "moisturizer", frequencyPerWeek: 7, rationale: "", irritationRisk: "low" },
  ],
  notes: [],
};

function revision(
  kind: RoutineRevision["kind"] = "pause_strong_actives",
  acceptedAt = `${DATE}T12:00:00.000Z`,
): RoutineRevision {
  return { kind, acceptedAt, effectiveDate: DATE, reason: "Pause the active." };
}

function logWithRetinoidDone() {
  const log = emptyLog();
  log.days[DATE] = {
    pm: {
      done: ["cleanser:base", "treatment:retinoid"],
      total: 3,
      scheduledStepKeys: ["cleanser:base", "treatment:retinoid", "moisturizer:base"],
    },
  };
  return log;
}

describe("coaching Apply / Undo", () => {
  it("apply takes effect and records history", () => {
    const applied = withAppliedRevision(logWithRetinoidDone(), revision(), lighter);
    expect(applied.revision?.kind).toBe("pause_strong_actives");
    expect(applied.days[DATE].pm?.done).toEqual(["cleanser:base"]);
    expect(applied.coachingHistory).toEqual([
      { kind: "pause_strong_actives", date: DATE, appliedAt: `${DATE}T12:00:00.000Z` },
    ]);
    expect(canUndoRevision(applied, DATE)).toBe(true);
  });

  it("undo restores the previous routine and the steps apply trimmed", () => {
    const before = logWithRetinoidDone();
    const undone = withUndoneRevision(
      withAppliedRevision(before, revision(), lighter),
      `${DATE}T12:05:00.000Z`,
    );
    expect(undone.revision).toBeUndefined();
    expect(undone.revisionUndo).toBeUndefined();
    expect(undone.days[DATE].pm).toEqual(before.days[DATE].pm);
    expect(undone.coachingHistory?.[0]?.undoneAt).toBe(`${DATE}T12:05:00.000Z`);
    expect(canUndoRevision(undone, DATE)).toBe(false);
  });

  it("undo keeps outcomes recorded after apply", () => {
    const applied = withAppliedRevision(logWithRetinoidDone(), revision(), lighter);
    applied.days[DATE].pm = { ...applied.days[DATE].pm!, done: ["cleanser:base", "moisturizer:base"] };
    const undone = withUndoneRevision(applied, `${DATE}T13:00:00.000Z`);
    expect(undone.days[DATE].pm?.done).toEqual([
      "cleanser:base",
      "treatment:retinoid",
      "moisturizer:base",
    ]);
    expect(undone.days[DATE].pm?.total).toBe(3);
  });

  it("undo brings back the revision that was in force before", () => {
    const first = withAppliedRevision(emptyLog(), revision("simplify_today", `${DATE}T08:00:00.000Z`));
    const second = withAppliedRevision(first, revision("pause_strong_actives"));
    const undone = withUndoneRevision(second, `${DATE}T12:30:00.000Z`);
    expect(undone.revision?.kind).toBe("simplify_today");
    expect(undone.coachingHistory?.map((e) => !!e.undoneAt)).toEqual([false, true]);
  });

  it("is one level deep and only on the day the change took effect", () => {
    const undone = withUndoneRevision(
      withAppliedRevision(emptyLog(), revision()),
      `${DATE}T12:30:00.000Z`,
    );
    expect(withUndoneRevision(undone, `${DATE}T12:31:00.000Z`)).toBe(undone);
    const applied = withAppliedRevision(emptyLog(), revision());
    expect(canUndoRevision(applied, "2026-07-11")).toBe(false);
  });

  it("caps history and survives a round-trip through storage", () => {
    let log = emptyLog();
    for (let i = 0; i < COACHING_HISTORY_LIMIT + 5; i += 1) {
      log = withAppliedRevision(log, revision("small_win", `${DATE}T00:00:${String(i).padStart(2, "0")}.000Z`));
    }
    expect(log.coachingHistory).toHaveLength(COACHING_HISTORY_LIMIT);
    const restored = normalizeLog(JSON.parse(JSON.stringify(log)));
    expect(restored.coachingHistory).toEqual(log.coachingHistory);
    expect(restored.revisionUndo).toEqual(log.revisionUndo);
  });

  it("drops malformed undo and history entries from storage", () => {
    const restored = normalizeLog({
      days: {},
      revisionUndo: { date: "bad" },
      coachingHistory: [{ kind: "small_win" }, null],
    });
    expect(restored.revisionUndo).toBeUndefined();
    expect(restored.coachingHistory).toBeUndefined();
  });
});
