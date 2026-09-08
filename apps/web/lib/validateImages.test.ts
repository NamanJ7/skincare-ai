import { describe, expect, it } from "vitest";

import { MAX_IMAGE_BYTES, MAX_IMAGES, validateImages } from "./validateImages";

/** Base64 text long enough to decode past `bytes`. */
const payload = (bytes: number) => "A".repeat(Math.ceil((bytes * 4) / 3) + 4);

const goodQuality = {
  angle: "front",
  score: 0.9,
  flags: [],
  illuminant: "screen_flash",
};

describe("validateImages", () => {
  it("treats a missing images field as a valid photo-less request", () => {
    // The pipeline accepts zero images and reports what it could not see, which
    // is what makes "continue without photos" possible in the app.
    expect(validateImages(undefined)).toEqual({ images: [] });
    expect(validateImages(null)).toEqual({ images: [] });
  });

  it("accepts the three-shot guided capture with measured quality", () => {
    const out = validateImages([
      { data: "abc", mediaType: "image/jpeg", quality: goodQuality },
      { data: "def", mediaType: "image/jpeg" },
      { data: "ghi" },
    ]);
    expect("images" in out && out.images).toHaveLength(3);
    expect("images" in out && out.images[0]?.quality?.angle).toBe("front");
  });

  it("refuses more images than the capture can produce", () => {
    const many = Array.from({ length: MAX_IMAGES + 1 }, () => ({ data: "abc" }));
    const out = validateImages(many);
    expect("error" in out && out.error).toContain(`At most ${MAX_IMAGES}`);
  });

  it("refuses a non-array", () => {
    expect("error" in validateImages("nope")).toBe(true);
    expect("error" in validateImages({ 0: { data: "a" } })).toBe(true);
  });

  it("names the offending index so a client can fix its encoding", () => {
    const out = validateImages([{ data: "abc" }, { data: "" }]);
    expect("error" in out && out.error).toContain("images[1]");
  });

  it("rejects a data: URI rather than sending the prefix to the model", () => {
    const out = validateImages([{ data: "data:image/jpeg;base64,abc" }]);
    expect("error" in out && out.error).toContain("without a data: URI prefix");
  });

  // Checked from the string length before anything is allocated, because
  // allocating first is how a size limit becomes the denial-of-service.
  it("rejects an oversized image", () => {
    const out = validateImages([{ data: payload(MAX_IMAGE_BYTES + 1) }]);
    expect("error" in out && out.error).toContain("MB limit");
  });

  it("accepts one right at the limit", () => {
    const out = validateImages([{ data: "A".repeat(Math.floor((MAX_IMAGE_BYTES * 4) / 3)) }]);
    expect("images" in out).toBe(true);
  });

  it("rejects a media type the model does not take", () => {
    const out = validateImages([{ data: "abc", mediaType: "image/tiff" }]);
    expect("error" in out && out.error).toContain("mediaType must be one of");
  });

  // Quality is measured on the client, so it is parsed rather than believed.
  it("rejects malformed client-measured quality", () => {
    for (const bad of [
      { ...goodQuality, score: 2 },
      { ...goodQuality, illuminant: "sunlight" },
      { ...goodQuality, angle: "behind" },
      { score: 0.5 },
    ]) {
      const out = validateImages([{ data: "abc", quality: bad }]);
      expect("error" in out && out.error).toContain("quality is malformed");
    }
  });

  it("rejects a null or non-object entry", () => {
    expect("error" in validateImages([null])).toBe(true);
    expect("error" in validateImages(["abc"])).toBe(true);
  });
});
