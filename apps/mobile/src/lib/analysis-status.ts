/**
 * The single source of truth for "did a valid scan analysis actually happen for
 * the current attempt?" — the invariant that keeps the app honest.
 *
 * Scan-derived UI (the "Your skin analysis" heading, confidence labels,
 * intensity bars, "From your scan" dates, the routine's "based on your scan"
 * note) is valid ONLY when the current status is `scan_analyzed` AND the stored
 * plan is bound to that same scan id. Any failed/skipped/unconfigured attempt
 * leaves an `answers_only` status, so the app falls back to a clearly-labeled
 * answer-based read — never a fabricated or stale scan.
 *
 * Pure and network-free so the gate can be unit-tested without a camera.
 */
import { ANALYSIS_CONFIGURED } from "./api";
import { isPlanCurrentForProfile } from "./profile-revision";
import type { OnboardingData } from "@/state/onboarding";

export type AnswersOnlyReason =
  | "scan_skipped"
  | "quality_failed"
  | "analysis_unconfigured"
  | "analysis_failed"
  | "analysis_timeout";

export type AnalysisStatus =
  | { kind: "none" }
  | {
      kind: "answers_only";
      reason: AnswersOnlyReason;
      /** ISO timestamp of the attempt that landed here. */
      attemptedAt: string;
      /** Optional detail from the failure (e.g. a corrective quality message). */
      message?: string;
    }
  | {
      kind: "scan_analyzed";
      scanId: string;
      analyzedAt: string;
      assessmentId?: string;
    };

/**
 * The core gate. True only when a plan exists, it carries an assessment, and its
 * scan id matches the current `scan_analyzed` status. A stale plan from a prior
 * scan (its id won't match the latest attempt's status) fails this check, so it
 * can never render as the current result.
 */
export function isCurrentScanAnalysis(data: OnboardingData): boolean {
  if (!isPlanCurrentForProfile(data)) return false;
  const status = data.analysisStatus;
  if (status?.kind === "scan_analyzed") {
    return !!data.plan?.assessment && data.plan.scanId === status.scanId;
  }
  // Legacy profiles (written before `analysisStatus` existed): a persisted plan
  // plus `scannedAt` was only ever produced by a successful scan, so honor it
  // rather than silently downgrading existing users to an answer-based read.
  if (!status && !!data.plan?.assessment && !!data.scannedAt) return true;
  return false;
}

/** The reason the current attempt is answer-based, if it is. */
export function answersOnlyReason(
  data: OnboardingData,
): AnswersOnlyReason | undefined {
  return data.analysisStatus?.kind === "answers_only"
    ? data.analysisStatus.reason
    : undefined;
}

export function analysisSource(data: OnboardingData): "scan" | "answers" {
  return isCurrentScanAnalysis(data) ? "scan" : "answers";
}

/**
 * Accurate, non-overclaiming photo-handling copy. When an analysis backend is
 * configured, photos can be uploaded for analysis, so we say so; otherwise they
 * genuinely never leave the device. Never claims photos "stay on your device"
 * when the upload path is live.
 */
export function photoPrivacyLine(
  configured: boolean = ANALYSIS_CONFIGURED,
): string {
  return configured
    ? "Photos are processed securely for analysis, then kept on this device. You can delete them anytime in Profile."
    : "Photos are saved on this device unless you delete them.";
}

/**
 * Check-in progress photos have no upload path in this build — they are never
 * part of an analysis submission. Kept config-driven so the claim breaks
 * loudly (via the test) if a check-in upload path is ever added.
 */
const CHECK_IN_PHOTOS_UPLOAD = false;

export function checkInPhotoPrivacyLine(
  uploads: boolean = CHECK_IN_PHOTOS_UPLOAD,
): string {
  return uploads
    ? "Check-in photos are processed securely, then kept on this device. You can delete them anytime in Profile."
    : "Check-in photos use your front camera and stay on this device. They're never uploaded.";
}

/**
 * Storage-only claim for surfaces that mix scan and check-in photos (the
 * progress timeline). Scan photos may have been processed for analysis when a
 * backend is configured, so this line only speaks to where they end up.
 */
export function photoStorageLine(
  configured: boolean = ANALYSIS_CONFIGURED,
): string {
  return configured
    ? "Saved on this device. You can delete it anytime in Profile."
    : "Saved on this device. It is never uploaded.";
}
