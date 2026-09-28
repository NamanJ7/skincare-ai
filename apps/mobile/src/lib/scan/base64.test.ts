import { describe, expect, it } from "vitest";

import { base64ToBytes } from "./base64";

/** Node's Buffer is the reference encoder — the decoder must round-trip it. */
function encode(bytes: number[]): string {
  return Buffer.from(bytes).toString("base64");
}

describe("base64ToBytes", () => {
  it("decodes the empty string", () => {
    expect(base64ToBytes("").length).toBe(0);
  });

  it("round-trips all padding lengths", () => {
    const cases = [[1], [1, 2], [1, 2, 3], [1, 2, 3, 4], [0, 127, 128, 255]];
    for (const bytes of cases) {
      expect(Array.from(base64ToBytes(encode(bytes)))).toEqual(bytes);
    }
  });

  it("round-trips a JPEG-sized binary blob", () => {
    const bytes = Array.from({ length: 4096 }, (_, i) => (i * 7 + 13) % 256);
    expect(Array.from(base64ToBytes(encode(bytes)))).toEqual(bytes);
  });

  it("tolerates embedded whitespace and newlines", () => {
    const clean = encode([10, 20, 30, 40, 50]);
    const noisy = `${clean.slice(0, 4)}\n ${clean.slice(4)}`;
    expect(Array.from(base64ToBytes(noisy))).toEqual([10, 20, 30, 40, 50]);
  });
});
