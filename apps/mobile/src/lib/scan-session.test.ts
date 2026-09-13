import { afterEach, describe, expect, it } from "vitest";

import type { StepId } from "@pore/shared/scan";

import {
  beginScanCaptureSession,
  clearShots,
  getScanCaptureSession,
  getShots,
  saveShots,
  setScanPhotoDisposer,
  type ScanShot,
} from "./scan-session";

function shot(
  stepId: StepId,
  uri: string,
  previewPerceptualHash?: string,
): ScanShot {
  return {
    uri,
    artifact: {
      kind: "timeline-only",
      stepId,
      sessionId: "session-test",
      captureId: `capture-${stepId}`,
      capturedAt: 1_100,
      ...(previewPerceptualHash ? { previewPerceptualHash } : {}),
      reason: { code: "fixture", message: "Timeline fixture" },
    },
  };
}

describe("scan-session shots", () => {
  it("round-trips discriminated capture metadata and clears it", () => {
    clearShots();
    saveShots([
      shot("front", "front", "0123456789abcdef"),
      shot("right", "right"),
    ]);
    expect(getShots()[0]?.artifact.previewPerceptualHash).toBe(
      "0123456789abcdef",
    );
    expect(getShots()[0]?.artifact.kind).toBe("timeline-only");
    clearShots();
    expect(getShots()).toEqual([]);
  });

  it("allows a single retake without losing sibling artifacts", () => {
    saveShots([
      shot("front", "front", "aaaaaaaaaaaaaaaa"),
      shot("right", "right", "bbbbbbbbbbbbbbbb"),
    ]);
    const retaken = [...getShots()];
    retaken[1] = shot("right", "right-new", "cccccccccccccccc");
    saveShots(retaken);
    expect(getShots()).toEqual([
      shot("front", "front", "aaaaaaaaaaaaaaaa"),
      shot("right", "right-new", "cccccccccccccccc"),
    ]);
    clearShots();
  });

  it("replaces timeline-only state when a pose is retaken", () => {
    saveShots([shot("front", "front")]);
    expect(getShots()[0]?.artifact.kind).toBe("timeline-only");
    const replacement = shot("front", "front-new");
    if (replacement.artifact.kind !== "timeline-only") {
      throw new Error("Expected a timeline-only fixture");
    }
    replacement.artifact.reason.code = "new-result";
    saveShots([replacement]);
    expect(getShots()[0]?.artifact).toMatchObject({
      kind: "timeline-only",
      reason: { code: "new-result" },
    });
    clearShots();
  });

  it("creates session identity when capture starts and clears it with the flow", () => {
    clearShots();
    const session = beginScanCaptureSession("session-created-at-start", 1_000);
    expect(session.startedAt).toBe(1_000);
    expect(session.sessionId).toBe("session-created-at-start");
    expect(getScanCaptureSession()).toEqual(session);
    clearShots();
    expect(getScanCaptureSession()).toBeNull();
  });
});

describe("temp photo disposal", () => {
  /**
   * Scan captures write full-resolution face JPEGs into the cache dir: the raw
   * still, plus the analysis encode for a verified capture. Nothing used to
   * delete them, so they survived the scan and survived "Delete my data" —
   * while the Profile dialog and privacy-controls both claimed otherwise.
   */
  function verified(stepId: StepId, uri: string, analysisUri: string): ScanShot {
    return {
      uri,
      artifact: {
        kind: "verified",
        stepId,
        sessionId: "session-test",
        captureId: `capture-${stepId}`,
        capturedAt: 1_100,
        analysisUri,
        contentDigest: "digest",
        byteLength: 10,
        evidence: { provenance: { frameId: "frame" } } as never,
        result: { passed: true, blockingIssues: [], warnings: [] } as never,
      },
    };
  }

  afterEach(() => setScanPhotoDisposer(undefined));

  it("hands every capture file to the disposer when shots are cleared", () => {
    const disposed: (string | undefined)[] = [];
    setScanPhotoDisposer((uris) => disposed.push(...uris));

    clearShots();
    disposed.length = 0;
    saveShots([
      verified("front", "file:///tmp/front.jpg", "file:///tmp/front-analysis.jpg"),
      shot("right", "file:///tmp/right.jpg"),
    ]);
    clearShots();

    expect(disposed).toContain("file:///tmp/front.jpg");
    expect(disposed).toContain("file:///tmp/front-analysis.jpg");
    expect(disposed).toContain("file:///tmp/right.jpg");
  });

  it("clears state even when the disposer throws", () => {
    setScanPhotoDisposer(() => {
      throw new Error("filesystem unavailable");
    });
    saveShots([shot("front", "file:///tmp/front.jpg")]);

    expect(() => clearShots()).not.toThrow();
    expect(getShots()).toEqual([]);
  });

  it("empties state before disposing, so a slow disposer cannot leak shots", () => {
    let seen: number | null = null;
    setScanPhotoDisposer(() => {
      seen = getShots().length;
    });
    saveShots([shot("front", "file:///tmp/front.jpg")]);
    clearShots();

    expect(seen).toBe(0);
  });
});
