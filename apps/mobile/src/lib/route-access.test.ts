import { describe, expect, it } from "vitest";

import {
  incompleteOnboardingRedirect,
  isAlwaysPublicRoute,
  safeInternalHref,
} from "./route-access";
import type { OnboardingData } from "@/state/onboarding";

const questionnaire: OnboardingData = {
  age: 30,
  goals: ["dryness"],
  primaryGoal: "dryness",
  skinTypeChoiceId: "unsure",
  routineComplexity: "minimal",
  sensitivity: "low",
  sensitivityChoiceId: "rarely",
  pregnancyOrBreastfeeding: false,
  usingPrescriptionSkincare: false,
  allergies: [],
  currentProducts: [],
  safetyChoiceIds: ["none"],
};

describe("incomplete onboarding route gate", () => {
  it("keeps the landing and education routes reachable", () => {
    expect(incompleteOnboardingRedirect({}, ["index"])).toBeNull();
    expect(
      incompleteOnboardingRedirect({}, ["onboarding", "intro"]),
    ).toBeNull();
  });

  it("blocks tabs and results at the first missing answer", () => {
    expect(incompleteOnboardingRedirect({}, ["(tabs)"])).toBe(
      "/onboarding/age",
    );
    expect(incompleteOnboardingRedirect({ age: 30 }, ["results"])).toBe(
      "/onboarding/goal",
    );
  });

  it("allows back navigation to earlier questions but not future ones", () => {
    expect(
      incompleteOnboardingRedirect({ age: 30 }, ["onboarding", "age"]),
    ).toBeNull();
    expect(
      incompleteOnboardingRedirect({ age: 30 }, ["onboarding", "skin-profile"]),
    ).toBe("/onboarding/goal");
  });

  it("allows the scan only after the questionnaire and requires preview next", () => {
    expect(
      incompleteOnboardingRedirect(questionnaire, ["scan-flow", "capture"]),
    ).toBeNull();
    expect(incompleteOnboardingRedirect(questionnaire, ["(tabs)"])).toBe(
      "/scan-flow?mode=onboarding",
    );
    expect(
      incompleteOnboardingRedirect(questionnaire, ["onboarding", "generating"]),
    ).toBeNull();

    const attempted: OnboardingData = {
      ...questionnaire,
      analysisStatus: {
        kind: "answers_only",
        reason: "scan_skipped",
        attemptedAt: "2026-07-16T12:00:00.000Z",
      },
    };
    expect(incompleteOnboardingRedirect(attempted, ["results"])).toBe(
      "/onboarding/preview",
    );
    expect(
      incompleteOnboardingRedirect(attempted, ["onboarding", "notifications"]),
    ).toBeNull();
    // Recording the attempt flips `required` from "scan" to "preview" while
    // still on the generating screen (its own effect hasn't navigated away
    // yet). Bouncing here raced that effect and thrashed the router into an
    // infinite update loop (a silent white-screen hang).
    expect(
      incompleteOnboardingRedirect(attempted, ["onboarding", "generating"]),
    ).toBeNull();
  });
});

/**
 * `returnTo` / `next` used to be validated with `value.startsWith("/")`, which
 * also accepts `//evil.com` — a protocol-relative URL. On native an unknown path
 * is inert, but the app also builds for web, and "happens to be harmless on this
 * platform" is not a property to depend on. generating.tsx had no check at all.
 */
describe("legal documents stay reachable mid-onboarding", () => {
  /**
   * The youth-consent screens link to the Privacy Notice *before* onboarding
   * finishes. When `/legal` was not in ALWAYS_PUBLIC, this gate bounced the
   * reader straight back out of the document a parent was being asked to read
   * — the same class of dead link as the unregistered pore.skin URLs.
   */
  it.each([
    ["/legal/privacy", ["legal", "privacy"]],
    ["/legal/terms", ["legal", "terms"]],
  ])("never redirects away from %s", (_route, segments) => {
    expect(incompleteOnboardingRedirect({}, segments)).toBeNull();
    expect(incompleteOnboardingRedirect({ age: 14 }, segments)).toBeNull();
    expect(incompleteOnboardingRedirect(questionnaire, segments)).toBeNull();
  });

  it("marks legal routes public for the age-policy gate as well", () => {
    // The root layout runs its own, stronger age/guardian redirect before this
    // module is consulted. Both gates read `isAlwaysPublicRoute`, because
    // teaching only one of them about /legal leaves a 13-to-17-year-old
    // bounced straight back out of the Privacy Notice they were told to read.
    expect(isAlwaysPublicRoute(["legal", "privacy"])).toBe(true);
    expect(isAlwaysPublicRoute(["legal", "terms"])).toBe(true);
    expect(isAlwaysPublicRoute(["index"])).toBe(true);
    expect(isAlwaysPublicRoute(["(auth)", "sign-in"])).toBe(true);
  });

  it("does not make unrelated routes public", () => {
    expect(isAlwaysPublicRoute(["(tabs)", "profile"])).toBe(false);
    expect(isAlwaysPublicRoute(["scan-flow"])).toBe(false);
    expect(isAlwaysPublicRoute(["feedback"])).toBe(false);
    expect(isAlwaysPublicRoute([])).toBe(true); // empty === index
  });

  it("still gates a non-legal route from the same starting state", () => {
    // Proves the assertions above come from the allowlist, not from the gate
    // being inert for every route.
    expect(incompleteOnboardingRedirect({}, ["(tabs)", "profile"])).toBe(
      "/onboarding/age",
    );
  });
});

describe("safeInternalHref", () => {
  it.each([
    "/(tabs)",
    "/(tabs)/profile",
    "/onboarding/preview",
    "/onboarding/goal",
    "/onboarding/generating",
    "/scan-flow",
  ])("allows the known destination %s", (href) => {
    expect(safeInternalHref(href, "/fallback")).toBe(href);
  });

  it("preserves a query string on an allowed route", () => {
    expect(safeInternalHref("/onboarding/age?edit=1", "/fallback")).toBe(
      "/onboarding/age?edit=1",
    );
    expect(safeInternalHref("/scan-flow?mode=onboarding", "/fallback")).toBe(
      "/scan-flow?mode=onboarding",
    );
  });

  it.each([
    ["//evil.com", "protocol-relative — the bug the old prefix check missed"],
    ["/\evil.com", "backslash variant browsers also treat as protocol-relative"],
    ["https://evil.com", "absolute URL"],
    ["javascript:alert(1)", "script scheme"],
    ["/onboarding/../../evil", "traversal"],
    ["/unknown-route", "a real path we do not hand out"],
    ["", "empty"],
    [undefined, "absent"],
  ] as [string | undefined, string][])("falls back for %j (%s)", (value: string | undefined) => {
    expect(safeInternalHref(value, "/onboarding/goal")).toBe("/onboarding/goal");
  });

  it("matches on the path only, so a query cannot smuggle a destination", () => {
    expect(safeInternalHref("/unknown?x=/(tabs)", "/onboarding/goal")).toBe(
      "/onboarding/goal",
    );
  });
});
