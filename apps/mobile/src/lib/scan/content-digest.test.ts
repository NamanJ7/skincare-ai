import { describe, expect, it } from "vitest";

import { bytesToHex } from "./digest-utils";

describe("bytesToHex", () => {
  it("keeps leading zeroes so SHA-256 bindings stay fixed width", () => {
    expect(bytesToHex(Uint8Array.from([0, 1, 15, 16, 255]).buffer)).toBe("00010f10ff");
  });
});
