/**
 * Plan provenance — how much of the plan the user themself supplied ("built
 * from your 7 answers and 3 scan photos"). Every counted unit is a discrete
 * input the user actually gave in the funnel, so the line is literally true;
 * photos count only when the current attempt passed the isCurrentScanAnalysis
 * gate, mirroring every other scan-derived claim. Pure so vitest can run it.
 */
import { STEP_ORDER } from "@pore/shared/scan";

import { isCurrentScanAnalysis } from "./analysis-status";
import type { OnboardingData } from "@/state/onboarding";

export interface PlanProvenance {
  answers: number;
  photos: number;
  fromScan: boolean;
}

export function planProvenance(data: OnboardingData): PlanProvenance {
  let answers = 0;
  if (data.age != null) answers += 1;
  if (data.primaryGoal) answers += 1;
  if (data.sensitivity) answers += 1;
  // safety.tsx always writes both booleans on Continue, so a completed funnel
  // counts them even when the answer was "no".
  if (data.pregnancyOrBreastfeeding !== undefined) answers += 1;
  if (data.usingPrescriptionSkincare !== undefined) answers += 1;
  answers += data.allergies?.length ?? 0;
  answers += data.currentProducts?.length ?? 0;

  const fromScan = isCurrentScanAnalysis(data);
  // An analyzed submission always carries exactly one image per guided angle.
  const photos = fromScan ? STEP_ORDER.length : 0;
  return { answers, photos, fromScan };
}

export function provenanceLine(p: PlanProvenance): string {
  const answers = `your ${p.answers} answer${p.answers === 1 ? "" : "s"}`;
  return p.photos > 0
    ? `${answers} and ${p.photos} scan photo${p.photos === 1 ? "" : "s"}`
    : answers;
}
