/**
 * The stored run of assessments, and how to read one set of them back.
 *
 * `compareAssessments` only ever needs two readings, so the app only ever kept
 * two: a write-once `baseline` and a `latest` that every new capture overwrote.
 * That is enough for the verdict and wrong for everything else — a third capture
 * destroyed the second, so the middle of a six-month routine was unrecoverable
 * and a trend line was impossible by construction. Assessments are small JSON;
 * the reason not to keep them was never cost.
 *
 * This lives in `progress/` rather than beside the app's storage because the
 * shape of the record is a domain question — which reading is the zero, which is
 * current — and because a migration that silently loses a baseline is
 * indistinguishable from a working one until the comparison it ruins. It needs
 * tests, and tests live here.
 */
import type { Assessment } from "../types/assessment";

/** One capture session's blind assessment, tagged with when it was taken. */
export interface StoredAssessment {
  sessionId: string;
  capturedAt: string;
  assessment: Assessment;
}

/** The pre-history shape: exactly two slots, the second overwritten forever. */
export interface LegacyAssessmentStore {
  baseline?: StoredAssessment;
  latest?: StoredAssessment;
  assessments?: StoredAssessment[];
}

/**
 * Read a stored record into an ordered history, oldest first.
 *
 * Migration is one-way and lossless: an install that only ever held a baseline
 * and a latest comes back as those two, in that order, and an install that
 * already has a history is returned untouched. A record holding both — which
 * should not happen, but a half-finished write could produce it — prefers the
 * history and folds in any legacy entry the history does not already carry, so
 * the baseline cannot be dropped by a shape mismatch.
 */
export function assessmentHistory(store: LegacyAssessmentStore): StoredAssessment[] {
  const history = [...(store.assessments ?? [])];
  const known = new Set(history.map((e) => e.sessionId));

  // Baseline first: it is the zero, and order in this array *is* the claim
  // about which reading came first.
  for (const legacy of [store.baseline, store.latest]) {
    if (!legacy || known.has(legacy.sessionId)) continue;
    known.add(legacy.sessionId);
    history.push(legacy);
  }
  return history;
}

/**
 * The first reading ever taken. Never replaced.
 *
 * A moving zero would let slow drift vanish: every comparison would be against
 * a recent past that had already absorbed the change being looked for.
 */
export function baselineOf(history: StoredAssessment[]): StoredAssessment | undefined {
  return history[0];
}

/** The most recent reading, or undefined when the baseline is all there is. */
export function latestOf(history: StoredAssessment[]): StoredAssessment | undefined {
  return history.length >= 2 ? history[history.length - 1] : undefined;
}

/**
 * Append a reading, keeping the baseline write-once.
 *
 * Re-filing the same session replaces it in place rather than growing the
 * history — a retried assessment of one capture set is a correction, not a
 * second point in time, and letting it append would put a fake interval into
 * any trend drawn from this.
 */
export function recordInHistory(
  history: StoredAssessment[],
  entry: StoredAssessment,
): StoredAssessment[] {
  const at = history.findIndex((e) => e.sessionId === entry.sessionId);
  if (at === -1) return [...history, entry];
  const next = [...history];
  next[at] = entry;
  return next;
}
