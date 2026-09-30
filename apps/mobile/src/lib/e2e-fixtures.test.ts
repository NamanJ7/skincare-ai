import { describe, expect, it } from "vitest";

import { buildE2EFixture, fixtureRouteAllowed } from "./e2e-fixtures";
import { activeRoutineRevision, routineFor, routineShelfAssignments } from "./plan";

const NOW = new Date("2026-07-10T12:00:00.000Z");

describe("internal E2E fixtures", () => {
  it("is inaccessible without the explicit internal build flag", () => {
    expect(fixtureRouteAllowed(false)).toBe(false);
    expect(fixtureRouteAllowed(true)).toBe(true);
  });

  it("uses a fully empty state for fresh onboarding", () => {
    expect(buildE2EFixture("fresh-onboarding", NOW)).toEqual({ profile: null, log: null });
  });

  it("uses fictional products and a valid adult questionnaire", () => {
    const { profile } = buildE2EFixture("mapped-products", NOW);
    expect(profile?.onboardingComplete).toBe(true);
    expect(profile?.userProducts?.every((product) => product.name.startsWith("Fictional"))).toBe(true);
    expect(routineFor(profile!).routine.am.length).toBeGreaterThan(0);
    expect(routineShelfAssignments(profile!, routineFor(profile!).routine).am[0]?.name).toBe("Fictional Gentle Cleanser");
  });

  it("seeds repeated skips, low completion, mild irritation, and active recovery", () => {
    const skipped = buildE2EFixture("repeated-skips", NOW).log!;
    expect(Object.values(skipped.days).filter((day) => day.pm?.skipped).length).toBe(2);
    expect(Object.keys(buildE2EFixture("low-completion", NOW).log!.days)).toHaveLength(3);
    const mild = buildE2EFixture("recent-mild-irritation", NOW);
    expect(Object.values(mild.log!.days)[0]?.pm?.reaction?.kind).toBe("mild_irritation");
    const recovery = buildE2EFixture("active-recovery", NOW).log!;
    expect(activeRoutineRevision(recovery.revision, "2026-07-10")?.kind).toBe("pause_strong_actives");
  });
});
