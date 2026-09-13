import { describe, expect, it } from "vitest";

import type { Routine } from "@pore/shared";

import { activePeriod, dailyAction } from "./daily-action";
import type { DayLog } from "./log";

const routine: Routine = {
  am: [
    {
      order: 1,
      category: "cleanser",
      frequencyPerWeek: 7,
      rationale: "",
      irritationRisk: "low",
    },
  ],
  pm: [
    {
      order: 1,
      category: "moisturizer",
      frequencyPerWeek: 7,
      rationale: "",
      irritationRisk: "low",
    },
  ],
  notes: [],
};

const amDone: DayLog = { am: { done: ["cleanser:base"], total: 1 } };
const bothDone: DayLog = {
  am: { done: ["cleanser:base"], total: 1 },
  pm: { done: ["moisturizer:base"], total: 1 },
};

function ctx(patch: Partial<Parameters<typeof dailyAction>[0]> = {}) {
  return {
    now: new Date(2026, 6, 9, 8),
    checkInDue: false,
    firstCheckIn: false,
    day: undefined as DayLog | undefined,
    routine,
    streak: 3,
    lastPhotoDaysAgo: 2 as number | null,
    shelfEmpty: false,
    scanHref: "/scan-flow?mode=rescan",
    ...patch,
  };
}

describe("activePeriod", () => {
  it("leads with AM in the morning and PM in the evening", () => {
    expect(activePeriod(8, false)).toBe("am");
    expect(activePeriod(20, false)).toBe("pm");
  });

  it("moves afternoons on to PM only once AM is done", () => {
    expect(activePeriod(14, false)).toBe("am");
    expect(activePeriod(14, true)).toBe("pm");
  });
});

describe("dailyAction", () => {
  it("puts today's routine before an optional check-in", () => {
    const action = dailyAction(ctx({ checkInDue: true }));
    expect(action.kind).toBe("routine");
  });

  it("frames the first self-report as optional context after the routine", () => {
    const action = dailyAction(
      ctx({ checkInDue: true, firstCheckIn: true, day: amDone }),
    );
    expect(action.kind).toBe("check_in");
    expect(action.title).toBe("How does your skin feel today?");
  });

  it("asks for the current routine period with a Day-N frame", () => {
    const action = dailyAction(ctx());
    expect(action.kind).toBe("routine");
    expect(action.href).toBe("/(tabs)/routine?period=am");
    expect(action.body).toContain("Day 4");
  });

  it("switches to protection copy once today already counts", () => {
    const action = dailyAction(
      ctx({ now: new Date(2026, 6, 9, 20), day: amDone }),
    );
    expect(action.kind).toBe("routine");
    expect(action.body).toBe("Tonight keeps your week on track.");
  });

  it("asks for a Day 1 photo when none exists and the routine is done", () => {
    const action = dailyAction(
      ctx({
        now: new Date(2026, 6, 9, 8),
        day: amDone,
        lastPhotoDaysAgo: null,
      }),
    );
    expect(action.kind).toBe("photo");
    expect(action.href).toBe("/scan-flow?mode=rescan");
  });

  it("asks for a weekly photo once the last one is 7+ days old", () => {
    const action = dailyAction(ctx({ day: amDone, lastPhotoDaysAgo: 7 }));
    expect(action.kind).toBe("photo");
  });

  it("points an empty shelf at add-product after routine and photo", () => {
    const action = dailyAction(ctx({ day: amDone, shelfEmpty: true }));
    expect(action.kind).toBe("shelf");
    expect(action.href).toBe("/(tabs)/routine?section=products");
  });

  it("celebrates when everything is handled", () => {
    const action = dailyAction(
      ctx({ now: new Date(2026, 6, 9, 20), day: bothDone }),
    );
    expect(action.kind).toBe("done");
    expect(action.title).toBe("Done. You protected today's progress.");
    expect(action.cta).toBeUndefined();
  });

  it("keeps the evening open loop in the morning done state", () => {
    const action = dailyAction(ctx({ day: amDone }));
    expect(action.kind).toBe("done");
    expect(action.body).toBe("Tonight keeps your week on track.");
  });
});
