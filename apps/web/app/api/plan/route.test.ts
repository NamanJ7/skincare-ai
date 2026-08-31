import { describe, it, expect, beforeAll } from "vitest";
import type { IntakeResponse } from "@pore/shared";
import { POST } from "./route";

// A dev shell may have this exported for other work — force it off so every
// test in this file runs the deterministic mock pipeline, never a live,
// paid Anthropic call.
beforeAll(() => {
  delete process.env.ANTHROPIC_API_KEY;
});

function intake(overrides: Partial<IntakeResponse> = {}): IntakeResponse {
  return {
    age: 22,
    goals: ["acne"],
    skinType: "combination",
    sensitivity: "low",
    currentProducts: [],
    allergies: [],
    budget: "medium",
    fragrancePreference: "no_preference",
    pregnancyOrBreastfeeding: false,
    skinTone: "medium",
    darkMarkProne: true,
    climate: "temperate",
    ...overrides,
  };
}

function req(body: unknown, raw?: string): Request {
  return new Request("http://localhost/api/plan", {
    method: "POST",
    body: raw ?? JSON.stringify(body),
  });
}

async function postJson(body: unknown, raw?: string) {
  const res = await POST(req(body, raw));
  const json = (await res.json()) as { error?: string; mode?: string };
  return { status: res.status, json };
}

describe("malformed request body", () => {
  it("returns 400 on unparseable JSON", async () => {
    const { status, json } = await postJson(undefined, "not json");
    expect(status).toBe(400);
    expect(json.error).toBe("Invalid JSON body");
  });
});

describe("missing intake", () => {
  it("returns 400 when intake is absent", async () => {
    const { status, json } = await postJson({});
    expect(status).toBe(400);
    expect(json.error).toBe("Missing `intake`");
  });
});

describe("structurally invalid intake", () => {
  it("returns 400 instead of 500 when intake doesn't match the schema", async () => {
    const { status, json } = await postJson({ intake: {} });
    expect(status).toBe(400);
    expect(json.error).toBe("`intake` is malformed");
  });
});

describe("images validation", () => {
  it("rejects images that isn't an array", async () => {
    const { status, json } = await postJson({ intake: intake(), images: "nope" });
    expect(status).toBe(400);
    expect(json.error).toBe("`images` must be an array");
  });

  it("rejects more than 3 images", async () => {
    const four = Array.from({ length: 4 }, () => ({ data: "dGVzdA==" }));
    const { status, json } = await postJson({ intake: intake(), images: four });
    expect(status).toBe(400);
    expect(json.error).toBe("At most 3 images are accepted, got 4");
  });

  it("rejects a non-object image entry", async () => {
    const { status, json } = await postJson({ intake: intake(), images: ["nope"] });
    expect(status).toBe(400);
    expect(json.error).toBe("images[0] must be an object");
  });

  it("rejects an image with missing data", async () => {
    const { status, json } = await postJson({ intake: intake(), images: [{}] });
    expect(status).toBe(400);
    expect(json.error).toBe("images[0].data must be a non-empty base64 string");
  });

  it("rejects a data: URI-prefixed payload", async () => {
    const { status, json } = await postJson({
      intake: intake(),
      images: [{ data: "data:image/jpeg;base64,dGVzdA==" }],
    });
    expect(status).toBe(400);
    expect(json.error).toBe("images[0].data must be raw base64, without a data: URI prefix");
  });

  it("rejects an image over the 8MB decoded-size limit", async () => {
    // Base64 encodes 3 bytes per 4 chars; this decodes to just over 8MB.
    const oversized = "A".repeat(11184811);
    const { status, json } = await postJson({ intake: intake(), images: [{ data: oversized }] });
    expect(status).toBe(400);
    expect(json.error).toBe("images[0] exceeds the 8MB limit");
  });

  it("rejects an unrecognized mediaType", async () => {
    const { status, json } = await postJson({
      intake: intake(),
      images: [{ data: "dGVzdA==", mediaType: "image/tiff" }],
    });
    expect(status).toBe(400);
    expect(json.error).toContain("mediaType must be one of");
  });

  it("rejects a quality object that fails PhotoQualitySchema", async () => {
    const { status, json } = await postJson({
      intake: intake(),
      images: [{ data: "dGVzdA==", quality: { angle: "front" } }],
    });
    expect(status).toBe(400);
    expect(json.error).toBe("images[0].quality is malformed");
  });
});

describe("mock mode success path", () => {
  it("returns mode mock with a routine the safety engine actually ran on", async () => {
    const { status, json } = await postJson({ intake: intake() });
    expect(status).toBe(200);
    expect(json.mode).toBe("mock");
    const body = json as unknown as { routine: { am: { category: string }[] } };
    expect(body.routine.am.some((s) => s.category === "sunscreen")).toBe(true);
  });

  it("accepts a well-formed image with a valid quality object", async () => {
    const { status, json } = await postJson({
      intake: intake(),
      images: [
        {
          data: "dGVzdA==",
          mediaType: "image/jpeg",
          quality: { angle: "front", score: 0.9, flags: [], illuminant: "ambient" },
        },
      ],
    });
    expect(status).toBe(200);
    expect(json.mode).toBe("mock");
  });
});
