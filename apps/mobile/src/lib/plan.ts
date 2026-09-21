/**
 * Build a routine from a set of photos and the answers we hold.
 *
 * Extracted because there are two ways into it and they must not drift: the end
 * of the questionnaire, and the recovery path on `/today` for a plan that failed
 * after the photos were already taken. A recovery that assembled its payload
 * differently would be a different request, not a retry, and the difference
 * would stay invisible until it mattered.
 *
 * The baseline assessment is filed here rather than by the caller for the same
 * reason: it is the zero every later measurement subtracts from, and a path that
 * forgot to record it would leave the user permanently unable to compare.
 */
import { recheckDueOn, today } from "@pore/shared";
import { fetchPlan, type PlanOutcome } from "@/lib/api";
import { buildIntake } from "@/lib/intake";
import { recordAssessment } from "@/lib/journal";
import { CAPTURE_STEPS, listSessions, type CapturedPhoto } from "@/lib/photos";
import { scheduleRecheck } from "@/lib/reminder";
import type { OnboardingData } from "@/state/onboarding";

export async function buildPlan(
  answers: OnboardingData,
  photos: CapturedPhoto[],
  /** The capture session these photos came from, so the assessment is filed against it. */
  sessionId?: string,
): Promise<PlanOutcome> {
  // Angle order is the model's only cue for which face is which, so it is fixed
  // here rather than left to whatever order the capture screen happened to hold.
  const ordered = CAPTURE_STEPS.map((s) => photos.find((p) => p.angle === s.angle)).filter(
    (p): p is CapturedPhoto => p !== undefined,
  );

  const outcome = await fetchPlan({
    images: ordered.map((p) => ({ data: p.data, mediaType: "image/jpeg", quality: p.quality })),
    intake: buildIntake(answers),
  });
  if (!outcome.ok) return outcome;

  recordAssessment({
    sessionId: sessionId ?? listSessions()[0]?.id ?? "baseline",
    capturedAt: ordered[0]?.capturedAt ?? new Date().toISOString(),
    assessment: outcome.plan.assessment,
  });

  /*
   * Book the next invitation from here, because every capture in the app —
   * onboarding, recovery and recheck alike — lands on this line.
   *
   * Putting it on the screens instead would mean three call sites that have to
   * stay in step, and the one that drifted would simply stop reminding anybody,
   * silently. It is best-effort: a declined permission or a failed schedule
   * costs a nudge, never the plan the user is waiting for.
   */
  const sessions = listSessions();
  const due = recheckDueOn({
    lastCaptureOn: today(),
    on: today(),
    captureCount: sessions.length,
  });
  void scheduleRecheck(new Date(`${due}T18:00:00`));

  return outcome;
}
