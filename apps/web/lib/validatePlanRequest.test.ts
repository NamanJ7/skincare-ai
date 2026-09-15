import { describe, expect, it } from "vitest";

import type { IntakeResponse } from "@pore/shared";
import { MAX_IMAGE_BYTES, validatePlanRequest } from "./validatePlanRequest";

/** A base64 string of a given character length, correctly padded. */
function b64(chars: number): string {
  const body = "A".repeat(Math.max(0, chars - (chars % 4)));
  return body.length === 0 ? "AAAA" : body;
}

function intake(over: Partial<IntakeResponse> = {}): IntakeResponse {
  return {
    age: 22,
    goals: ["acne"],
    skinType: "combination",
    sensitivity: "medium",
    currentProducts: [],
    allergies: [],
    budget: "medium",
    fragrancePreference: "no_preference",
    pregnancyOrBreastfeeding: false,
    skinTone: "medium",
    darkMarkProne: false,
    climate: "temperate",
    ...over,
  };
}

function image(over: Record<string, unknown> = {}) {
  return { data: b64(64), mediaType: "image/jpeg", ...over };
}

function body(over: Record<string, unknown> = {}) {
  return { images: [image()], intake: intake(), ...over };
}

describe("accepts a real request", () => {
  it("passes a well-formed body through", () => {
    const r = validatePlanRequest(body());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.input.images).toHaveLength(1);
      expect(r.input.intake.age).toBe(22);
    }
  });

  it("keeps client-measured quality when it parses", () => {
    const quality = { angle: "front", score: 0.9, flags: [], illuminant: "screen_flash" };
    const r = validatePlanRequest(body({ images: [image({ quality })] }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.input.images[0]!.quality?.angle).toBe("front");
  });
});

describe("the amplification case", () => {
  it("rejects an unknown intake field carrying megabytes of text", () => {
    // This is the whole reason this module exists. Unvalidated, this field was
    // JSON.stringify'd into BOTH Opus calls — the caller choosing our token bill.
    const huge = "x".repeat(5 * 1024 * 1024);
    const r = validatePlanRequest(body({ intake: { ...intake(), notes: huge } }));
    expect(r.ok).toBe(false);
  });

  it("rejects an intake that is a bare string, number or array", () => {
    for (const bad of ["hello", 42, [1, 2, 3]]) {
      expect(validatePlanRequest(body({ intake: bad })).ok).toBe(false);
    }
  });

  it("caps arrays at the size of the domain", () => {
    const tooMany = Array.from({ length: 40 }, () => "niacinamide");
    expect(validatePlanRequest(body({ intake: intake({ allergies: tooMany }) })).ok).toBe(false);
  });

  it("caps the one free-text field", () => {
    const r = validatePlanRequest(body({ intake: intake({ location: "x".repeat(5000) }) }));
    expect(r.ok).toBe(false);
  });
});

describe("intake bounds", () => {
  it("rejects a missing intake", () => {
    expect(validatePlanRequest({ images: [image()] }).ok).toBe(false);
  });

  it("does not take the client's word on the age gate", () => {
    expect(validatePlanRequest(body({ intake: intake({ age: 4 }) })).ok).toBe(false);
    expect(validatePlanRequest(body({ intake: intake({ age: 15 }) })).ok).toBe(false);
    expect(validatePlanRequest(body({ intake: intake({ age: 16 }) })).ok).toBe(true);
  });

  it("rejects values outside the domain enums", () => {
    expect(validatePlanRequest(body({ intake: intake({ goals: ["nope"] as never }) })).ok).toBe(false);
    expect(validatePlanRequest(body({ intake: intake({ skinType: "purple" as never }) })).ok).toBe(false);
  });

  it("rejects a non-integer age", () => {
    expect(validatePlanRequest(body({ intake: intake({ age: 22.5 }) })).ok).toBe(false);
  });
});

describe("images", () => {
  it("rejects an empty array, which used to fire both Opus calls on no photo", () => {
    const r = validatePlanRequest(body({ images: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/at least one image/i);
  });

  it("rejects more than three", () => {
    expect(validatePlanRequest(body({ images: [image(), image(), image(), image()] })).ok).toBe(false);
  });

  it("rejects a data: URI prefix", () => {
    expect(validatePlanRequest(body({ images: [image({ data: "data:image/png;base64,AAAA" })] })).ok).toBe(false);
  });

  it("rejects data that is not base64", () => {
    for (const bad of ["not base64!!", "AAA", "AA=A"]) {
      expect(validatePlanRequest(body({ images: [image({ data: bad })] })).ok).toBe(false);
    }
  });

  it("rejects an image over the limit before allocating it", () => {
    const tooBig = b64(Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 8);
    const r = validatePlanRequest(body({ images: [image({ data: tooBig })] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/limit/i);
  });

  it("requires mediaType rather than assuming JPEG", () => {
    const { mediaType: _drop, ...noType } = image();
    void _drop;
    expect(validatePlanRequest(body({ images: [noType] })).ok).toBe(false);
  });

  it("rejects a media type outside the allowlist", () => {
    expect(validatePlanRequest(body({ images: [image({ mediaType: "image/svg+xml" })] })).ok).toBe(false);
  });

  it("rejects malformed quality rather than trusting it", () => {
    expect(validatePlanRequest(body({ images: [image({ quality: { angle: "sideways" } })] })).ok).toBe(false);
  });

  it("rejects a non-array images field", () => {
    expect(validatePlanRequest(body({ images: "front.jpg" })).ok).toBe(false);
  });
});

describe("error messages", () => {
  it("never echo the caller's input back", () => {
    const marker = "SENTINEL_VALUE_9f2a";
    const cases = [
      body({ intake: { ...intake(), [marker]: marker } }),
      body({ images: [image({ data: `data:${marker}` })] }),
      body({ images: [image({ mediaType: marker })] }),
      body({ intake: intake({ location: marker.repeat(500) }) }),
    ];
    for (const c of cases) {
      const r = validatePlanRequest(c);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).not.toContain(marker);
    }
  });

  it("rejects a non-object body without throwing", () => {
    for (const bad of [null, undefined, "x", 7, []]) {
      expect(validatePlanRequest(bad).ok).toBe(false);
    }
  });
});
