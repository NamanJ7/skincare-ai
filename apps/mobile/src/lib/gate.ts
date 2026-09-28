/**
 * Free / Plus feature policy. This module is deliberately pure so the same
 * cadence and quota rules can be exercised without rendering a screen.
 *
 * Free includes the initial scan, the first seven-day follow-up and its
 * comparison, the complete routine, default reminders, and three complete
 * active-compatibility reads per calendar month. Safety guidance is never
 * gated. Plus continues the weekly loop and removes the compatibility limit.
 */
import type { ScanHistory } from "./scan-history";
import { daysBetween } from "./check-in";
import { todayKey, type DateKey } from "./log";
import type { Entitlement } from "@/state/entitlement";
import type { OnboardingData } from "@/state/onboarding";

export const SCAN_CADENCE_DAYS = 7;
export const FREE_COMPATIBILITY_CHECKS_PER_MONTH = 3;

export type PremiumFeature =
  | "rescan"
  | "shelf_detail"
  | "reminders"
  | "weekly_report";

export function isPremium(entitlement: Entitlement): boolean {
  return entitlement.unlocked && entitlement.tier === "plus";
}

function analyzedDates(data: OnboardingData, history: ScanHistory): DateKey[] {
  const dates = history.scans
    .filter((scan) => scan.analyzed)
    .map((scan) => scan.date);

  // Legacy profiles predate scan history and only stamped `scannedAt`. It can
  // also be newer than history when analysis succeeded but local photo
  // persistence failed, so merge it instead of only using it as a fallback.
  if (data.scannedAt) {
    const date = todayKey(new Date(data.scannedAt));
    if (!dates.includes(date)) dates.push(date);
  }
  return dates.sort();
}

export function analyzedScanCount(
  data: OnboardingData,
  history: ScanHistory,
): number {
  return analyzedDates(data, history).length;
}

export function hasUsedFreeScan(
  data: OnboardingData,
  history: ScanHistory,
): boolean {
  return analyzedScanCount(data, history) > 0;
}

export type ScanAccessReason =
  | "initial_scan"
  | "first_weekly_comparison"
  | "plus_weekly_scan"
  | "cadence_wait"
  | "plus_required";

export interface ScanAccess {
  allowed: boolean;
  reason: ScanAccessReason;
  analyzedCount: number;
  /** Non-zero only when another scan would be too soon. */
  daysUntilAvailable: number;
}

/**
 * The initial analysis is free. After seven days, the first follow-up is also
 * free so every user can experience a real comparison. Further weekly scans
 * require Plus. Even Plus never encourages scans more often than weekly.
 */
export function scanAccess(
  entitlement: Entitlement,
  data: OnboardingData,
  history: ScanHistory,
  today: DateKey = todayKey(),
): ScanAccess {
  const dates = analyzedDates(data, history);
  const analyzedCount = dates.length;
  if (analyzedCount === 0) {
    return {
      allowed: true,
      reason: "initial_scan",
      analyzedCount,
      daysUntilAvailable: 0,
    };
  }

  const elapsed = Math.max(0, daysBetween(dates[dates.length - 1], today));
  const daysUntilAvailable = Math.max(0, SCAN_CADENCE_DAYS - elapsed);
  if (daysUntilAvailable > 0) {
    return {
      allowed: false,
      reason: "cadence_wait",
      analyzedCount,
      daysUntilAvailable,
    };
  }

  if (analyzedCount === 1) {
    return {
      allowed: true,
      reason: "first_weekly_comparison",
      analyzedCount,
      daysUntilAvailable: 0,
    };
  }

  if (isPremium(entitlement)) {
    return {
      allowed: true,
      reason: "plus_weekly_scan",
      analyzedCount,
      daysUntilAvailable: 0,
    };
  }

  return {
    allowed: false,
    reason: "plus_required",
    analyzedCount,
    daysUntilAvailable: 0,
  };
}

/** Backwards-compatible boolean used by simple call sites. */
export function canStartScan(
  entitlement: Entitlement,
  data: OnboardingData,
  history: ScanHistory,
  today?: DateKey,
): boolean {
  return scanAccess(entitlement, data, history, today).allowed;
}

/** The baseline self-report stays free, as does its first weekly comparison. */
export function canViewWeeklyReport(
  entitlement: Entitlement,
  checkInCount: number,
): boolean {
  return isPremium(entitlement) || (checkInCount > 0 && checkInCount <= 2);
}

export function compatibilityMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export interface CompatibilityAccess {
  allowed: boolean;
  alreadyChecked: boolean;
  remaining: number;
}

export function compatibilityAccess(
  entitlement: Entitlement,
  productId: string,
  now = new Date(),
): CompatibilityAccess {
  if (isPremium(entitlement)) {
    return { allowed: true, alreadyChecked: false, remaining: Number.POSITIVE_INFINITY };
  }
  const month = compatibilityMonthKey(now);
  const checked =
    entitlement.compatibilityUsage?.month === month
      ? entitlement.compatibilityUsage.productIds
      : [];
  const alreadyChecked = checked.includes(productId);
  const remaining = Math.max(
    0,
    FREE_COMPATIBILITY_CHECKS_PER_MONTH - checked.length,
  );
  return { allowed: alreadyChecked || remaining > 0, alreadyChecked, remaining };
}

export const FEATURE_COPY: Record<
  PremiumFeature,
  { title: string; body: string }
> = {
  rescan: {
    title: "Continue weekly scans with Pore Plus",
    body: "Your first scan and first seven-day comparison stay free. Plus continues weekly scans and progress history at a skin-friendly cadence.",
  },
  shelf_detail: {
    title: "Continue Active Compatibility with Plus",
    body: "Three complete checks each month stay free. Plus removes the limit. Warnings and safety explanations always remain available.",
  },
  reminders: {
    title: "Custom reminder times are part of Pore Plus",
    body: "Default morning, evening, and weekly reminders stay free. Plus adds custom times and sunscreen reapplication reminders.",
  },
  weekly_report: {
    title: "Continue weekly reports with Pore Plus",
    body: "Your first weekly comparison stays free. Plus continues adaptive reports and progress history after that proof point.",
  },
};

export function isPremiumFeature(value: unknown): value is PremiumFeature {
  return typeof value === "string" && value in FEATURE_COPY;
}
