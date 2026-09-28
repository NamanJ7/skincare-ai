/**
 * The intake half of a plan request had no runtime validation — only a cast and
 * a truthiness check — while the scan half has had a full guard all along.
 * That asymmetry mattered because several safety-engine guarantees fail *open*
 * on a missing field rather than throwing, so a caller could switch them off by
 * omitting a JSON key. These tests pin the boundary.
 */
import { describe, expect, it } from "vitest";
import type { IntakeResponse } from "@pore/shared";

import { assertRuntimeIntake } from "../intake-guard";
import { AnalysisRequestError } from "../scan-analysis-guard";

/** The failing field list now lives on `detail`, never in the wire message. */
function detailOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return (error as AnalysisRequestError).detail ?? "";
  }
  throw new Error("expected assertRuntimeIntake to throw");
}

const valid: IntakeResponse = {
  age: 28,
  goals: ["acne"],
  sensitivity: "medium",
  currentProducts: [],
  allergies: [],
  pregnancyOrBreastfeeding: false,
};

describe("assertRuntimeIntake", () => {
  it("accepts a complete profile unchanged", () => {
    expect(assertRuntimeIntake(valid)).toMatchObject(valid);
  });

  it("accepts the optional fields the funnel may omit", () => {
    expect(() =>
      assertRuntimeIntake({ ...valid, skinType: "oily", climate: "humid" }),
    ).not.toThrow();
  });

  it.each([
    ["pregnancyOrBreastfeeding", "the pregnancy filter would silently skip"],
    ["sensitivity", "the strong-active cap would silently no-op"],
    ["allergies", "the allergy filter would throw mid-pipeline"],
    ["currentProducts", "personalization would throw mid-pipeline"],
    ["goals", "ingredient ranking would throw mid-pipeline"],
  ])("rejects a profile missing %s (%s)", (field) => {
    const partial = { ...valid } as Record<string, unknown>;
    delete partial[field];
    expect(() => assertRuntimeIntake(partial)).toThrow(AnalysisRequestError);
  });

  it("rejects before the model is called, with a 400 and a stable code", () => {
    try {
      assertRuntimeIntake({});
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AnalysisRequestError);
      expect((error as AnalysisRequestError).status).toBe(400);
      expect((error as AnalysisRequestError).code).toBe("INVALID_INTAKE");
    }
  });

  it("enforces the shared minimum supported age", () => {
    expect(() => assertRuntimeIntake({ ...valid, age: 11 })).toThrow(
      AnalysisRequestError,
    );
    expect(() => assertRuntimeIntake({ ...valid, age: 13 })).not.toThrow();
  });

  it("rejects a non-numeric or absurd age rather than passing it to the prompt", () => {
    expect(() => assertRuntimeIntake({ ...valid, age: "28" })).toThrow();
    expect(() => assertRuntimeIntake({ ...valid, age: 500 })).toThrow();
    expect(() => assertRuntimeIntake({ ...valid, age: Number.NaN })).toThrow();
  });

  it("rejects wrong-typed collection fields", () => {
    expect(() => assertRuntimeIntake({ ...valid, allergies: "retinoid" })).toThrow();
    expect(() => assertRuntimeIntake({ ...valid, goals: "acne" })).toThrow();
    expect(() =>
      assertRuntimeIntake({ ...valid, sensitivity: "extreme" }),
    ).toThrow();
  });

  it("keeps the offending field names off the wire", () => {
    // The route echoes `message` verbatim, so it must not enumerate the fields
    // the safety engine keys on — POST {"intake":{}} used to return the whole
    // set. `detail` carries them for the server log instead.
    try {
      assertRuntimeIntake({});
      expect.unreachable("should have thrown");
    } catch (error) {
      const { message, detail } = error as AnalysisRequestError;
      for (const field of [
        "age",
        "goals",
        "sensitivity",
        "currentProducts",
        "allergies",
        "pregnancyOrBreastfeeding",
      ]) {
        expect(message).not.toContain(field);
      }
      expect(message.length).toBeLessThan(120);
      expect(detail).toContain("sensitivity");
      expect(detail).not.toContain("invalid_");
    }
  });

  it("records the specific failing field in detail", () => {
    expect(detailOf(() => assertRuntimeIntake({ ...valid, sensitivity: "extreme" })))
      .toContain("sensitivity");
  });
});

describe("prompt-input bounds", () => {
  /**
   * Every field below is interpolated verbatim into both Opus prompts, twice
   * per request. Unbounded, they were a token-inflation and prompt-steering
   * channel that cost real money on a `max_tokens: 32_000` model.
   */
  const base = {
    age: 28,
    goals: ["acne"],
    sensitivity: "medium",
    currentProducts: [],
    allergies: [],
    pregnancyOrBreastfeeding: false,
  };

  it("rejects an over-long allergyNotes free-text field", () => {
    expect(
      detailOf(() => assertRuntimeIntake({ ...base, allergyNotes: "a".repeat(501) })),
    ).toContain("allergyNotes");
  });

  it("accepts allergyNotes at the limit", () => {
    expect(() =>
      assertRuntimeIntake({ ...base, allergyNotes: "a".repeat(500) }),
    ).not.toThrow();
  });

  it("rejects an unbounded currentProducts array", () => {
    expect(
      detailOf(() =>
        assertRuntimeIntake({
          ...base,
          currentProducts: Array.from({ length: 101 }, () => "niacinamide"),
        }),
      ),
    ).toContain("currentProducts");
  });

  it("rejects a single over-long product string", () => {
    expect(
      detailOf(() =>
        assertRuntimeIntake({ ...base, currentProducts: ["x".repeat(121)] }),
      ),
    ).toContain("currentProducts");
  });

  it("rejects an unbounded allergies array", () => {
    expect(
      detailOf(() =>
        assertRuntimeIntake({
          ...base,
          allergies: Array.from({ length: 51 }, () => "fragrance"),
        }),
      ),
    ).toContain("allergies");
  });

  it("rejects an over-long location", () => {
    expect(
      detailOf(() => assertRuntimeIntake({ ...base, location: "x".repeat(121) })),
    ).toContain("location");
  });

  it("rejects a goals array padded far beyond the enum size", () => {
    expect(
      detailOf(() =>
        assertRuntimeIntake({
          ...base,
          goals: Array.from({ length: 200 }, () => "acne"),
        }),
      ),
    ).toContain("goals");
  });

  it("still accepts a realistic profile with a full shelf", () => {
    expect(() =>
      assertRuntimeIntake({
        ...base,
        currentProducts: Array.from({ length: 60 }, (_, i) => `active-${i}`),
        allergies: ["fragrance", "essential_oils"],
        allergyNotes: "Reacts to strong menthol.",
        location: "Vancouver, Canada",
      }),
    ).not.toThrow();
  });
});
