/** Fictional local data for internal E2E builds. Never enabled in beta/production. */
import type { RoutineStep } from "@pore/shared";

import { routineStepInstances, shiftKey, todayKey, type RoutineLog } from "./log";
import { routineFor } from "./plan";
import type { OnboardingData } from "@/state/onboarding";

export const E2E_FIXTURES_ENABLED = process.env.EXPO_PUBLIC_E2E_FIXTURES === "1";

export const E2E_FIXTURE_NAMES = [
  "fresh-onboarding",
  "mapped-products",
  "repeated-skips",
  "low-completion",
  "recent-mild-irritation",
  "active-recovery",
] as const;
export type E2EFixtureName = (typeof E2E_FIXTURE_NAMES)[number];

export function fixtureRouteAllowed(enabled = E2E_FIXTURES_ENABLED): boolean {
  return enabled;
}

export function isE2EFixtureName(value: string): value is E2EFixtureName {
  return E2E_FIXTURE_NAMES.some((name) => name === value);
}

export function buildE2EFixture(
  name: E2EFixtureName,
  now = new Date(),
): { profile: OnboardingData | null; log: RoutineLog | null } {
  if (name === "fresh-onboarding") return { profile: null, log: null };

  const today = todayKey(now);
  const profile: OnboardingData = {
    age: 28,
    goals: ["acne"],
    primaryGoal: "acne",
    skinType: "combination",
    skinTypeChoiceId: "combination",
    routineComplexity: "balanced",
    sensitivity: "medium",
    sensitivityChoiceId: "medium",
    pregnancyOrBreastfeeding: false,
    usingPrescriptionSkincare: false,
    allergies: [],
    currentProducts: [],
    safetyChoiceIds: ["none"],
    analysisStatus: {
      kind: "answers_only",
      reason: "scan_skipped",
      attemptedAt: now.toISOString(),
    },
    onboardingComplete: true,
    userProducts: [
      { id: "e2e-cleanser", name: "Fictional Gentle Cleanser", category: "cleanser", actives: ["ceramides"] },
      { id: "e2e-moisturizer", name: "Fictional Moisturizer", category: "moisturizer", actives: ["ceramides"] },
      { id: "e2e-sunscreen", name: "Fictional Sunscreen", category: "sunscreen", actives: ["niacinamide"] },
    ],
  };
  const base = routineFor(profile, undefined, today).routine;
  const strong: RoutineStep = {
    order: base.pm.length + 1,
    category: "treatment",
    active: "retinoid",
    frequencyPerWeek: 3,
    rationale: "Fictional E2E treatment step.",
    irritationRisk: "medium",
  };
  if (name === "recent-mild-irritation" || name === "active-recovery") {
    profile.scannedAt = now.toISOString();
    profile.analysisStatus = {
      kind: "scan_analyzed",
      scanId: "fictional-e2e-scan",
      analyzedAt: now.toISOString(),
    };
    profile.plan = {
      mode: "ai",
      scanId: "fictional-e2e-scan",
      assessment: {
        findings: [],
        escalation: { recommendProfessional: false, reasons: [] },
        summary: "Fictional E2E assessment.",
        disclaimer: "Fictional E2E data only.",
      },
      adjustments: [],
      routine: { ...base, pm: [...base.pm, strong] },
    };
  }
  const log: RoutineLog = { days: {} };
  const pmKeys = routineStepInstances((profile.plan?.routine ?? base).pm).map((item) => item.key);

  if (name === "repeated-skips") {
    for (const offset of [-3, -2, -1]) {
      const date = shiftKey(today, offset);
      log.days[date] = {
        pm: {
          done: offset === -3 ? pmKeys : pmKeys.slice(1),
          total: pmKeys.length,
          scheduledStepKeys: pmKeys,
          ...(offset === -3 ? {} : {
            skipped: { [pmKeys[0]]: { reason: "not_now", recordedAt: `${date}T20:00:00.000Z` } },
          }),
        },
      };
    }
  }
  if (name === "low-completion") {
    for (const offset of [-3, -2, -1]) {
      const date = shiftKey(today, offset);
      log.days[date] = { pm: { done: [], total: pmKeys.length, scheduledStepKeys: pmKeys } };
    }
  }
  if (name === "recent-mild-irritation") {
    const date = shiftKey(today, -1);
    log.days[date] = {
      pm: {
        done: pmKeys,
        total: pmKeys.length,
        scheduledStepKeys: pmKeys,
        reaction: { kind: "mild_irritation", recordedAt: `${date}T20:00:00.000Z` },
      },
    };
  }
  if (name === "active-recovery") {
    log.revision = {
      kind: "pause_strong_actives",
      acceptedAt: now.toISOString(),
      effectiveDate: today,
      period: "pm",
      reason: "Fictional E2E recovery fixture.",
    };
    log.revisionUndo = { date: today, appliedAt: now.toISOString() };
    log.coachingHistory = [{ kind: "pause_strong_actives", date: today, appliedAt: now.toISOString() }];
  }
  return { profile, log };
}
