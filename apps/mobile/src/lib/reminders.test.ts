import { describe, expect, it } from "vitest";

import {
  ALL_REMINDER_IDENTIFIERS,
  WEEKDAY_LABELS,
  defaultReminderPrefs,
  effectiveReminders,
  formatReminderTime,
  isDismissed,
  normalizeReminderPrefs,
  parseReminderTap,
  reminderHref,
  reminderIdentifier,
  reminderTrigger,
  withDismissal,
  type ReminderType,
} from "./reminders";

describe("reminder preferences", () => {
  it("uses the free default schedule with sunscreen off", () => {
    expect(defaultReminderPrefs()).toEqual({
      optIn: false,
      am: { enabled: true, hour: 8, minute: 0 },
      pm: { enabled: true, hour: 21, minute: 0 },
      weekly: { enabled: true, weekday: 1, hour: 18, minute: 0 },
      sunscreen: { enabled: false, hour: 12, minute: 0 },
    });
  });

  it("fills missing sections and preserves valid partial values", () => {
    expect(normalizeReminderPrefs({ optIn: true, am: { enabled: false, hour: 9 } })).toMatchObject({
      optIn: true,
      am: { enabled: false, hour: 9, minute: 0 },
      pm: { enabled: true, hour: 21, minute: 0 },
      weekly: { enabled: true, weekday: 1, hour: 18, minute: 0 },
    });
  });

  it("clamps numeric fields and replaces junk with defaults", () => {
    const prefs = normalizeReminderPrefs({
      optIn: "yes",
      am: { enabled: "yes", hour: 99, minute: -4 },
      pm: null,
      weekly: { weekday: 12, hour: Number.NaN, minute: 90 },
      sunscreen: "nope",
    });
    expect(prefs.optIn).toBe(false);
    expect(prefs.am).toEqual({ enabled: true, hour: 23, minute: 0 });
    expect(prefs.pm).toEqual({ enabled: true, hour: 21, minute: 0 });
    expect(prefs.weekly).toEqual({ enabled: true, weekday: 7, hour: 18, minute: 59 });
    expect(prefs.sunscreen).toEqual({ enabled: false, hour: 12, minute: 0 });
    expect(normalizeReminderPrefs("junk")).toEqual(defaultReminderPrefs());
  });
});

describe("identifiers and effective requests", () => {
  it("uses stable identifiers for every reminder", () => {
    expect(reminderIdentifier("weekly")).toBe("reminder:weekly");
    expect(ALL_REMINDER_IDENTIFIERS).toEqual([
      "reminder:am",
      "reminder:pm",
      "reminder:weekly",
      "reminder:sunscreen",
    ]);
  });

  it("returns nothing without opt-in or permission", () => {
    const prefs = defaultReminderPrefs();
    expect(effectiveReminders(prefs, true)).toEqual([]);
    prefs.optIn = true;
    expect(effectiveReminders(prefs, false)).toEqual([]);
  });

  it("includes only enabled types and excludes sunscreen by default", () => {
    const prefs = { ...defaultReminderPrefs(), optIn: true };
    expect(effectiveReminders(prefs, true).map((request) => request.type)).toEqual([
      "am",
      "pm",
      "weekly",
    ]);
    prefs.pm = { ...prefs.pm, enabled: false };
    prefs.sunscreen = { ...prefs.sunscreen, enabled: true };
    expect(effectiveReminders(prefs, true).map((request) => request.type)).toEqual([
      "am",
      "weekly",
      "sunscreen",
    ]);
  });
});

describe("trigger shaping", () => {
  const prefs = normalizeReminderPrefs({
    am: { hour: 7, minute: 15 },
    weekly: { weekday: 5, hour: 17, minute: 30 },
  });

  it("uses daily triggers for routine reminders", () => {
    expect(reminderTrigger("am", prefs, "ios")).toEqual({ type: "daily", hour: 7, minute: 15 });
  });

  it("uses an iOS calendar trigger for weekly reminders", () => {
    expect(reminderTrigger("weekly", prefs, "ios")).toEqual({
      type: "calendar",
      weekday: 5,
      hour: 17,
      minute: 30,
      repeats: true,
    });
  });

  it("uses an Android weekly trigger and passes the weekday through", () => {
    expect(reminderTrigger("weekly", prefs, "android")).toEqual({
      type: "weekly",
      weekday: 5,
      hour: 17,
      minute: 30,
    });
    expect(WEEKDAY_LABELS[1]).toBe("Sun");
  });
});

describe("tap routing", () => {
  it("round-trips every reminder type and rejects junk", () => {
    const types: ReminderType[] = ["am", "pm", "weekly", "sunscreen"];
    for (const type of types) expect(parseReminderTap({ type })).toBe(type);
    expect(parseReminderTap({ type: "pushy" })).toBeNull();
    expect(parseReminderTap(null)).toBeNull();
  });

  it("maps every type to its product destination", () => {
    expect(reminderHref("am")).toBe("/(tabs)/routine?period=am");
    expect(reminderHref("pm")).toBe("/(tabs)/routine?period=pm");
    expect(reminderHref("weekly")).toBe("/check-in");
    expect(reminderHref("sunscreen")).toBe("/(tabs)");
  });

  it("formats deterministic 12-hour detail labels", () => {
    expect(formatReminderTime(0, 0)).toBe("12:00 AM");
    expect(formatReminderTime(21, 5)).toBe("9:05 PM");
  });
});

describe("per-day dismissal", () => {
  it("keeps same-day kinds and prunes the previous day on write", () => {
    let prefs = withDismissal(defaultReminderPrefs(), "2026-07-12", "small_win");
    prefs = withDismissal(prefs, "2026-07-12", "simplify_today");
    expect(isDismissed(prefs, "2026-07-12", "small_win")).toBe(true);
    expect(prefs.dismissed?.kinds).toEqual(["small_win", "simplify_today"]);

    prefs = withDismissal(prefs, "2026-07-13", "pause_strong_actives");
    expect(prefs.dismissed).toEqual({ date: "2026-07-13", kinds: ["pause_strong_actives"] });
    expect(isDismissed(prefs, "2026-07-13", "small_win")).toBe(false);
  });
});
