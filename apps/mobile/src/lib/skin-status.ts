/**
 * Skin status — the one-word answer to "how is my skin doing?" Derived, never
 * stored. Check-ins are the app's only honest skin signal (self-reported
 * trend language, never inferred severity), so behavior data like streaks and
 * scan photos stay out of the status. Red flags stay with EscalationCard.
 * Pure, no React.
 */
import {
  checkInDue,
  latestCheckIn,
  previousCheckIn,
  type CheckIn,
  type CheckInLog,
} from "./check-in";
import type { DateKey } from "./log";
import { compareCheckIns } from "./trends";

export type SkinStatus =
  | "starting"
  | "rebuilding"
  | "stabilizing"
  | "improving"
  | "needs_check_in";

export interface SkinStatusResult {
  status: SkinStatus;
  /** One-word display label, e.g. "Rebuilding". */
  label: string;
  /** Identity-framing headline, e.g. "Your skin is rebuilding." */
  headline: string;
  /** One calm sentence of context. */
  detail: string;
}

export const STATUS_LABELS: Record<SkinStatus, string> = {
  starting: "Starting",
  rebuilding: "Rebuilding",
  stabilizing: "Stabilizing",
  improving: "Improving",
  needs_check_in: "Needs check-in",
};

const COPY: Record<SkinStatus, Omit<SkinStatusResult, "status" | "label">> = {
  starting: {
    headline: "Your journey is underway.",
    detail: "Start with one consistent day.",
  },
  rebuilding: {
    headline: "Your skin is rebuilding.",
    detail: "Steady is the strategy.",
  },
  stabilizing: {
    headline: "Your skin is finding its rhythm.",
    detail: "Holding steady is progress.",
  },
  improving: {
    headline: "Your skin is improving.",
    detail: "Keep doing exactly what you're doing.",
  },
  needs_check_in: {
    headline: "Time to see what changed.",
    detail: "A one-minute check-in updates your skin status.",
  },
};

/**
 * Status from a pair of check-ins (also drives the report's change line).
 * Anything worse reads as Rebuilding — loss reframed as work in progress.
 */
export function statusFromPair(
  latest?: CheckIn,
  previous?: CheckIn,
): SkinStatus {
  if (!latest || !previous) return "starting";
  const statements = compareCheckIns(latest, previous);
  if (statements.some((s) => s.direction === "worse")) return "rebuilding";
  if (statements.some((s) => s.direction === "better")) return "improving";
  return "stabilizing";
}

/**
 * The current status. A lapsed cadence outranks everything ("Needs Check-In"
 * aligns exactly with useCheckIns().due) — but a brand-new user with zero
 * check-ins is Starting, not nagged on day one.
 */
export function deriveSkinStatus(
  checkIns: CheckInLog,
  today: DateKey,
): SkinStatusResult {
  const latest = latestCheckIn(checkIns);
  const status: SkinStatus =
    latest && checkInDue(checkIns, today)
      ? "needs_check_in"
      : statusFromPair(latest, previousCheckIn(checkIns));
  return { status, label: STATUS_LABELS[status], ...COPY[status] };
}
