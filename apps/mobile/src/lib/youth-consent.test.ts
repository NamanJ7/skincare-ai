import { describe, expect, it } from "vitest";

import {
  createGuardianAuthorization,
  createTeenSelfConsent,
  hasCurrentGuardianAuthorization,
  hasCurrentTeenSelfConsent,
  profileAuthorizationRequirement,
} from "./youth-consent";

const credential = {
  algorithm: "sha256" as const,
  salt: "device-salt",
  digest: "guardian-pin-digest",
};

describe("youth consent records", () => {
  it("accepts current 16–17 self-consent and fails closed outside that tier", () => {
    const record = createTeenSelfConsent(16, "2026-07-16T12:00:00.000Z");
    expect(hasCurrentTeenSelfConsent(16, record)).toBe(true);
    expect(hasCurrentTeenSelfConsent(17, record)).toBe(true);
    expect(hasCurrentTeenSelfConsent(18, record)).toBe(false);
    expect(
      hasCurrentTeenSelfConsent(16, {
        ...record,
        withdrawnAt: "2026-07-16T13:00:00.000Z",
      }),
    ).toBe(false);
  });

  it("accepts a current parent authorization only for ages 13–15", () => {
    const record = createGuardianAuthorization(
      14,
      credential,
      "2026-07-16T12:00:00.000Z",
    );
    expect(hasCurrentGuardianAuthorization(13, record)).toBe(true);
    expect(hasCurrentGuardianAuthorization(15, record)).toBe(true);
    expect(hasCurrentGuardianAuthorization(16, record)).toBe(false);
    expect(
      hasCurrentGuardianAuthorization(14, {
        ...record,
        guardianCredential: { ...credential, digest: "" },
      }),
    ).toBe(false);
  });

  it("refuses to create records for the wrong age tier", () => {
    expect(() => createTeenSelfConsent(15)).toThrow();
    expect(() => createGuardianAuthorization(16, credential)).toThrow();
  });

  it("routes every age tier to the required profile authorization", () => {
    const guardian = createGuardianAuthorization(14, credential);
    const teen = createTeenSelfConsent(17);
    expect(profileAuthorizationRequirement(undefined, undefined, undefined)).toBe(
      "age",
    );
    expect(profileAuthorizationRequirement(12, undefined, undefined)).toBe(
      "under_13",
    );
    expect(profileAuthorizationRequirement(14, undefined, undefined)).toBe(
      "guardian",
    );
    expect(profileAuthorizationRequirement(14, guardian, undefined)).toBeNull();
    expect(profileAuthorizationRequirement(17, undefined, undefined)).toBe(
      "teen",
    );
    expect(profileAuthorizationRequirement(17, undefined, teen)).toBeNull();
    expect(profileAuthorizationRequirement(18, undefined, undefined)).toBeNull();
  });
});
