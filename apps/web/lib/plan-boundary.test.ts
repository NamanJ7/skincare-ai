/**
 * The /api/plan trust boundary: what stops an anonymous caller from spending
 * money. TODOS.md flagged this as covered by manual probes only.
 *
 * Not a suite — the assertions on the paid path, and nothing else.
 */
import { describe, expect, it } from "vitest";
import { IntakeSchema } from "./schemas";
import { rateLimit } from "./rate-limit";

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

describe("rateLimit", () => {
  // `now` is injected rather than faked globally: the window is arithmetic, so
  // there is nothing to fake. Each test uses its own key for isolation.
  it("allows the limit and rejects the next request", () => {
    const t = 1_000_000;
    for (let i = 0; i < 5; i++) {
      expect(rateLimit("allow-key", t + i).ok).toBe(true);
    }
    const blocked = rateLimit("allow-key", t + 5);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("releases once the window has passed", () => {
    const t = 2_000_000;
    for (let i = 0; i < 5; i++) rateLimit("release-key", t + i);
    expect(rateLimit("release-key", t + 5).ok).toBe(false);

    // 10 minutes later the window is empty again.
    expect(rateLimit("release-key", t + 10 * 60 * 1000 + 1).ok).toBe(true);
  });

  it("tracks callers independently", () => {
    const t = 3_000_000;
    for (let i = 0; i < 5; i++) rateLimit("caller-a", t + i);
    expect(rateLimit("caller-a", t + 5).ok).toBe(false);
    expect(rateLimit("caller-b", t + 5).ok).toBe(true);
  });
});
