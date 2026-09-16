/**
 * The bound on what one `/api/plan` request can cost.
 *
 * `intake` is `JSON.stringify`'d into *both* Claude prompts, so its size is the
 * per-request bill. The rate limiter caps how many requests are paid for, not
 * how much each one costs — that is this schema's job, and it is covered here.
 * The limiter and the image rules have their own suites
 * (`rateLimit.test.ts`, `validateImages.test.ts`).
 *
 * Not a suite — the assertions on the paid path, and nothing else.
 */
import { describe, expect, it } from "vitest";
import { IntakeSchema } from "./schemas";

const validIntake = {
  age: 28,
  goals: ["acne"],
  skinType: "oily",
  sensitivity: "medium",
  currentProducts: [],
  allergies: [],
  budget: "low",
  fragrancePreference: "no_preference",
  pregnancyOrBreastfeeding: false,
  skinTone: "medium",
  darkMarkProne: false,
  climate: "temperate",
} as const;

describe("IntakeSchema", () => {
  // Guard against a schema so strict the real client can never satisfy it —
  // that failure mode turns the validation gate into an outage.
  it("accepts what the app actually sends", () => {
    expect(IntakeSchema.safeParse(validIntake).success).toBe(true);
    expect(IntakeSchema.safeParse({ ...validIntake, location: "Berlin" }).success).toBe(true);
  });

  it("rejects a token bomb in free-text fields", () => {
    expect(
      IntakeSchema.safeParse({ ...validIntake, currentProducts: ["x".repeat(100_000)] }).success,
    ).toBe(false);
    expect(
      IntakeSchema.safeParse({ ...validIntake, allergies: Array(500).fill("nuts") }).success,
    ).toBe(false);
    expect(
      IntakeSchema.safeParse({ ...validIntake, location: "y".repeat(5_000) }).success,
    ).toBe(false);
  });

  it("enforces the age gate server-side", () => {
    expect(IntakeSchema.safeParse({ ...validIntake, age: 14 }).success).toBe(false);
    expect(IntakeSchema.safeParse({ ...validIntake, age: 16 }).success).toBe(true);
  });

  it("rejects unknown keys rather than forwarding them into a prompt", () => {
    expect(
      IntakeSchema.safeParse({ ...validIntake, ignorePreviousInstructions: "hi" }).success,
    ).toBe(false);
  });
});

