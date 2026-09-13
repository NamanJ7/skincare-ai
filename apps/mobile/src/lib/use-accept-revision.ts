import { useCallback } from "react";

import { track } from "@/lib/analytics";
import {
  todayKey,
  type RoutinePeriod,
  type RoutineRevision,
  type RoutineRevisionKind,
} from "@/lib/log";
import { routineFor } from "@/lib/plan";
import { useOnboarding } from "@/state/onboarding";
import { useRoutineLog } from "@/state/routine-log";

/**
 * Applies a visible, persisted routine revision through the same safety-clamped
 * path used by behavioral suggestions. This is the single action behind
 * Minimum Mode and future user-requested one-day simplifications.
 */
export function useAcceptRevision() {
  const { data } = useOnboarding();
  const { acceptRevision } = useRoutineLog();

  return useCallback(
    ({
      kind,
      period,
      reason,
      effectiveDate = todayKey(),
      surface = "routine",
    }: {
      kind: RoutineRevisionKind;
      period?: RoutinePeriod;
      reason: string;
      effectiveDate?: string;
      surface?: string;
    }): RoutineRevision => {
      const revision: RoutineRevision = {
        kind,
        acceptedAt: new Date().toISOString(),
        effectiveDate,
        ...(period ? { period } : {}),
        reason,
      };
      const revisedRoutine = routineFor(data, revision, effectiveDate).routine;
      acceptRevision(revision, revisedRoutine);
      track("routine_adjustment_accepted", { kind, surface });
      return revision;
    },
    [acceptRevision, data],
  );
}
