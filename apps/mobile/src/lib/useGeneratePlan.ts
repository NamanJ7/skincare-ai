/**
 * Generate a plan from the captured photos and save it as a check-in.
 *
 * Shared by first-run intake and the returning-user re-check so the rule that
 * matters lives in one place: a failed request STOPS. It never falls through to
 * a screen that would present an example routine as a read of someone's face.
 * Two copies of that rule would drift, and the drift would be silent.
 */
import { useState } from "react";

import type { IntakeResponse } from "@pore/shared";
import { fetchPlan } from "./api";
import { CAPTURE_STEPS, newSessionId, type CapturedPhoto } from "./photos";
import { saveCheckIn } from "./plan";
import { useOnboarding } from "@/state/onboarding";

export interface GeneratePlanState {
  /** True while the request is in flight. */
  analyzing: boolean;
  /** Set when the last attempt failed, so the caller can offer a retry. */
  error: string | null;
  /**
   * Run the pipeline for `intake`. Resolves true when the caller should move on
   * to /today — either a real plan was saved, or no server is configured and the
   * labelled demo is the honest thing to show. Resolves false when it failed and
   * the user should stay put.
   */
  generate: (intake: IntakeResponse) => Promise<boolean>;
}

export function useGeneratePlan(): GeneratePlanState {
  const { data, update } = useOnboarding();
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate(intake: IntakeResponse): Promise<boolean> {
    setAnalyzing(true);
    setError(null);

    const photos = data.photos ?? [];
    const ordered = CAPTURE_STEPS.map((s) => photos.find((p) => p.angle === s.angle)).filter(
      (p): p is CapturedPhoto => p !== undefined,
    );
    const outcome = await fetchPlan({
      images: ordered.map((p) => ({ data: p.data, mediaType: "image/jpeg", quality: p.quality })),
      intake,
    });
    setAnalyzing(false);

    if (outcome.status === "failed") {
      setError(outcome.message);
      return false;
    }
    if (outcome.status === "ok") {
      update({ plan: outcome.plan });
      // Keyed to this visit's capture session, so the findings and the photos
      // that produced them stay together. The capture screen always sets this;
      // the fallback exists so a plan is never silently left unsaved if it
      // somehow doesn't — an orphaned record beats a lost one.
      saveCheckIn(data.sessionId ?? newSessionId(), intake, outcome.plan);
    }
    return true;
  }

  return { analyzing, error, generate };
}
