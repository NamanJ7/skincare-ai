/**
 * Scan-to-scan concern deltas: the first analyzed scan (baseline) vs the
 * latest, per concern. Pure, no React. Only analyzed records count — photo-only
 * records can never imply a comparison that didn't happen. Copy rules match
 * the trend engine: appearance-direction language only, never a measurement.
 */
import type { AppearanceLevel, ConcernKey } from "@pore/shared";
import { QUALITY_CONFIG, STEP_ORDER } from "@pore/shared/scan";

import { CONCERN_LABELS } from "./labels";
import { APPEARANCE_LABELS, APPEARANCE_RANK } from "./results";
import {
  firstAnalyzedScan,
  latestAnalyzedScan,
  type ScanFinding,
  type ScanHistory,
  type ScanRecord,
} from "./scan-history";
import type { ScanComparisonMetadata } from "./scan/comparison-metadata";
import type { TrendDirection, TrendStatement } from "./trends";

export type ScanDeltaKind =
  | "improved"
  | "steady"
  | "worsened"
  | "appeared"
  | "resolved";

export interface ScanConcernDelta {
  concern: ConcernKey;
  kind: ScanDeltaKind;
  /** better | stable | worse — drives TrendRow icon/tone. */
  direction: TrendDirection;
  /** "none" when the concern wasn't present on that scan. */
  baselineLevel: AppearanceLevel;
  latestLevel: AppearanceLevel;
}

export interface ScanComparison {
  baselineCreatedAt: string;
  latestCreatedAt: string;
  /** Sorted most-actionable first: worsened/appeared, then improved/resolved, then steady. */
  deltas: ScanConcernDelta[];
}

/** Present findings for a record, falling back to the stored full assessment. */
function presentFindings(record: ScanRecord): ScanFinding[] | null {
  if (record.findings) return record.findings;
  if (record.assessment) {
    return record.assessment.findings
      .filter((f) => f.present)
      .map((f) => ({ concern: f.concern, appearanceLevel: f.appearanceLevel }));
  }
  return null;
}

const KIND_ORDER: Record<ScanDeltaKind, number> = {
  worsened: 0,
  appeared: 1,
  improved: 2,
  resolved: 3,
  steady: 4,
};

/** True only when every pose was captured under sufficiently similar conditions. */
export function scanConditionsAreComparable(
  baseline: ScanComparisonMetadata | undefined,
  latest: ScanComparisonMetadata | undefined,
): boolean {
  if (!baseline || !latest || baseline.configVersion !== latest.configVersion)
    return false;

  const limits = QUALITY_CONFIG.comparison;
  for (const stepId of STEP_ORDER) {
    const before = baseline.poses[stepId];
    const after = latest.poses[stepId];
    if (!before || !after) return false;
    const centerX = after.faceCenterX - before.faceCenterX;
    const centerY = after.faceCenterY - before.faceCenterY;
    const centerDelta = Math.sqrt(centerX * centerX + centerY * centerY);
    if (
      Math.abs(after.yawDeg - before.yawDeg) > limits.maxYawDeltaDeg ||
      Math.abs(after.faceWidthRatio - before.faceWidthRatio) >
        limits.maxFaceWidthRatioDelta ||
      centerDelta > limits.maxFaceCenterDelta ||
      Math.abs(after.faceLumaMean - before.faceLumaMean) >
        limits.maxFaceLumaMeanDelta ||
      Math.abs(after.lightingAsymmetry - before.lightingAsymmetry) >
        limits.maxLightingAsymmetryDelta ||
      Math.abs(after.backlightDelta - before.backlightDelta) >
        limits.maxBacklightDeltaDifference
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Compare the first and latest analyzed scans, or null when there aren't two
 * distinct analyzed records with usable findings yet.
 */
export function compareAnalyzedScans(
  history: ScanHistory,
): ScanComparison | null {
  const baseline = firstAnalyzedScan(history);
  const latest = latestAnalyzedScan(history);
  if (!baseline || !latest || baseline.createdAt === latest.createdAt)
    return null;
  if (
    !scanConditionsAreComparable(
      baseline.comparisonMetadata,
      latest.comparisonMetadata,
    )
  )
    return null;

  const baselineFindings = presentFindings(baseline);
  const latestFindings = presentFindings(latest);
  if (!baselineFindings || !latestFindings) return null;

  const baselineLevels = new Map(
    baselineFindings.map((f) => [f.concern, f.appearanceLevel]),
  );
  const latestLevels = new Map(
    latestFindings.map((f) => [f.concern, f.appearanceLevel]),
  );
  const concerns = new Set([...baselineLevels.keys(), ...latestLevels.keys()]);

  const deltas: ScanConcernDelta[] = [];
  for (const concern of concerns) {
    const baselineLevel = baselineLevels.get(concern) ?? "none";
    const latestLevel = latestLevels.get(concern) ?? "none";
    const before = APPEARANCE_RANK[baselineLevel];
    const after = APPEARANCE_RANK[latestLevel];
    if (before === 0 && after === 0) continue;

    const kind: ScanDeltaKind =
      before === 0
        ? "appeared"
        : after === 0
          ? "resolved"
          : after < before
            ? "improved"
            : after > before
              ? "worsened"
              : "steady";
    const direction: TrendDirection =
      kind === "appeared" || kind === "worsened"
        ? "worse"
        : kind === "steady"
          ? "stable"
          : "better";
    deltas.push({ concern, kind, direction, baselineLevel, latestLevel });
  }

  deltas.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  return {
    baselineCreatedAt: baseline.createdAt,
    latestCreatedAt: latest.createdAt,
    deltas,
  };
}

const HEADLINES: Record<ScanDeltaKind, string> = {
  improved: "less visible than your first scan",
  worsened: "more visible than your first scan",
  appeared: "new since your first scan",
  resolved: "no longer showing",
  steady: "about the same as your first scan",
};

const SHARED_WHY =
  "Scan reads only look at appearance and can shift with lighting. Treat this as a direction, not a measurement.";

const NEXT: Record<TrendDirection, string> = {
  worse:
    "Keep the routine steady and retake your next scan in similar light before changing anything.",
  better:
    "Keep your routine steady and compare again in similar light. The scan shows direction, not what caused the change.",
  stable: "No change needed. Staying steady between scans is a good result.",
};

/**
 * The comparison as TrendRow-ready statements, capped so steady rows (sorted
 * last) collapse away first.
 */
export function scanTrendStatements(
  cmp: ScanComparison,
  max = 4,
): TrendStatement[] {
  return cmp.deltas.slice(0, max).map((d) => ({
    key: `scan:${d.concern}` as const,
    direction: d.direction,
    headline: `${CONCERN_LABELS[d.concern]}: ${HEADLINES[d.kind]}`,
    noticed: `Read as ${APPEARANCE_LABELS[d.baselineLevel].toLowerCase()} on your first scan and ${APPEARANCE_LABELS[d.latestLevel].toLowerCase()} on your latest.`,
    why: SHARED_WHY,
    next: NEXT[d.direction],
  }));
}
