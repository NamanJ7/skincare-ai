/**
 * Persisted scan history: one record per completed scan, so Progress can show
 * a photo timeline and "vs your last scan" language. Pure types + math, no
 * React. Photo names are RELATIVE to the photos/ dir (see photos.ts).
 */
import type { AppearanceLevel, Assessment, ConcernKey } from "@pore/shared";

import type { DateKey } from "./log";
import type { ScanComparisonMetadata } from "./scan/comparison-metadata";

export interface ScanFinding {
  concern: ConcernKey;
  appearanceLevel: AppearanceLevel;
}

export interface ScanRecord {
  date: DateKey;
  createdAt: string;
  /** Relative names under photos/ ("<ts>-front.jpg", …); [] if persisting failed. */
  photoNames: string[];
  /** The scan/session id this record came from, when a submission was assembled. */
  scanId?: string;
  /** Per-pose capture conditions used to decide if scans are comparable. */
  comparisonMetadata?: ScanComparisonMetadata;
  /**
   * True only when analysis succeeded for this record. A photo-only record
   * (analysis failed/skipped) is `false`/absent even though photos were saved,
   * so history can't imply a skin analysis that never happened.
   */
  analyzed?: boolean;
  /** assessment.summary when the plan call succeeded. */
  summary?: string;
  /** Present-only findings, for the "N things noticed" caption. */
  findings?: ScanFinding[];
  /**
   * The full cosmetic assessment, when the plan call succeeded — lets the
   * results dashboard render this scan's priorities/confidence even after the
   * in-memory plan is gone. Small (nine findings); safe to persist.
   */
  assessment?: Assessment;
}

/** Scans kept sorted ascending by createdAt. */
export interface ScanHistory {
  scans: ScanRecord[];
}

export const emptyScans = (): ScanHistory => ({ scans: [] });

/**
 * Coerce a stored or cloud-restored history into the current shape. Without
 * this, a `{}` payload reaches `history.scans.filter(...)` in gate.ts at first
 * render. `analyzed` is deliberately not defaulted to true: an unrecognizable
 * record must never imply a skin analysis that may not have happened.
 */
export function normalizeScans(value: unknown): ScanHistory {
  if (!value || typeof value !== "object") return emptyScans();
  const raw = (value as Partial<ScanHistory>).scans;
  if (!Array.isArray(raw)) return emptyScans();
  const scans = raw.filter((record): record is ScanRecord => {
    if (!record || typeof record !== "object") return false;
    const r = record as Partial<ScanRecord>;
    return (
      typeof r.date === "string" &&
      typeof r.createdAt === "string" &&
      Array.isArray(r.photoNames)
    );
  });
  scans.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  return { scans };
}

export function addScan(history: ScanHistory, record: ScanRecord): ScanHistory {
  const scans = [...history.scans, record];
  scans.sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  return { scans };
}

/** Remove exactly one local scan and its derived result by stable timestamp. */
export function removeScan(
  history: ScanHistory,
  createdAt: string,
): ScanHistory {
  return { scans: history.scans.filter((scan) => scan.createdAt !== createdAt) };
}

export function latestScan(history: ScanHistory): ScanRecord | undefined {
  return history.scans[history.scans.length - 1];
}

/**
 * The most recent record that actually completed analysis (skips photo-only
 * records from failed/skipped attempts), for honest "your last scan" language.
 */
export function latestAnalyzedScan(history: ScanHistory): ScanRecord | undefined {
  for (let i = history.scans.length - 1; i >= 0; i--) {
    const record = history.scans[i];
    if (record.analyzed && record.assessment) return record;
  }
  return undefined;
}

/** The earliest analyzed record — the baseline for scan-to-scan comparisons. */
export function firstAnalyzedScan(history: ScanHistory): ScanRecord | undefined {
  for (const record of history.scans) {
    if (record.analyzed && record.assessment) return record;
  }
  return undefined;
}
