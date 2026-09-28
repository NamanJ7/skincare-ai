import { describe, expect, it } from "vitest";

import { isSha256, newCaptureId, newFrameId, newScanSessionId, sha256Blob } from "../provenance";

describe("capture provenance", () => {
  it("creates namespace-separated unique session and capture IDs", () => {
    const first = newScanSessionId();
    const second = newScanSessionId();
    const capture = newCaptureId();
    expect(first).toMatch(/^scan_/u);
    expect(second).not.toBe(first);
    expect(capture).toMatch(/^capture_/u);
    expect(newFrameId()).toMatch(/^frame_/u);
  });

  it("digests the exact retained bytes", async () => {
    const first = await sha256Blob(new Blob(["first image"]));
    const same = await sha256Blob(new Blob(["first image"]));
    const different = await sha256Blob(new Blob(["second image"]));
    expect(isSha256(first)).toBe(true);
    expect(same).toBe(first);
    expect(different).not.toBe(first);
  });
});
