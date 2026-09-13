import { describe, expect, it } from "vitest";

import type { AppearanceLevel, Assessment, ConcernKey } from "@pore/shared";
import { QUALITY_CONFIG, STEP_ORDER, type StepId } from "@pore/shared/scan";

import {
  compareAnalyzedScans,
  scanConditionsAreComparable,
  scanTrendStatements,
} from "./scan-compare";
import type { ScanFinding, ScanHistory, ScanRecord } from "./scan-history";
import type {
  PoseComparisonMetadata,
  ScanComparisonMetadata,
} from "./scan/comparison-metadata";

const YAW: Record<StepId, number> = { front: 0, right: 45, left: -45 };

function comparisonMetadata(
  configVersion: string = QUALITY_CONFIG.version,
): ScanComparisonMetadata {
  const poses = Object.fromEntries(
    STEP_ORDER.map((stepId) => [
      stepId,
      {
        stepId,
        capturedAt: 1_000,
        width: 1024,
        height: 1365,
        yawDeg: YAW[stepId],
        pitchDeg: 0,
        rollDeg: 0,
        faceWidthRatio: 0.4,
        faceCenterX: 0.5,
        faceCenterY: 0.48,
        faceLumaMean: 150,
        lightingAsymmetry: 0.03,
        backlightDelta: 8,
        shadowClipping: 0.01,
        highlightClipping: 0.01,
        skinSharpness: 60,
        skinLaplacianVariance: 80,
        qualityScore: 0.95,
        qualityConfidence: 0.9,
      } satisfies PoseComparisonMetadata,
    ]),
  ) as Record<StepId, PoseComparisonMetadata>;
  return { configVersion, poses };
}

function assessment(findings: ScanFinding[] = []): Assessment {
  return {
    findings: findings.map((f) => ({
      concern: f.concern,
      present: true,
      appearanceLevel: f.appearanceLevel,
      confidence: 0.8,
      contributingFactors: [],
      regions: [],
      regionDetail: [],
      observedInPoses: ["front", "right", "left"],
    })),
    escalation: { recommendProfessional: false, reasons: [] },
    summary: "",
    disclaimer: "",
  };
}

function analyzedScan(
  createdAt: string,
  findings: ScanFinding[],
  opts: {
    omitFindings?: boolean;
    comparisonMetadata?: ScanComparisonMetadata;
    omitComparisonMetadata?: boolean;
  } = {},
): ScanRecord {
  return {
    date: createdAt.slice(0, 10),
    createdAt,
    photoNames: [],
    analyzed: true,
    assessment: assessment(findings),
    ...(opts.omitComparisonMetadata
      ? {}
      : { comparisonMetadata: opts.comparisonMetadata ?? comparisonMetadata() }),
    ...(opts.omitFindings ? {} : { findings }),
  };
}

function photoOnlyScan(createdAt: string): ScanRecord {
  return { date: createdAt.slice(0, 10), createdAt, photoNames: ["p.jpg"] };
}

function history(...scans: ScanRecord[]): ScanHistory {
  return { scans };
}

const T1 = "2026-06-01T10:00:00.000Z";
const T2 = "2026-06-15T10:00:00.000Z";
const T3 = "2026-07-01T10:00:00.000Z";

const finding = (
  concern: ConcernKey,
  appearanceLevel: AppearanceLevel,
): ScanFinding => ({
  concern,
  appearanceLevel,
});

describe("compareAnalyzedScans", () => {
  it("returns null with zero or one analyzed scan", () => {
    expect(compareAnalyzedScans(history())).toBeNull();
    expect(compareAnalyzedScans(history(analyzedScan(T1, [])))).toBeNull();
  });

  it("skips photo-only records entirely", () => {
    const h = history(
      photoOnlyScan(T1),
      analyzedScan(T2, []),
      photoOnlyScan(T3),
    );
    expect(compareAnalyzedScans(h)).toBeNull();
  });

  it("compares the first and latest analyzed scans across photo-only noise", () => {
    const h = history(
      analyzedScan(T1, [finding("redness_appearance", "moderate")]),
      photoOnlyScan(T2),
      analyzedScan(T3, [finding("redness_appearance", "mild")]),
    );
    const cmp = compareAnalyzedScans(h);
    expect(cmp).not.toBeNull();
    expect(cmp!.baselineCreatedAt).toBe(T1);
    expect(cmp!.latestCreatedAt).toBe(T3);
    expect(cmp!.deltas).toEqual([
      {
        concern: "redness_appearance",
        kind: "improved",
        direction: "better",
        baselineLevel: "moderate",
        latestLevel: "mild",
      },
    ]);
  });

  it("marks appeared and resolved concerns", () => {
    const h = history(
      analyzedScan(T1, [finding("oiliness", "mild")]),
      analyzedScan(T3, [finding("dryness_flaking", "mild")]),
    );
    const cmp = compareAnalyzedScans(h)!;
    const byConcern = Object.fromEntries(cmp.deltas.map((d) => [d.concern, d]));
    expect(byConcern["dryness_flaking"].kind).toBe("appeared");
    expect(byConcern["dryness_flaking"].direction).toBe("worse");
    expect(byConcern["oiliness"].kind).toBe("resolved");
    expect(byConcern["oiliness"].direction).toBe("better");
  });

  it("ranks levels in both directions and keeps steady rows stable", () => {
    const h = history(
      analyzedScan(T1, [
        finding("acne_like_breakouts", "mild"),
        finding("uneven_tone", "moderate"),
      ]),
      analyzedScan(T3, [
        finding("acne_like_breakouts", "noticeable"),
        finding("uneven_tone", "moderate"),
      ]),
    );
    const cmp = compareAnalyzedScans(h)!;
    const byConcern = Object.fromEntries(cmp.deltas.map((d) => [d.concern, d]));
    expect(byConcern["acne_like_breakouts"].kind).toBe("worsened");
    expect(byConcern["uneven_tone"].kind).toBe("steady");
    expect(byConcern["uneven_tone"].direction).toBe("stable");
  });

  it("sorts worsened/appeared ahead of improved/resolved ahead of steady", () => {
    const h = history(
      analyzedScan(T1, [
        finding("oiliness", "mild"),
        finding("redness_appearance", "moderate"),
        finding("uneven_tone", "mild"),
      ]),
      analyzedScan(T3, [
        finding("oiliness", "noticeable"),
        finding("redness_appearance", "mild"),
        finding("uneven_tone", "mild"),
        finding("dryness_flaking", "mild"),
      ]),
    );
    const kinds = compareAnalyzedScans(h)!.deltas.map((d) => d.kind);
    expect(kinds).toEqual(["worsened", "appeared", "improved", "steady"]);
  });

  it("falls back to the stored assessment when findings are missing", () => {
    const h = history(
      analyzedScan(T1, [finding("redness_appearance", "noticeable")], {
        omitFindings: true,
      }),
      analyzedScan(T3, [finding("redness_appearance", "mild")], {
        omitFindings: true,
      }),
    );
    const cmp = compareAnalyzedScans(h)!;
    expect(cmp.deltas[0].kind).toBe("improved");
  });

  it("withholds comparison language when metadata or config versions differ", () => {
    const noMetadata = history(
      analyzedScan(T1, [], { omitComparisonMetadata: true }),
      analyzedScan(T3, []),
    );
    expect(compareAnalyzedScans(noMetadata)).toBeNull();

    const oldConfig = comparisonMetadata("old-config");
    expect(
      scanConditionsAreComparable(oldConfig, comparisonMetadata()),
    ).toBe(false);
  });

  it("withholds comparison language when pose or lighting conditions drift", () => {
    const shifted = comparisonMetadata();
    shifted.poses.right = {
      ...shifted.poses.right,
      yawDeg:
        shifted.poses.right.yawDeg +
        QUALITY_CONFIG.comparison.maxYawDeltaDeg +
        1,
    };
    expect(
      scanConditionsAreComparable(comparisonMetadata(), shifted),
    ).toBe(false);

    const darker = comparisonMetadata();
    darker.poses.front = {
      ...darker.poses.front,
      faceLumaMean:
        darker.poses.front.faceLumaMean +
        QUALITY_CONFIG.comparison.maxFaceLumaMeanDelta +
        1,
    };
    expect(
      scanConditionsAreComparable(comparisonMetadata(), darker),
    ).toBe(false);
  });
});

describe("scanTrendStatements", () => {
  const h = history(
    analyzedScan(T1, [
      finding("oiliness", "mild"),
      finding("redness_appearance", "moderate"),
      finding("uneven_tone", "mild"),
      finding("texture_congestion", "mild"),
      finding("dark_spot_appearance", "mild"),
    ]),
    analyzedScan(T3, [
      finding("oiliness", "noticeable"),
      finding("redness_appearance", "mild"),
      finding("uneven_tone", "mild"),
      finding("texture_congestion", "mild"),
      finding("dark_spot_appearance", "mild"),
    ]),
  );

  it("caps rows so steady deltas collapse first", () => {
    const statements = scanTrendStatements(compareAnalyzedScans(h)!, 3);
    expect(statements).toHaveLength(3);
    expect(statements[0].key).toBe("scan:oiliness");
    expect(statements[0].direction).toBe("worse");
  });

  it("uses cautious appearance copy without a percentage or diagnosis", () => {
    for (const s of scanTrendStatements(compareAnalyzedScans(h)!)) {
      expect(s.headline).not.toMatch(/%|\d/);
      expect(s.why).toContain("only look at appearance");
      expect(s.noticed).toContain("first scan");
      expect(s.next).not.toMatch(/credit|caused by|because of your routine/i);
    }
  });

  it("names the level movement in the noticed line", () => {
    const [worst] = scanTrendStatements(compareAnalyzedScans(h)!);
    expect(worst.noticed).toBe(
      "Read as mild on your first scan and noticeable on your latest.",
    );
  });
});
