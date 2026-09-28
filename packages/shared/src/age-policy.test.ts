import { describe, expect, it } from "vitest";

import {
  ageTierFor,
  isSupportedAge,
  needsGuardianProfileAuthorization,
  needsGuardianPurchaseApproval,
  needsTeenSelfConsent,
} from "./age-policy";

describe("age policy", () => {
  it("maps every launch boundary to the intended tier", () => {
    expect(ageTierFor(12)).toBe("under_13");
    expect(ageTierFor(13)).toBe("young_teen");
    expect(ageTierFor(15)).toBe("young_teen");
    expect(ageTierFor(16)).toBe("older_teen");
    expect(ageTierFor(17)).toBe("older_teen");
    expect(ageTierFor(18)).toBe("adult");
  });

  it("requires the right authorization without treating all minors alike", () => {
    expect(isSupportedAge(12)).toBe(false);
    expect(isSupportedAge(13)).toBe(true);
    expect(needsGuardianProfileAuthorization(15)).toBe(true);
    expect(needsGuardianProfileAuthorization(16)).toBe(false);
    expect(needsTeenSelfConsent(16)).toBe(true);
    expect(needsTeenSelfConsent(18)).toBe(false);
  });

  it("supports every selectable age from 13 through 100", () => {
    for (let age = 13; age <= 100; age += 1) {
      expect(isSupportedAge(age)).toBe(true);
      expect(ageTierFor(age)).toBe(
        age >= 18 ? "adult" : age <= 15 ? "young_teen" : "older_teen",
      );
    }
  });

  it("maps every age-wheel value from 1 through 100 without gaps", () => {
    for (let age = 1; age <= 100; age += 1) {
      const expectedTier =
        age < 13
          ? "under_13"
          : age <= 15
            ? "young_teen"
            : age <= 17
              ? "older_teen"
              : "adult";
      expect(ageTierFor(age)).toBe(expectedTier);
      expect(isSupportedAge(age)).toBe(age >= 13);
    }
    expect(ageTierFor(34)).toBe("adult");
    expect(isSupportedAge(34)).toBe(true);
  });

  it("keeps paid transactions parent-controlled for every supported minor", () => {
    expect(needsGuardianPurchaseApproval(12)).toBe(false);
    expect(needsGuardianPurchaseApproval(13)).toBe(true);
    expect(needsGuardianPurchaseApproval(17)).toBe(true);
    expect(needsGuardianPurchaseApproval(18)).toBe(false);
  });
});
