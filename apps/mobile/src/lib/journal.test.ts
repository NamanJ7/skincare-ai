/**
 * Regression tests for the state that safety rules read.
 *
 * The bug these exist to prevent: onboarding answers lived in a plain
 * `useState`, so closing the app threw them away. `buildIntake` then filled
 * defaults — including `pregnancyOrBreastfeeding: false` — and the safety
 * engine, which is itself well tested and correct, dutifully applied the
 * pregnancy filter to a user it now believed was not pregnant.
 *
 * The engine was never wrong. The state feeding it was, and nothing tested it.
 */
import { applySafetyRules, type Routine } from "@pore/shared";
import { beforeEach, describe, expect, it } from "vitest";

import { __reset } from "@/test/expo-file-system";
import { buildIntake } from "./intake";
import {
  eraseRecord,
  hasRoutine,
  readJournal,
  recordCheckIn,
  saveOnboarding,
  toggleStep,
} from "./journal";
import type { OnboardingData } from "@/state/onboarding";

beforeEach(() => __reset());

/** A routine loaded with actives a pregnancy filter must act on. */
function retinoidRoutine(): Routine {
  return {
    am: [{ order: 1, category: "sunscreen", frequencyPerWeek: 7, rationale: "Daily SPF.", irritationRisk: "low" }],
    pm: [
      {
        order: 1,
        category: "treatment",
        active: "retinoid",
        frequencyPerWeek: 7,
        rationale: "Cell turnover.",
        irritationRisk: "high",
      },
    ],
    notes: [],
  };
}

describe("onboarding answers survive a restart", () => {
  it("keeps pregnancy true across a save and a fresh read", () => {
    saveOnboarding({ pregnancyOrBreastfeeding: true, skinType: "dry", sensitivity: "high" });

    // A fresh read is what a relaunched app does.
    const reread = readJournal();
    expect(reread.intake?.pregnancyOrBreastfeeding).toBe(true);
  });

  it("still strips retinoids after a restart — the actual regression", () => {
    saveOnboarding({ pregnancyOrBreastfeeding: true });

    const intake = buildIntake(readJournal().intake ?? {});
    const { routine, adjustments } = applySafetyRules(retinoidRoutine(), intake);

    expect(routine.pm.some((s) => s.active === "retinoid")).toBe(false);
    expect(adjustments.some((a) => a.rule === "pregnancy_unsafe_removed")).toBe(true);
  });

  it("shows what the bug looked like: no persisted answers means not pregnant", () => {
    // Nothing saved — buildIntake has to guess, and its guess is `false`. This
    // is correct behaviour for a genuinely unknown user and catastrophic for
    // one whose answer we threw away, which is why persistence is the fix.
    expect(buildIntake({}).pregnancyOrBreastfeeding).toBe(false);
  });

  it("merges successive updates instead of replacing them", () => {
    saveOnboarding({ pregnancyOrBreastfeeding: true });
    const merged: OnboardingData = { ...readJournal().intake, skinType: "oily" };
    saveOnboarding(merged);

    const intake = readJournal().intake;
    expect(intake?.pregnancyOrBreastfeeding).toBe(true);
    expect(intake?.skinType).toBe("oily");
  });
});

describe("allergies reach the safety engine", () => {
  it("removes an active the user listed, end to end", () => {
    // The engine has always had this rule; nothing ever gave it an allergy to
    // act on, because buildIntake hardcoded an empty list and no screen asked.
    saveOnboarding({ allergies: ["retinoid"] });

    const intake = buildIntake(readJournal().intake ?? {});
    const { routine, adjustments } = applySafetyRules(retinoidRoutine(), intake);

    expect(routine.pm.some((s) => s.active === "retinoid")).toBe(false);
    expect(adjustments.some((a) => a.rule === "allergy_removed")).toBe(true);
  });

  it("defaults to no allergies rather than dropping actives on a blank answer", () => {
    saveOnboarding({ skinType: "oily" });
    expect(buildIntake(readJournal().intake ?? {}).allergies).toEqual([]);
  });
});

describe("what goes to disk", () => {
  it("never writes photo base64 into the journal", () => {
    saveOnboarding({
      skinType: "oily",
      photos: [
        {
          angle: "front",
          uri: "file:///front.jpg",
          data: "AAAABBBBCCCC-pretend-this-is-two-megabytes",
          quality: { angle: "front", score: 0.9, flags: [], illuminant: "screen_flash" },
          capturedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    const stored = readJournal();
    expect(stored.intake).not.toHaveProperty("photos");
    expect(JSON.stringify(stored)).not.toContain("pretend-this-is-two-megabytes");
  });
});

describe("startedOn is anchored by real activity, not by looking around", () => {
  it("does not persist a journal merely because one was read", () => {
    readJournal();
    readJournal();
    // Nothing written means nothing anchored: a user who browses on day 1 and
    // onboards on day 5 starts their ramp on day 5.
    expect(hasRoutine()).toBe(false);
    expect(readJournal().completed).toEqual({});
  });
});

describe("erasing the routine record", () => {
  it("clears activity but keeps the routine the control promises to keep", () => {
    saveOnboarding({
      pregnancyOrBreastfeeding: true,
      plan: {
        assessment: {} as never,
        routine: retinoidRoutine(),
        adjustments: [],
        mode: "mock",
      },
    });
    toggleStep("2026-01-01", "PM", 1, 1);
    recordCheckIn("2026-01-01", "stinging");

    expect(hasRoutine()).toBe(true);

    const after = eraseRecord();

    expect(after.completed).toEqual({});
    expect(after.finished).toEqual([]);
    expect(after.checkIns).toEqual([]);
    // "Your routine stays" — the dialog's own promise.
    expect(hasRoutine(after)).toBe(true);
    expect(after.intake?.pregnancyOrBreastfeeding).toBe(true);
  });
});
