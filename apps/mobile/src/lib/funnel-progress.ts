/**
 * Truthful progress for the onboarding funnel: the bar
 * never reads zero because by the time a question renders, earlier steps are
 * genuinely done — the landing introduction completes step 1, and the scan/plan
 * build is the final step. One map keeps every screen's progress truthful.
 *
 * `from` is the previous step's fill, so ProgressBar can animate INTO the
 * current step on mount instead of appearing pre-filled and static.
 */
export const FUNNEL_STEPS = [
  "age",
  "goal",
  "profile",
  "sensitivity",
  "safety",
  "scan",
  "plan",
  "notifications",
] as const;

export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export interface FunnelProgress {
  step: number;
  total: number;
  from: number;
}

export function funnelProgress(step: FunnelStep): FunnelProgress {
  const index = FUNNEL_STEPS.indexOf(step);
  const total = FUNNEL_STEPS.length;
  return { step: index + 1, total, from: index / total };
}
