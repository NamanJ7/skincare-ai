import { describe, expect, it } from "vitest";

import { buildIntake } from "./intake";
import { normalizeProfile, type UserProduct } from "./profile";
import { createTeenSelfConsent } from "./youth-consent";

describe("normalizeProfile", () => {
  it("returns an empty profile for missing input", () => {
    expect(normalizeProfile(undefined)).toEqual({});
  });

  it("keeps legacy answers but reopens incomplete onboarding", () => {
    const old = {
      age: 22,
      goals: ["acne"],
      skinType: "oily",
      onboardingComplete: true,
    };
    expect(normalizeProfile(old)).toEqual({
      ...old,
      onboardingComplete: false,
    });
  });

  it("drops the retired guardian email and requires a current youth record", () => {
    expect(
      normalizeProfile({
        age: 17,
        parentEmail: "guardian@example.com",
        onboardingComplete: true,
      }),
    ).toEqual({ age: 17, onboardingComplete: false });
  });

  it("keeps an authorized 16–17 profile complete", () => {
    const teenSelfConsent = createTeenSelfConsent(
      17,
      "2026-07-16T12:00:00.000Z",
    );
    expect(
      normalizeProfile({
        age: 17,
        teenSelfConsent,
        goals: ["acne"],
        primaryGoal: "acne",
        skinType: "combination",
        skinTypeChoiceId: "combination",
        routineComplexity: "balanced",
        sensitivity: "medium",
        sensitivityChoiceId: "sometimes",
        pregnancyOrBreastfeeding: false,
        usingPrescriptionSkincare: false,
        allergies: [],
        currentProducts: [],
        analysisStatus: {
          kind: "answers_only",
          reason: "scan_skipped",
          attemptedAt: "2026-07-16T12:00:00.000Z",
        },
        onboardingComplete: true,
      }),
    ).toMatchObject({
      age: 17,
      teenSelfConsent,
      onboardingComplete: true,
      safetyChoiceIds: ["none"],
    });
  });

  it("normalizes flagged legacy safety answers without reopening onboarding", () => {
    expect(
      normalizeProfile({
        age: 30,
        goals: ["acne"],
        primaryGoal: "acne",
        skinType: "combination",
        skinTypeChoiceId: "combination",
        routineComplexity: "balanced",
        sensitivity: "medium",
        sensitivityChoiceId: "sometimes",
        pregnancyOrBreastfeeding: false,
        usingPrescriptionSkincare: true,
        allergies: ["fragrance"],
        currentProducts: [],
        analysisStatus: {
          kind: "answers_only",
          reason: "scan_skipped",
          attemptedAt: "2026-07-16T12:00:00.000Z",
        },
        onboardingComplete: true,
      }),
    ).toMatchObject({
      onboardingComplete: true,
      safetyChoiceIds: ["prescription_skincare", "known_reactions"],
    });
  });

  it("drops malformed userProducts entries and coerces unknown categories", () => {
    const stored = {
      age: 22,
      userProducts: [
        { id: "a", name: "CeraVe Foaming Cleanser", category: "cleanser" },
        { name: "  Mystery Serum  ", category: "elixir" }, // unknown category, no id
        { name: "", category: "toner" }, // empty name
        "not-an-object",
        null,
      ],
    };
    const products = normalizeProfile(stored).userProducts as UserProduct[];
    expect(products).toEqual([
      { id: "a", name: "CeraVe Foaming Cleanser", category: "cleanser" },
      { id: "product-1", name: "Mystery Serum", category: "other" },
    ]);
  });

  it("replaces a non-array userProducts with an empty list", () => {
    expect(normalizeProfile({ userProducts: "corrupt" }).userProducts).toEqual(
      [],
    );
  });

  it("keeps catalog identity, valid actives, and addedAt while filtering unknown active keys", () => {
    const stored = {
      userProducts: [
        {
          id: "a",
          catalogId: "  cerave-resurfacing-retinol-serum  ",
          name: "Night serum",
          category: "serum",
          actives: ["retinoid", "unobtanium", 3],
          addedAt: "2026-07-09T12:00:00.000Z",
        },
        {
          id: "b",
          name: "Plain cleanser",
          category: "cleanser",
          actives: "corrupt",
        },
      ],
    };
    const products = normalizeProfile(stored).userProducts as UserProduct[];
    expect(products).toEqual([
      {
        id: "a",
        catalogId: "cerave-resurfacing-retinol-serum",
        name: "Night serum",
        category: "serum",
        actives: ["retinoid"],
        addedAt: "2026-07-09T12:00:00.000Z",
      },
      { id: "b", name: "Plain cleanser", category: "cleanser" },
    ]);
  });

  it("keeps ingredientsUnknown only when true and no actives are tagged", () => {
    const stored = {
      userProducts: [
        {
          id: "a",
          name: "Mystery cream",
          category: "moisturizer",
          ingredientsUnknown: true,
        },
        // Tagged actives win over a stale "don't know" flag.
        {
          id: "b",
          name: "Night serum",
          category: "serum",
          actives: ["retinoid"],
          ingredientsUnknown: true,
        },
        {
          id: "c",
          name: "Toner",
          category: "toner",
          ingredientsUnknown: "yes",
        },
      ],
    };
    const products = normalizeProfile(stored).userProducts as UserProduct[];
    expect(products).toEqual([
      {
        id: "a",
        name: "Mystery cream",
        category: "moisturizer",
        ingredientsUnknown: true,
      },
      {
        id: "b",
        name: "Night serum",
        category: "serum",
        actives: ["retinoid"],
      },
      { id: "c", name: "Toner", category: "toner" },
    ]);
  });
});

describe("buildIntake", () => {
  it("passes the new questionnaire answers through", () => {
    const intake = buildIntake({
      age: 30,
      budget: "high",
      fragrancePreference: "fragrance_free",
      allergies: ["retinoid", "fragrance"],
      allergyNotes: "Avoid lanolin",
      routineComplexity: "minimal",
    });
    expect(intake.budget).toBe("high");
    expect(intake.fragrancePreference).toBe("fragrance_free");
    expect(intake.allergies).toEqual(["retinoid", "fragrance"]);
    expect(intake.allergyNotes).toBe("Avoid lanolin");
    expect(intake.routineComplexity).toBe("minimal");
  });

  it("does not fabricate answers for questions the user was never asked", () => {
    const intake = buildIntake({ age: 22, goals: ["acne"] });
    expect(intake.budget).toBeUndefined();
    expect(intake.fragrancePreference).toBeUndefined();
    expect(intake.skinType).toBeUndefined();
    expect(intake.skinTone).toBeUndefined();
    expect(intake.climate).toBeUndefined();
    expect(intake.allergies).toEqual([]);
  });
});
