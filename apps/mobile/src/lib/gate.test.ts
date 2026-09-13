import { describe, expect, it } from "vitest";

import {
  FREE_COMPATIBILITY_CHECKS_PER_MONTH,
  canStartScan,
  canViewWeeklyReport,
  compatibilityAccess,
  hasUsedFreeScan,
  isPremium,
  isPremiumFeature,
  scanAccess,
} from "./gate";
import type { ScanHistory, ScanRecord } from "./scan-history";
import type { Entitlement } from "@/state/entitlement";

const FREE: Entitlement = { unlocked: false };
const PLUS: Entitlement = { unlocked: true, tier: "plus", term: "annual" };

function history(...scans: ScanRecord[]): ScanHistory {
  return { scans };
}

const analyzed: ScanRecord = {
  date: "2026-07-01",
  createdAt: "2026-07-01T10:00:00.000Z",
  photoNames: [],
  analyzed: true,
};

const photoOnly: ScanRecord = {
  date: "2026-07-01",
  createdAt: "2026-07-01T10:00:00.000Z",
  photoNames: ["p.jpg"],
};

describe("isPremium", () => {
  it("mirrors entitlement.unlocked", () => {
    expect(isPremium(FREE)).toBe(false);
    expect(isPremium(PLUS)).toBe(true);
  });
});

describe("hasUsedFreeScan", () => {
  it("is false with no history and no scannedAt", () => {
    expect(hasUsedFreeScan({}, history())).toBe(false);
  });

  it("ignores photo-only records — a failed attempt doesn't burn the free scan", () => {
    expect(hasUsedFreeScan({}, history(photoOnly, photoOnly))).toBe(false);
  });

  it("is true once any record was analyzed", () => {
    expect(hasUsedFreeScan({}, history(photoOnly, analyzed))).toBe(true);
  });

  it("honors legacy profiles that only stamped scannedAt", () => {
    expect(hasUsedFreeScan({ scannedAt: "2026-07-01T10:00:00.000Z" }, history())).toBe(true);
  });
});

describe("canStartScan", () => {
  it("applies the seven-day cadence to Plus too", () => {
    expect(canStartScan(PLUS, {}, history(analyzed), "2026-07-05")).toBe(false);
    expect(canStartScan(PLUS, {}, history(analyzed), "2026-07-08")).toBe(true);
  });

  it("allows free users their first analyzed scan", () => {
    expect(canStartScan(FREE, {}, history())).toBe(true);
    expect(canStartScan(FREE, {}, history(photoOnly))).toBe(true);
  });

  it("includes one free weekly follow-up after seven days", () => {
    expect(canStartScan(FREE, {}, history(analyzed), "2026-07-07")).toBe(false);
    expect(canStartScan(FREE, {}, history(analyzed), "2026-07-08")).toBe(true);
    expect(scanAccess(FREE, {}, history(analyzed), "2026-07-08").reason).toBe(
      "first_weekly_comparison",
    );
  });

  it("requires Plus only after the first comparison has been delivered", () => {
    const followUp: ScanRecord = {
      ...analyzed,
      date: "2026-07-08",
      createdAt: "2026-07-08T10:00:00.000Z",
    };
    expect(scanAccess(FREE, {}, history(analyzed, followUp), "2026-07-15")).toMatchObject({
      allowed: false,
      reason: "plus_required",
      analyzedCount: 2,
    });
  });

  it("counts a newer successful scan even when its photos failed to persist", () => {
    const access = scanAccess(
      FREE,
      { scannedAt: "2026-07-08T10:00:00.000Z" },
      history(analyzed),
      "2026-07-15",
    );
    expect(access).toMatchObject({
      allowed: false,
      reason: "plus_required",
      analyzedCount: 2,
    });
  });
});

describe("weekly report proof", () => {
  it("keeps the baseline and first comparison free, then requires Plus", () => {
    expect(canViewWeeklyReport(FREE, 1)).toBe(true);
    expect(canViewWeeklyReport(FREE, 2)).toBe(true);
    expect(canViewWeeklyReport(FREE, 3)).toBe(false);
    expect(canViewWeeklyReport(PLUS, 10)).toBe(true);
  });
});

describe("monthly Active Compatibility quota", () => {
  it("allows three distinct complete reads and keeps repeats available", () => {
    const withThree: Entitlement = {
      unlocked: false,
      compatibilityUsage: {
        month: "2026-07",
        productIds: ["one", "two", "three"],
      },
    };
    expect(FREE_COMPATIBILITY_CHECKS_PER_MONTH).toBe(3);
    expect(compatibilityAccess(withThree, "two", new Date(2026, 6, 15))).toMatchObject({
      allowed: true,
      alreadyChecked: true,
      remaining: 0,
    });
    expect(compatibilityAccess(withThree, "four", new Date(2026, 6, 15)).allowed).toBe(false);
  });

  it("resets on a new local calendar month and is unlimited for Plus", () => {
    const used: Entitlement = {
      unlocked: false,
      compatibilityUsage: {
        month: "2026-06",
        productIds: ["one", "two", "three"],
      },
    };
    expect(compatibilityAccess(used, "four", new Date(2026, 6, 1)).remaining).toBe(3);
    expect(compatibilityAccess(PLUS, "four", new Date(2026, 6, 1)).allowed).toBe(true);
  });
});

describe("isPremiumFeature", () => {
  it("accepts known features and rejects everything else", () => {
    expect(isPremiumFeature("rescan")).toBe(true);
    expect(isPremiumFeature("weekly_report")).toBe(true);
    expect(isPremiumFeature("free_money")).toBe(false);
    expect(isPremiumFeature(undefined)).toBe(false);
  });
});
